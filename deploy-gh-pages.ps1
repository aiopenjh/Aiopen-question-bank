$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
if (-not $rootDir) {
    $rootDir = Get-Location
}

$distDir = Join-Path $rootDir "apps\mobile\dist"
$mobileDir = Join-Path $rootDir "apps\mobile"
$buildInfoPath = Join-Path $mobileDir "src\constants\buildInfo.ts"
$publicVersionPath = Join-Path $mobileDir "public\version.json"

# 앱에 내장된 버전과 배포 서버의 버전을 같은 값으로 유지합니다.
$buildInfoText = Get-Content -LiteralPath $buildInfoPath -Raw
$versionMatch = [regex]::Match($buildInfoText, "version:\s*'([^']+)'")
$buildTimeMatch = [regex]::Match($buildInfoText, "buildTime:\s*'([^']+)'")
$buildLabelMatch = [regex]::Match($buildInfoText, "buildLabel:\s*'([^']+)'")
if (-not ($versionMatch.Success -and $buildTimeMatch.Success -and $buildLabelMatch.Success)) {
    throw "오류: buildInfo.ts에서 배포 버전 정보를 읽지 못했습니다."
}
[ordered]@{
    version = $versionMatch.Groups[1].Value
    buildTime = $buildTimeMatch.Groups[1].Value
    buildLabel = $buildLabelMatch.Groups[1].Value
} | ConvertTo-Json | Set-Content -LiteralPath $publicVersionPath -Encoding utf8

Write-Host "📦 1. Expo 정적 웹 번들 빌드 시작 (apps\mobile)..." -ForegroundColor Cyan
Push-Location $mobileDir
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

Write-Host "🚀 2. gh-pages 브랜치 프로덕션 배포 푸시 중..." -ForegroundColor Cyan
Push-Location $distDir
if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git"
}

git init -b gh-pages
git config user.name "AI CBT Deployer"
git config user.email "deployer@celueste.local"
git add -A
git commit -m "Deploy: Update GitHub Pages build" --allow-empty
git remote add origin https://github.com/aiopenjh/Aiopen-question-bank.git
git push origin gh-pages -f
Remove-Item -Recurse -Force ".git"
Pop-Location

Write-Host "🎉 DEPLOY_SUCCESS: GitHub Pages 프로덕션 배포가 성공적으로 완료되었습니다!" -ForegroundColor Green
