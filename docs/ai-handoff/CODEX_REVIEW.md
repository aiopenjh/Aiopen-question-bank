# Codex 검토 — Android 첫 실기기 피드백

- 작업 ID: `android-real-device-round1-20260925`
- 기준: `066002d` 위 Claude 미커밋 변경
- 판정: **수정 필요 (`claude_revision`, 1회차)**

## 필수 수정

1. `userManualSections.tsx`: `USER_MANUAL_SECTIONS` 상수가 `styles` 선언보다 앞에 있어 모듈 평가 시 TDZ에 걸린다. Windows `cmd.exe /c npx tsc --noEmit`에서 `TS2448`/`TS2454`가 다수 발생한다. `styles`를 상수보다 먼저 선언하거나 안전한 구조로 바꾸고 타입 오류 0건으로 만든다.
2. `apps/mobile/tests/question_report.test.cjs`: 기존 4개 중 2개가 새 배치와 충돌해 실패한다. 기존 지문/해설 카드 버튼 기대를 지우는 것만으로 끝내지 말고, **헤더 단일 버튼 → 풀이 중 현재 문제 / 결과 중 문제 선택 → 신고 모달**, 답안·채점 불변을 새 테스트로 확인한다. 실제 실패 메시지는 `active(...).props.onReportQuestion is not a function` 및 stem 카드 내 `ReportQuestionButton` 기대 실패다.
3. `ExamSessionScreen.tsx`: 현재 1행 헤더에 `✕ 나가기`, 진행 표시, `📐 풀이공간`, `💡 힌트`, `🚩 문제 신고`가 모두 들어간다. `examActiveStyles.ts`에는 줄바꿈/축소가 없어서 폭 360px 안팎에서 넘칠 가능성이 크다. 작은 Android 화면에서도 세 기능과 진행 표시가 보이고 눌리도록 레이아웃을 분리·축약하고, 기존 디자인을 유지한다.

## 권장 확인

- `utils/alert.ts` 리스너 스택 수정은 랭킹 모달이 메인 리스너를 덮어쓰던 코드 경로와 맞는다. 등록→랭킹 열기→랭킹 닫기→메인 알림 호출의 회귀 테스트를 추가하면 좋다. 폴백은 유지한다.
- 사용설명서 렌더 비용 감소는 가능하지만 실기기 속도 측정은 없다. '원인 확정/완료'라고 단정하지 말고 실기기 재검증 필요로 보고한다.
- PDF 내보내기는 네이티브 실제 저장이 미완료였으나, 사용자가 2026-09-25에 **`expo-print` 추가를 승인했다.** 이번 수정에서 실제 Android PDF 생성·공유/저장을 구현한다. 다른 새 의존성은 추가하지 않는다. 공식 SDK 57 문서의 권장 버전은 `~57.0.2`다.

## 인수인계

변경 파일은 보존하고 위 항목만 수정한다. Claude 실행 환경에서 명령이 계속 거부되면 반복 시도하지 말고 보고서에 명시한다. Codex가 타입 검사·대상 테스트를 실행하고 한글 커밋을 맡는다. push/빌드/배포는 하지 않는다.

## 최종 검토 (Codex)

- 필수 수정 3건 반영을 확인했다. Windows `npx tsc --noEmit` 통과, 대상 테스트 8개 및 전체 앱 테스트 205개 통과.
- 새 `expo-print ~57.0.2`는 사용자 승인에 따라 추가했다. Android에서 PDF를 생성하고 OS 공유 시트를 여는 경로를 확인했다. 다만 실제 한글·쪽 배치와 저장 동작은 새 APK 실기기 검증이 필요하다.
- 테스트 실행기에서 VM 객체를 직접 깊은 비교한 테스트 1건은 필드별 비교로 바로잡았다. 기존 알림 화면 복귀 회귀 테스트 1건을 추가해 통과했다.
- Android에 웹 전용 'PDF 저장 화면 열기' 버튼을 노출하지 않고, 실제 저장 버튼만 보여주게 했다.
- 첫 정식 출시 표시 버전 `1.0.0`, 내부 Android 빌드 번호 유지·증가 원칙을 `DEVELOPER.md`에 기록했다. 이번 테스트 APK 표시 버전은 그대로 둔다.
- 남은 검증: 새 APK 실기기에서 키보드 위치, 의견창, 사용설명서 속도, PDF 한글·저장, 신고 버튼 배치, 아이콘을 확인해야 한다.
- Android 테스트 브랜치 `origin/feature/android-app`에 `fab8c7c`를 반영했고, EAS preview APK 빌드 `74a30943-c4e3-48c2-95b6-7a015935a6eb`가 완료됐다. 내부 빌드 번호는 `8`, 다운로드 주소는 `https://expo.dev/artifacts/eas/Mkiwk_Kq1-uDzu6_NWITcHD6DRdCIdL_II64zRJh-DQ.apk`다. 첫 정식 출시는 아직 진행하지 않았다.
