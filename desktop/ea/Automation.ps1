Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Local-only arguments. This module has no remote command or filesystem dispatcher.
function Read-NexoPackage($Repository, $Package) {
    $classes = @(); $links = @{}; $Package.Elements.Refresh(); $Package.Packages.Refresh()
    foreach ($element in $Package.Elements) {
        if ($element.Type -ne 'Class') { continue }
        $attributes = @()
        foreach ($attribute in $element.Attributes) {
            $attributes += @{ name = [string]$attribute.Name; type = [string]$attribute.Type; visibility = [string]$attribute.Visibility }
        }
        $classes += @{ id = [string]$element.ElementID; name = [string]$element.Name; abstract = [string]$element.Abstract; attributes = $attributes; methods = [int]$element.Methods.Count; stereotype = [string]$element.Stereotype }
        foreach ($link in $element.Connectors) {
            $links[[string]$link.ConnectorID] = @{ name = [string]$link.Name; source = [string]$Repository.GetElementByID($link.ClientID).Name; target = [string]$Repository.GetElementByID($link.SupplierID).Name; type = [string]$link.Type; sourceMultiplicity = [string]$link.ClientEnd.Cardinality; targetMultiplicity = [string]$link.SupplierEnd.Cardinality; sourceRole = [string]$link.ClientEnd.Role; targetRole = [string]$link.SupplierEnd.Role; sourceAggregation = [int]$link.ClientEnd.Aggregation; targetAggregation = [int]$link.SupplierEnd.Aggregation }
        }
    }
    foreach ($child in $Package.Packages) {
        $nested = Read-NexoPackage $Repository $child
        $classes += @($nested.classes)
        foreach ($link in $nested.relationships) { $links[($link | ConvertTo-Json -Compress)] = $link }
    }
    return @{ classes = @($classes); relationships = @($links.Values); packageGuid = [string]$Package.PackageGUID }
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
