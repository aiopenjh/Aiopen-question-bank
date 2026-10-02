$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$exportDirectory = Join-Path $PSScriptRoot 'apps\mobile\dist-login-pilot'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22.12 이상이 필요합니다.' }
if (-not (Test-Path -LiteralPath (Join-Path $exportDirectory 'index.html'))) {
    throw '시범 웹 파일이 필요합니다. apps\mobile에서 .\node_modules\.bin\expo.cmd export --platform web --output-dir dist-login-pilot 을 먼저 실행하세요.'
}
$env:AI_CONNECTOR_APP_ROOT = $exportDirectory
$env:AI_CONNECTOR_APP_MOUNT = '/Aiopen-question-bank'
$env:AI_CONNECTOR_APP_NAME = 'Celueste 문제은행'
$env:AI_CONNECTOR_PORT = '48721'
try { & node (Join-Path $PSScriptRoot 'packages\ai-login-connector\desktop\server.js') }
finally { Remove-Item Env:\AI_CONNECTOR_APP_ROOT,Env:\AI_CONNECTOR_APP_MOUNT,Env:\AI_CONNECTOR_APP_NAME,Env:\AI_CONNECTOR_PORT -ErrorAction SilentlyContinue }
