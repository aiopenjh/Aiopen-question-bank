@echo off
chcp 65001 > nul

echo ========================================================
echo    Celueste AI Mobile App Server
echo    "초정밀 공인 표준 교육과정 및 환각 제로 CBT 엔진"
echo ========================================================
echo.

if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%PATH%"

echo [1/3] 8081 포트 충돌 확인 및 기존 프로세스 자동 정리 중...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8081 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%p >nul 2>&1
)

echo [2/3] 스마트폰 연결용 실제 Wi-Fi IP 자동 감지 중...
for /f "usebackq tokens=*" %%a in (`powershell -Command "try { (Get-NetIPAddress -InterfaceAlias 'Wi-Fi*' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress | Select-Object -First 1 } catch {}"`) do set "WIFI_IP=%%a"

if not "%WIFI_IP%"=="" (
    echo [*] 감지된 Wi-Fi IP: %WIFI_IP%
    set "REACT_NATIVE_PACKAGER_HOSTNAME=%WIFI_IP%"
) else (
    echo [*] Wi-Fi IP 미감지 - 기본 LAN 환경으로 실행합니다.
)

echo.
echo [3/3] Expo Metro 번들러 캐시 초기화 및 LAN 모드로 시작 중...
echo.
echo [사용 가이드]
echo  - 안드로이드: [Expo Go] 앱 실행 후 아래 터미널의 QR 코드 스캔
echo  - 아이폰: 기본 카메라 앱으로 아래 QR 코드 스캔
echo  - 네트워크 오류 발생 시: 터미널에서 's' 키를 눌러 Tunnel 모드로 전환!
echo  - 컴퓨터 브라우저 미리보기: 터미널에서 'w' 키를 누르세요.
echo ========================================================
echo.

cd /d "%~dp0apps\mobile"
call npx expo start --lan --clear

pause
