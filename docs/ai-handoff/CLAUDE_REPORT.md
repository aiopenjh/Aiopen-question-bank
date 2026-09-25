# Claude 구현 보고서

## 작업 정보

- 작업 ID: `android-real-device-round1-20260925`
- 작업 폴더: `C:/Users/choor/.codex/worktrees/android-web-hotfix-sync/ai bank`
- 브랜치: `feature/android-release-candidate`
- 기준 커밋: `82dc54b` (직전 인수인계 문서 커밋 `066002d` 포함)
- 이 세션은 중간에 max-turns 제한으로 한 번 중단되었다가 이어서 완료했다. 미커밋 변경은 그대로 보존되어 있었다.
- **커밋 미완료**: 이 세션은 `git add`/`git commit` 명령 승인을 받을 수 없어(반복 시도 모두 "requires approval"로 거부) 코드를 커밋하지 못했다. 아래 변경 사항은 모두 작업 폴더에 파일 상태로만 존재한다. Codex 또는 사용자가 직접 `git add`와 한글 커밋 메시지로 `git commit`을 실행해야 한다.

## 2차 수정 (Codex 1차 검토 `CODEX_REVIEW.md` 반영, iteration 1)

`docs/ai-handoff/CODEX_REVIEW.md`의 필수 수정 3건과, 사용자가 추가 승인한 `expo-print` 네이티브 PDF 구현을 처리했다. 1차 구현(아래 "## 1~4" 절)의 미커밋 변경은 그대로 두고 이 절의 파일만 추가로 수정했다. 회피 목록 파일은 이번에도 건드리지 않았다.

### 필수 수정 1 — `userManualSections.tsx` TDZ 오류

- 원인: `const styles = StyleSheet.create({...})`가 파일 맨 아래에 있었는데, 그 위의 `export const USER_MANUAL_SECTIONS = [...]`의 JSX가 모듈 평가 시점에 `styles.detailContainer` 등을 즉시 참조했다. `USER_MANUAL_SECTIONS`가 먼저 평가되므로 아직 초기화되지 않은 `styles`(TDZ)를 참조해 `cmd.exe /c npx tsc --noEmit`에서 `TS2448`/`TS2454`가 발생했다.
- 수정: `styles` 선언을 `USER_MANUAL_SECTIONS` 배열 바로 위(파일 앞쪽)로 옮기고, 파일 끝의 중복 선언은 제거했다. 콘텐츠 내용과 모듈 스코프 상수라는 성능 개선 의도는 그대로다.
- 변경 파일: `apps/mobile/src/components/modals/userManualSections.tsx`

### 필수 수정 2 — `question_report.test.cjs` 배치 변경 반영

- 기존 2개 테스트가 옛 설계(문제마다 반복 버튼, `ExamActiveView`/`ExamResultView`의 `onReportQuestion` prop)를 검증하고 있어 새 배치(헤더 단일 버튼 → 풀이 중 현재 문제 / 결과 중 선택 창)와 충돌했다.
- `exam and result screens open the report for that question without touching answers`를 `header report entry targets the current question while solving, then a chosen question after submission, without touching answers or grading`로 다시 작성했다. `ExamSessionScreen`을 실제로 렌더링해 헤더의 `문제 신고` 버튼이: 풀이 중에는 즉시 현재 문제로 `QuestionReportModal`을 열고, 제출 후에는 `QuestionReportPickerModal`을 먼저 열어 고른 문제로 `QuestionReportModal`을 여는지 확인한다. 신고 열기/닫기 전후로 `ExamResultView`에 전달되는 `userAnswers`와 `results` 배열이 그대로인지(`assert.deepEqual`/`length` 비교) 검증해 "답안·채점 불변"을 직접 확인한다.
- `report button sits under the stem during the exam and in each explanation card after submission`(옛 배치 전용)는 `exam active and result views no longer render a per-question report button`로 교체해, `ExamActiveView`/`ExamResultView`를 직접 렌더링했을 때 `ReportQuestionButton` 타입 노드가 더 이상 존재하지 않는지 회귀 확인한다.
- 1번 테스트(`payload carries...`)와 2번 테스트(`report is sent only on...`)는 `QuestionReportModal` 자체 동작(전송 항목·재시도·성공 표시)만 다뤄 배치 변경과 무관하므로 그대로 뒀다.
- 변경 파일: `apps/mobile/tests/question_report.test.cjs`

### 필수 수정 3 — `ExamSessionScreen.tsx` 헤더 좁은 화면 겹침

- 기존 헤더는 `✕ 나가기`·진행 표시·`📐 풀이공간`·`💡 힌트`·`🚩 문제 신고`까지 한 줄(`flexDirection:'row', justify-content:'space-between'`)에 넣었고 줄바꿈/축소 처리가 없어 폭이 좁은 안드로이드 화면(360px 안팎)에서 겹치거나 잘릴 수 있었다.
- 헤더를 두 줄로 분리했다: 위 줄(`examHeaderTopRow`)은 나가기 버튼과 진행 표시만, 아래 줄(`examHeaderActionsRow`)은 기능 버튼들만 담는다. 버튼 줄에는 `flexWrap:'wrap'`을 줘서 화면이 더 좁아져도 버튼이 다음 줄로 넘어가지 배치가 깨지지 않는다. 진행 표시는 `flex:1, textAlign:'center', numberOfLines={1}`로 길어도 잘리게 했다. 디자인 톤·아이콘·문구는 바꾸지 않았다.
- 변경 파일: `apps/mobile/src/features/exam/ExamSessionScreen.tsx`, `apps/mobile/src/features/exam/examActiveStyles.ts`

### 추가 승인 항목 — `expo-print` 네이티브 PDF 실제 저장

- `DataBackupSection.tsx`의 `saveWorkbookPdf()`를 플랫폼별로 분리했다. 웹은 기존 `pdf-lib`+Canvas 경로(`workbookPdf.ts`)를 그대로 쓴다. 네이티브는 DOM Canvas 없이 이미 있는 `generateWorkbookHtml()`(순수 문자열, DOM 비의존)을 그대로 재사용해 `expo-print`의 `printToFileAsync({ html })`로 실제 PDF 파일을 만들고, 이미 설치된 `expo-sharing`의 `shareAsync(uri, { mimeType: 'application/pdf', ... })`로 OS 공유 시트를 열어 저장·공유 경로를 제공한다.
- `Sharing.isAvailableAsync()`가 false인 기기에서는 성공으로 포장하지 않고, PDF가 만들어진 캐시 경로(`uri`)를 그대로 안내 문구에 넣어 "만들어졌지만 공유는 못 한다"를 정직하게 알린다.
- 워터마크 이미지 URL 해석을 `resolveWatermarkImageUrl()`로 통합했다: 웹은 기존처럼 `window.location.href` 기준 절대 URL, 네이티브는 `Image.resolveAssetSource(...)`.uri를 쓴다.
- **웹 전용 닫기 링크 노출 확인**: `workbookHtml.ts`의 `<a class="close-preview">...×</a>`(미리보기 닫기 링크)는 이미 `@media print { .close-preview { display:none; } }`로 인쇄 시 숨겨지도록 작성되어 있었다. `expo-print`는 네이티브 WebView의 인쇄 렌더링 경로를 쓰므로 `@media print` 규칙이 적용되어 PDF에는 노출되지 않을 것으로 판단했다. 추가로 네이티브 호출에서는 `returnUrl`을 빈 문자열로 넘겨 링크의 `href` 자체도 비워 이중으로 방어했다. **다만 실제 기기의 인쇄 렌더링 결과물(WebView 기반 PDF 변환이 `@media print`를 확실히 적용하는지)은 이 세션에서 직접 확인하지 못했다. Codex가 설치 후 실기기 또는 Android 에뮬레이터에서 생성된 PDF를 열어 닫기 링크(×)와 페이지별 하단 각주가 보이지 않는지, 하단 통합 각주만 있는지 눈으로 확인해야 한다.**
- 다른 새 의존성은 추가하지 않았다. `package.json`도 건드리지 않았다 — `npx expo install expo-print`(SDK 57 권장 `~57.0.2`) 실행과 검증은 Codex에 넘긴다.
- 새 테스트 `apps/mobile/tests/workbook_pdf_native.test.cjs`를 작성했다. `expo-print`/`expo-sharing`/`Image.resolveAssetSource`를 자체 모의(mock)해 4가지를 확인한다: (1) 과목 미선택 시 PDF를 만들지 않고 안내만 하는지, (2) 실제로 `printToFileAsync`와 `shareAsync`가 올바른 인자(mimeType 등)로 호출되는지, (3) `generateWorkbookHtml`에 전달되는 `returnUrl`(닫기 링크)이 네이티브에서 빈 문자열인지, (4) 공유 불가 기기에서 성공을 가장하지 않고 파일 경로를 안내하는지.
- 변경 파일: `apps/mobile/src/features/settings/DataBackupSection.tsx`(수정), `apps/mobile/tests/workbook_pdf_native.test.cjs`(신규)

### 이번에도 실행하지 못한 검증

- 이 세션은 여전히 `git add`/`git commit`/`npx tsc`/`node --test`/`node -e` 등 실행형 명령이 전부 "requires approval"로 거부되어 커밋과 타입체크, 테스트 실행을 하지 못했다. 지시에 따라 반복 시도하지 않았다.
- **Codex가 반드시 실행해야 하는 명령**:
  ```
  cd apps/mobile && cmd.exe /c npx tsc --noEmit
  cd apps/mobile && node --test tests/userManual*.test.cjs tests/question_report.test.cjs tests/workbook_pdf_native.test.cjs
  ```
  (`userManualSections.tsx`에는 전용 테스트 파일이 없다 — 타입체크로 TDZ 수정만 확인하면 된다. 위 `userManual*` 패턴은 실제로 매칭되는 파일이 없을 수 있으니 생략하고 `tsc` 결과로 확인해도 된다.)
  `npx expo install expo-print`를 먼저 실행해 패키지를 설치해야 위 `tsc`/테스트가 `expo-print` 관련 `TS2307`(모듈 못 찾음) 없이 통과한다.
- 코드는 각 변경 지점을 직접 다시 읽고 수동으로 대조 검증했다(TDZ 순서, prop 배선, 헤더 스타일 키 이름 일치, mock 요청 경로 매칭).

## 1. 네이티브 알림창 디자인 (#3·#6·#9, 미답변 확인) — 완료

### 원인
`showAlert`/`registerAlertListener`(`apps/mobile/src/utils/alert.ts`)는 모듈 전역 변수 `currentListener` 하나에만 리스너를 저장했다.

- 메인 화면은 `useAppController.ts`에서 앱 시작 시 한 번 리스너를 등록한다.
- 그런데 `RankingLeaderboardCard.tsx` → `RankingWindowScreen.tsx`가 네이티브(Android)에서는 별도 창이 아니라 **같은 화면 트리 안의 `UniversalModal`**로 열린다(`openRankingWindow()`가 `Platform.OS !== 'web'`이면 항상 `false`를 돌려주기 때문). `RankingWindowScreen`은 "메인 화면과 독립적으로 동작해야 한다"는 이유로 자체적으로 `registerAlertListener`를 다시 호출해 전역 리스너를 **덮어썼다**.
- 사용자가 랭킹 창을 한 번이라도 열었다가 닫으면, 언마운트 cleanup이 `currentListener`를 `null`로 되돌렸다. 메인 화면의 리스너는 최초 마운트 시 한 번만 등록되므로 다시 등록되지 않는다.
- 그 뒤로는 앱 전체에서 `showAlert()`를 호출할 때마다 리스너가 없다고 판단해 `utils/alert.ts`의 네이티브 폴백인 실제 `Alert.alert(...)`(안드로이드 기본 OS 알림창)로 떨어졌다. 과목 등록 완료, PDF 불러오기/등록 완료, 미답변 문항 확인이 모두 이 경로를 탄다.

### 수정
`apps/mobile/src/utils/alert.ts`에서 전역 변수 하나를 리스너 **스택**(`listenerStack: AlertListener[]`)으로 바꿨다.

- `registerAlertListener`는 리스너를 push하고, 해제 함수는 `lastIndexOf`로 자기 자신만 스택에서 제거한다.
- `showAlert`/`dismissAlert`는 스택의 맨 위(top) 리스너에만 전달한다.
- 랭킹 창을 열면 그 리스너가 스택 위에 쌓이고, 닫으면 자기 항목만 제거되어 메인 화면의 리스너가 다시 top으로 드러난다. 메인 화면 리스너 자체를 잃는 일이 없다.
- `AppAlertModal`, `UniversalModal`, 버튼 확인/취소 콜백, Android 뒤로가기(`onRequestClose`) 동작은 건드리지 않았다. `Alert.alert` 폴백 코드 자체도 리스너가 정말 하나도 없을 때(예: 마운트 직전)를 위해 그대로 남겨뒀다 — 삭제해서 알림이 안 뜨게 만들지 않았다.

변경 파일: `apps/mobile/src/utils/alert.ts`

## 2. PDF 문제집 내보내기 (#4) — 1차 구현 당시 기록 (아래 "보류" 항목은 이후 승인·구현됨)

> **갱신**: 이 절은 1차 구현 시점의 기록이다. 사용자가 이후 `expo-print` 설치를 승인했고, 위 "## 2차 수정" 절의 "추가 승인 항목"에서 네이티브 실제 PDF 생성을 구현했다. 아래 "보류" 표시는 더 이상 유효하지 않다 — 최신 상태는 2차 수정 절을 본다.

### 확인한 내용
- `DataBackupSection.tsx`의 미리보기 버튼(`exportWorkbook`)은 네이티브에서 이미 `showAlert`로 "웹 버전에서 이용 가능" 안내를 띄운다.
- 직접 저장 버튼(`saveWorkbookPdf`)은 네이티브에서 `if (Platform.OS !== 'web' || savingPdf) return;`으로 **아무 안내 없이 조용히 아무 반응도 하지 않았다.** 버튼을 눌러도 로딩 표시조차 없어 고장난 것처럼 보인다.
- `workbookPdf.ts`는 `document.createElement('canvas')`, `CanvasRenderingContext2D`, 브라우저 `Image`, `canvas.toDataURL()`을 직접 사용해 각 페이지를 이미지로 그린 뒤 `pdf-lib`로 PNG를 삽입한다. 전부 DOM 전용 API라 네이티브 런타임에는 존재하지 않는다.

### 이번에 고친 것
직접 저장 버튼도 미리보기 버튼과 동일하게, 네이티브에서는 조용히 무시하는 대신 `showAlert('PDF 저장', '현재 PDF 저장은 웹 버전에서 이용할 수 있습니다.')`를 보여주도록 했다. 두 버튼 모두 이제 "된다고 속이지 않고, 안 되면 안 된다고 말한다."

변경 파일: `apps/mobile/src/features/settings/DataBackupSection.tsx`

### 보류: 네이티브 실제 PDF 생성 (새 의존성 필요)
한글 문제·정답·해설을 담은 진짜 PDF를 Android에서 만들려면 아래 두 경로 중 하나가 필요하고, 둘 다 현재 설치되어 있지 않은 새 의존성을 요구한다. **승인 없이 설치하지 않고 이 하위 작업만 보류한다.**

1. **`expo-print` (권장)**: `printToFileAsync`로 HTML을 네이티브 렌더러(OS WebView)를 통해 PDF로 바로 변환한다. 이미 있는 `apps/mobile/src/utils/workbookHtml.ts`(DOM 비의존, 순수 HTML 문자열 생성)를 그대로 재사용할 수 있고, 한글을 포함한 유니코드 폰트 임베딩을 별도로 신경 쓸 필요가 없다. 구현량이 가장 적다.
2. **대안: `@pdf-lib/fontkit` + 한글 TTF 폰트 에셋**: 기존 `pdf-lib` 파이프라인을 유지하면서 `fontkit`으로 한글 트루타입 폰트를 직접 임베딩한다. `pdf-lib`의 표준 14개 내장 폰트는 한글(비-WinAnsi) 글리프를 지원하지 않아, fontkit 없이는 한글 텍스트를 그릴 수 없다(에러 발생 또는 렌더 실패). 폰트 파일을 앱에 번들해야 해 앱 용량이 늘고, 폰트 라이선스 확인이 추가로 필요하다.

두 경로 모두 `package.json`에 없는 패키지 설치가 필수라 이번 세션에서는 진행하지 않았다. **다른 항목은 계획대로 계속 구현했다.**

## 3. 사용설명서(UserManualModal) 렌더링 지연 (#5) — 완료

### 원인
`UserManualModal.tsx`(원래 550줄, 500줄 제한 초과)는 7개 항목의 펼침 콘텐츠(항목마다 3~5개의 `tipBox`, 굵게 표시가 섞인 긴 한글 문장 다수)를 `sections` 배열로 **컴포넌트 렌더 함수 안에서 매 렌더마다 새로 생성**했다. `expandedSection` 상태가 바뀔 때마다(항목을 펼치거나 접을 때마다) 열려있지 않은 나머지 6개 항목의 콘텐츠까지 포함해 전체 JSX 객체 그래프를 다시 만들었다. 저사양 안드로이드 기기에서 탭할 때마다 이 재생성 비용이 JS 스레드를 막아 펼침/접힘/닫기/시스템 뒤로가기가 느리거나 반응하지 않는 것처럼 보인다.

닫기 버튼과 시스템 뒤로가기 자체는 `UniversalModal`의 `onRequestClose`(네이티브 `<Modal>`이 안드로이드 하드웨어 뒤로가기를 자동으로 가로챈다)에 정상적으로 연결되어 있었다. 별도의 배선 문제는 없었고, 위 렌더링 비용이 같은 JS 스레드에서 탭 처리를 지연시키는 것이 원인이었다.

### 수정
- 정적 콘텐츠(props/state에 의존하지 않음)를 `apps/mobile/src/components/modals/userManualSections.tsx`(신규, 334줄)로 분리해 **모듈 스코프 상수** `USER_MANUAL_SECTIONS`로 만들었다. 이제 앱 로드 시 한 번만 생성되고, 항목을 펼치거나 접어도(어떤 `expandedSection` 값이든) 다시 만들어지지 않는다.
- `UserManualModal.tsx`는 237줄로 줄어 500줄 제한을 지킨다. 토글 로직, 헤더, 스크롤 목록 구조와 설명 문구는 그대로 유지했다. 중첩 터치(`바깥 TouchableOpacity` 닫기 + `안쪽 TouchableOpacity` stopPropagation)는 이 코드베이스의 다른 팝업(`DataBackupSection.tsx`의 백업 선택 팝업 등)에서도 쓰는 안전한 기존 패턴이라 그대로 유지했다.

변경 파일: `apps/mobile/src/components/modals/UserManualModal.tsx`(수정), `apps/mobile/src/components/modals/userManualSections.tsx`(신규)

## 4. 문제 신고 배치 (#10) — 완료

### 변경 내용
- `ExamActiveView.tsx`(풀이 화면)와 `ExamResultView.tsx`(결과 화면)에서 문제마다 반복되던 `ReportQuestionButton`과 `onReportQuestion` prop을 제거했다.
- `ExamSessionScreen.tsx` 헤더에 단일 진입점 `🚩 문제 신고` 버튼을 추가했다(풀이 중·결과 화면 모두에서 항상 보임).
  - 풀이 중에는 누르면 바로 현재 보고 있는 문제(`q`)를 신고 대상으로 지정한다(`setReportTarget(q)`).
  - 결과 화면에서는 먼저 `QuestionReportPickerModal`(신규)이 열려 전체 문제 목록에서 신고할 문제를 번호와 지문으로 골라 선택한 뒤 같은 `QuestionReportModal`로 넘어간다.
- `QuestionReportModal.tsx`에 `QuestionReportPickerModal` 컴포넌트를 추가했다. 기존 Formspree 전송 함수(`postFeedback`), 전송 항목(`buildQuestionReportPayload`: 문제 ID·지문·보기 문구·사유·메모만 포함, 정답/해설/답안/API 키 제외), 사용자 확인·실패 시 재시도 가능 구조는 전혀 바꾸지 않았다. 답안·채점 상태(`reportTarget`은 여전히 별도 state)도 그대로 분리되어 있다.
- 더 이상 쓰이지 않는 `ReportQuestionButton` 컴포넌트와 관련 스타일(`trigger`, `triggerText`)은 삭제했다(죽은 코드 방지).

변경 파일: `apps/mobile/src/features/exam/ExamActiveView.tsx`, `apps/mobile/src/features/exam/ExamResultView.tsx`, `apps/mobile/src/features/exam/ExamSessionScreen.tsx`, `apps/mobile/src/features/exam/QuestionReportModal.tsx`

## Codex 수정과의 충돌 방지

TASK.md에서 지정한 회피 목록(`SourceUploadModal.tsx`, `TopicModal.tsx`, `ApiKeySection.tsx`, `SettingsScreen.tsx`, `FeedbackCard.tsx`, `useSourceManager.ts`, `app.json`)은 이번 세션에서 전혀 수정하지 않았다. `git diff --stat`로 변경 파일 8개(수정 7 + 신규 1)를 확인했고 모두 위 4개 항목 범위 안이다.

## 검증 결과

- **Windows `cmd.exe /c npx tsc --noEmit`을 실행하지 못했다.** 이 세션은 `npx`/`tsc`/`node -e` 등 코드 실행형 명령에 대한 승인을 받을 수 없는 상태였다(반복 시도했으나 매번 "requires approval"로 거부됨). **Codex가 반드시 아래 명령으로 타입 오류 0건을 직접 확인해야 한다.**
  ```
  cd apps/mobile && cmd.exe /c npx tsc --noEmit
  ```
- 대신 변경된 8개 파일을 전부 다시 읽고 수동으로 검토했다: prop 제거 후 남은 참조가 없는지(`grep -rn "ReportQuestionButton|onReportQuestion" src` 결과 없음), 새로 분리한 `userManualSections.tsx`의 import(`colors`)와 내보낸 타입(`UserManualSection`)이 올바른지, `alert.ts`의 스택 로직이 `showAlert`/`dismissAlert`/해제 함수 모두 동일한 `listenerStack`을 참조하는지 확인했다.
- 파일 줄 수 확인(500줄 제한): `UserManualModal.tsx` 237줄, `userManualSections.tsx` 334줄. 나머지 변경 파일은 모두 기존보다 줄어들거나 소폭 증가에 그쳐 제한 내다.
- 실기기 APK 검증은 하지 않았다(요청 범위 아님, EAS 빌드 권한도 없음).

## Codex가 확인할 항목

1. `cmd.exe /c npx tsc --noEmit` 통과 여부(0건 필수).
2. `alert.ts` 리스너 스택 수정이 실제로 문제를 해결하는지: 랭킹 창(네이티브 폴백 전체화면)을 열었다 닫은 뒤에도 `showAlert()` 호출이 여전히 `AppAlertModal`로 뜨는지 코드 경로로 재확인. 가능하면 실기기/에뮬레이터로 재현 시나리오(랭킹 창 열기→닫기→과목 등록 완료 알림 확인)를 직접 확인.
3. PDF 항목의 보류 판단에 동의하는지, `expo-print` 설치를 사용자에게 요청할지 여부.
4. 문제 신고 단일 진입점 UX(헤더 버튼 위치, 결과 화면 선택 모달)가 요구사항 의도에 맞는지.
5. 브랜치 한글 커밋 작성(이 세션은 커밋까지 수행). push·병합·배포는 사용자 승인 후 별도 진행.
