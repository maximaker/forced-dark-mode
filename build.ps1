# Packages the extension for the Chrome Web Store: dist/forced-dark-mode-<version>.zip
# Writes zip entries with forward slashes (Windows PowerShell's Compress-Archive uses
# backslashes, which the Web Store can reject).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$version = (Get-Content manifest.json -Raw | ConvertFrom-Json).version
$files = @("manifest.json", "background.js", "content.js", "sun.js", "popup.html", "popup.css", "popup.js",
           "icons/16.png", "icons/32.png", "icons/48.png", "icons/128.png")

New-Item -ItemType Directory -Force dist | Out-Null
$zipPath = Join-Path $PSScriptRoot "dist/forced-dark-mode-$version.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, "Create")
try {
  foreach ($f in $files) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $PSScriptRoot $f), $f) | Out-Null
  }
} finally { $zip.Dispose() }
Write-Host "Built $zipPath"
