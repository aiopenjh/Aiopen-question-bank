# 독립 연결 모듈 구조

## 경계

```text
사용하는 프로젝트의 기능 (학습 / 질문 / 기타 기능)
       │  connect / status / models / generate / disconnect
       ▼
AIConnector — 계정 선택, 요청 직렬화, 인증 시도, 사용 권한 확인
       ├─ OpenAIProvider : 공식 ChatGPT OAuth / Responses
       ├─ GeminiProvider : Google OAuth / 선택한 경우만 Gemini API
       ├─ ClaudeProvider : 미지원 상태 / 허용된 별도 연결부로 교체
       └─ CredentialStore : MemoryStore 또는 WindowsEncryptedStore

desktop/server.js : 시범용 로컬 HTTP 호스트와 브라우저 로그인 화면
```

`src`에는 특정 앱의 문제·정답·학습 기록·랭킹·UI 코드가 없습니다.
`desktop`은 첫 사용 환경용 예시 호스트입니다. 호스트를 교체해도 연결부 계약을 유지할 수 있습니다.
Android나 원격 웹 앱이 이 Node 모듈을 그대로 실행할 수 있다는 뜻은 아닙니다.

## 공통 계약

| 메서드 | 동작 |
|---|---|
| `status()` | 자격 증명을 제외한 공급자 상태·계정 선택 정보 반환 |
| `connect(providerId, {redirectUri, accountId?})` | 인증 시도 생성. 새 계정 또는 선택한 기존 등록을 재인증 |
| `completeConnect(callbackUrl)` | 일회성 state 확인, 코드 교환, ID 검증, 승인 권한 및 계정 저장 |
| `selectAccount(providerId, accountId)` | 저장된 해당 공급자의 계정 선택. 자체적으로 AI 요청하지 않음 |
| `models(providerId)` | 선택 계정의 모델 목록 요청. 로그인 및 AI 권한이 필요 |
| `generate(providerId, {model, prompt, signal?, onDelta?})` | 계정별 목록에 포함된 모델에 텍스트 요청. 완료 여부와 응답 반환 |
| `disconnect(providerId)` | 진행 중인 현재 공급자 요청/로그인 취소, 선택 계정 원격 해제 시도 및 로컬 자격 증명 제거 |
| `close()` | 실행 중 작업 정리, 저장소 잠금 해제. 저장된 로그인 유지 |

계정은 공급자·발급자·clientId·검증된 subject의 조합으로 분리합니다. 같은 이메일이라는 이유로 계정을 합치지 않습니다.
갱신은 공급자별로 직렬화하고 저장 변경은 공통 큐로 처리합니다. Windows 저장소는 한 프로세스만 열 수 있게 합니다.

## 공급자 연결부

공급자는 표시 정보·기능 지원 여부와 `begin / exchange / refresh / revoke / models / generate`를 구현합니다.
새로운 연결 경로가 허용되면 `providers` 생성 목록에 해당 연결부를 넣으면 됩니다.
Claude는 현재 공식적인 자체 앱 구독 로그인 경로가 없는 상태를 명시합니다. 토큰 가져오기·웹 로그인 자동화·숨겨진 엔드포인트 우회는 구현하지 않았습니다.

사용할 연결부와 저장소는 프로젝트가 주입합니다. 허용된 공급자만 목록에 넣을 수도 있습니다.
외부 연결부가 신뢰하지 않는 인증 URL·JWKS 주소·API 엔드포인트를 쓰지 않도록 검토하는 책임은 호스트에 있습니다.

## 데스크톱 호스트

로컬 브라우저는 시작 시 일회성 키로 세션을 만들고 HttpOnly 쿠키로 연결됩니다.
요청 검증 값은 브라우저 메모리에서만 유지하며, 공급자의 자격 증명은 로컬 백엔드가 보관합니다.
OAuth 이동은 로컬 서버의 일회성 경로에서 공식 공급자로 리다이렉트합니다. 재로그인 ID 토큰 힌트를 프론트엔드 JSON으로 반환하지 않습니다.
콜백은 로그인 시도별 state 및 정확한 콜백 경로로 검증합니다. 브라우저의 다른 사이트에 로컬 API 접근 권한을 제공하지 않습니다.

AI 요청은 사용자가 전송 버튼을 누른 경우에만 수행합니다. Gemini API 선택 모드는 추가 확인란을 요구합니다.
OpenAI 스트림은 `response.completed`를 받아야 완료로 처리하며, 중단·실패·불완전 응답은 구분합니다.
UI는 AI 텍스트를 `textContent`로 표시하며 HTML로 실행하지 않습니다.

## 이번 작업 이후

1. 작성한 코드의 문법·오프라인 인증 경계·Windows 저장소 동작 확인.
2. 사용자가 공식 화면에서 로그인한 뒤 첫 응답까지 실계정 확인.
3. Claude의 허용된 자체 연결 경로와 Gemini 개인 구독 연결 가능 여부 결정.
4. 검증된 계약으로 문제은행에 연결. 기존 API 호출부를 대체하는 작업은 별도 범위.
5. 패키징, 배포 라이선스, Google 앱 검증, 웹/Android 확장 검토.

검증 결과를 기록하기 전에는 로그인 성공·실사용 성공·배포 준비 완료로 표현하지 않습니다.
