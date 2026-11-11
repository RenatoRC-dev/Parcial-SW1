param(
    [Parameter(Mandatory=$true)][uri]$BackendUrl,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_-]{1,160}$')][string]$ProjectId,
    [Parameter(Mandatory=$true)][string]$RepositoryPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^\{[0-9A-Fa-f-]{36}\}$')][string]$ParentPackageGuid,
    [securestring]$ParticipantCredential,
    [switch]$Authorize,
    [switch]$Once
)
. "$PSScriptRoot/Automation.ps1"
if ($BackendUrl.UserInfo -or $BackendUrl.Query -or $BackendUrl.Fragment -or ($BackendUrl.Scheme -ne 'https' -and -not ($BackendUrl.Scheme -eq 'http' -and $BackendUrl.IsLoopback))) { throw 'HTTPS required except local loopback' }
if (-not (Test-Path -LiteralPath $RepositoryPath -PathType Leaf) -or [IO.Path]::GetExtension($RepositoryPath) -notin @('.eap', '.eapx', '.qea', '.qeax')) { throw 'Select an existing local EA repository' }
$RepositoryPath = (Resolve-Path -LiteralPath $RepositoryPath).Path
if ($RepositoryPath.StartsWith('\\')) { throw 'Select a local repository, not a network path' }
$repository = New-Object -ComObject EA.Repository
$headers = $null
try {
    if (-not $repository.OpenFile($RepositoryPath)) { throw 'Cannot open the selected EA repository' }
    $parent = $repository.GetPackageByGuid($ParentPackageGuid)
    if ($null -eq $parent) { throw 'Selected destination package not found' }
    "Project: $ProjectId; EA parent: $($parent.Name). Each job creates a NEW isolated package."
    if (-not $Authorize -and (Read-Host 'Authorize this participant/project and local destination? Type AUTHORIZE') -cne 'AUTHORIZE') { throw 'Authorization cancelled' }
    $secure = $ParticipantCredential
    if ($null -eq $secure) { $secure = Read-Host 'Participant project credential (never sent to AI)' -AsSecureString }
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $credential = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    if ($credential -notmatch '^[A-Za-z0-9_-]{43}$') { throw 'Invalid credential format' }
    $headers = @{ Authorization = "Bearer $credential" }
    $credential = $null
    $base = $BackendUrl.GetLeftPart([UriPartial]::Authority) + "/api/proyectos/$ProjectId/conector-ea"
    $sha = [Security.Cryptography.SHA256]::Create()
    $targetId = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($RepositoryPath.ToLowerInvariant() + '|' + $ParentPackageGuid.ToUpperInvariant() + '|' + $ProjectId)))).Replace('-', '').ToLowerInvariant()
    if (-not (Test-Path -LiteralPath $env:LOCALAPPDATA -PathType Container)) { throw 'Missing user application directory' }
    $state = Join-Path $env:LOCALAPPDATA 'NexoCASE-EA'
    if (-not (Test-Path -LiteralPath $state)) { [void][IO.Directory]::CreateDirectory($state) }
    # Stable UUIDv4 in user-local state, not a remote-supplied device identity.
    $deviceFile = Join-Path $state "$targetId.device"
    if (-not (Test-Path -LiteralPath $deviceFile)) { [IO.File]::WriteAllText($deviceFile, [guid]::NewGuid().ToString()) }
    $deviceId = [guid]::Parse([IO.File]::ReadAllText($deviceFile)).ToString()
    $pair = Invoke-RestMethod -Uri "$base/autorizar" -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ deviceId=$deviceId; targetId=$targetId; consent=$true } | ConvertTo-Json -Compress) -TimeoutSec 15 -MaximumRedirection 0
    $headers['X-NexoCASE-Connector'] = $pair.token
    'Authorized. Keep this foreground connector running. Ctrl+C disconnects. Authorization expires after eight hours.'
    # Deliver pending receipts first. No re-execution of jobs after network failure or process restart.
    foreach ($file in [IO.Directory]::EnumerateFiles($state, "$targetId-*.json")) {
        $body = [IO.File]::ReadAllText($file)
        [void](Invoke-RestMethod -Uri "$base/recibo" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 15 -MaximumRedirection 0)
        [IO.File]::Delete($file)
    }
    while ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $pair.expires) {
        try { $response = Invoke-RestMethod -Uri "$base/siguiente" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 15 -MaximumRedirection 0 }
        catch { 'Connection unavailable or authorization expired; no EA operation started.'; Start-Sleep -Seconds 5; continue }
        $job = $response.job
        if ($null -eq $job) { Start-Sleep -Seconds 2; continue }
        if ($job.requestId -notmatch '^[0-9A-Fa-f-]{36}$' -or $job.projectId -ne $ProjectId -or $job.targetId -ne $targetId -or $job.expires -le [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or $job.xmi.Length -gt 6990510) { throw 'Invalid scoped/expired job; refused' }
        $journal = Join-Path $state ("$targetId-$($job.requestId).json")
        $receipt = @{ requestId=$job.requestId; status='failed'; code='RECONCILIATION_REQUIRED' }
        # Persist fail-closed receipt before any external write.
        [IO.File]::WriteAllText($journal, ($receipt | ConvertTo-Json -Depth 15 -Compress))
        try {
            $bytes = [Convert]::FromBase64String($job.xmi)
            $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
            if ($bytes.Length -gt 5242880 -or $hash -cne $job.sha256) { throw 'Integrity mismatch' }
            $xml = [Text.Encoding]::UTF8.GetString($bytes)
            'Importing isolated package and inspecting EA repository...'
            $inspection = Import-NexoXmi $repository $parent $job.requestId $xml
            $receipt = @{ requestId=$job.requestId; status='verified'; inspection=$inspection }
        } catch { $receipt = @{ requestId=$job.requestId; status='failed'; code='IMPORT_FAILED' }; 'EA import/readback failed; inspect the isolated job package. No success reported.' }
        $body = $receipt | ConvertTo-Json -Depth 15 -Compress
        [IO.File]::WriteAllText($journal, $body)
        # Retry ONLY delivery of this durable receipt, never the COM import.
        $delivered = $false
        while (-not $delivered -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $pair.expires) {
            try {
                $result = Invoke-RestMethod -Uri "$base/recibo" -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 15 -MaximumRedirection 0
                "Backend outcome: $($result.status)"; [IO.File]::Delete($journal); $delivered = $true
            } catch { 'Receipt pending; no reimport. Retrying delivery.'; Start-Sleep -Seconds 5 }
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
