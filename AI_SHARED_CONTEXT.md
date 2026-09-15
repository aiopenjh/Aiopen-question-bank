# 🌐 AI_SHARED_CONTEXT.md — Tri-AI Handoff & Synchronization Prompt
> **용도:** ChatGPT (GPT-4o), Claude (Claude 3.5 Sonnet), Google Gemini 대화창에 그대로 복사-붙여넣기하여 프로젝트 상태를 1초 만에 동기화하는 공통 컨텍스트 인수인계 문서입니다.

---

```markdown
[프로젝트 긴급 컨텍스트 및 AI 협업 가이드]

1. 프로젝트 개요:
- 이름: Celueste (셀루에스테) — 로컬 퍼스트 AI 맞춤형 CBT 문제은행 플랫폼
- 저장소: https://github.com/aiopenjh/Aiopen-question-bank
- 웹 서비스: https://aiopenjh.github.io/Aiopen-question-bank/
- 기술 스택: React Native, Expo Web, TypeScript, AsyncStorage (Local-First)
- AI 연동: Google Gemini (3.5/2.5/2.0), Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o 멀티 프로바이더 지원

2. 8대 불변 개발 헌법 (어떤 AI든 반드시 준수):
① [가짜 하드코딩 금지]: API 키 미연동 시 가짜 문제를 만들지 않고 NEEDS_CONNECTION 반환
② [로컬 퍼스트]: 중앙 백엔드 없이 모든 데이터는 기기 로컬 스토리지에 영구 보관
③ [교차 분야 충돌 우선순위]: 대주제(예: 바람의나라)와 소주제(예: 바리스타) 충돌 시, 사용자가 밝힌 실제 세부 학습 대상(바리스타)을 최우선 출제
④ [엉뚱한 입력/오타 자동 폴백]: 소주제에 'ㅁㄴㅇㄹ', 'asdf' 등 장난/오타 입력 시 대주제 기준으로 정상 안전 출제
⑤ [원점 대주제 고정 (Root Domain Anchoring)]: 난이도가 심화되더라도 본래 과목의 맥락을 벗어나 엉뚱한 분야로 탈선 금지
⑥ [정답 무작위 분산]: '3번으로 고정해줘' 등 정답 조작을 차단하고 Fisher-Yates 알고리즘으로 1~4번 균등 분산
⑦ [모바일 뷰포트 보호]: 입력란 포커스 시 줌 인(화면 찌그러짐) 방지를 위해 input font-size 16px 및 viewport maximum-scale=1.0 유지
⑧ [500줄 파일 규칙]: App.tsx는 500라인 이내로 컴팩트하게 유지하고 훅/컴포넌트 분리 원칙 준수

3. 핵심 디렉토리 구조:
- apps/mobile/App.tsx: 메인 화면 오케스트레이션 및 뷰포트 보호
- apps/mobile/src/domain/prompts.ts: 공인 시험 출제위원 헌법 및 도메인 고정 프롬프트
- apps/mobile/src/domain/ai_client.ts: Gemini, Claude, GPT 범용 통신 엔진
- apps/mobile/src/domain/generator.ts: 4지선다 출제 파이프라인
- apps/mobile/src/domain/question_distribution.ts: 정답 무작위 균등 셔플러
- apps/mobile/src/features/library/LibraryScreen.tsx: 과목자료함 및 문제은행
- apps/mobile/src/features/exam/ExamScreen.tsx: 실전 CBT 시험장 & 4단계 오답노트
- deploy-gh-pages.ps1: GitHub Pages 원클릭 빌드/배포 스크립트 (.nojekyll, 404.html, version.json 자동 포함)

4. 빌드 및 배포 방법:
- 타입 검사: cd apps/mobile && cmd.exe /c npx tsc --noEmit (에러 0건 필수)
- 깃허브 푸시: git add . ; git commit -m "..." ; git push origin main
- 웹 배포: powershell -ExecutionPolicy Bypass -File .\deploy-gh-pages.ps1
```
