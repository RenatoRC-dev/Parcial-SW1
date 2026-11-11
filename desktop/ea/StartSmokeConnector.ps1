param([Parameter(Mandatory=$true)][uri]$BackendUrl, [Parameter(Mandatory=$true)][string]$ProjectId, [Parameter(Mandatory=$true)][string]$RepositoryPath, [Parameter(Mandatory=$true)][string]$ParentPackageGuid)
# Smoke host passes a disposable test participant credential only in the child environment.
if (-not $env:NEXOCASE_EA_SMOKE_CREDENTIAL) { throw 'Missing disposable smoke identity' }
$secure = ConvertTo-SecureString $env:NEXOCASE_EA_SMOKE_CREDENTIAL -AsPlainText -Force
$env:NEXOCASE_EA_SMOKE_CREDENTIAL = $null
& "$PSScriptRoot/Connect.ps1" -BackendUrl $BackendUrl -ProjectId $ProjectId -RepositoryPath $RepositoryPath -ParentPackageGuid $ParentPackageGuid -ParticipantCredential $secure -Authorize -Once
