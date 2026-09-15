# 다음 노트북 작업 시작 지침

아래 내용을 새 Codex/AI 작업의 첫 메시지로 사용한다.

```text
이 프로젝트는 Celueste 로컬 퍼스트 AI CBT 플랫폼입니다.

1. 루트의 AGENTS.md를 처음부터 끝까지 읽고 9대 불변 헌법, 파일 책임 맵, 변경 통제 규칙을 준수하세요.
2. docs/handoff/2026-09-16/README.md와 docs/UX_REFRESH_WORKFLOW.md를 읽어 사용자 제안, 시각 방향, 현재 구현 상태, 참고 캡처를 먼저 파악하세요.
3. 작업 브랜치는 feature/ux-refresh입니다. 새 clone에서는 origin/feature/ux-refresh를 추적하도록 체크아웃하세요.
4. main 및 gh-pages 브랜치는 사용자의 별도 승인 없이 병합, 커밋, 푸시, 배포하지 마세요.
5. 기존 기능과 로컬 데이터 계약을 온전히 보존하세요. 과목, 단원, 문제, 오답, 직접 저장 오답노트, 알람, 난이도, ZIP 백업·복원, 출력 기능 중 하나라도 빠지면 안 됩니다.
6. API 키와 개인 학습 데이터는 외부로 전송하거나 문서·로그·커밋에 기록하지 마세요. 백업에는 API 키를 포함하지 마세요.
7. UI의 기준은 블러시 핑크 파스텔, 낮은 대비, 고등학생·대학생에게 맞는 세련된 캐릭터입니다. 유아풍, 과한 장식, 버튼 중복을 피하세요.
8. 나만의 오답노트는 사용자가 직접 저장한 문제만 의미합니다. 자동 오답 복습과 의미를 섞거나 중복 버튼을 만들지 마세요.
9. 문제 보관함의 현재 결정은 전체 문제 → 과목 → 단원 → 문제의 계층형 아코디언입니다. 전체는 최상단, 과목은 세로 상위 탭, 선택한 과목 바로 아래에 단원, 선택한 단원 아래에 문제를 표시합니다.
10. 변경 전에 git status와 현재 브랜치를 확인하고 사용자의 기존 변경을 버리거나 덮어쓰지 마세요.
11. 다음 작업은 먼저 run_mobile.bat로 휴대폰 Expo Go에서 인수인계 문서의 확인 목록을 점검한 뒤 진행하세요.
12. 코드 변경 후 apps/mobile에서 cmd.exe /c npx tsc --noEmit을 통과시키세요. 전체 테스트는 현재 mock/경로가 오래되어 있으므로 통과했다고 가정하지 말고 실제 수행 결과만 보고하세요.

새 기능을 임의로 추가하거나 범위를 넓히지 말고, 발견한 별도 문제는 원인과 영향만 먼저 보고한 뒤 승인을 받으세요.
```

## 새 노트북에서 시작 명령

```powershell
git clone https://github.com/aiopenjh/Aiopen-question-bank.git
cd Aiopen-question-bank
git fetch origin
git switch --track origin/feature/ux-refresh
git status --short --branch
cd apps/mobile
npm ci
cd ../..
.\run_mobile.bat
```

이미 같은 이름의 로컬 브랜치가 있으면 `git switch feature/ux-refresh`를 사용한다. 원격보다 로컬 변경이 있는 경우 임의로 reset하지 말고 먼저 상태를 확인한다.
