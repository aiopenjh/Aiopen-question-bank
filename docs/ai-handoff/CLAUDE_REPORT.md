# Claude 구현 보고서

## 작업 정보

- 작업 ID: `android-web-hotfix-sync-20260925`
- 상태: 구현 완료, Codex 검토 대기
- 기준 커밋: `ac17890` (인수인계 문서 `b0cbf0f` 포함)
- 결과 커밋: `2653f9a` (병합: 웹 출제·채점 수정 Android 통합, 부모 `b0cbf0f` + `origin/main@bf4f8f2`)

## 구현한 내용

- `origin/main`의 웹 커밋 5개(`878ee76`, `79ff0ea`, `30e6001`, `a273d2a`, `bf4f8f2`)를 `--no-ff` 병합했다. merge-base `2657750` 이후 main에는 이 5개만 있으므로 다른 웹 변경은 섞이지 않았다. 기존 이력은 재작성하지 않았다.
- 충돌 해결 3건
  - `prompts.ts`: 규칙 13(기준 환경)은 양쪽이 같은 문장이라 하나만 유지하고, 규칙 14(주관식 객관 채점 기준)를 추가했다. 규칙 13·14 각각 1회만 존재함을 확인했다.
  - `ExamResultView.tsx`: Android 쪽(사용자 정정, 채점 실패 안내, 문제 신고, `summarizeExamResults` 사용)을 그대로 유지하고 웹 쪽 화면 내 계산은 버렸다. 부분점수 평균은 `domain/exam_result_summary.ts`로 옮겼다. 점수 줄 표기만 `(N점)` → `· 점수 N점`으로 바꿨다(비율이 아니라 평균임을 드러내기 위함). 전부 미완료 시 제목은 Android 문구 "채점 가능한 문항이 없습니다"를 유지했다.
  - `storage.test.cjs`: Android의 구형 객관식 회귀 2건과 웹의 의견형 주관식 보존 회귀 1건을 모두 남겼다.
- `exam_result_summary.ts`: `itemScores` 필드와 문항별 점수 계산을 추가했다. 객관식 100/0, 채점 완료 주관식·빈칸형은 실제 점수(0~100으로 제한), 사용자 정정 문항은 100, 채점 실패는 `null`로 분모 제외, 전부 실패면 `scorePercent: null`. 상태(`statuses`)·개수 집계는 바꾸지 않았다.
- 자동 병합 파일 확인: `generator.ts`(같은 유형 계획으로 최대 1회 재요청, 재실패 시 `GenerationContentError`로 저장 없음), `useQuizGeneration.ts`(`questionTypeMode`가 모달 → `handleSelectQuizCount` → `handleQuickGenerateForUnit` → `analyzeUserIntent`로 전달), `question_type_plan.ts`, `intent.ts`, `grading.ts`(응답 형식 엄격 검증, Android 변경과 함께 정상 병합).

## 변경 파일

- 웹에서 들어온 파일: `QuizCountModal.tsx`, `generator.ts`, `intent.ts`, `prompts.ts`, `question_type_plan.ts`, `subjective_suitability.ts`(신규), `grading.ts`, `useQuizGeneration.ts`, 테스트 `generator`, `question_type_plan`, `quiz_count_modal`, `subjective_suitability`(신규), `score_50_repro`(신규), `storage`
- 통합 중 직접 수정: `exam_result_summary.ts`, `ExamResultView.tsx`(점수 줄 문구 1줄), `tests/score_50_repro.test.cjs`, `tests/attempt_correction.test.cjs`

## 테스트 조정

- `score_50_repro.test.cjs` B: 렌더링 시 실제 `exam_result_summary`를 불러오도록 했다. 75점·50점·부분점수 배지 기대값은 그대로 두었고, 실패 제외 기대값은 Android 화면 구조에 맞게 바꿨다(`1 / 1문항 · 점수 100점`, `채점 미완료 1`, 제외 안내 문구). 전부 실패 시 무점수 검사는 유지하고 제목 문구만 Android 문구로 맞췄다.
- 같은 파일에 C 테스트를 추가했다: 정정 + 부분점수 50 + 채점 실패 + 0점 → `itemScores [100, 50, null, 0]`, 분모 3, 50점. 부분점수 문항 정정 시 100점, 범위 밖 점수 제한, 화면 표시까지 확인한다.
- `attempt_correction.test.cjs`의 기존 요약 테스트 기대 점수를 50 → 63으로 바꿨다. 기존 50은 `(정답+정정)/분모` 비율이었고, 승인된 부분점수 평균 규칙으로는 (100+100+50+0)/4 = 62.5 → 63이다. 상태·개수 기대값은 그대로다.

## 검증 결과

- `cmd.exe /c npx tsc --noEmit`: 오류 없음
- 관련 테스트 8개 파일(`score_50_repro`, `attempt_correction`, `storage`, `generator`, `subjective_suitability`, `question_type_plan`, `quiz_count_modal`, `grading_incomplete`): 72개 통과, 0개 실패
- 전체 `node --test tests/*.test.cjs`: 198개 통과, 0개 실패
- `npx expo export -p web`: 성공(`dist` 생성, Git 추적 대상 아님)
- 실행하지 않은 검증: Android 실기기·에뮬레이터 확인, EAS 빌드, 실제 AI 제공자 호출

## 전달 산출물

- Git 번들: 없음(로컬 브랜치 `feature/android-web-hotfix-sync`)
- 패치: 없음
- 스크린샷: 없음

## 알려진 제한과 미해결 사항

- 실기기 미검증: 출제 모달의 문제 유형 선택 칩 배치(작은 화면·Android 뒤로가기와 겹침 여부), 결과 화면 점수 줄 줄바꿈, 주관식 재요청 중 로딩 표시 시간.
- `useQuizGeneration.ts`는 583줄로 500줄 제한을 넘는다. Android 기준에서 이미 579줄이었고 웹 병합으로 4줄 늘었다. 이번 범위에서는 분리하지 않았다.
- `subjective_suitability.ts`는 키워드 기반이라 모든 의견형 지문을 걸러내지는 못한다(웹과 같은 제한).
- 과거 시험 기록의 점수를 저장해 두는 곳이 있다면 이전 비율 방식 점수와 새 평균 점수가 섞여 보일 수 있다. 현재 결과 화면은 매번 다시 계산하므로 영향이 없고, 다른 화면의 점수 저장 여부는 확인하지 않았다.

## Codex가 확인할 항목

- `exam_result_summary.ts`의 점수 규칙과 `attempt_correction.test.cjs` 기대값 50 → 63 변경이 승인 범위에 맞는지
- 결과 화면 점수 줄 문구 변경(`(N점)` → `· 점수 N점`)과 전부 미완료 시 Android 제목 유지가 괜찮은지
- 병합 커밋 `2653f9a`의 부모가 `b0cbf0f`와 `bf4f8f2`인지, push 전 원격 `feature/android-app`와의 관계
