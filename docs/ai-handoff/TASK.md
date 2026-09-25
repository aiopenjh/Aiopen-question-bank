# 현재 작업

## 작업 ID

`anthropic-sonnet-46-20260925`

## 사용자 요청과 역할

사용자가 퇴역한 Claude 3.5 Sonnet 대신 `claude-sonnet-4-6` 사용을 승인했다. 복잡한 코드 수정은 Claude가, 검토·원격 반영·배포는 Codex가 담당한다.

## 기준과 작업 폴더

- Android: `origin/feature/android-app@c124929`, 작업 폴더 `C:/Users/choor/.codex/worktrees/android-web-hotfix-sync/ai bank`
- 웹: `origin/main@bf4f8f2`, 작업 폴더 `C:/Users/choor/.codex/worktrees/anthropic-sonnet-46-web/ai bank`
- `D:/ai bank`의 작업 트리는 건드리지 않는다.

## 승인된 변경 범위

1. 두 브랜치의 `apps/mobile/src/domain/ai_client.ts`에서 Anthropic Messages API 모델을 `claude-sonnet-4-6`으로 교체하고, Claude 3.5로 적힌 주석·오류 문구를 현재 모델에 맞춘다.
2. 웹 main에는 Android 브랜치에서 이미 검증된 `anthropic-dangerous-direct-browser-access: true` 헤더도 적용한다. Android의 같은 헤더는 유지한다.
3. 기존 API 키 경로, AI 전송 안내, 요청 취소, Gemini/OpenAI 경로, PDF·검색 기능 제한은 유지한다.
4. Anthropic 요청 모델·헤더와 정상·빈 응답·오류 처리를 실제 동작 기준으로 검사하는 최소 회귀 테스트를 추가한다. 실제 API 키나 사용자 데이터를 사용하지 않는다.
5. 두 작업 폴더의 코드를 각각 커밋한다. 새 커밋 메시지는 한글로 쓰고 이전 커밋 이력은 재작성하지 않는다.

## 검증과 인수인계

- 각 브랜치에서 관련 테스트와 `cmd.exe /c npx tsc --noEmit`을 실행한다. 이미 검증한 무관한 전체 테스트를 반복할 필요는 없다.
- `CLAUDE_REPORT.md`에 브랜치별 커밋·변경 파일·검증 결과·남은 위험을 기록한다.
- `STATUS.json`을 `codex_review`로 바꾸고 `activeAgent`를 `codex`로 넘긴다.
- Claude는 push, main 병합, 웹 배포, EAS 빌드를 하지 않는다.

## 알려진 별도 제약

- Celueste의 기존 EAS 프로젝트 ID와 Android 서명키는 아직 식별되지 않았다. Expo Go의 `Bank` 프로젝트는 Celueste 빌드 프로젝트로 확인되지 않았다.
- 이번 모델 교체는 실제 사용자 Anthropic API 키로 호출하지 않는다. 네트워크 요청은 테스트에서 모의 처리한다.
