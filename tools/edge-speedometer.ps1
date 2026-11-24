# edge-speedometer.ps1 - run Speedometer 3.1 in Edge with the same params, screenshot the score.
param(
    [string]$Url = 'https://browserbench.org/Speedometer3.1/?startAutomatically=true&iterationCount=3&suite=TodoMVC-JavaScript-ES5',
    [string]$Shot = 'G:\Temp\UserTemp\opencode\edge-speedometer.png'
)

$env:LIB = $null
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$profile = 'G:\Temp\UserTemp\opencode\edge-speedprof'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class EdgeCap {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
"@
Add-Type -AssemblyName System.Drawing

Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

$p = Start-Process -PassThru -FilePath $edge -ArgumentList @(
    "--user-data-dir=$profile", '--no-first-run', '--no-default-browser-check',
    '--disable-sync', '--new-window', '--window-size=1220,920', $Url
)

$done = $false
$deadline = [DateTime]::Now.AddSeconds(180)
while ([DateTime]::Now -lt $deadline) {
    $w = Get-Process msedge -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -match 'Results Summary' } | Select-Object -First 1
    if ($w) { $done = $true; break }
    Start-Sleep -Milliseconds 250
}

if (-not $done) { 'no results summary within 180 s'; exit 1 }

Start-Sleep -Seconds 2
$w = Get-Process msedge -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -match 'Results Summary' } | Select-Object -First 1

$fg = [EdgeCap]::GetForegroundWindow()
[EdgeCap]::ShowWindow($fg, 6) | Out-Null
[EdgeCap]::SetWindowPos($w.MainWindowHandle, [IntPtr](-1), 20, 20, 1220, 920, 0x0040) | Out-Null
[EdgeCap]::SetForegroundWindow($w.MainWindowHandle) | Out-Null
Start-Sleep -Seconds 2

$r = New-Object EdgeCap+RECT
[EdgeCap]::GetWindowRect($w.MainWindowHandle, [ref]$r) | Out-Null
$cw = $r.Right - $r.Left
$ch = $r.Bottom - $r.Top
$bmp = New-Object System.Drawing.Bitmap($cw, $ch)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size($cw, $ch)))
$bmp.Save($Shot, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
[EdgeCap]::ShowWindow($fg, 9) | Out-Null

"saved $Shot ${cw}x${ch}"
