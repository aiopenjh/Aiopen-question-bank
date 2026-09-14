@echo off
chcp 65001 > nul
echo ========================================================
echo    CogniQuest AI - AI 맞춤형 시험 문제 및 CBT 학습 엔진
echo    "초정밀 공인 표준 교육과정 및 환각 제로 시험 출제"
echo ========================================================
echo.
echo [1] 안드로이드 스마트폰에서 켜는 법:
echo     - 플레이스토어에서 [Expo Go] 앱 설치
echo     - 아래 터미널에 나오는 QR 코드를 카메라로 스캔
echo.
echo [2] 컴퓨터 브라우저에서 모바일 화면 보기:
echo     - 화면이 뜨면 키보드에서 'w' 키를 누르세요.
echo.
echo 앱 서버를 시작합니다... 잠시만 기다려주세요.
echo.

cd /d "%~dp0apps\mobile"
call npm start

pause
