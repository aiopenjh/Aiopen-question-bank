# Celueste Developer & Maintainer Guide

이 문서는 개발자와 저장소 관리자를 위한 기술 문서입니다. 사용자 기능과 사용법은 [README.md](README.md), AI 협업 불변 규칙은 [AGENTS.md](AGENTS.md)를 참고합니다.

## 1. 현재 구성

- 클라이언트: Expo 57, React Native 0.86, React 19, TypeScript
- 웹 저장소: IndexedDB 기반 로컬 저장소
- 네이티브 저장소: AsyncStorage, API 키는 별도 보안 저장 경로
- 로컬 알림: `expo-notifications`
- 문서/백업: ZIP, JSON, HTML, PDF 생성 지원
- 배포 대상: GitHub Pages 정적 웹, EAS Android 빌드

중앙 서버 없이도 기본 학습 기능이 동작하는 로컬 퍼스트 구조입니다. 네트워크는 AI 문제 생성, 업데이트 확인, 선택형 랭킹·의견 전송처럼 명시적인 기능에서만 사용합니다.

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
  - 새 주제로 학습하기 진입
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
  - 전체 화면 CBT 시험과 힌트 표시
- `apps/mobile/src/features/exam/ExamResultView.tsx`
  - 채점 결과, 오답 원인, 개념, 풀이 과정
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

## 5. AI 생성 파이프라인

- `apps/mobile/src/domain/ai_client.ts`: 키 형식 감지와 AI 제공사 통신
- `apps/mobile/src/domain/prompts.ts`: 출제 규칙과 응답 형식
- `apps/mobile/src/domain/generator.ts`: 생성 결과 검증과 문제 변환
- `apps/mobile/src/domain/question_distribution.ts`: 정답 위치 셔플
- `apps/mobile/src/domain/hint_generator.ts`: 기존 문제의 요청형 AI 힌트 생성
- `apps/mobile/src/hooks/useQuizGeneration.ts`: 화면에서 출제 흐름 조정

API 키가 없거나 통신에 실패할 때 임의 문제를 만들어 대체하지 않습니다. 연결 필요 또는 오류 상태를 반환해 사용자가 원인을 확인할 수 있게 합니다.

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
- 주요 행동은 분홍색, 보조 추가 행동은 민트색을 사용합니다.
- 모바일 입력 확대 방지를 위해 모든 `TextInput`은 16px 이상을 유지합니다.
- 접이식 영역은 행 전체가 클릭 가능하지만, 상태 인지를 위해 작은 화살표를 함께 표시합니다.
- 화면 문구와 조작 요소는 한국어 우선으로 작성하고, 장식용 영어는 보조 역할로 제한합니다.

## 9. 변경 전 확인 사항

1. 루트 `AGENTS.md`의 9대 불변 규칙 확인
2. 관련 화면과 데이터 흐름만 최소 범위로 수정
3. 새 라이브러리 도입 전 승인
4. 기존 사용자 데이터와 백업 마이그레이션 보존
5. 입력 폰트 16px 이상 유지
6. `cmd.exe /c npx tsc --noEmit` 통과

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
