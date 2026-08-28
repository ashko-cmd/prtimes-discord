[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$expectedOrigin = 'https://github.com/ashko-cmd/prtimes-discord.git'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $repositoryRoot 'data/notified.json'

Push-Location $repositoryRoot
try {
    $origin = (git remote get-url origin).Trim()
    if ($LASTEXITCODE -ne 0 -or $origin -ne $expectedOrigin) {
        throw "Unexpected origin URL: $origin"
    }
    if (-not (Test-Path -LiteralPath $stateFile -PathType Leaf)) {
        throw 'data/notified.json was not found. Run the local monitor first.'
    }

    $state = Get-Content -Raw -Encoding utf8 -LiteralPath $stateFile | ConvertFrom-Json
    $urls = @($state)
    if ($urls | Where-Object { $_ -isnot [string] }) {
        throw 'data/notified.json has an invalid format.'
    }
    Write-Host "Validated $($urls.Count) local notification records without displaying them."

    git fetch --no-tags origin refs/heads/state
    if ($LASTEXITCODE -eq 0) {
        throw 'origin/state already exists. Refusing to overwrite it.'
    }

    if (-not $PSCmdlet.ShouldProcess($expectedOrigin, 'Create and push the notification-only state branch')) {
        return
    }

    $blob = (git hash-object -w -- $stateFile).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create the notification-state blob.' }
    $tree = ("100644 blob $blob`tnotified.json" | git mktree).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create the state tree.' }
    $commit = ('Initialize notification state' | git commit-tree $tree).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create the state commit.' }
    git push origin "${commit}:refs/heads/state"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to push the state branch.' }
    Write-Host "Saved $($urls.Count) notification records to the state branch."
}
finally {
    Pop-Location
}
