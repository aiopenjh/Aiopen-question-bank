$ErrorActionPreference = "Stop"
$deployDir = "c:\AI-powered test generator app\deploy-temp"

if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}

git worktree add -B gh-pages $deployDir origin/gh-pages
Get-ChildItem -Path $deployDir -Exclude .git | Remove-Item -Recurse -Force
Copy-Item -Path "c:\AI-powered test generator app\apps\mobile\dist\*" -Destination $deployDir -Recurse -Force

Push-Location $deployDir
git add -A
git commit -m "Deploy v1.0.8: Gentle book turn transition speed and clean header without 1/3 pill"
git push origin gh-pages
Pop-Location

git worktree remove --force $deployDir
Write-Host "DEPLOY_SUCCESS"
