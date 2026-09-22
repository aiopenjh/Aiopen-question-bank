# 🌐 AI_SHARED_CONTEXT.md — Tri-AI Handoff & Synchronization Prompt
> **용도:** ChatGPT (GPT-4o), Claude (Claude 3.5 Sonnet), Google Gemini 대화창에 그대로 복사-붙여넣기하여 프로젝트 상태를 1초 만에 동기화하는 공통 컨텍스트 인수인계 문서입니다.

---

```markdown
[프로젝트 긴급 컨텍스트 및 AI 협업 가이드]

1. 프로젝트 개요:
- 이름: Celueste (셀루에스테) — 로컬 퍼스트 AI 맞춤형 CBT 문제은행 플랫폼
- 저장소: https://github.com/aiopenjh/Aiopen-question-bank
- 웹 서비스: https://aiopenjh.github.io/Aiopen-question-bank/
- 기술 스택: React Native, Expo Web, TypeScript, IndexedDB(Web), AsyncStorage(Native) (Local-First)
- AI 연동: Google Gemini 3.5 이상을 기본 기준으로 사용. Gemini는 3.5 미만 모델로 전환 금지. 기존 키 형식 호환을 위한 Claude/OpenAI 통신 경로 유지
- 현재 배포 표기: v2.3.4. 로컬 `main`에는 v2.4 Beta 후보 기능이 통합되어 있으나 버전 상승과 배포는 아직 별도 작업
- 단원 레벨은 사용자가 레벨을 고른 뒤 3문제/5문제를 누르고 기존 문제 유지 또는 삭제를 선택할 때 Unit.difficultyLevel에 저장. 과목 시작 레벨이나 다른 단원을 변경하지 않음. 앱 재실행/백업 복원 후 유지.
- 의견 보내기는 앱 내부 모달 → Formspree → 관리자 메일. 동기 중복 잠금과 20초 제한시간 적용. 오늘 풀이 집계는 UTC 문자열 앞부분이 아닌 로컬 날짜로 비교.

2. 제품 헌법과 개발 안전 규칙 (요약):
① 가짜 문제 금지: 생성 통로가 없거나 실패하면 NEEDS_CONNECTION 또는 명확한 오류 반환
② 로컬 퍼스트: 학습 데이터는 기기가 기준이며 외부 전송의 목적과 범위를 명확히 분리
③ 학습 의도 보존: 유효한 세부 학습 의도를 우선하고 무의미한 입력은 원래 과목으로 폴백, 심화 과정도 도메인 이탈 금지
④ 평가 무결성: 문항 유형 계획을 검증하고 객관식 정답 편향을 줄이며 채점 실패를 오답과 분리
⑤ 중복 방지와 개념 확장: 판박이 문제를 막고 단원 내 다양한 개념·원리·사례로 확장
⑥ 배포 가능한 AI 연결: 운영자 키를 앱에 넣지 않고 BYOK·관리형 프록시·온디바이스 통로를 교체 가능하게 분리
⑦ 데이터 호환성과 복구: 기존 저장·백업을 보존하고 실패 시 원본을 삭제하지 않음
⑧ 개발 안전: 책임 분리, 입력 16px 이상, 접근성 확인, main·push·build·deploy 단계 분리

3. 핵심 디렉토리 구조:
- apps/mobile/App.tsx: 메인 화면 오케스트레이션 및 전역 뷰포트 보호
- apps/mobile/src/hooks/useAppController.ts: 메인 화면 상태와 동작 오케스트레이션
- apps/mobile/src/components/AppView.tsx: 메인 화면 렌더링
- apps/mobile/src/domain/prompts.ts: 공인 시험 출제위원 헌법 및 도메인 고정 프롬프트
- apps/mobile/src/domain/ai_client.ts: Gemini, Claude, GPT 범용 통신 엔진
- apps/mobile/src/domain/question_type_plan.ts: 객관식·주관식 범주·빈칸형 문항별 독립 추첨
- apps/mobile/src/domain/generator.ts: 복수 문항 유형 생성·검증·저장 파이프라인
- apps/mobile/src/domain/generator_validation.ts: 유형별 AI 응답 구조 검증
- apps/mobile/src/domain/question_distribution.ts: 정답 무작위 균등 셔플러
- apps/mobile/src/domain/grading.ts: 빈칸형 로컬 채점, 단답형·서술형 AI 채점
- apps/mobile/src/features/library/LibraryScreen.tsx: 과목자료함 및 문제은행
- apps/mobile/src/features/exam/ExamSessionScreen.tsx: 복수 유형 CBT 시험장 & 4단계 오답노트
- apps/mobile/src/features/exam/ScratchpadPanel.tsx: 문제별 필기 풀이공간
- apps/ranking-worker/: 선택형 랭킹용 Cloudflare Worker/D1 API (운영 URL과 D1 설정은 배포 전 확정 필요)
- apps/mobile/src/domain/difficulty.ts: 1~30 이상 난이도 프로필
- apps/mobile/src/domain/question_similarity.ts: 저장 문제와 신규 문제의 중복 유사도 검사
- apps/mobile/src/data/app_storage.ts: 웹 IndexedDB 자동 생성·기존 데이터 이관과 네이티브 AsyncStorage 연결
- CHANGELOG.md: v2.0.0 ~ v2.3.4 통합 릴리스 변경 이력
- deploy-gh-pages.ps1: GitHub Pages 빌드/배포 스크립트 (.nojekyll, 404.html, version.json 자동 포함)

문서 기준:
- DEVELOPER.md: 현재 구현의 공식 기술 입구
- AGENTS.md: 제품 헌법과 개발 안전 규칙
- docs/ARCHITECTURE_WORKFLOW_V2.md: 상세 계층과 데이터 흐름
- docs/PRODUCT_ROADMAP_AND_BETA_PLAN.md: 완료 상태와 Beta 잔여 과제

4. 빌드 및 배포 방법:
- 타입 검사: cd apps/mobile && cmd.exe /c npx tsc --noEmit (에러 0건 필수)
- 깃허브 푸시: git add . ; git commit -m "..." ; git push origin main
- 웹 배포: powershell -ExecutionPolicy Bypass -File .\deploy-gh-pages.ps1
```
