param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not (Test-Path -LiteralPath $Directory -PathType Container)) { throw 'Expected an exclusively created smoke directory' }
$automation = Join-Path $PSScriptRoot '../../../../../desktop/ea/Automation.ps1'
. $automation
$repoPath = Join-Path $Directory 'optional-types.eapx'
if (Test-Path -LiteralPath $repoPath) { throw 'Never overwrite a repository' }
$repository = New-Object -ComObject EA.Repository
try {
    if (-not $repository.CreateModel(0, $repoPath, 0) -or -not $repository.OpenFile($repoPath)) { throw 'Cannot create disposable EA repository' }
    $root = $repository.Models.AddNew('Optional types isolated smoke', 'Package'); [void]$root.Update()
    $xml = [IO.File]::ReadAllText((Join-Path $Directory 'nexocase.xmi'))
    $inspection = Import-NexoXmi $repository $root ([guid]::NewGuid().ToString()) $xml
    foreach ($c in $inspection.classes) {
        foreach ($a in $c.attributes) {
            if ($a.name -in @('nombre', 'telefono') -and $a.type -ne '') { throw 'EA invented a type for a typeless attribute' }
            if ($a.name -eq 'correo' -and $a.type -ne 'String') { throw 'Typed control attribute changed' }
        }
    }
    $package = $repository.GetPackageByGuid($inspection.packageGuid)
    $cliente = @($inspection.classes | Where-Object { $_.name -eq 'Cliente' })
    if ($cliente.Count -ne 1) { throw 'Cliente not found exactly once in EA' }
    # Native EA creation, not an XML edit: verifies the reverse direction independently.
    $element = $repository.GetElementByID([int]$cliente[0].id)
    $attribute = $element.Attributes.AddNew('apodo', '')
    $attribute.Type = ''
    if (-not $attribute.Update()) { throw 'Cannot create native typeless EA attribute' }
    $element.Attributes.Refresh()
    $native = Read-NexoPackage $repository $package
    $project = $repository.GetProjectInterface()
    # Official EA XMIType enum xmiEA21=11. No diagrams or profile expansion.
    $result = $project.ExportPackageXMI($project.GUIDtoXML($package.PackageGUID), 11, 0, -1, 1, 0, (Join-Path $Directory 'ea-roundtrip.xmi'))
    if (-not (Test-Path -LiteralPath (Join-Path $Directory 'ea-roundtrip.xmi') -PathType Leaf)) { throw 'EA did not produce XMI' }
    @{ libraryVersion=$repository.LibraryVersion; imported=$inspection; native=$native; nativeAttributeGuid=[string]$attribute.AttributeGUID } | ConvertTo-Json -Depth 15
} finally { $repository.CloseFile(); $repository.Exit() }
