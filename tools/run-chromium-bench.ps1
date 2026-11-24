# run-chromium-bench.ps1 - run Speedometer 3.1 and the local bench page in any Chromium browser.
#
#   powershell -File tools\run-chromium-bench.ps1 -Browser <exe> -ProfileDir <dir> -OutDir <dir>
#
# Produces: <OutDir>\speedometer-<name>.png  and prints the bench-page title.
# The browser's own profile is isolated, so the user's normal browser is untouched.

param(
    [Parameter(Mandatory)][string]$Browser,
    [Parameter(Mandatory)][string]$ProfileDir,
    [string]$OutDir = 'G:\Temp\UserTemp\opencode\chromium-bench',
    [string]$BenchPage = 'file:///G:/Dx/browser/tools/shell-ui/bench.html',
    [string]$SpeedoUrl = 'https://browserbench.org/Speedometer3.1/?startAutomatically=true&iterationCount=10&suite=TodoMVC-JavaScript-ES5',
    [int]$TimeoutSeconds = 240
)

$ErrorActionPreference = 'Stop'
$env:LIB = $null
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

$exeName = [System.IO.Path]::GetFileName($Browser)
$name = [System.IO.Path]::GetFileNameWithoutExtension($Browser)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class RCB {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
}
"@
Add-Type -AssemblyName System.Drawing

function Stop-ProfileInstances {
    Get-CimInstance Win32_Process -Filter "Name = '$exeName'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProfileDir*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
}

function Capture-Window([IntPtr]$Handle, [string]$Path) {
    [RCB]::SetWindowPos($Handle, [IntPtr](-1), 20, 20, 1220, 920, 0x0040) | Out-Null
    Start-Sleep -Seconds 2
    $r = New-Object RCB+RECT
    [RCB]::GetWindowRect($Handle, [ref]$r) | Out-Null
    $cw = $r.Right - $r.Left
    $ch = $r.Bottom - $r.Top
    $bmp = New-Object System.Drawing.Bitmap($cw, $ch)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    $ok = [RCB]::PrintWindow($Handle, $hdc, 2)
    $g.ReleaseHdc($hdc)
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    return "${cw}x${ch} ok=$ok"
}

function Wait-Title([string]$Pattern, [int]$Seconds) {
    $deadline = [DateTime]::Now.AddSeconds($Seconds)
    while ([DateTime]::Now -lt $deadline) {
        $w = Get-Process -ErrorAction SilentlyContinue |
            Where-Object { $_.ProcessName -eq $name -and $_.MainWindowTitle -cmatch $Pattern -and $_.MainWindowHandle -ne 0 } |
            Select-Object -First 1
        if ($w) { return $w }
        Start-Sleep -Milliseconds 250
    }
    return $null
}

# --- Speedometer -------------------------------------------------------------------------
Stop-ProfileInstances
Start-Process -FilePath $Browser -ArgumentList @(
    "--user-data-dir=$ProfileDir", '--no-first-run', '--no-default-browser-check',
    '--disable-sync', '--new-window', '--window-size=1220,920', $SpeedoUrl
) | Out-Null

$w = Wait-Title 'Results Summary' $TimeoutSeconds
if (-not $w) { "speedometer: NO RESULT within $TimeoutSeconds s" }
else {
    $shot = Join-Path $OutDir "speedometer-$name.png"
    $info = Capture-Window $w.MainWindowHandle $shot
    "speedometer: $shot $info"
}

# --- micro suite -------------------------------------------------------------------------
Stop-ProfileInstances
Start-Process -FilePath $Browser -ArgumentList @(
    "--user-data-dir=$ProfileDir", '--no-first-run', '--no-default-browser-check',
    '--disable-sync', '--new-window', '--window-size=1200,880', $BenchPage
) | Out-Null

$w = Wait-Title '^BENCH [0-9]' 120
if (-not $w) { 'benchpage: NO RESULT' }
else { 'benchpage: ' + ($w.MainWindowTitle -replace ' - .*$', '') }

Stop-ProfileInstances
