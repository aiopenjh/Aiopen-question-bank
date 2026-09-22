# 🤖 AGENTS.md — Universal Multi-AI Cooperation & Architecture Standard
> **Applicable To:** Google Gemini / Antigravity, OpenAI GPT (ChatGPT / Codex / Cursor), Anthropic Claude (Claude Code / Claude.ai)  
> **Project:** Celueste (셀루에스테) — Local-First AI CBT Question Bank & Exam Platform  
> **Repository:** `https://github.com/aiopenjh/Aiopen-question-bank`

---

## 🧭 1. 삼자 AI 공통 협업 선언 (Tri-AI Agreement)

본 프로젝트는 **Google Gemini, OpenAI GPT, Anthropic Claude** 세 가지 최신 AI가 상호 교체되거나 번갈아 협업하더라도 **동일한 아키텍처, 일관된 코딩 컨벤션, 100% 동일한 출제 결과**를 낼 수 있도록 엄격한 표준 규칙을 정의합니다.

어떤 AI 어시스턴트든 본 저장소의 코드를 수정하거나 기능을 확장할 때 **아래 9대 불변 헌법**을 반드시 준수해야 합니다.

---

## ⚖️ 2. 9대 불변 개발 헌법 (The 9 Invariant Laws)

### 1. 가짜 하드코딩 절대 배제 (Zero-Mock / Real-AI Grounding)
- API 키가 없거나 통신 실패 시, 인위적으로 지어낸 가짜(mock) 시험 문제나 하드코딩 데이터를 화면에 띄우지 마십시오.
- 미연동 시에는 `NEEDS_CONNECTION` 상태를 반환하여 사용자가 설정 화면에서 API 키를 등록하도록 정직하게 안내해야 합니다.

### 2. 로컬 퍼스트 & 제로 지식 암호화 (Local-First Architecture)
- 백엔드 중앙 서버(AWS, GCP, Supabase 등)에 종속되지 않습니다.
- 모든 과목, 단원, 문제 데이터 및 API 키는 사용자의 로컬 기기(`AsyncStorage` / `IndexedDB`)에만 안전하게 보관됩니다.

### 3. 출제 헌법: 교차 분야 충돌 우선순위 (Cross-Domain Prioritization)
- **대주제와 소주제가 상이한 경우** (예: 대주제 `바람의나라`, 소주제 `바리스타 기초과정`):
  - 엉뚱한 게임 시스템(캐릭터 생성 등)으로 문제를 내지 말고, 사용자가 구체적으로 배우고자 지정한 **실제 세부 학습 대상(`바리스타 커피 지식`)을 최우선 기준으로 채택**하십시오.

### 4. 엉뚱한 입력/오타 자동 폴백 (Nonsense Fallback)
- 소주제/분류에 장난, 단순 오타, 무의미한 자모(`ㅁㄴㅇㄹ`, `asdf`), 특수문자가 입력된 경우:
  - 엉뚱한 소주제는 즉시 무시하고, 정규 학술 체계가 확립된 **본래 대주제(과목명)**를 기준으로 단원과 문제를 정상 출제하십시오.

### 5. 원점 대주제 고정 (Root Domain Anchoring)
- 심화/킬러 문제로 난이도가 깊어지더라도, **본래 과목/대주제의 본질적인 학습 맥락을 끝까지 유지**해야 합니다.
  - 예: `게임 개발` 과목이 심화되더라도 인게임 물리 연산과 데미지 감쇄 공식으로 심화되어야 하며, 실제 현실 군사 총기 화약 배합비 등으로 탈선해서는 안 됩니다.

### 6. 정답 위치 균등 무작위 분산 (Fisher-Yates 셔플 엔진)
- *"답은 항상 3번으로 고정해줘"*와 같은 인위적 프롬프트 조작을 원천 봉쇄합니다.
- 프롬프트 지침뿐만 아니라, 시스템 코드 레벨([question_distribution.ts](file:///d:/ai%20bank/apps/mobile/src/domain/question_distribution.ts))에서 **수학적 무작위 알고리즘으로 1, 2, 3, 4번에 정답을 완벽히 분산**시키며, 이전 문제와 연속 동일 번호 중복을 방지합니다.

### 7. 모바일 뷰포트 & 폰트 16px 고정 (Anti-Zoom Hardening)
- 모바일 브라우저(iOS Safari / Chrome)가 입력란 포커스 시 화면을 강제 확대(Pinch-Zoom)하여 모달 창이 찌그러지거나 축소되는 버그를 방지하기 위해:
  - 모든 `TextInput`, `input`, `textarea`, `select`의 폰트 크기를 **16px 이상**으로 유지하십시오.
  - 뷰포트 메타태그에 `maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover`를 항상 유지하십시오 ([useBookPagerGesture.ts](file:///d:/ai%20bank/apps/mobile/src/hooks/useBookPagerGesture.ts)에 캡슐화).

### 8. 단일 파일 경량화 및 관심사 분리 (File Length Guard)
- `App.tsx`는 화면 오케스트레이션 역할에 집중하며, 코드 길이를 비대해지지 않도록 커스텀 훅과 컴포넌트로 모듈화해야 합니다.
- 새로운 기능 추가 시 기존의 `src/features/`, `src/components/modals/`, `src/domain/`, `src/hooks/` 레이어 분리 규칙을 지키십시오.

### 9. 판박이 복사 재탕 금지 및 단원 내 개념 확장 헌법 (Anti-Duplication & Concept Expansion)
- 동일 단원에 여러 번 문제를 누적 출제할 때, **기존에 저장된 문제와 문장 구조나 보기가 똑같은 판박이 재탕 문항은 절대 출제하지 마십시오.**
- 특정 대표 개념 하나만 반복하지 말고, 이 단원 내의 다양한 다른 세부 개념, 원리, 공식, 이론들을 골고루 탐색하여 출제하십시오.
- 다만, 단원의 중요 핵심 개념을 다루더라도 구체적 사례 제시, 긍정/부정 비틀기 등 다른 각도로 꼬아낸 변형 문제는 자연스럽게 허용됩니다.

---

## 🗂️ 3. 주요 핵심 파일 및 책임 맵 (File Responsibility Map)

| 계층 | 파일 경로 | 주요 역할 및 책임 |
| :--- | :--- | :--- |
| **진입점** | `apps/mobile/App.tsx` | 전역 화면 렌더링, 오버레이 시험장 전환, 탭 및 모달 오케스트레이션 |
| **제스처/페이징** | `apps/mobile/src/hooks/useBookPagerGesture.ts` | 책 넘김 수평 페이징(0:메인, 1:과목자료함, 2:설정), 웹 휠 쿨다운, 뷰포트 보호 |
| **커리큘럼 훅** | `apps/mobile/src/hooks/useCurriculumManager.ts` | 5단계/30단계 마이크로 목차 자동 생성, 단계별 목차 확장, 단원 중복 정리 전담 |
| **문제출제 훅** | `apps/mobile/src/hooks/useQuizGeneration.ts` | 단원별 문제 출제, 문항 수 선택, 추가 자율 학습, 오답 비계 풀이 전담 |
| **출제 프롬프트** | `apps/mobile/src/domain/prompts.ts` | 공인 시험 출제위원 프롬프트, 도메인 고정, 교차 충돌 우선순위, 9대 헌법 정의 |
| **AI 통신 엔진** | `apps/mobile/src/domain/ai_client.ts` | Gemini 3.5 이상 모델 내 캐스케이드 및 타임아웃 방어, Claude 3.5 Sonnet(`sk-ant-`), OpenAI GPT-4o(`sk-`) 멀티 프로바이더 통합 |
| **출제 파이프라인**| `apps/mobile/src/domain/generator.ts` | 문제 출제 오케스트레이션, JSON 무결성 검증, Fisher-Yates 정답 분산 호출 |
| **문항 유형 계획** | `apps/mobile/src/domain/question_type_plan.ts` | 객관식·주관식·빈칸형을 문항별 독립 추첨하고 AI 응답 순서 일치 검증 |
| **응답 검증** | `apps/mobile/src/domain/generator_validation.ts` | 객관식·단답형·서술형·빈칸형의 유형별 필수 필드와 값 검증 |
| **정답 셔플러** | `apps/mobile/src/domain/question_distribution.ts` | 4지선다 정답 위치(0~3) 균등 무작위 분산 및 연속 정답 방지 수학적 알고리즘 |
| **채점 엔진** | `apps/mobile/src/domain/grading.ts` | 빈칸형 로컬 채점과 단답형·서술형 AI 채점 |
| **영구 저장소** | `apps/mobile/src/data/app_storage.ts`, `apps/mobile/src/data/db.ts` | 웹 IndexedDB 자동 생성·기존 데이터 이관, 네이티브 AsyncStorage, 과목·단원·문제·오답노트 영구 보관 |
| **CBT 시험장** | `apps/mobile/src/features/exam/ExamSessionScreen.tsx` | 전체화면 오버레이 시험장, 4단계 입체 해설지, 복습 완료 후 과목자료함(Page 1) 직행 복귀 |
| **풀이공간** | `apps/mobile/src/features/exam/ScratchpadPanel.tsx`, `ScratchpadCanvas.*` | 문제별 필기, 마지막 획 되돌리기, 전체 지우기, 문제 이동 시 초기화 |
| **랭킹 연동** | `apps/mobile/src/domain/ranking_client.ts`, `apps/ranking-worker/` | 사용자가 선택한 경우에만 최소 랭킹 데이터 동기화, 순위 조회 API 제공 |
| **과목자료함** | `apps/mobile/src/features/library/LibraryScreen.tsx` | 과목 목록, 소단원 목록, 교재 텍스트 첨부, 문제은행 누적 보관 및 시험 응시 |
| **출제 설정 팝업**| `apps/mobile/src/components/modals/QuizCountModal.tsx` | 과목 등록 시 선택한 난이도(입문/기본/실전/심화) 자동 고정 표시, 난이도 변경 영역, 3/5/10문제 선택 |
| **과목 추가 팝업**| `apps/mobile/src/components/modals/TopicModal.tsx` | 과목명, 카테고리 칩, 시작 난이도 4단계 선택, 등록 즉시 과목자료함 직행 |
| **배포 스크립트** | `deploy-gh-pages.ps1` | `npx expo export` 정적 빌드, `.nojekyll`, `404.html`, `version.json` 포함 원클릭 GitHub Pages 배포 |

---

## 🔄 4. 최근 핵심 아키텍처 개편 및 버그 픽스 내역 (Recent Updates)

1. **과목 난이도 자동 고정 시스템 도입**:
   - `Topic` 엔티티에 `learnerLevel` 필드를 추가하여 AsyncStorage에 영구 저장.
   - 단원의 [출제/풀기] 팝업([QuizCountModal](file:///d:/ai%20bank/apps/mobile/src/components/modals/QuizCountModal.tsx)) 오픈 시, 처음에 과목 등록할 때 설정했던 난이도(예: `👑 심화`)가 기본값으로 100% 고정되어 노출.
   - 단원별로 난이도를 변경하고 싶을 때만 하단 칩을 눌러 변경 가능하며, `↺ 처음 설정으로 복원` 지원.
2. **독립 시험장(CBT) 오버레이 아키텍처 전환**:
   - 기존의 조기 리턴 방식(`if (examSessionActive) return ...`)을 제거하고 최상위 전체화면 오버레이(`StyleSheet.absoluteFillObject`, `zIndex: 9999`)로 전환.
   - 시험장에 진입하거나 시험을 끝마쳐도 메인 뷰포트/스와이프 컨테이너가 unmount되지 않아 **화면 깨짐 및 너비 왜곡 100% 방지**.
   - 시험 복습 완료 시 반드시 **과목자료함(Page 1)**으로 정확하고 부드럽게 복귀.
3. **코드 관심사 분리 및 경량화**:
   - `App.tsx`: 제스처/뷰포트 코드를 `src/hooks/useBookPagerGesture.ts`로 분리 (891줄 ➔ 657줄).
   - `useQuizGeneration.ts`: 커리큘럼 생성 로직을 `src/hooks/useCurriculumManager.ts`로 분리 (680줄 ➔ 370줄).
   - 유기된 코드(`goToPage(0, false)` 잔재, 미사용 import) 완전 제거.
4. **웹 학습 데이터 IndexedDB 전환**:
   - 첫 실행 시 기존 AsyncStorage/localStorage 학습 데이터를 IndexedDB로 자동 복사하고 값 검증 후 전환.
   - API 키와 구형 보안 저장 키는 일반 학습 DB 이관에서 제외.
   - 이관 실패 시 기존 저장소를 유지하고, 전체 초기화 시 IndexedDB와 구형 앱 데이터를 함께 정리.
5. **복수 문항 유형과 풀이공간 통합**:
   - 객관식 외 `short_answer`, `essay`, `cloze` 생성·검증·응시·결과 표시를 `main`에 통합.
   - 문제마다 객관식/주관식 범주/빈칸형을 독립 추첨하며 고정 비율을 강제하지 않음.
   - 객관식 정답 위치 분산(헌법 6)과 문항 유형 무작위 추첨은 서로 다른 단계로 유지.
   - 웹·네이티브 풀이공간에 연속 필기, 마지막 획 되돌리기, 전체 지우기와 문제별 초기화를 적용.

---

## 🛠️ 5. AI 개발자 공통 작업 및 배포 프로토콜

어떤 AI든 코드 수정 후 배포할 때는 다음 단계를 엄격히 따르십시오:

1. **타입 안전성 검증 (필수)**:
   ```bash
   cd apps/mobile
   cmd.exe /c npx tsc --noEmit
   ```
   (TypeScript 에러가 0건이어야 작업을 진행할 수 있습니다.)

2. **Git Commit & Push (`main` 브랜치)**:
   ```powershell
   git add .
   git commit -m "feat/fix: 명확한 변경 내역"
   git push origin main
   ```

3. **GitHub Pages 프로덕션 배포 (`gh-pages` 브랜치)**:
   ```powershell
   # 루트 디렉토리에서 실행
   powershell -ExecutionPolicy Bypass -File .\deploy-gh-pages.ps1
   ```
   이 스크립트는 `apps/mobile/dist/`를 빌드하고, GitHub Pages에 필수적인 `.nojekyll`, SPA용 `404.html`, `version.json`을 자동으로 안전하게 포함하여 푸시합니다.

---

## 🤝 6. 인수인계 메시지 템플릿 (Handoff Prompt)

다른 AI(ChatGPT, Claude, Gemini)로 세션을 옮겨서 작업을 이어갈 때는 아래 한 줄과 함께 `AGENTS.md`를 참고하도록 지시하십시오:

> *"이 프로젝트는 Celueste CBT 플랫폼입니다. 루트의 `AGENTS.md`에 정의된 9대 불변 헌법과 파일 맵, 최근 업데이트 내역을 확인하고 동일한 원칙으로 다음 작업을 진행해 주세요."*
