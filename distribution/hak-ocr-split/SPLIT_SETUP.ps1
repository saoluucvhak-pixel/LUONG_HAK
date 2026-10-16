param(
    [Parameter(Mandatory=$true)][string]$SourceExe,
    [Parameter(Mandatory=$true)][string]$OutputDir,
    [ValidateRange(4,50)][int]$ChunkMiB = 40
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $SourceExe -PathType Leaf)) {
    throw "Cannot find installer EXE: $SourceExe"
}
$source = (Resolve-Path -LiteralPath $SourceExe).Path
$info = Get-Item -LiteralPath $source
if ($info.Length -lt 1024) { throw "Installer is too small to split: $($info.Length) bytes" }
$chunkBytes = [long]$ChunkMiB * 1MB
$totalParts = [int][Math]::Ceiling($info.Length / $chunkBytes)
if ($totalParts -gt 16) { throw "Expected $totalParts pieces; upload workflow only supports 16. Increase ChunkMiB or add upload steps." }

if (Test-Path -LiteralPath $OutputDir) { Remove-Item -LiteralPath $OutputDir -Force -Recurse }
New-Item -ItemType Directory -Force -Path (Join-Path $OutputDir 'parts') | Out-Null
$partsDir = (Resolve-Path -LiteralPath (Join-Path $OutputDir 'parts')).Path

$parts = [System.Collections.Generic.List[object]]::new()
$inputStream = [System.IO.File]::OpenRead($source)
try {
    $buffer = New-Object byte[] (1MB)
    for ($i = 1; $i -le $totalParts; $i++) {
        $partName = '{0}.part{1:d3}' -f $info.Name, $i
        $partFile = Join-Path $partsDir $partName
        $outputStream = [System.IO.File]::Create($partFile)
        $remaining = [Math]::Min($chunkBytes, $info.Length - $inputStream.Position)
        try {
            while ($remaining -gt 0) {
                $want = [int][Math]::Min($buffer.Length, $remaining)
                $read = $inputStream.Read($buffer, 0, $want)
                if ($read -le 0) { throw "Unexpected end of installer at piece $i" }
                $outputStream.Write($buffer, 0, $read)
                $remaining -= $read
            }
        } finally { $outputStream.Dispose() }
        $pinfo = Get-Item -LiteralPath $partFile
        $parts.Add([ordered]@{
            index = $i
            name = $partName
            artifactName = ('HAK-OCR-Setup-Part-{0:d3}' -f $i)
            size = $pinfo.Length
            sha256 = (Get-FileHash -LiteralPath $partFile -Algorithm SHA256).Hash.ToLowerInvariant()
        })
    }
} finally { $inputStream.Dispose() }

$manifest = [ordered]@{
    schema = 'hak-ocr-windows-split-v1'
    fileName = $info.Name
    size = $info.Length
    sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    chunkBytes = $chunkBytes
    partCount = $totalParts
    parts = @($parts.ToArray())
}
$manifestFile = Join-Path $OutputDir 'manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestFile -Encoding utf8
Write-Host "SPLIT_OK: $($manifest.fileName), $($manifest.partCount) chunks, $($manifest.size) bytes; SHA256=$($manifest.sha256)" -ForegroundColor Green
