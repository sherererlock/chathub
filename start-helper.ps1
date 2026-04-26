$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$helperDir = Join-Path $scriptDir "TowerAI"

Write-Host "Starting TowerAI helper server..." -ForegroundColor Cyan

Set-Location $helperDir
& ".\node_modules\.bin\tsx.cmd" "src/helper/index.ts"
