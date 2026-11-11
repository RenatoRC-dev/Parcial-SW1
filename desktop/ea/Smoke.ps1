param([string]$XmiPath, [switch]$PrepareOnly, [string]$ExportPath, [string]$TemporaryDirectory = (Join-Path ([IO.Path]::GetTempPath()) 'opencode'))
. "$PSScriptRoot/Automation.ps1"
$parent = $TemporaryDirectory
if (-not (Test-Path -LiteralPath $parent)) { throw 'Missing approved temporary directory' }
$path = Join-Path $parent ("nexocase-ea-" + [guid]::NewGuid().ToString() + '.eapx')
$repository = New-Object -ComObject EA.Repository
try {
    if (-not $repository.CreateModel(0, $path, 0)) { throw 'CreateModel failed' }
    if (-not $repository.OpenFile($path)) { throw 'OpenFile failed' }
    $root = $repository.Models.AddNew('NexoCASE safe smoke', 'Package'); [void]$root.Update()
    if ($PrepareOnly) {
        @{ testRepository=$path; parentPackageGuid=[string]$root.PackageGUID } | ConvertTo-Json -Compress
        return
    }
    if (-not $XmiPath) { throw 'Select a NexoCASE-generated XMI' }
    $xml = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $XmiPath))
    $inspection = Import-NexoXmi $repository $root ([guid]::NewGuid().ToString()) $xml
    if ($ExportPath) {
        $approved = [IO.Path]::GetFullPath($TemporaryDirectory).TrimEnd('\') + '\'
        $destination = [IO.Path]::GetFullPath($ExportPath)
        if (-not $destination.StartsWith($approved, [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $destination)) { throw 'Export evidence must be a new file in the approved temporary directory' }
        $exported = Export-NexoXmi $repository ($repository.GetPackageByGuid($inspection.packageGuid))
        [IO.File]::WriteAllBytes($destination, [Convert]::FromBase64String($exported.xmi))
    }
    @{ libraryVersion = $repository.LibraryVersion; testRepository = $path; parentPackageGuid = [string]$root.PackageGUID; packageGuid = $inspection.packageGuid; classes = $inspection.classes.Count; attributes = @($inspection.classes | ForEach-Object { $_.attributes }).Count; relationships = $inspection.relationships.Count; exported = [bool]$ExportPath } | ConvertTo-Json -Depth 4
} finally { $repository.CloseFile(); $repository.Exit() }
