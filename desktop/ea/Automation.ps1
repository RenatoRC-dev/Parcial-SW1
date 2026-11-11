Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Local-only arguments. This module has no remote command or filesystem dispatcher.
function Read-NexoPackage($Repository, $Package, $Seen = @{}, [int]$Depth = 0) {
    if ($Depth -gt 20 -or $Seen.Count -gt 2000) { throw 'Selected package exceeds bounded profile' }
    if ($Seen.ContainsKey("p-$($Package.PackageID)")) { throw 'Cyclic package tree' }
    $Seen["p-$($Package.PackageID)"] = $true
    $classes = @(); $links = @{}; $Package.Elements.Refresh(); $Package.Packages.Refresh()
    $nestedLinks = @(); $unsupported = 0; $diagrams = [int]$Package.Diagrams.Count
    foreach ($element in $Package.Elements) {
        if ($element.Type -ne 'Class') { $unsupported++; continue }
        $attributes = @()
        foreach ($attribute in $element.Attributes) {
            $attributes += @{ name = [string]$attribute.Name; type = [string]$attribute.Type; visibility = [string]$attribute.Visibility }
        }
        $classes += @{ id = [string]$element.ElementID; name = [string]$element.Name; abstract = [string]$element.Abstract; attributes = $attributes; methods = [int]$element.Methods.Count; stereotype = [string]$element.Stereotype }
        foreach ($link in $element.Connectors) {
            if ($Seen.ContainsKey("c-$($link.ConnectorID)")) { continue }
            $Seen["c-$($link.ConnectorID)"] = $true
            $links[[string]$link.ConnectorID] = @{ name = [string]$link.Name; source = [string]$Repository.GetElementByID($link.ClientID).Name; target = [string]$Repository.GetElementByID($link.SupplierID).Name; type = [string]$link.Type; sourceMultiplicity = [string]$link.ClientEnd.Cardinality; targetMultiplicity = [string]$link.SupplierEnd.Cardinality; sourceRole = [string]$link.ClientEnd.Role; targetRole = [string]$link.SupplierEnd.Role; sourceAggregation = [int]$link.ClientEnd.Aggregation; targetAggregation = [int]$link.SupplierEnd.Aggregation }
        }
    }
    foreach ($child in $Package.Packages) {
        $nested = Read-NexoPackage $Repository $child $Seen ($Depth + 1)
        $classes += @($nested.classes)
        $nestedLinks += @($nested.relationships)
        $unsupported += $nested.unsupported.elements; $diagrams += $nested.unsupported.diagrams
    }
    if ($classes.Count -gt 200 -or ($links.Count + $nestedLinks.Count) -gt 400 -or $unsupported -gt 1000) { throw 'Selected package exceeds bounded profile' }
    return @{ classes = @($classes); relationships = @($links.Values) + @($nestedLinks); packageGuid = [string]$Package.PackageGUID; unsupported = @{ elements=$unsupported; diagrams=$diagrams } }
}

function Export-NexoXmi($Repository, $SourcePackage) {
    # Source is selected locally. No remote job can supply a package or path.
    $inspection = Read-NexoPackage $Repository $SourcePackage
    $project = $Repository.GetProjectInterface()
    # EA15 requires a filename. It is generated here, never supplied by a job.
    $folder = Join-Path ([IO.Path]::GetTempPath()) ('NexoCASE-EA-Export-' + [guid]::NewGuid().ToString())
    [void][IO.Directory]::CreateDirectory($folder)
    $file = Join-Path $folder 'modelo.xmi'
    try {
        # xmiEA21=11; no diagram/layout/images or external DTD.
        [void]$project.ExportPackageXMI($project.GUIDtoXML($SourcePackage.PackageGUID), 11, 0, -1, 1, 0, $file)
        if (-not [IO.File]::Exists($file) -or (Get-Item -LiteralPath $file).Length -gt 5242880) { throw 'EA did not produce bounded XMI' }
        $bytes = [IO.File]::ReadAllBytes($file)
        # EA15 writes Windows-1252; let the XML reader honor the declaration,
        # prohibit external entities, then send an honest UTF-8 document to CU06.
        $settings = New-Object Xml.XmlReaderSettings
        $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit; $settings.XmlResolver = $null
        $settings.MaxCharactersInDocument = 5242880
        $stream = New-Object IO.MemoryStream(,$bytes)
        $reader = [Xml.XmlReader]::Create($stream, $settings)
        try {
            $document = New-Object Xml.XmlDocument; $document.XmlResolver = $null; $document.Load($reader)
            if ($document.FirstChild -is [Xml.XmlDeclaration]) { $document.FirstChild.Encoding = 'utf-8' }
            $xml = $document.OuterXml; $bytes = [Text.Encoding]::UTF8.GetBytes($xml)
        } finally { $reader.Dispose(); $stream.Dispose() }
    } finally {
        # Only this function's freshly generated file; no recursive/user cleanup.
        try {
            if ([IO.File]::Exists($file)) { [IO.File]::Delete($file) }
            if ([IO.Directory]::GetFileSystemEntries($folder).Count -eq 0) { [IO.Directory]::Delete($folder) }
        } catch [IO.IOException] { } # EA15 can retain its working-directory handle until Exit().
    }
    if ($bytes.Length -eq 0 -or $bytes.Length -gt 5242880 -or $xml -match '<!DOCTYPE|<!ENTITY' -or $xml -notmatch '<(?:\w+:)?XMI\b') { throw 'Exported XMI is incompatible or exceeds 5 MB' }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
    return @{ inspection=$inspection; xmi=[Convert]::ToBase64String($bytes); sha256=$hash }
}

function Import-NexoXmi($Repository, $Parent, [string]$JobId, [string]$Xml) {
    if ($JobId -notmatch '^[a-fA-F0-9-]{36}$' -or $Xml.Length -gt 5242880 -or $Xml -match '<!DOCTYPE|<!ENTITY') { throw 'Invalid bounded XMI job' }
    # A durable marker is written BEFORE import. A crash requires inspection, never a blind replay.
    $name = "NexoCASE-$JobId"
    $Parent.Packages.Refresh()
    foreach ($existing in $Parent.Packages) {
        if ($existing.Name -eq $name -or $existing.Notes -eq $name) { throw 'RECONCILIATION_REQUIRED: job package already exists; no reimport performed' }
    }
    $isolated = $Parent.Packages.AddNew($name, 'Package')
    $isolated.Notes = $name
    if (-not $isolated.Update()) { throw 'Cannot create isolated package' }
    $Parent.Packages.Refresh()
    $project = $Repository.GetProjectInterface()
    # StripGUID=1 prevents collisions with existing elements. Import only into a NEW package.
    $result = $project.ImportPackageXMI($project.GUIDtoXML($isolated.PackageGUID), $Xml, 0, 1)
    # EA 15.1 returns the imported package GUID; other versions document an empty success result.
    if ($result -match '^\{[0-9A-Fa-f-]{36}\}$') {
        $imported = $Repository.GetPackageByGuid($result)
        if ($imported.PackageID -ne $isolated.PackageID -and $imported.ParentID -ne $isolated.PackageID) { throw 'Imported package escaped isolated destination' }
        $imported.Notes = $name; [void]$imported.Update()
    } elseif (-not [string]::IsNullOrEmpty($result)) { throw 'EA rejected XMI; isolated package retained for inspection' }
    $Repository.RefreshModelView($isolated.PackageID)
    return Read-NexoPackage $Repository ($Repository.GetPackageByID($isolated.PackageID))
}
