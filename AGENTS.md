# 🤖 AGENTS.md — Universal Multi-AI Cooperation & Architecture Standard
> **Applicable To:** Google Gemini / Antigravity, OpenAI GPT (ChatGPT / Codex / Cursor), Anthropic Claude (Claude Code / Claude.ai)  
> **Project:** Celueste (셀루에스테) — Local-First AI CBT Question Bank & Exam Platform  
> **Repository:** `https://github.com/aiopenjh/Aiopen-question-bank`

---

## 🧭 1. 삼자 AI 공통 협업 선언 (Tri-AI Agreement)

본 프로젝트는 **Google Gemini, OpenAI GPT, Anthropic Claude** 등 작업 주체가 바뀌어도 동일한 데이터 구조, 검증 규칙, 개인정보 경계와 실패 처리 원칙을 유지하도록 공통 기준을 정의합니다.

AI 응답과 무작위 추첨 결과 자체가 매번 같을 수는 없습니다. 대신 어떤 구현에서도 아래 제품 헌법과 개발 안전 규칙을 지켜 결과의 품질·보안·호환성을 일관되게 유지합니다.

---

## ⚖️ 2. 제품 헌법과 개발 안전 규칙

### A. 제품 헌법

#### 1. 가짜 문제 절대 배제 (Zero-Mock / Real-AI Grounding)
- API 키가 없거나 통신 실패 시, 인위적으로 지어낸 가짜(mock) 시험 문제나 하드코딩 데이터를 화면에 띄우지 마십시오.
- 생성 통로가 없으면 `NEEDS_CONNECTION` 또는 명확한 오류 상태를 반환하고, 사용자가 연결 방법을 선택하도록 안내합니다.

#### 2. 로컬 퍼스트와 명시적 외부 전송 (Local-First & Explicit Network Boundary)
- 과목, 단원, 문제, 오답과 학습 기록의 기본 저장소는 사용자 기기(웹 `IndexedDB`, Android `SQLite`)입니다. 구형 Android `AsyncStorage` 데이터는 검증 후 이관하며 원본을 임의로 삭제하지 않습니다.
- AI 생성·채점, 선택형 랭킹, 의견 전송처럼 네트워크가 필요한 기능은 목적과 전송 범위를 분리하고 사용자에게 명확히 알립니다.
- API 키는 일반 학습 데이터와 분리해 보안 저장하고 백업에 포함하지 않습니다. 로컬 퍼스트를 모든 데이터의 완전한 암호화나 무전송으로 과장하지 않습니다.

#### 3. 학습 의도와 도메인 보존 (Intent & Domain Anchoring)
- 대주제와 구체적인 소주제가 충돌하면 사용자가 실제로 배우려는 유효한 세부 대상을 우선합니다.
- 소주제가 무의미한 자모, 장난, 단순 오타라면 이를 무시하고 본래 과목의 정상 학술 체계로 폴백합니다.
- 난이도가 높아져도 원래 과목의 학습 맥락을 벗어나 다른 분야로 탈선하지 않습니다.

#### 4. 평가 무결성과 실패 상태 분리 (Assessment Integrity)
- AI가 반환한 문항 유형은 코드가 미리 만든 유형 계획과 일치해야 하며, 불일치 응답은 저장하지 않습니다.
- 객관식 정답 위치는 코드에서 무작위 분산해 특정 번호 편향과 가능한 범위의 연속 중복을 줄입니다. 문항 수가 4의 배수가 아닐 수 있으므로 “완벽한 균등”을 보장한다고 표현하지 않습니다.
- 주관식 AI 채점 실패는 오답이 아닙니다. 답안을 보존하고 실패 상태를 별도로 표시합니다.

#### 5. 중복 방지와 개념 확장 (Anti-Duplication & Concept Expansion)
- 동일 단원에 여러 번 문제를 누적 출제할 때, **기존에 저장된 문제와 문장 구조나 보기가 똑같은 판박이 재탕 문항은 절대 출제하지 마십시오.**
- 특정 대표 개념 하나만 반복하지 말고, 이 단원 내의 다양한 다른 세부 개념, 원리, 공식, 이론들을 골고루 탐색하여 출제하십시오.
- 다만, 단원의 중요 핵심 개념을 다루더라도 구체적 사례 제시, 긍정/부정 비틀기 등 다른 각도로 꼬아낸 변형 문제는 자연스럽게 허용됩니다.

#### 6. 배포 가능한 AI 연결 구조와 비밀 보호 (Deployable AI Access)
- 앱에 개발자·운영자의 AI API 키를 하드코딩하거나 번들에 포함하지 않습니다. 앱스토어·APK·웹 번들의 비밀값은 추출 가능하다고 가정합니다.
- 문제 생성 통로는 `BYOK(사용자 키)`, `관리형 서버 프록시`, 향후 `온디바이스 모델`을 교체할 수 있도록 도메인 로직과 분리합니다.
- 관리형 서버를 도입할 때는 인증, 사용자별 할당량, 비용 제한, 악용 방지, 로그 최소화와 키 회전을 먼저 설계합니다.
- 랭킹 서버와 문제 생성 서버는 목적·권한·보관 데이터가 다르므로 하나의 신뢰 경계로 섞지 않습니다.

#### 7. 데이터 호환성과 복구 가능성 (Compatibility & Recovery)
- 저장 스키마를 바꿀 때 기존 사용자 데이터와 백업을 계속 읽을 수 있는 마이그레이션을 제공합니다.
- 이관·복원 실패 시 원본을 삭제하지 않고 가능한 범위에서 이전 상태로 복구합니다.
- 삭제, 초기화, 배포처럼 되돌리기 어려운 작업은 영향 범위 확인과 명시적 승인을 거칩니다.

### B. 개발 안전 규칙

1. `App.tsx`는 화면 오케스트레이션에 집중하고 화면·도메인·저장·외부 통신 책임을 기존 레이어에 분리합니다. 줄 수 자체보다 책임 경계를 우선합니다.
2. 모든 모바일 웹 입력의 글자 크기는 16px 이상을 유지합니다. 화면 확대를 전면 차단하는 설정은 접근성 영향을 확인한 뒤 적용합니다.
3. 기존 디자인 토큰과 모바일 뷰포트 규칙을 재사용하고, 새 UI가 가로 넘침·키보드 가림을 만들지 않게 합니다.
4. `main` 반영, 원격 푸시, 앱 빌드, 웹 배포는 서로 다른 단계로 취급하며 필요한 승인과 검증을 각각 수행합니다.

---

## 🗂️ 3. 주요 핵심 파일 및 책임 맵 (File Responsibility Map)

| 계층 | 파일 경로 | 주요 역할 및 책임 |
| :--- | :--- | :--- |
| **진입점** | `apps/mobile/App.tsx` | 전역 화면 렌더링, 오버레이 시험장 전환, 탭 및 모달 오케스트레이션 |
| **제스처/페이징** | `apps/mobile/src/hooks/useBookPagerGesture.ts` | 책 넘김 수평 페이징(0:메인, 1:과목자료함, 2:설정), 웹 휠 쿨다운, 뷰포트 보호 |
| **커리큘럼 훅** | `apps/mobile/src/hooks/useCurriculumManager.ts` | 5단계/30단계 마이크로 목차 자동 생성, 단계별 목차 확장, 단원 중복 정리 전담 |
| **문제출제 훅** | `apps/mobile/src/hooks/useQuizGeneration.ts` | 단원별 문제 출제, 문항 수 선택, 추가 자율 학습, 오답 비계 풀이 전담 |
| **출제 프롬프트** | `apps/mobile/src/domain/prompts.ts` | 공인 시험 출제위원 프롬프트, 도메인 고정, 교차 충돌·무의미 입력 방어 규칙 정의 |
| **AI 통신 엔진** | `apps/mobile/src/domain/ai_client.ts` | Gemini 3.5 이상 모델 캐스케이드와 제한 처리, Claude Sonnet 4.6(`sk-ant-`), OpenAI GPT-4o(`sk-`) 멀티 프로바이더 통합 |
| **출제 파이프라인**| `apps/mobile/src/domain/generator.ts` | 문제 출제 오케스트레이션, JSON 무결성 검증, Fisher-Yates 정답 분산 호출 |
| **문항 유형 계획** | `apps/mobile/src/domain/question_type_plan.ts` | 혼합·객관식만·주관식만 선택, 혼합 시 문항별 독립 추첨과 AI 응답 순서 일치 검증 |
| **응답 검증** | `apps/mobile/src/domain/generator_validation.ts` | 객관식·단답형·서술형·빈칸형의 유형별 필수 필드와 값 검증 |
| **정답 셔플러** | `apps/mobile/src/domain/question_distribution.ts` | 4지선다 정답 위치(0~3) 균등 무작위 분산 및 연속 정답 방지 수학적 알고리즘 |
| **채점 엔진** | `apps/mobile/src/domain/grading.ts` | 빈칸형 로컬 채점과 단답형·서술형 AI 채점 |
| **영구 저장소** | `apps/mobile/src/data/app_storage.ts`, `apps/mobile/src/data/native_sqlite_backend.ts`, `apps/mobile/src/data/native_storage_migration.ts`, `apps/mobile/src/data/db.ts` | 웹 IndexedDB, Android SQLite 키-값 저장과 AsyncStorage 원본 보존형 이관 |
| **CBT 시험장** | `apps/mobile/src/features/exam/ExamSessionScreen.tsx` | 전체화면 오버레이 시험장, 4단계 입체 해설지, 복습 완료 후 과목자료함(Page 1) 직행 복귀 |
| **풀이공간** | `apps/mobile/src/features/exam/ScratchpadPanel.tsx`, `ScratchpadCanvas.*` | 문제별 필기, 마지막 획 되돌리기, 전체 지우기, 문제 이동 시 초기화 |
| **랭킹 연동** | `apps/mobile/src/domain/ranking_client.ts`, `apps/ranking-worker/` | 사용자가 선택한 경우에만 최소 랭킹 데이터 동기화, 순위 조회 API 제공 |
| **과목자료함** | `apps/mobile/src/features/library/LibraryScreen.tsx` | 과목 목록, 소단원 목록, 교재 텍스트 첨부, 문제은행 누적 보관 및 시험 응시 |
| **출제 설정 팝업**| `apps/mobile/src/components/modals/QuizCountModal.tsx` | 과목의 시작 난이도 기본 표시, 난이도 변경, 혼합·객관식만·주관식만 선택과 3/5문제 선택 |
| **과목 추가 팝업**| `apps/mobile/src/components/modals/TopicModal.tsx` | 과목명, 카테고리 칩, 시작 난이도 4단계 선택, 등록 즉시 과목자료함 직행 |
| **배포 스크립트** | `deploy-gh-pages.ps1` | `npx expo export` 정적 빌드, `.nojekyll`, `404.html`, `version.json` 포함 원클릭 GitHub Pages 배포 |

---

## 🔄 4. 최근 핵심 아키텍처 개편 및 버그 픽스 내역 (Recent Updates)

1. **과목 난이도 자동 고정 시스템 도입**:
   - `Topic` 엔티티에 `learnerLevel` 필드를 추가하여 앱 저장소에 영구 저장.
   - 단원의 [출제/풀기] 팝업([QuizCountModal](apps/mobile/src/components/modals/QuizCountModal.tsx)) 오픈 시, 처음에 과목 등록할 때 설정했던 난이도(예: `👑 심화`)가 기본값으로 노출.
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
   - 객관식 정답 위치 분산과 문항 유형 무작위 추첨은 서로 다른 단계로 유지.
   - 웹·네이티브 풀이공간에 연속 필기, 마지막 획 되돌리기, 전체 지우기와 문제별 초기화를 적용.

현재 Android 테스트 브랜치(`feature/android-app`)에는 SQLite 이관, Android PDF 생성·공유, 채점 미완료와 부분점수 처리, 사용자 정정, 문제 신고가 추가되어 있습니다. 이 브랜치의 코드는 `main`이나 공개 웹에 자동 반영되지 않습니다. 과거 변경 내역은 당시 적용 범위를 설명한 기록으로 읽습니다.

---

## 🛠️ 5. AI 개발자 공통 작업 및 배포 프로토콜

어떤 AI든 코드 수정 후 배포할 때는 다음 단계를 엄격히 따르십시오:

1. **타입 안전성 검증 (필수)**:
   ```bash
   cd apps/mobile
   cmd.exe /c npx tsc --noEmit
   ```
   (TypeScript 에러가 0건이어야 작업을 진행할 수 있습니다.)

2. **현재 작업 브랜치에 범위 지정 커밋**:
   ```powershell
   git add <변경 파일>
   git commit -m "수정: 명확한 변경 내역"
   ```

   원격 푸시, `main` 병합, APK 빌드, 웹 배포는 각각 별도의 승인·검증 단계입니다. 작업 브랜치에서 `main`으로 바로 푸시하지 않습니다.

3. **GitHub Pages 프로덕션 배포 (`gh-pages` 브랜치)**:
   ```powershell
   # 루트 디렉토리에서 실행
   powershell -ExecutionPolicy Bypass -File .\deploy-gh-pages.ps1
   ```
   이 스크립트는 `apps/mobile/dist/`를 빌드하고, GitHub Pages에 필수적인 `.nojekyll`, SPA용 `404.html`, `version.json`을 자동으로 안전하게 포함하여 푸시합니다.

---

## 🤝 6. 인수인계 메시지 템플릿 (Handoff Prompt)

다른 AI(ChatGPT, Claude, Gemini)로 세션을 옮겨서 작업을 이어갈 때는 아래 한 줄과 함께 `AGENTS.md`를 참고하도록 지시하십시오:

> *"이 프로젝트는 Celueste CBT 플랫폼입니다. 루트의 `AGENTS.md`에 정의된 제품 헌법, 개발 안전 규칙, 파일 맵과 최근 업데이트 내역을 확인하고 동일한 원칙으로 다음 작업을 진행해 주세요."*

### 파일 기반 Claude-Codex 인수인계

- 구현과 검토를 주고받는 작업은 `docs/ai-handoff/README.md`의 프로토콜을 사용합니다.
- 작업 시작 시 `docs/ai-handoff/STATUS.json`을 확인하고 활성 작업이 있으면 `TASK.md`와 직전 담당자의 보고서를 먼저 읽습니다.
- Claude는 `CLAUDE_REPORT.md`, Codex는 `CODEX_REVIEW.md`에 결과를 기록합니다.
- `STATUS.json`의 `activeAgent`가 아닌 AI는 동시에 코드를 수정하지 않습니다.
- 이 인수인계 구조는 push, merge, deploy 승인을 대신하지 않습니다.
