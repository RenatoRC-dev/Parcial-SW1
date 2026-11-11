. "$PSScriptRoot/Automation.ps1"
# Deterministic Windows tests: no EA, Pester, network or filesystem dependency.
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Collection { $a = New-Object Collections.ArrayList; Add-Member -InputObject $a ScriptMethod Refresh { }; return ,$a }
$script:imports = 0
$script:reply = ''
$script:child = [pscustomobject]@{ Name=''; Notes=''; PackageID=2; ParentID=1; PackageGUID='{11111111-1111-4111-8111-111111111111}'; Elements=(Collection); Packages=(Collection); Diagrams=(Collection) }
$script:child | Add-Member ScriptMethod Update { return $true }
$parent = [pscustomobject]@{ PackageID=1; Packages=(Collection) }
Add-Member -InputObject $parent.Packages ScriptMethod AddNew { param($name,$type) $script:child.Name=$name; [void]$this.Add($script:child); return $script:child }
$project = [pscustomobject]@{}
$project | Add-Member ScriptMethod GUIDtoXML { param($guid) return $guid }
$project | Add-Member ScriptMethod ImportPackageXMI { param($guid,$xml,$diagrams,$strip) Assert ($strip -eq 1 -and $diagrams -eq 0) 'Unsafe import flags'; $script:imports++; return $script:reply }
$repository = [pscustomobject]@{ Project=$project }
$repository | Add-Member ScriptMethod GetProjectInterface { return $this.Project }
$repository | Add-Member ScriptMethod RefreshModelView { param($id) }
$repository | Add-Member ScriptMethod GetPackageByID { param($id) return $script:child }
$repository | Add-Member ScriptMethod GetPackageByGuid { param($id) return $script:child }
$id = [guid]::NewGuid().ToString()
$readback = Import-NexoXmi $repository $parent $id '<xmi:XMI/>'
Assert ($script:imports -eq 1 -and $readback.classes.Count -eq 0) 'Must import then inspect even empty models'
try { [void](Import-NexoXmi $repository $parent $id '<xmi:XMI/>'); throw 'Duplicate accepted' } catch { Assert ($_.Exception.Message -match 'RECONCILIATION_REQUIRED') 'Duplicate must fail closed' }
Assert ($script:imports -eq 1) 'Duplicate job must not call COM again'
try { [void](Import-NexoXmi $repository $parent 'bad-id' '<xmi:XMI/>'); throw 'Bad ID accepted' } catch { Assert ($_.Exception.Message -match 'Invalid bounded') 'Invalid id must reject' }
try { [void](Import-NexoXmi $repository $parent ([guid]::NewGuid().ToString()) '<!DOCTYPE unsafe>'); throw 'DTD accepted' } catch { Assert ($_.Exception.Message -match 'Invalid bounded') 'DTD must reject' }
$parent.Packages.Clear(); $script:reply = 'Incompatible XMI'
try { [void](Import-NexoXmi $repository $parent ([guid]::NewGuid().ToString()) '<xmi:XMI/>'); throw 'Bad XMI accepted' } catch { Assert ($_.Exception.Message -match 'EA rejected') 'COM import failure must reject' }
$parent.Packages.Clear(); $script:reply = $script:child.PackageGUID
$readback = Import-NexoXmi $repository $parent ([guid]::NewGuid().ToString()) '<xmi:XMI/>'
Assert ($readback.packageGuid -eq $script:child.PackageGUID) 'EA15 GUID response requires repository inspection'
$parent.Packages.Clear(); $script:child.PackageID = 99; $script:child.ParentID = 999
# GetPackageByGuid must return a different package to simulate escape.
$repository | Add-Member -Force ScriptMethod GetPackageByGuid { param($id) return [pscustomobject]@{ PackageID=7; ParentID=999 } }
try { [void](Import-NexoXmi $repository $parent ([guid]::NewGuid().ToString()) '<xmi:XMI/>'); throw 'Escaped package accepted' } catch { Assert ($_.Exception.Message -match 'escaped') 'Escaped destination must reject' }
'PASS: 7 deterministic Windows Automation scenarios (empty readback, duplicate, ID, DTD, incompatible XMI, EA15 GUID, containment).'
$script:exportPayload = '<?xml version="1.0" encoding="windows-1252"?><xmi:XMI xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"><name>Préstamo</name></xmi:XMI>'
$project | Add-Member ScriptMethod ExportPackageXMI {
    param($guid,$type,$diagrams,$image,$format,$dtd,$file)
    Assert ($type -eq 11 -and $diagrams -eq 0 -and $dtd -eq 0 -and $file) 'Export must use bounded EA21 file without diagrams/DTD'
    [IO.File]::WriteAllText($file,$script:exportPayload,[Text.Encoding]::GetEncoding(1252))
    return ''
}
$export = Export-NexoXmi $repository $script:child
$xml = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($export.xmi))
Assert ($xml -match 'Préstamo' -and $xml -match 'encoding="utf-8"') 'Windows-1252 must normalize without losing accents'
$script:exportPayload = '<!DOCTYPE x [<!ENTITY bad "unsafe">]><xmi:XMI/>'
try { [void](Export-NexoXmi $repository $script:child); throw 'DTD export accepted' } catch { Assert ($_.Exception.Message -notmatch '^DTD export accepted$') 'Export must reject DTD' }
$script:exportPayload = '<broken>'
try { [void](Export-NexoXmi $repository $script:child); throw 'Malformed export accepted' } catch { Assert ($_.Exception.Message -notmatch '^Malformed export accepted$') 'Malformed export must reject' }
'PASS: 3 reverse export scenarios (EA21 flags + encoding, DTD, malformed).'
