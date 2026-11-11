param(
    [Parameter(Mandatory=$true)][uri]$BackendUrl,
    [ValidatePattern('^[A-Za-z0-9_-]{1,160}$')][string]$ProjectId,
    [Parameter(Mandatory=$true)][string]$RepositoryPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^\{[0-9A-Fa-f-]{36}\}$')][string]$ParentPackageGuid,
    [securestring]$ParticipantCredential,
    [securestring]$PairingCode,
    [string]$SourcePackageGuid,
    [System.Threading.CancellationToken]$CancellationToken = [System.Threading.CancellationToken]::None,
    [hashtable]$Status,
    [switch]$Authorize,
    [switch]$Once
)
. "$PSScriptRoot/Automation.ps1"
if ($BackendUrl.UserInfo -or $BackendUrl.Query -or $BackendUrl.Fragment -or ($BackendUrl.Scheme -ne 'https' -and -not ($BackendUrl.Scheme -eq 'http' -and $BackendUrl.IsLoopback))) { throw 'HTTPS required except local loopback' }
if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Leaf) -or [IO.Path]::GetExtension($RepositoryPath) -notin @('.eap', '.eapx', '.qea', '.qeax')) { throw 'Select an existing local EA repository' }
$RepositoryPath = (Resolve-Path -LiteralPath $RepositoryPath).Path
if ($RepositoryPath.StartsWith('\\')) { throw 'Select a local repository, not a network path' }
if ((New-Object IO.DriveInfo([IO.Path]::GetPathRoot($RepositoryPath))).DriveType -eq [IO.DriveType]::Network) { throw 'Mapped network repositories are not allowed' }
function Set-Status([string]$message) { if ($null -ne $Status) { $Status.message = $message } else { Write-Output $message } }
function Get-HttpStatus($failure) {
    $response = $failure.Exception.PSObject.Properties['Response']
    if ($null -eq $response -or $null -eq $response.Value) { return 0 }
    return [int]$response.Value.StatusCode
}
function Is-AuthFailure($failure) { return (Get-HttpStatus $failure) -in @(401,403) }
$repository = New-Object -ComObject EA.Repository
$headers = $null
try {
    if (-not $repository.OpenFile($RepositoryPath)) { throw 'Cannot open the selected EA repository' }
    $parent = $repository.GetPackageByGuid($ParentPackageGuid)
    if ($null -eq $parent) { throw 'Selected destination package not found' }
    "Project: $ProjectId; EA parent: $($parent.Name). Each job creates a NEW isolated package."
    if (-not $Authorize -and (Read-Host 'Authorize this participant/project, local export source and isolated import destination? Type AUTHORIZE') -cne 'AUTHORIZE') { throw 'Authorization cancelled' }
    $explicitSource = [bool]$SourcePackageGuid
    if (-not $SourcePackageGuid) { $SourcePackageGuid = $ParentPackageGuid }
    $source = $repository.GetPackageByGuid($SourcePackageGuid)
    if ($null -eq $source) { throw 'Selected source package not found' }
    $modern = $null -ne $PairingCode
    if (-not $modern -and -not $ProjectId) { throw 'Project required for legacy pairing' }
    $secure = if ($modern) { $PairingCode } else { $ParticipantCredential }
    if ($null -eq $secure) { $secure = Read-Host 'Participant project credential (never sent to AI)' -AsSecureString }
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $credential = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    if ($credential -notmatch $(if ($modern) { '^[A-Za-z0-9_-]{24}$' } else { '^[A-Za-z0-9_-]{43}$' })) { throw 'Invalid authorization format' }
    $headers = @{}
    if (-not $modern) { $headers.Authorization = "Bearer $credential" }
    $base = $BackendUrl.GetLeftPart([UriPartial]::Authority) + "/api/proyectos/$ProjectId/conector-ea"
    $sha = [Security.Cryptography.SHA256]::Create()
    $sourceScope = if ($modern -or $explicitSource) { $SourcePackageGuid.ToUpperInvariant() + '|' } else { '' }
    $targetId = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($RepositoryPath.ToLowerInvariant() + '|' + $ParentPackageGuid.ToUpperInvariant() + '|' + $sourceScope + $ProjectId)))).Replace('-', '').ToLowerInvariant()
    if (-not (Test-Path -LiteralPath $env:LOCALAPPDATA -PathType Container)) { throw 'Missing user application directory' }
    $state = Join-Path $env:LOCALAPPDATA 'NexoCASE-EA'
    if (-not (Test-Path -LiteralPath $state)) { [void][IO.Directory]::CreateDirectory($state) }
    # Stable UUIDv4 in user-local state, not a remote-supplied device identity.
    $deviceFile = Join-Path $state "$targetId.device"
    if (-not (Test-Path -LiteralPath $deviceFile)) { [IO.File]::WriteAllText($deviceFile, [guid]::NewGuid().ToString()) }
    $deviceId = [guid]::Parse([IO.File]::ReadAllText($deviceFile)).ToString()
    if ($modern) {
        $base = $BackendUrl.GetLeftPart([UriPartial]::Authority) + '/api/conector-ea'
        $pair = Invoke-RestMethod -Uri "$base/canjear" -Method Post -ContentType 'application/json' -Body (@{ codigo=$credential; deviceId=$deviceId; targetId=$targetId; consent=$true } | ConvertTo-Json -Compress) -TimeoutSec 15 -MaximumRedirection 0
        $ProjectId = $pair.projectId
    } else {
        $pair = Invoke-RestMethod -Uri "$base/autorizar" -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ deviceId=$deviceId; targetId=$targetId; consent=$true } | ConvertTo-Json -Compress) -TimeoutSec 15 -MaximumRedirection 0
    }
    $credential = $null
    $journalPrefix = if ($modern) { "$targetId-$ProjectId" } else { $targetId }
    if ($null -ne $Status) { $Status.expires = $pair.expires }
    $headers['X-NexoCASE-Connector'] = $pair.token
    Set-Status 'Connected / Conectado. Authorization: 8 hours. Stop to disconnect.'
    # Deliver pending receipts first. No re-execution of jobs after network failure or process restart.
    foreach ($file in [IO.Directory]::EnumerateFiles($state, "$journalPrefix-*.json")) {
        $body = [IO.File]::ReadAllText($file)
        [void](Invoke-RestMethod -Uri "$base/recibo" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 15 -MaximumRedirection 0)
        [IO.File]::Delete($file)
    }
    while (-not $CancellationToken.IsCancellationRequested -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $pair.expires) {
        try { $response = Invoke-RestMethod -Uri "$base/siguiente" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 15 -MaximumRedirection 0 }
        catch { if (Is-AuthFailure $_) { throw 'Authorization expired/revoked. Generate a new pairing code.' }; Set-Status 'Disconnected / Desconectado; retrying connection, no EA action.'; Start-Sleep -Seconds 2; continue }
        Set-Status 'Connected / Conectado'
        $job = $response.job
        if ($null -eq $job) { Start-Sleep -Seconds 2; continue }
        if (-not $job.PSObject.Properties['direction']) { $job | Add-Member NoteProperty direction 'nexo_to_ea' }
        if ($job.requestId -notmatch '^[0-9A-Fa-f-]{36}$' -or $job.projectId -ne $ProjectId -or $job.targetId -ne $targetId -or $job.expires -le [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or $job.direction -notin @('nexo_to_ea','ea_to_nexo')) { throw 'Invalid scoped/expired job; refused' }
        if ($job.direction -eq 'nexo_to_ea' -and (-not $job.PSObject.Properties['xmi'] -or $job.xmi.Length -gt 6990510)) { throw 'Missing or oversized XMI payload' }
        $journal = Join-Path $state ("$journalPrefix-$($job.requestId).json")
        $receipt = @{ requestId=$job.requestId; status='failed'; code='RECONCILIATION_REQUIRED' }
        # Persist fail-closed receipt before any external write.
        [IO.File]::WriteAllText($journal, ($receipt | ConvertTo-Json -Depth 15 -Compress))
        try {
            if ($job.direction -eq 'ea_to_nexo') {
                Set-Status 'Exporting approved EA package / Exportando paquete aprobado'
                $export = Export-NexoXmi $repository $source
                $receipt = @{ requestId=$job.requestId; status='exported'; xmi=$export.xmi; sha256=$export.sha256; inspection=$export.inspection }
            } elseif (-not $job.direction -or $job.direction -eq 'nexo_to_ea') {
            $bytes = [Convert]::FromBase64String($job.xmi)
            $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
            if ($bytes.Length -gt 5242880 -or $hash -cne $job.sha256) { throw 'Integrity mismatch' }
            $xml = [Text.Encoding]::UTF8.GetString($bytes)
            Set-Status 'Importing isolated package / Importando paquete aislado'
            $inspection = Import-NexoXmi $repository $parent $job.requestId $xml
            $receipt = @{ requestId=$job.requestId; status='verified'; inspection=$inspection }
            } else { throw 'Unsupported job direction' }
        } catch { $receipt = @{ requestId=$job.requestId; status='failed'; code=$(if ($job.direction -eq 'ea_to_nexo') { 'EXPORT_FAILED' } else { 'IMPORT_FAILED' }) }; 'EA import/readback failed; inspect the isolated job package. No success reported.' }
        $body = $receipt | ConvertTo-Json -Depth 15 -Compress
        [IO.File]::WriteAllText($journal, $body)
        # Retry ONLY delivery of this durable receipt, never the COM import.
        $delivered = $false
        while (-not $delivered -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $pair.expires) {
            try {
                $result = Invoke-RestMethod -Uri "$base/recibo" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 15 -MaximumRedirection 0
                Set-Status "Backend outcome / Resultado: $($result.status)"; [IO.File]::Delete($journal); $delivered = $true
            } catch {
                if (Is-AuthFailure $_) { throw 'Authorization expired/revoked; receipt preserved, no replay.' }
                $httpStatus = Get-HttpStatus $_
                if ($httpStatus -ge 400 -and $httpStatus -lt 500) { throw 'Receipt rejected; preserved for reconciliation, no COM replay.' }
                Set-Status 'Receipt pending / Recibo pendiente; no replay.'
                if ($CancellationToken.IsCancellationRequested) { break }; Start-Sleep -Seconds 2
            }
        }
        if ($Once) { break }
    }
} finally {
    if ($null -ne $headers -and $headers.ContainsKey('X-NexoCASE-Connector')) {
        try { [void](Invoke-RestMethod -Uri "$base/revocar" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 5 -MaximumRedirection 0) } catch { }
    }
    $headers = $null
    $repository.CloseFile(); $repository.Exit()
}
