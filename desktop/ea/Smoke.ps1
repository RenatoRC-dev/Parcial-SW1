param([string]$XmiPath, [switch]$PrepareOnly, [string]$TemporaryDirectory = (Join-Path ([IO.Path]::GetTempPath()) 'opencode'))
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
    @{ libraryVersion = $repository.LibraryVersion; testRepository = $path; inspection = $inspection } | ConvertTo-Json -Depth 15
} finally { $repository.CloseFile(); $repository.Exit() }
