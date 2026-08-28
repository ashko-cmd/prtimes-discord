$ErrorActionPreference = 'Continue'
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8WithoutBom
[Console]::OutputEncoding = $utf8WithoutBom
$projectDirectory = Split-Path -Parent $PSScriptRoot
$nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) {
    $nodeCommand.Source
} else {
    Join-Path $env:ProgramFiles 'nodejs\node.exe'
}

if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf)) {
    throw 'Node.js was not found. Install Node.js 20 or later, or add node.exe to PATH.'
}
$logDirectory = Join-Path $projectDirectory 'data'
$logFile = Join-Path $logDirectory 'monitor.log'

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

# Keep one previous log when the current log exceeds 5 MB.
if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 5MB) {
    $previousLog = Join-Path $logDirectory 'monitor.previous.log'
    if (Test-Path -LiteralPath $previousLog) {
        Remove-Item -LiteralPath $previousLog -Force
    }
    Move-Item -LiteralPath $logFile -Destination $previousLog
}

Set-Location -LiteralPath $projectDirectory
& $nodeExecutable 'src/index.js' *>> $logFile
exit $LASTEXITCODE
