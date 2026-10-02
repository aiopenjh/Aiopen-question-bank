$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22.12 이상이 필요합니다. Node 설치 후 다시 실행하세요.'
}
& node (Join-Path $PSScriptRoot 'desktop\server.js')
