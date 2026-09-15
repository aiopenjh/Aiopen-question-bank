$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
if (-not $rootDir) {
    $rootDir = Get-Location
}

$deployDir = Join-Path $rootDir "deploy-temp"
$distDir = Join-Path $rootDir "apps\mobile\dist"

Write-Host "📦 1. Expo 정적 웹 번들 빌드 시작 (apps\mobile)..." -ForegroundColor Cyan
Push-Location (Join-Path $rootDir "apps\mobile")
cmd.exe /c npx expo export
Pop-Location

if (-not (Test-Path $distDir)) {
    throw "오류: apps\mobile\dist 빌드 결과물이 생성되지 않았습니다."
}

# SPA 지원용 404.html 및 GitHub Pages용 .nojekyll 보장
$indexPath = Join-Path $distDir "index.html"
$fourOhFourPath = Join-Path $distDir "404.html"
$noJekyllPath = Join-Path $distDir ".nojekyll"

if (Test-Path $indexPath) {
    Copy-Item -Path $indexPath -Destination $fourOhFourPath -Force
}
if (-not (Test-Path $noJekyllPath)) {
    New-Item -ItemType File -Path $noJekyllPath -Force | Out-Null
}

Write-Host "🚀 2. gh-pages 브랜치 배포 준비..." -ForegroundColor Cyan
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}

# 원격 origin/gh-pages 존재 여부 확인
$hasRemoteGhPages = git ls-remote --heads origin gh-pages
if ($hasRemoteGhPages) {
    git worktree add -B gh-pages $deployDir origin/gh-pages
} else {
    git worktree add -B gh-pages $deployDir
}

Get-ChildItem -Path $deployDir -Exclude .git | Remove-Item -Recurse -Force
Copy-Item -Path "$distDir\*" -Destination $deployDir -Recurse -Force

Push-Location $deployDir
git add -A
git commit -m "Deploy: Update GitHub Pages build via deploy script" --allow-empty
git push origin gh-pages -u
Pop-Location

git worktree remove --force $deployDir
Write-Host "🎉 DEPLOY_SUCCESS: GitHub Pages 프로덕션 배포가 성공적으로 완료되었습니다!" -ForegroundColor Green
