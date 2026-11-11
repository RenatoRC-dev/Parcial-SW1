# User-level Windows UI. No elevation, execution-policy bypass, tokens on disk or shell commands from jobs.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object Windows.Forms.Form
$form.Text = 'NexoCASE - Enterprise Architect'; $form.Size = New-Object Drawing.Size(660,590)
$form.MinimumSize = $form.Size; $form.StartPosition = 'CenterScreen'; $form.AutoScroll = $true
function Label($text,$y) { $c=New-Object Windows.Forms.Label; $c.Text=$text; $c.SetBounds(18,$y,600,24); $form.Controls.Add($c) }
function Input($y) { $c=New-Object Windows.Forms.TextBox; $c.SetBounds(18,$y,600,26); $c.Anchor='Top,Left,Right'; $form.Controls.Add($c); return $c }
Label 'Backend URL (HTTPS, or local http://localhost:3001)' 16
$url=Input 42; $url.Text='http://localhost:3001'
Label 'Codigo temporal / One-use pairing code (from NexoCASE assistant)' 77
$code=Input 103; $code.UseSystemPasswordChar=$true
Label 'Repositorio local / Local EA repository (.eapx, .qea)' 139
$path=Input 165; $path.ReadOnly=$true; $path.Width=470
$browse=New-Object Windows.Forms.Button; $browse.Text='Elegir / Browse'; $browse.SetBounds(496,163,124,30); $form.Controls.Add($browse)
Label 'Destino / Destination: each import creates a NEW isolated package' 202
$destination=New-Object Windows.Forms.ComboBox; $destination.SetBounds(18,228,600,26); $destination.DropDownStyle='DropDownList'; $destination.DisplayMember='Name'; $form.Controls.Add($destination)
Label 'Origen / Source: locally approved package to export to NexoCASE' 264
$source=New-Object Windows.Forms.ComboBox; $source.SetBounds(18,290,600,26); $source.DropDownStyle='DropDownList'; $source.DisplayMember='Name'; $form.Controls.Add($source)
$consent=New-Object Windows.Forms.CheckBox; $consent.Text='Autorizo ambos sentidos / I authorize both directions for this project'; $consent.SetBounds(18,330,600,30); $form.Controls.Add($consent)
$start=New-Object Windows.Forms.Button; $start.Text='Conectar / Connect'; $start.SetBounds(18,372,190,36); $form.Controls.Add($start)
$stop=New-Object Windows.Forms.Button; $stop.Text='Detener / Stop'; $stop.SetBounds(222,372,170,36); $stop.Enabled=$false; $form.Controls.Add($stop)
$status=New-Object Windows.Forms.Label; $status.Text='Sin configurar / Not configured. EA with a usable license is required.'; $status.SetBounds(18,426,600,80); $form.Controls.Add($status)
try {
    if ($null -eq [type]::GetTypeFromProgID('EA.Repository')) { throw 'EA COM missing' }
    $status.Text='EA COM registrado / registered. Select a repository; opening it checks your EA license.'
} catch {
    $status.Text='EA COM no disponible / unavailable. Install or repair EA locally, accept its license, then reopen this connector.'
    $browse.Enabled=$false; $start.Enabled=$false
}
$script:worker=$null; $script:handle=$null; $script:cancel=$null; $script:shared=$null; $script:closing=$false
$browse.Add_Click({
    $dialog=New-Object Windows.Forms.OpenFileDialog
    $dialog.Filter='EA repositories|*.eap;*.eapx;*.qea;*.qeax'; $dialog.CheckFileExists=$true
    if ($dialog.ShowDialog() -ne 'OK') { return }
    $repo=$null
    try {
        if ($dialog.FileName.StartsWith('\\')) { throw 'Only local repositories are allowed' }
        if ((New-Object IO.DriveInfo([IO.Path]::GetPathRoot($dialog.FileName))).DriveType -eq [IO.DriveType]::Network) { throw 'Mapped network repositories are not allowed' }
        $repo=New-Object -ComObject EA.Repository
        if (-not $repo.OpenFile($dialog.FileName)) { throw 'Cannot open repository' }
        $destination.Items.Clear(); $source.Items.Clear()
        $script:packages=0
        function Add-Packages($collection,$prefix,$depth) {
            if ($depth -gt 20) { throw 'Package tree exceeds supported depth' }
            foreach ($p in $collection) {
                if (++$script:packages -gt 2000) { throw 'Too many packages; select a smaller repository' }
                $item=[pscustomobject]@{ Name="$prefix$($p.Name)"; Guid=$p.PackageGUID }
                [void]$destination.Items.Add($item); [void]$source.Items.Add($item)
                Add-Packages $p.Packages "$prefix$($p.Name) / " ($depth+1)
            }
        }
        Add-Packages $repo.Models '' 0
        if (-not $destination.Items.Count) { throw 'Create a root model package in EA first' }
        $destination.SelectedIndex=0; $source.SelectedIndex=0; $path.Text=$dialog.FileName
        $status.Text="EA COM available (build $($repo.LibraryVersion)). Select source and destination, then connect."
    } catch { $path.Clear(); $destination.Items.Clear(); $source.Items.Clear(); $status.Text='EA unavailable, license not accepted, or repository cannot be opened. Open EA locally and check your selection.' }
    finally { if ($repo) { $repo.CloseFile(); $repo.Exit() }; $dialog.Dispose() }
})
$start.Add_Click({
    if ($script:worker) { return }
    if (-not $consent.Checked -or -not $path.Text -or -not $source.SelectedItem -or $code.Text -notmatch '^[A-Za-z0-9_-]{24}$') { $status.Text='Select local packages, authorize, and enter a fresh pairing code.'; return }
    try {
        $backend=[uri]$url.Text
        if (-not $backend.IsAbsoluteUri -or $backend.UserInfo -or $backend.Query -or $backend.Fragment -or ($backend.Scheme -ne 'https' -and -not ($backend.Scheme -eq 'http' -and $backend.IsLoopback))) { throw 'Invalid URL' }
        $secure=ConvertTo-SecureString $code.Text -AsPlainText -Force; $code.Clear()
        $script:cancel=New-Object Threading.CancellationTokenSource
        $script:shared=[hashtable]::Synchronized(@{message='Connecting / Conectando'; expires=0})
        $runspace=[runspacefactory]::CreateRunspace(); $runspace.ApartmentState='STA'; $runspace.ThreadOptions='ReuseThread'; $runspace.Open()
        $script:worker=[powershell]::Create(); $script:worker.Runspace=$runspace
        [void]$script:worker.AddCommand((Join-Path $PSScriptRoot 'Connect.ps1')).AddParameter('BackendUrl',$backend).AddParameter('RepositoryPath',$path.Text).AddParameter('ParentPackageGuid',$destination.SelectedItem.Guid).AddParameter('SourcePackageGuid',$source.SelectedItem.Guid).AddParameter('PairingCode',$secure).AddParameter('Authorize',$true).AddParameter('CancellationToken',$script:cancel.Token).AddParameter('Status',$script:shared)
        $script:handle=$script:worker.BeginInvoke()
        $start.Enabled=$false; $browse.Enabled=$false; $stop.Enabled=$true
        foreach ($control in @($url,$code,$source,$destination,$consent)) { $control.Enabled=$false }
    } catch { $status.Text='Unable to start. Check URL, Windows script policy, EA and repository permissions.' }
})
$stop.Add_Click({ if ($script:cancel) { $script:cancel.Cancel(); $status.Text='Stopping safely; any current EA operation must finish first.' } })
$timer=New-Object Windows.Forms.Timer; $timer.Interval=500
$timer.Add_Tick({
    if (-not $script:worker) { return }
    $status.Text=$script:shared.message
    if ($script:shared.expires) { $status.Text+="`r`nExpires / Vence: $([DateTimeOffset]::FromUnixTimeMilliseconds($script:shared.expires).ToLocalTime().ToString('g'))" }
    if ($script:handle.IsCompleted) {
        try { [void]$script:worker.EndInvoke($script:handle); $status.Text='Disconnected / Desconectado. Generate a new code to reconnect.' }
        catch { $status.Text='Connection ended. Check EA license, network and authorization; generate a fresh code. Pending receipts are preserved.' }
        $script:worker.Runspace.Close(); $script:worker.Dispose(); $script:worker=$null; $script:cancel.Dispose()
        $start.Enabled=$true; $browse.Enabled=$true; $stop.Enabled=$false
        foreach ($control in @($url,$code,$source,$destination,$consent)) { $control.Enabled=$true }
        if ($script:closing) { $form.Close() }
    }
})
$form.Add_FormClosing({ param($sender,$eventArgs) if ($script:worker) { $eventArgs.Cancel=$true; $script:closing=$true; $script:cancel.Cancel(); $status.Text='Waiting for current operation to finish safely...' } })
$timer.Start(); [void]$form.ShowDialog(); $timer.Stop(); $timer.Dispose(); $form.Dispose()
