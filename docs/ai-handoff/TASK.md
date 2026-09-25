# 현재 작업

## 작업 ID

`android-web-hotfix-sync-20260925`

## 사용자 요청과 역할

어제의 Android 비공개 테스트 준비를 이어간다. 오늘 운영 웹에 반영한 문제 유형 선택·50점 채점 보완·부분점수·주관식 출제 제한을 Android 브랜치에도 반영한다. 복잡한 코드 통합은 Claude가 구현하고, Codex가 검증과 원격 반영을 맡는다.

## 기준 Git 상태

- Android 기준: `origin/feature/android-app@ac17890` (버전 정리, 비공개 테스트 문서, 오픈소스 고지 초안 포함)
- 웹 기준: `origin/main@bf4f8f2` (5개 웹 수정 커밋, 운영 웹 배포 완료)
- Claude 작업 브랜치: `feature/android-web-hotfix-sync`를 Android 기준 커밋에서 새로 만든다.
- `D:\ai bank`의 작업 트리에는 별도 미커밋 변경이 있으므로 이를 덮거나 함께 커밋하지 않는다. 격리된 작업 폴더를 사용한다.

## 승인된 변경 범위

1. 웹의 5개 커밋(`878ee76`, `79ff0ea`, `30e6001`, `a273d2a`, `bf4f8f2`)의 동작을 Android 브랜치에 통합한다. 기존 Android 기능(사용자 채점 정정, 문제 신고, 저장소 안전 화면, SQLite, 뒤로가기)을 유지한다.
2. 사전 `git merge-tree`에서 `prompts.ts`, `ExamResultView.tsx`, `storage.test.cjs` 세 파일의 충돌을 확인했다.
   - `prompts.ts`: 이미 있는 기준 환경 규칙 13을 중복시키지 않고 주관식 객관 채점 규칙 14를 추가한다.
   - `ExamResultView.tsx`: Android의 사용자 정정·채점 실패·문제 신고 UI를 유지한다. 부분점수 평균은 현재 집계 원천인 `domain/exam_result_summary.ts`에서 계산한다. 객관식은 100/0, 채점 완료된 주관식·빈칸형은 실제 점수, 사용자가 정정한 문항은 기존처럼 정답 취급, 채점 실패는 분모에서 제외한다. 전부 미완료이면 숫자 점수를 표시하지 않는다.
   - `storage.test.cjs`: Android의 구형 객관식 회귀와 웹의 기존 의견형 주관식 보존 회귀를 모두 남긴다.
3. 자동 병합된 `generator.ts`, `useQuizGeneration.ts`, 유형 계획과 테스트도 실제 동작을 확인한다. 주관식 부적합 시 같은 유형 계획으로 최대 한 번 재시도하고, 재실패 시 저장하지 않는다.
4. 웹의 `score_50_repro.test.cjs`가 Android 화면 구조와 다르면 테스트 의도(서술형 응답 형식 거부, 부분점수 평균, 실패 제외, 전부 실패 시 무점수)를 Android 집계 함수와 화면에 맞춰 조정한다. 기대값을 삭제해 통과시키지 않는다.

## 검증과 산출물

- `apps/mobile`에서 Windows `cmd.exe /c npx tsc --noEmit`, 관련 테스트와 전체 테스트, `npx expo export -p web`을 확인한다.
- Android 결과 요약의 정정·부분점수·채점 실패 조합을 테스트로 확인한다.
- 변경 파일과 충돌 해결 방식, 통과·실패 건수, 실기기 미검증 항목을 `CLAUDE_REPORT.md`에 적고 `STATUS.json`을 `codex_review`로 넘긴다.
- 커밋 메시지는 짧고 명확한 한글로 쓴다. 코드 통합 커밋은 기존 이력을 재작성하지 않는다.

## 제외 범위와 다음 단계

- Claude는 push·main 병합·웹 배포·EAS 빌드를 하지 않는다. Codex가 검증 뒤 원격 Android 반영을 맡는다.
- EAS CLI가 현재 PC에서 로그인되지 않았고 `app.json`에 `extra.eas.projectId`가 없다. 이전 APK의 서명키·기존 EAS 프로젝트 연결을 확인하기 전에는 새 프로젝트나 서명키를 만들지 않는다.
- 새 기능·라이브러리·대용량 교재 서버 구현은 이번 통합 범위 밖이다.

