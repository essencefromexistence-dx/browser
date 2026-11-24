# edge-speedometer2.ps1 - run Speedometer 3.1 in Edge (isolated profile), capture score via PrintWindow.
param(
    [string]$Url = 'https://browserbench.org/Speedometer3.1/?startAutomatically=true&iterationCount=10&suite=TodoMVC-JavaScript-ES5',
    [string]$Shot = 'G:\Temp\UserTemp\opencode\edge-speedometer10.png'
)

$env:LIB = $null
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$profile = 'G:\Temp\UserTemp\opencode\edge-speedprof'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class E2 {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
}
"@
Add-Type -AssemblyName System.Drawing

# only stop the instances that belong to the isolated benchmark profile
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" |
    Where-Object { $_.CommandLine -like "*$profile*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

$p = Start-Process -PassThru -FilePath $edge -ArgumentList @(
    "--user-data-dir=$profile", '--no-first-run', '--no-default-browser-check',
    '--disable-sync', '--new-window', '--window-size=1220,920', $Url
)

$done = $false
$deadline = [DateTime]::Now.AddSeconds(180)
while ([DateTime]::Now -lt $deadline) {
    $w = Get-Process msedge -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -match 'Results Summary' -and $_.MainWindowHandle -ne 0 } |
        Select-Object -First 1
    if ($w) { $done = $true; break }
    Start-Sleep -Milliseconds 250
}
if (-not $done) { 'no results summary within 180 s'; exit 1 }

Start-Sleep -Seconds 2
$h = $w.MainWindowHandle
[E2]::SetWindowPos($h, [IntPtr](-1), 20, 20, 1220, 920, 0x0040) | Out-Null
Start-Sleep -Seconds 2

$r = New-Object E2+RECT
[E2]::GetWindowRect($h, [ref]$r) | Out-Null
$cw = $r.Right - $r.Left
$ch = $r.Bottom - $r.Top
$bmp = New-Object System.Drawing.Bitmap($cw, $ch)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [E2]::PrintWindow($h, $hdc, 2)
$g.ReleaseHdc($hdc)
$bmp.Save($Shot, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

"saved $Shot ${cw}x${ch} ok=$ok title=$($w.MainWindowTitle)"
