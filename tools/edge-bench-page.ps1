# edge-bench-page.ps1 - run tools/shell-ui/bench.html in Edge (visible) and read the title.
param([int]$Runs = 3, [string]$Url = 'file:///G:/Dx/browser/tools/shell-ui/bench.html')

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$out = @()

for ($i = 1; $i -le $Runs; $i++) {
    $profile = "G:\Temp\UserTemp\opencode\edge-pageprof"
    $p = Start-Process -PassThru -FilePath $edge -ArgumentList @(
        "--user-data-dir=$profile", '--no-first-run', '--no-default-browser-check',
        '--disable-sync', '--new-window', '--window-size=1200,880', $Url
    )
    $title = $null
    $deadline = [DateTime]::Now.AddSeconds(45)
    while ([DateTime]::Now -lt $deadline) {
        $w = Get-Process msedge -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowTitle -cmatch '^BENCH [0-9]' } | Select-Object -First 1
        if ($w) { $title = $w.MainWindowTitle; break }
        Start-Sleep -Milliseconds 100
    }
    $out += $(if ($title) { $title } else { 'NO RESULT' })
    Get-Process msedge -ErrorAction SilentlyContinue |
        Where-Object { $_.StartTime -ge $p.StartTime.AddSeconds(-2) } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

$out
