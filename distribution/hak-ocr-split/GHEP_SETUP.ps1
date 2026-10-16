param(
    [string]$InputDirectory = $PSScriptRoot,
    [string]$ManifestPath = (Join-Path $PSScriptRoot 'manifest.json'),
    [string]$OutputDirectory = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { throw "Thieu manifest.json: $ManifestPath" }
$m = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($m.schema -ne 'hak-ocr-windows-split-v1') { throw 'Manifest khong dung dinh dang' }
if ($m.fileName -notmatch '^HAKSmartOCRAI-Setup-[A-Za-z0-9.\-]+\.exe$') { throw 'Ten file EXE khong hop le' }
if ($m.partCount -ne @($m.parts).Count -or $m.partCount -lt 1) { throw 'So luong phan khong hop le' }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$destination = Join-Path $OutputDirectory $m.fileName
if (Test-Path -LiteralPath $destination) { throw "File EXE da ton tai. Hay di chuyen hoac doi ten truoc: $destination" }
$temporary = $destination + '.joining'
if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
$stream = [System.IO.File]::Create($temporary)
try {
    $buffer = New-Object byte[] (1MB)
    foreach ($part in @($m.parts)) {
        if ($part.index -lt 1 -or $part.index -gt $m.partCount) { throw 'Chi so part khong hop le' }
        $partPath = Join-Path $InputDirectory $part.name
        if (-not (Test-Path -LiteralPath $partPath -PathType Leaf)) {
            $archive = Join-Path $InputDirectory ($part.artifactName + '.zip')
            if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
                throw "Thieu $($part.name) hoac $($part.artifactName).zip. Vui long tai day du $($m.partCount) phan."
            }
            # Read just the expected member from the artifact ZIP (no full unzip).
            $zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
            try {
                $entry = $zip.GetEntry($part.name)
                if ($null -eq $entry) { throw "Khong tim thay $($part.name) trong $archive" }
                if ($entry.Length -ne [long]$part.size) { throw "Kich thuoc sai: $($part.name)" }
                $partPath = Join-Path $OutputDirectory ($part.name + '.tmp')
                if (Test-Path -LiteralPath $partPath) { Remove-Item -LiteralPath $partPath -Force }
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $partPath)
            } finally { $zip.Dispose() }
            $deleteAfter = $true
        } else { $deleteAfter = $false }
        try {
            $info = Get-Item -LiteralPath $partPath
            if ($info.Length -ne [long]$part.size) { throw "Kich thuoc sai: $($part.name)" }
            $hash = (Get-FileHash -LiteralPath $partPath -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($hash -ne $part.sha256) { throw "SHA256 khong khop: $($part.name). Hay tai lai phan nay." }
            $partStream = [System.IO.File]::OpenRead($partPath)
            try {
                while ($true) {
                    $read = $partStream.Read($buffer, 0, $buffer.Length)
                    if ($read -eq 0) { break }
                    $stream.Write($buffer, 0, $read)
                }
            } finally { $partStream.Dispose() }
            Write-Host "OK part $($part.index)/$($m.partCount)" -ForegroundColor Green
        } finally {
            if ($deleteAfter -and (Test-Path -LiteralPath $partPath)) { Remove-Item -LiteralPath $partPath -Force }
        }
    }
} catch {
    $stream.Dispose()
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    throw
} finally { $stream.Dispose() }

$size = (Get-Item -LiteralPath $temporary).Length
if ($size -ne [long]$m.size) {
    Remove-Item -LiteralPath $temporary -Force
    throw "Sai kich thuoc file ghep: $size; can $($m.size)"
}
$fullHash = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant()
if ($fullHash -ne $m.sha256) {
    Remove-Item -LiteralPath $temporary -Force
    throw 'SHA256 file EXE sau khi ghep KHONG KHOP! Khong chay file nay.'
}
Move-Item -LiteralPath $temporary -Destination $destination
Write-Host "SUCCESS: Da ghep EXE va xac thuc SHA256: $destination" -ForegroundColor Green
Write-Host "SHA256=$fullHash"
