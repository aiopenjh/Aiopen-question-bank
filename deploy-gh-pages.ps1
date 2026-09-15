$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
if (-not $rootDir) {
    $rootDir = Get-Location
}

$deployDir = Join-Path $rootDir "deploy-temp"
$distDir = Join-Path $rootDir "apps\mobile\dist"

if (-not (Test-Path $distDir)) {
    Write-Host "Warning: apps\mobile\dist directory not found. Please run 'cd apps/mobile; npx expo export' first." -ForegroundColor Yellow
}

if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}

git worktree add -B gh-pages $deployDir origin/gh-pages
Get-ChildItem -Path $deployDir -Exclude .git | Remove-Item -Recurse -Force
Copy-Item -Path "$distDir\*" -Destination $deployDir -Recurse -Force

Push-Location $deployDir
git add -A
git commit -m "Deploy: Update GitHub Pages build via deploy script"
git push origin gh-pages
Pop-Location

git worktree remove --force $deployDir
Write-Host "DEPLOY_SUCCESS"
