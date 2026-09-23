# Celueste Developer & Maintainer Guide

이 문서는 개발자와 저장소 관리자가 가장 먼저 보는 **공식 기술 입구**입니다. 사용자 기능과 사용법은 [README.md](README.md), 변경 불가 원칙은 [AGENTS.md](AGENTS.md), 상세 흐름은 [docs/ARCHITECTURE_WORKFLOW_V2.md](docs/ARCHITECTURE_WORKFLOW_V2.md)를 참고합니다.

문서별 책임은 다음처럼 구분합니다.

- `README.md`: 사용자용 설치·기능·사용법
- `DEVELOPER.md`: 현재 구현의 개발자용 요약과 작업 기준
- `AGENTS.md`: 어떤 AI와 개발자도 지켜야 할 제품 헌법과 개발 안전 규칙
- `docs/ARCHITECTURE_WORKFLOW_V2.md`: 계층, 데이터 흐름, 외부 연결, 실패 처리의 상세 기준
- `AI_SHARED_CONTEXT.md`: 다른 AI에게 넘기는 짧은 인수인계문
- `docs/PRODUCT_ROADMAP_AND_BETA_PLAN.md`: 완료 기능과 다음 출시 과제

## 1. 현재 구성

- 클라이언트: Expo 57, React Native 0.86, React 19, TypeScript
- 웹 저장소: IndexedDB 기반 로컬 저장소
- 네이티브 저장소: AsyncStorage, API 키는 별도 보안 저장 경로
- 로컬 알림: `expo-notifications`
- 문서/백업: ZIP, JSON, HTML, PDF 생성 지원
- 배포 대상: GitHub Pages 정적 웹, EAS Android 빌드
- 선택형 랭킹 서버: Cloudflare Workers + D1 + Rate Limiting

중앙 서버 없이도 기본 학습 기능이 동작하는 로컬 퍼스트 구조입니다. 네트워크는 AI 문제 생성, 업데이트 확인, 선택형 랭킹·의견 전송처럼 명시적인 기능에서만 사용합니다.

핵심 흐름은 `App.tsx → AppView/useAppController → 기능 훅 → domain → repository → app_storage → IndexedDB/AsyncStorage`입니다. 화면은 저장소나 외부 API를 직접 다루지 않고 각 계층의 책임을 거칩니다.

| 계층 | 책임 | 대표 위치 |
| --- | --- | --- |
| 화면 | 사용자 입력과 상태 표시 | `src/features`, `src/components` |
| 오케스트레이션 | 화면 이벤트와 여러 기능 연결 | `App.tsx`, `useAppController.ts` |
| 기능 훅 | 출제, 목차, 시험, 랭킹 흐름 관리 | `src/hooks` |
| 도메인 | AI 요청, 검증, 채점, 분산 규칙 | `src/domain` |
| 저장소 | 엔티티별 읽기·쓰기와 백업 | `src/data/repositories` |
| 저장 엔진 | 웹 IndexedDB와 네이티브 AsyncStorage 추상화 | `src/data/app_storage.ts` |
| 선택형 서버 | 공개 랭킹과 최소 통계 처리 | `apps/ranking-worker` |

## 2. 로컬 개발

```powershell
cd apps/mobile
npm install
npm run web
```

Expo 개발 서버:

```powershell
cd apps/mobile
npm start
```

로컬 랭킹 클라이언트는 기본적으로 `http://localhost:8787`을 사용합니다. 운영 Worker로 연결해 확인할 때는 Expo 실행 전에 환경 변수를 지정합니다.

```powershell
$env:EXPO_PUBLIC_RANKING_API_URL = "https://celueste-ranking-api.celueste-ranking-worker.workers.dev"
npm run web
```

로컬 랭킹 Worker와 D1을 함께 실행할 때는 별도 터미널에서 다음 순서로 준비합니다.

```powershell
cd apps/ranking-worker
npm install
npm run db:migrate:local
npm run dev
```

`wrangler dev`가 기본 `http://localhost:8787`에서 실행되면 Expo 개발 클라이언트가 별도 환경 변수 없이 로컬 Worker를 사용합니다. 운영 D1에는 로컬 마이그레이션 명령을 사용하지 마세요.

타입 검사:

```powershell
cd apps/mobile
cmd.exe /c npx tsc --noEmit
```

프로젝트 테스트가 필요한 작업에서는 변경 범위에 맞는 테스트를 선택해 실행합니다.

```powershell
cd apps/mobile
node --test tests/*.cjs
```

## 3. 주요 화면 구조

### 메인

- `apps/mobile/src/features/study/StudyMapScreen.tsx`
  - TODAY'S STUDY 카드
  - 최근 과목, 목표 진행률, 응원 문구, 이어서 학습하기
  - 워터마크 중앙의 반투명 자유 주제 검색 영역과 일반·엉뚱한 주제 예시
- `apps/mobile/src/features/study/DailyInspirationCard.tsx`
  - 메인 카드 안의 짧은 응원 문구와 새로고침

### 자료함

- `apps/mobile/src/features/library/LibraryScreen.tsx`
  - 과목 목록과 선택 과목의 단원·문제 보관함
  - 기존 문제 즉시 시작과 새 문제 생성 분리
- `apps/mobile/src/features/library/libraryBaseStyles.ts`
- `apps/mobile/src/features/library/libraryNavigationStyles.ts`
  - 단일 백색 패널, 구분선 중심의 가벼운 레이아웃

### 설정

- `apps/mobile/src/features/settings/SettingsScreen.tsx`
  - 학습 루틴, 접이식 AI 연결, 접이식 데이터 관리
  - 상단 사용설명서 링크, 하단 버전·갱신 표시
- `apps/mobile/src/features/settings/AlarmConfigSection.tsx`
  - 공통 요일과 최대 8개의 다중 알람 시간
  - `HH:MM` 직접 입력, 중복 방지, 개별 삭제
- `apps/mobile/src/features/settings/AppVersionSection.tsx`
  - 의견 보내기 아래의 최소 버전·갱신 UI

### 시험

- `apps/mobile/src/features/exam/ExamSessionScreen.tsx`
  - 전체 화면 CBT 시험, 힌트, 문제별 풀이공간 상태 조정
- `apps/mobile/src/hooks/useExamSession.ts`
  - 시험 시작 회차와 제출 기록 저장
  - 레벨 31 이상은 새 문제 생성 직후 `challengeEligible`로 시작한 3문항 회차만 순차 통과 기록으로 저장
- `apps/mobile/src/domain/challenge_progress.ts`
  - 과목별 레벨 31 이상 순차 통과 복원과 3문항 중 2문항 통과 검증
  - 기존 문제 복습, 오답 복습과 기한 복습은 일반 풀이로 저장하며 초고난도 도전 진도에서 제외
- `apps/mobile/src/features/exam/ExamActiveView.tsx`
  - 객관식 선택, 빈칸별 입력, 단답형·서술형 텍스트 입력
  - 문제·보기·답안 입력에 플랫폼 기본 한글 시스템 글꼴 적용
- `apps/mobile/src/features/exam/ExamResultView.tsx`
  - 유형별 제출 답안과 채점 결과, 오답 원인, 개념, 해설
- `apps/mobile/src/features/exam/ScratchpadPanel.tsx`
- `apps/mobile/src/features/exam/ScratchpadCanvas.web.tsx`
- `apps/mobile/src/features/exam/ScratchpadCanvas.tsx`
- `apps/mobile/src/features/exam/scratchpadDrawing.ts`
  - 웹 SVG 연속 경로와 네이티브 연결 선분 기반 필기
  - 마지막 획 되돌리기, 전체 지우기, 문제 이동 시 컴포넌트 재생성
- `apps/mobile/src/components/MathText.tsx`
- `apps/mobile/src/domain/math_notation.ts`
  - 저장 원문을 변경하지 않고 화면 렌더링 단계에서 수학 표기 처리

## 4. 앱 오케스트레이션

- `apps/mobile/App.tsx`
  - 최상위 화면·모달·시험 오버레이 조합
- `apps/mobile/src/components/AppView.tsx`
  - 메인, 자료함, 설정 페이지 연결
- `apps/mobile/src/hooks/useAppController.ts`
  - 화면 이벤트와 기능 훅 연결
- `apps/mobile/src/hooks/useBookPagerGesture.ts`
  - 3페이지 좌우 이동과 모바일 뷰포트 보호

`App.tsx`에 도메인 로직을 추가하지 말고 기능별 훅·컴포넌트로 분리합니다.

### 화면에서 문제 저장까지

1. `StudyMapScreen` 또는 `LibraryScreen`이 과목·단원 선택 이벤트를 전달합니다.
2. `useAppController`가 `useCurriculumManager` 또는 `useQuizGeneration`에 작업을 위임합니다.
3. `generator.ts`가 AI 클라이언트를 호출하고 응답 구조를 검증합니다.
4. 문제 유형 계획과 객관식 정답 위치 분산을 적용합니다.
5. 저장소 계층이 문제 리비전과 제출키를 IndexedDB 또는 AsyncStorage에 기록합니다.
6. `ExamSessionScreen`은 저장된 문제를 받아 CBT 오버레이를 표시합니다.

화면 컴포넌트에서 AI 제공자나 저장 엔진을 직접 호출하지 않습니다. 생성 실패 시 부분 결과나 가짜 문제를 저장하지 않습니다.

## 5. AI 생성 파이프라인

- `apps/mobile/src/domain/ai_client.ts`: 키 형식 감지와 AI 제공사 통신
- `apps/mobile/src/domain/question_type_plan.ts`: 문항별 문제 유형 독립 추첨과 AI 응답 일치 검사
- `apps/mobile/src/domain/prompts.ts`: 추첨 결과를 포함한 출제 규칙과 유형별 응답 형식
- `apps/mobile/src/domain/generator_validation.ts`: 객관식·단답형·서술형·빈칸형별 AI 응답 구조 검증
- `apps/mobile/src/domain/generator.ts`: 생성 호출, 추첨 결과 검증, 저장 모델 변환
- `apps/mobile/src/domain/question_distribution.ts`: 정답 위치 셔플
- `apps/mobile/src/domain/grading.ts`: 단답형·서술형 AI 채점과 빈칸형 로컬 채점
- `apps/mobile/src/domain/hint_generator.ts`: 기존 문제의 요청형 AI 힌트 생성
- `apps/mobile/src/hooks/useQuizGeneration.ts`: 화면에서 출제 흐름 조정

API 키가 없거나 통신에 실패할 때 임의 문제를 만들어 대체하지 않습니다. 연결 필요 또는 오류 상태를 반환해 사용자가 원인을 확인할 수 있게 합니다.

### 문제 유형 추첨

`createQuestionTypePlan()`은 문항마다 서로 독립적으로 다음 범주를 같은 확률로 추첨합니다.

- `multiple_choice`: 객관식, 확률 1/3
- 주관식 범주: 확률 1/3. 범주 안에서 `short_answer`와 `essay`를 다시 1/2 확률로 선택
- `cloze`: 빈칸형, 확률 1/3

문항 구성 비율과 연속 유형을 보정하지 않으므로 3문항 모두 객관식·주관식·빈칸형인 결과도 허용합니다. 모든 난이도에서 네 유형을 사용할 수 있으며, 프롬프트가 답안 길이와 요구 지식을 학습자 난이도에 맞춥니다.

추첨 배열은 프롬프트에 정확한 순서로 전달됩니다. AI 응답의 `questionType` 배열이 추첨 결과와 다르면 `matchesQuestionTypePlan()`에서 생성 실패로 처리해 의도하지 않은 유형 대체를 저장하지 않습니다. 이후 객관식 정답 위치를 분산하고 전체 문항 순서를 Fisher-Yates 방식으로 섞습니다.

### 유형별 채점

- `multiple_choice`: 저장된 정답 옵션 ID와 로컬 비교
- `cloze`: 허용 정답을 공백·대소문자 기준으로 정규화해 로컬 비교하며, 여러 빈칸은 부분 점수를 계산
- `short_answer`: 모범답안의 핵심 의미 일치를 AI에 요청해 0점 또는 100점 판정
- `essay`: 2~5개의 체크리스트와 총 100점 배점을 기준으로 AI가 항목별 충족 여부를 반환

주관식 AI 채점에 실패해도 제공자 예외 원문을 저장하지 않습니다. 고정 안내와 사용자의 제출 답안을 보존하며 자동 재시도하지 않습니다.

## 6. 저장소와 백업

- `apps/mobile/src/data/app_storage.ts`
  - 웹 IndexedDB와 네이티브 AsyncStorage의 공통 어댑터
  - 구형 웹 저장값을 IndexedDB로 이관
- `apps/mobile/src/data/db.ts`
  - 저장소 초기화와 공개 데이터 API
- `apps/mobile/src/data/repositories/`
  - 과목, 문제, 자료, 백업, 랭킹 저장 책임 분리
- `apps/mobile/src/data/storage_keys.ts`
  - 저장 키의 단일 정의

백업은 학습 데이터와 알람 설정을 포함하지만 API 키는 포함하지 않습니다. 복원 로직을 변경할 때는 신규 형식뿐 아니라 기존 백업 형식도 계속 읽을 수 있어야 합니다.

### 랭킹 서버

- `apps/mobile/src/domain/ranking_client.ts`: Worker API 호출과 오류 범주화
- `apps/mobile/src/hooks/useRankingWindow.ts`: 최초 참여, 복구, 탈퇴와 리더보드 상태
- `apps/mobile/src/data/repositories/ranking_repository.ts`: 기기 토큰과 자동 연동 대기 상태 저장
- `apps/ranking-worker/src/routes.mjs`: 참여자 등록, 복구, 당일 기록 동기화, 리더보드, 탈퇴
- `apps/ranking-worker/src/util.mjs`: 토큰 해시, CORS, 서울 날짜와 닉네임 검증

운영 API는 `https://celueste-ranking-api.celueste-ranking-worker.workers.dev`입니다. 최초 닉네임 등록 뒤 시험 완료 시 세 랭킹 지표를 함께 자동 동기화합니다. 닉네임 검사는 서버에서 2~12자 제한, 중복, 운영자 사칭, 욕설·성적 표현과 공백·기호를 이용한 우회를 차단합니다. 문제 내용, 정답, 과목명과 API 키는 전송하지 않습니다.

| 메서드와 경로 | 역할 |
| --- | --- |
| `POST /v1/participants` | 닉네임 등록과 기기·복구 토큰 발급 |
| `POST /v1/participants/recover` | 백업의 복구 토큰으로 새 기기 토큰 발급 |
| `POST /v1/sync/today` | 오늘 완료 수와 최고 순차 통과 레벨 동기화 |
| `GET /v1/leaderboard` | 세 가지 공개 랭킹 조회 |
| `DELETE /v1/participants/me` | 3일 유예 탈퇴 요청 |

서버 DB에는 기기·복구 토큰 원문을 저장하지 않고 SHA-256 해시만 저장합니다. 같은 날 완료 수와 최고 레벨은 `MAX` 규칙으로 갱신해 재시도로 누적치가 부풀지 않게 합니다. 자동 연동 실패는 클라이언트 저장소에 대기 상태로 남기고 다음 시험 완료 시 최신 값으로 다시 시도합니다.

## 7. 알람 설정 스키마

현재 알람 형식은 `schemaVersion: 2`입니다.

```ts
interface AlarmTime {
  hour: number;   // 0..23
  minute: number; // 0..59
}

interface AlarmConfig {
  schemaVersion: 2;
  enabled: boolean;
  times: AlarmTime[];
  selectedDays?: ('월' | '화' | '수' | '목' | '금' | '토' | '일')[];
  weekendEnabled?: boolean;
}
```

`apps/mobile/src/utils/notifications.ts`의 `normalizeAlarmConfig()`가 다음 형식을 모두 읽습니다.

1. `times[]`를 사용하는 현재 다중 알람
2. `enabled + hour + minute`의 이전 단일 알람
3. `morningEnabled/morningHour + eveningEnabled/eveningHour`의 구형 알람

마이그레이션 시 시간 범위를 검증하고, 중복을 제거한 뒤 오름차순으로 정렬합니다. 네이티브 알림은 `선택 요일 × 등록 시간` 조합으로 예약됩니다. 웹 인앱 알림은 페이지가 실행 중일 때 30초 간격으로 현재 시각을 확인합니다.

알람 스키마를 변경하면 함께 확인할 파일:

- `apps/mobile/src/utils/notifications.ts`
- `apps/mobile/src/features/settings/AlarmConfigSection.tsx`
- `apps/mobile/src/hooks/useAppBackup.ts`
- `apps/mobile/src/data/repositories/backup_repository.ts`

## 8. UI 원칙

- 메인, 자료함, 설정은 각각 하나의 큰 백색 패널을 기본 골격으로 사용합니다.
- 중첩 카드와 그림자를 반복하지 않고 1px 구분선으로 섹션을 나눕니다.
- 중앙 책 이미지와 `Celueste` 문자는 낮은 불투명도의 워터마크로만 사용합니다.
- 자유 주제 진입은 워터마크 중앙의 반투명 검색 영역으로 제공하고, 현재 학습을 이어가는 주 행동과 분리합니다.
- 주요 행동은 분홍색, 보조 추가 행동은 민트색을 사용합니다.
- 모바일 입력 확대 방지를 위해 모든 `TextInput`은 16px 이상을 유지합니다.
- 접이식 영역은 행 전체가 클릭 가능하지만, 상태 인지를 위해 작은 화살표를 함께 표시합니다.
- 화면 문구와 조작 요소는 한국어 우선으로 작성하고, 장식용 영어는 보조 역할로 제한합니다.

## 9. 변경 전 확인 사항

1. 루트 `AGENTS.md`의 제품 헌법과 개발 안전 규칙 확인
2. 관련 화면과 데이터 흐름만 최소 범위로 수정
3. 새 라이브러리 도입 전 승인
4. 기존 사용자 데이터와 백업 마이그레이션 보존
5. 입력 폰트 16px 이상 유지
6. `cmd.exe /c npx tsc --noEmit` 통과

현재 전체 회귀 테스트는 다음 명령으로 실행하며, 2026-09-22 보수 후 89개입니다.

```powershell
cd apps/mobile
node --test tests/*.cjs
```

문제 유형이나 풀이공간을 변경할 때 함께 확인할 테스트:

- `tests/question_type_plan.test.cjs`
- `tests/generator.test.cjs`
- `tests/cloze.test.cjs`
- `tests/scratchpad.test.cjs`
- `tests/study_pipeline.test.cjs`

## 10. 커밋과 배포

일반 코드 반영:

```powershell
git add <변경 파일>
git commit -m "feat: 변경 내용"
git push origin main
```

GitHub Pages 배포는 별도 승인된 경우에만 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy-gh-pages.ps1
```

이 스크립트는 정적 번들, `.nojekyll`, `404.html`, `version.json`을 준비하고 `gh-pages` 브랜치로 푸시합니다. 일반 `main` 푸시와 프로덕션 배포는 별개의 작업입니다.

랭킹 Worker 배포:

```powershell
cd apps/ranking-worker
npm test
npm run deploy
```

### 배포 전 확인 순서

1. `git status`로 사용자 작업과 변경 범위를 확인합니다.
2. `apps/mobile`에서 `cmd.exe /c npx tsc --noEmit`을 통과시킵니다.
3. Worker 변경이 있으면 `apps/ranking-worker`에서 `npm test`를 통과시킵니다.
4. 사용자 화면·동작 변경을 `README.md`에 반영합니다.
5. 구조·환경 변수·운영 절차 변경을 `DEVELOPER.md`에 반영합니다.
6. 배포된 변경을 `CHANGELOG.md`에 기록합니다.
7. 앱 릴리스라면 `buildInfo.ts`와 `public/version.json`의 버전·빌드 시각을 맞춥니다.
8. `main`을 푸시한 뒤 승인된 대상만 Worker와 GitHub Pages에 배포합니다.
9. 운영 `version.json`, Worker `/health`, GitHub Pages Actions 결과를 확인합니다.

문구 정리나 사용설명서 보완처럼 사용자가 버전 유지 배포를 명시한 경우에는 `buildInfo.ts`와 버전 번호를 변경하지 않습니다. 이 경우에도 문서와 커밋에는 실제 변경 내용을 남깁니다.

Android APK 빌드:

```powershell
cd apps/mobile
npx eas-cli build -p android --profile preview
```

## 11. 관련 문서

- [AGENTS.md](AGENTS.md): AI 협업과 불변 개발 규칙
- [AI_SHARED_CONTEXT.md](AI_SHARED_CONTEXT.md): 다른 AI로 작업을 넘길 때의 공통 맥락
- [CHANGELOG.md](CHANGELOG.md): 버전별 변경 이력
- [docs/ARCHITECTURE_WORKFLOW_V2.md](docs/ARCHITECTURE_WORKFLOW_V2.md): 상세 아키텍처
- [docs/PRODUCT_ROADMAP_AND_BETA_PLAN.md](docs/PRODUCT_ROADMAP_AND_BETA_PLAN.md): 제품 로드맵

문서별 갱신 기준:

- 사용자에게 보이는 버튼, 화면 순서, 개인정보 처리나 사용 방법이 바뀌면 `README.md`와 앱의 `UserManualModal.tsx`를 함께 확인합니다.
- 아키텍처, 환경 변수, 테스트, 서버나 배포 방식이 바뀌면 `DEVELOPER.md`를 갱신합니다.
- 배포된 동작이 바뀌면 `CHANGELOG.md`에 해당 버전 또는 버전 유지 추가 배포 내역을 기록합니다.
- 불변 원칙이나 AI 협업 규칙을 바꿀 때만 `AGENTS.md`를 수정합니다.

## 12. 현재 운영 제약과 다음 우선순위

- 주관식 채점은 AI 통신이 필요합니다. 현재 채점 실패 답안은 보존되지만 자동 재채점 화면은 없습니다.
- 주관식 채점은 `domain/exam_grading.ts`에서 동시에 최대 2개 요청으로 제한합니다. 공급자 제한과 비용은 Beta에서 관찰해야 합니다.
- 백업은 최상위 스키마를 검사하지만 중첩 객체 검증을 더 강화할 여지가 있습니다.
- 웹 자동 회귀는 도메인 테스트 중심이며 실제 브라우저 E2E는 아직 별도 구축 대상입니다.
- 랭킹 Worker와 D1은 운영 배포되어 있습니다. 로컬 Expo는 기본적으로 `localhost:8787`을 사용하므로 운영 서버 시험 시 환경 변수 주입이 필요합니다.
- 현재 앱 릴리스 표시는 `v2.3.6`입니다. 다음 배포에서도 `buildInfo.ts`, `public/version.json`, 변경 이력을 같은 버전으로 갱신해야 합니다.

## 13. 성능 보수 경계 (2026-09-22)

- `question_history.ts`: 기존 submissionKey 부분 일치와 저장 순서를 유지하는 오답 인덱스. 초기 로딩·시험 완료 시 이미 읽은 배열을 재사용합니다.
- `exam_grading.ts`: 화면에서 분리한 유형별 채점 조정. 최대 동시 요청 2개, 결과 순서 보존. 기존 화면의 타입 export는 호환성을 위해 유지합니다.
- `AppView`: 첫 방문 때 페이지를 마운트한 뒤 유지합니다. 기존 시험 오버레이·페이지 상태는 보존합니다.
- `useAppController`: 날짜와 관련 배열이 바뀔 때만 복습·오늘 집계를 재계산합니다.
- `useSourceManager`: PDF 라이브러리를 요청 시 로딩합니다. 웹 export에서 PDF 코드가 별도 번들로 분리됩니다.
- TypeScript는 `noUnusedLocals`와 `noUnusedParameters`를 기본 적용하여 사용되지 않는 import, props와 콜백이 다시 누적되지 않게 합니다.
- `topic_unit_repository.ts`의 다중 저장은 공통 롤백 경계를 사용해 과목·단원 삭제 중 실패 시 기존 스냅샷 복원 순서를 유지합니다.
- 생성기 내 구형 주석 검증기 제거, 힌트 검증은 `generator_validation.ts`로 통합하고 기존 export를 유지합니다.
- 현재 저장 스키마와 백업 형식은 유지합니다. 문제별 IndexedDB 레코드 전환은 별도 마이그레이션·복구 검증이 필요한 후속 작업입니다.
- 목록 가상화, ZIP 비동기 처리, PDF 메모리 한도, 방문 후 화면 렌더링 최적화 및 이미지 용량 축소는 추가 계측 후 진행할 항목입니다.

## 14. 개발 수준과 다음 성장 기준 (2026-09-23)

기능을 구현하는 순수 코딩 능력만 놓고 보면 실무 연차별 차이가 항상 크지는 않습니다. 연차가 높아질수록 더 크게 드러나는 차이는 코드의 화려함보다 **운영 중 발생할 문제를 미리 예상하고 통제하는 판단력**입니다.

Celueste는 현재 로컬 퍼스트 학습 데이터, AI 문제 생성, 여러 문제 유형과 채점, 백업, 알람, 랭킹 확장을 포함하므로 단순한 입문용 구현 단계를 넘어섰습니다. 앞으로의 수준 향상은 기능 수를 늘리는 것보다 다음 항목을 실제 서비스 환경에서 완주하는 데 달려 있습니다.

- 서버와 랭킹을 연결했을 때 동시 접속, 중복 요청, 지연 및 장애를 통제한다.
- 앱 업데이트와 데이터 스키마 변경 후에도 기존 사용자 데이터를 안전하게 보존한다.
- API 키, 개인정보, 비용 한도와 악용 방지 정책을 제품 구조에 포함한다.
- 장애를 재현하고 관찰할 수 있도록 로그·지표·오류 추적 기준을 마련한다.
- 배포 전 검증, 단계적 출시, 실패 시 롤백과 복구 절차를 준비한다.
- 성능을 추측으로 고치지 않고 측정 결과에 따라 병목만 분리하고 최적화한다.
- 새 기능을 빠르게 추가하면서도 기존 기능과 저장 형식이 깨지지 않게 회귀 검증을 유지한다.

따라서 이 프로젝트의 다음 목표는 “더 복잡한 코드를 작성하는 것”이 아니라 **실패·확장·데이터·보안·비용·배포를 예측 가능하게 관리하는 제품 운영 역량을 갖추는 것**입니다. 개발자 수준은 특정 연차의 이름보다 이러한 과정을 독립적으로 판단하고 끝까지 책임져 본 경험으로 평가합니다.
