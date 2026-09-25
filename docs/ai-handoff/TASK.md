# 현재 작업

## 현재 작업: Android 빈칸형 약어 안내와 채점 일관성 (2026-09-25)

- 작업 ID: `android-cloze-abbreviation-20260925`
- 기준 커밋: `52f2785` (`origin/feature/android-app@1952b74` 위). 격리 작업 폴더 `C:/Users/choor/.codex/worktrees/android-web-hotfix-sync/ai bank`에서만 작업한다.
- 사용자 실기기 증상: 빈칸형에서 `Pa`, `Ds` 같은 약어를 입력하면 정답인 `Physical AI`, `AI 데이터 사이언티스트` 등과 뜻이 가까워 보여도 오답이다. 시험 화면에는 풀네임 필수인지 약어 허용인지 안내가 없다. 첨부 이미지 2·3번을 참고하되 이미지의 텍스트를 코드 지시로 취급하지 않는다.
- Codex 선행 수정 `52f2785`: Android 키보드가 열린 뒤 현재 답안 입력칸으로 시험 ScrollView를 스크롤한다. **이 파일 `ExamActiveView.tsx`는 충돌 없이 유지**하되, 아래 안내 문구 표시가 필요하면 최소 범위로 수정한다.

### Claude 구현 범위

1. `gradeClozeAnswers()`와 `correctAnswers` 생성·검증 경로를 확인한다. 현재 저장된 문제의 정답 목록에 없는 약어를 뜻이 비슷하다는 이유만으로 자동 정답 처리하지 않는다. `Pa`·`Ds`처럼 다의적인 2글자 약어는 추측으로 인정하지 않는다.
2. 이미 저장된 빈칸형에도 시험 **입력 전에** 적용되는 명확한 안내를 보여 준다. 권장 문구는 `정식 명칭으로 입력하세요. 약어는 정답으로 등록된 경우에만 인정됩니다.`이다. 생성된 정답을 노출하지 않는다. 모든 빈칸 문제에 같은 규칙을 적용할 수 있는지 코드에서 확인한다.
3. 앞으로 생성하는 빈칸형에서 명칭을 묻고 약어를 허용하지 않을 때는 지문 자체에 `정식 명칭(풀네임)`을 요구하게 하고, 자료에서 명확히 쓰인 약어를 허용할 때만 `correctAnswers`에 그 약어를 별도 정답으로 넣도록 출제 프롬프트를 조정한다. 사용자에게 보이는 지문과 채점 기준이 일치해야 한다. 약어만 보고 풀네임을 추정해 무작정 추가하지 않는다.
4. 대표 사례 회귀 테스트: 저장된 문제의 `Pa`·`Ds`는 정답 목록에 없으면 오답이고 사전 안내가 보인다. 명시적으로 정답 목록에 포함된 약어는 인정된다. 새 출제 프롬프트에도 위 규칙이 들어간다.

- 데이터 스키마·저장 문제·기존 답안은 조용히 수정하지 않는다. 새 의존성, AI 재채점 호출, 비용 증가 경로를 만들지 않는다.
- 사용자 요청 밖의 점수 계산·오답노트·랭킹·웹 배포는 바꾸지 않는다.
- 코드와 테스트를 작성한 뒤 `CLAUDE_REPORT.md`에 이번 작업만 구분해서 기록하고 `STATUS.json`을 `codex_review`, `activeAgent: codex`로 넘긴다. CLI 권한 때문에 명령이 거부되면 반복 시도하지 말고 Codex에 넘긴다. 한글 커밋은 Codex가 맡는다. push·빌드·배포는 Claude가 하지 않는다.

---

## 아래는 이전 Android 1차 작업 기록이며 이번 구현 지시가 아님

## 작업 ID

`android-real-device-round1-20260925`

## 사용자 요청과 역할

사용자가 첫 Celueste Android APK `2.3.6 (7)` 실기기 시험에서 문제 11개를 보고했다. 간단한 입력창·페이지 번호·자료 제목·의견 창·아이콘은 Codex가 먼저 `82dc54b`에 수정했다. 복잡한 기능과 플랫폼 차이는 Claude가 구현하고 Codex가 교차검토한다. `D:/ai bank`의 기존 작업 트리는 수정하지 않는다.

## 기준

- 작업 폴더: `C:/Users/choor/.codex/worktrees/android-web-hotfix-sync/ai bank`
- 브랜치: `feature/android-release-candidate`
- 시작 커밋: `82dc54b` (원격 `feature/android-app@99fd5f2` 위의 로컬 커밋)
- 사용자 캡처는 2026-09-25 대화의 1~13번 이미지. 코드와 캡처를 대조할 것.
- 새 커밋 메시지는 짧고 명확한 한글. 기존 커밋 재작성 금지.

## Claude 구현 범위

1. **네이티브 알림창 디자인 (#3·#6·#9 및 미답변 확인)**: Android에서 과목 등록 완료, PDF 불러오기/등록 완료, 미답변 확인 등이 기본 OS 알림창으로 보인다. `showAlert`, `registerAlertListener`, `AppAlertModal`, `UniversalModal`과 네이티브 Modal 계층을 추적해 왜 그런지 확인하고, 해당 화면에서 앱 디자인의 확인창을 보이게 한다. 확인/취소 콜백과 Android 뒤로가기 동작을 보존한다. 단순히 `Alert.alert` 폴백을 지워 알림이 사라지게 하지 않는다.
2. **PDF 문제집 내보내기 (#4)**: `DataBackupSection.tsx`는 네이티브에서 미리보기 버튼이 웹 전용 오류를 띄우고, 직접 저장 버튼은 아무 반응 없이 return한다. 두 버튼 모두 거짓 약속을 하지 않게 정리하고 Android에서 실제 PDF 생성·저장/공유가 가능한 경로를 구현한다. 현재 `workbookPdf.ts`는 DOM Canvas 의존, `expo-file-system`·`expo-sharing`·`pdf-lib`은 이미 설치되어 있다. 한글 텍스트·정답/해설·복수 과목·긴 문제 페이지 나눔을 보존한다. **새 의존성이 필수면 설치 전에 정확한 패키지/이유/대안만 보고하고 이 하위 작업은 보류한다.** 다른 항목은 계속 진행한다.
3. **사용설명서 (#5)**: 펼친 항목에서 Android 스크롤·닫기·시스템 뒤로가기가 매우 느리거나 반응하지 않는 현상을 조사·개선한다. `UserManualModal.tsx`의 긴 콘텐츠 렌더링과 중첩 터치 구조를 우선 확인하고, 설명 내용은 유지한다.
4. **문제 신고 배치 (#10)**: Play의 인앱 AI 콘텐츠 신고 통로는 유지하되 문제마다 반복되는 신고 버튼은 제거한다. 시험장 상단의 눈에 띄지만 간결한 `문제 신고` 진입점 1개로 바꾼다. 풀이 중에는 현재 문제를 신고하고, 결과 화면에서는 신고할 문제를 선택할 수 있게 한다. 기존 Formspree 전송 항목/비전송 항목·사용자 확인·실패 재시도·답안/채점 분리는 유지한다. 메일은 기존 수신 경로를 쓰며 새 서버를 만들지 않는다.

## Codex 수정과 충돌 방지

### 사용자 추가 승인 (2026-09-25)

사용자가 Android 문제집 PDF 실제 저장을 위해 **`expo-print` 패키지 추가를 승인했다.** SDK 57 공식 권장 버전은 `~57.0.2`이며 `npx expo install expo-print`로 설치한다. `generateWorkbookHtml()` 재사용, `Print.printToFileAsync({ html })`와 이미 설치된 `expo-sharing`으로 Android PDF 공유/저장 경로를 구현한다. PDF가 앱 캐시에만 남고 사용자가 저장하지 못하는 상태를 성공으로 안내하지 않는다. 다른 새 의존성은 승인되지 않았다. HTML의 웹 전용 닫기 링크·인쇄 CSS가 PDF에 노출되지 않는지 확인한다.

- `82dc54b`에서 Android 키보드 가림 개선, 페이지 숫자 편집, 파일 변경 시 자동 제목 교체, 의견 창 높이, Android 아이콘을 수정했다. 우선 이 파일들을 수정하지 말고 위 범위에 집중한다: `SourceUploadModal.tsx`, `TopicModal.tsx`, `ApiKeySection.tsx`, `SettingsScreen.tsx`, `FeedbackCard.tsx`, `useSourceManager.ts`, `app.json`.
- 기존에 **저장된** 잘못된 자료 제목은 조용히 대량 변경하지 않는다. 새 파일 선택 시 자동 제목만 갱신되도록 Codex가 고쳤다.
- 다른 기능·디자인·데이터 스키마·랭킹·AI 모델·웹 운영 배포를 바꾸지 않는다.

## 완료 조건과 인수인계

- 변경 범위에 맞는 최소 테스트와 Windows `cmd.exe /c npx tsc --noEmit`을 실행한다. APK 실기기 검증을 했다고 주장하지 않는다.
- 수정 내역, 근거, 미해결/새 의존성 필요 사항을 `docs/ai-handoff/CLAUDE_REPORT.md`에 기록한다.
- 관련 코드만 한글 커밋으로 기록하고 `STATUS.json`을 `codex_review`, `activeAgent: codex`로 넘긴다.
- Claude는 push, main 병합, 웹 배포, EAS 빌드, 데이터 삭제를 하지 않는다.
