# AI Login Connector

문제은행과 독립적으로 만든 Windows 로컬 시범용 AI 계정 연결 모듈입니다.
기존 Codex·Claude 실행 도구를 호출하지 않습니다. 추가 npm 라이브러리 없이 Node.js 기본 기능으로 작성했습니다.

**PC 시범판입니다. GPT 실계정 연결 상태·모델 조회와 Google 실계정 로그인을 확인했습니다. 실제 문제 출제의 완료 검증은 남아 있습니다. Google 로그인과 Gemini AI 사용 권한은 별개이며, Gemini API 모드는 기본 비활성화입니다.**

## 현재 구현 범위

| 연결부 | 작성한 기능 | 남은 조건 |
|---|---|---|
| GPT / ChatGPT | 자체 OAuth + PKCE, 동적 앱 등록, ID 토큰 서명 검증, 계정 전환, 자격 증명 갱신, 계정별 모델 조회, Responses 스트림, 연결 해제 | 사용자의 승인·지원 계정·OpenAI 서비스 적용 조건 확인 및 실계정 검증 |
| Gemini / Google | 자체 Google OAuth + PKCE, ID 토큰 검증, 계정 전환·갱신·해제 | 개발자의 Desktop OAuth 앱 등록 필요. 기본값은 로그인 신원 확인만 지원 |
| Gemini API 선택 모드 | Google OAuth 자격 증명으로 모델 목록 및 텍스트 생성 요청 | 별도 Cloud 프로젝트·API 활성화·권한·과금 조건 필요. 기본 비활성화 |

Google 로그인은 Gemini 개인 구독 사용 권한을 의미하지 않습니다. 선택 모드를 켜도 Gemini 구독 한도로 바뀌지 않습니다.

## 실행

Windows 및 Node.js **22.12 이상**이 필요합니다. 현재 설치된 Node를 사용하며 패키지 설치 단계는 없습니다.

```powershell
cd C:\AI_Login_Connector
npm start
```

또는 `C:\AI_Login_Connector\start.ps1`을 실행하세요.
기본 브라우저에서 로컬 연결 화면을 엽니다. 서버는 `127.0.0.1`의 사용 가능한 포트에만 바인딩됩니다.
종료는 실행 터미널에서 `Ctrl+C`입니다. 시작 스크립트는 자동 실행·서비스·방화벽·기존 프로젝트 설정을 변경하지 않습니다.

첫 화면은 같은 스타일의 GPT·Gemini 연결 버튼과 가입 링크를 제공합니다. 문제은행 연결판은 하나라도 로그인되어 있으면 앱으로 자동 진입합니다. 새 로그인도 같은 창에서 진행하고, 성공한 콜백은 앱으로 바로 이동합니다. 앱 설정의 AI 연결은 반반 나눈 2열 카드이며, 다른 AI를 추가 연결해도 기존 공급자 계정은 유지됩니다. 실제 AI 권한이 있는 연결의 모델만 선택할 수 있습니다.
문제은행 연결판은 저장소 루트의 `start-login-pilot.ps1`로 실행합니다. 문제은행 설정의 기존 API 키 입력 자리에 AI 연결 버튼이 표시됩니다. GPT·Gemini 버튼을 누르면 해당 공급자의 실제 계정 모델만 보여줍니다. 작은 모델 메뉴에서 선택하면 출제·목차·힌트·주관식 채점에 바로 적용되며 선택 표시가 붙습니다. 문제의 정답·해설은 출제 결과에 포함됩니다. 로그인과 모델 선택 자체는 문제 생성 요청을 보내지 않습니다.

첫 연결 화면과 같은 로컬 origin의 호스트는 `localStorage`의 `ai-login-connector:model-selection-v1`에서 `{mode:'desktop', providerId, model, acceptApiUsage}`를 읽습니다. 이 값은 비밀이 아닌 선택 정보이며 로그인 자격 증명이나 API 키를 포함하지 않습니다. 호스트에서 선택을 바꾸면 같은 값도 갱신해야 합니다. 문제은행 공통 AI 요청 경로는 매 호출마다 이 선택을 읽고 로컬 백엔드에 공급자·모델을 전달합니다. 백엔드는 로그인·실제 모델 목록·사용 권한을 다시 확인하고, 실패할 때 다른 AI나 기존 API 키로 전환하지 않습니다. 공개 웹·Android에서는 이 로컬 선택을 읽지 않습니다.

Gemini도 키 입력 대신 Google OAuth 로그인을 사용합니다. 개발자 측 Desktop OAuth 등록 정보는 Git에 포함하지 않는 로컬 설정으로 적용합니다. 테스트용 Google 로그인은 확인했지만, 실제 출제는 별도 API 활성화·프로젝트 권한 설정과 검증이 필요합니다. 무료 한도는 Gemini 웹 개인 계정이 아닌 사용 프로젝트의 API 등급에 적용됩니다. 무료 이용을 보장하거나 프로젝트 과금을 자동 변경하지 않습니다.

## Google 앱 설정

개발자가 `config.example.json`을 `.local/config.json`으로 복사하고 필요한 값을 설정합니다. `.local`은 Git 제외 대상입니다.
일반 사용자가 각자 개발자 콘솔에서 앱을 등록하도록 만드는 구조를 의도하지 않습니다. 배포자가 앱 등록·동의 화면 검증을 담당해야 합니다.

1. Google Cloud에서 OAuth 동의 화면 및 **Desktop app** 클라이언트를 등록합니다.
2. 개발자 설정의 `google.clientId`와 필요한 경우 `google.clientSecret`을 지정합니다.
3. 기본 `apiAccess: false`에서는 신원 확인만 요청합니다. API 사용 권한·구독 혜택을 연결하지 않습니다.
4. 별도 Gemini API 사용을 원할 때만 프로젝트의 Generative Language API 활성화와 권한·과금 조건을 확인한 뒤 `projectId`, `apiAccess: true`를 설정합니다. 이 모드는 Cloud API 접근 범위를 요청하므로 동의 화면의 권한을 확인해야 합니다.

API 모드에서는 문제은행에서 연결을 선택할 때 별도 사용량/과금 확인란이 표시됩니다. 설정 파일을 바꾼 뒤 프로그램을 다시 시작하세요.
앱 등록, 계정 가입, Cloud 프로젝트 생성, 결제 설정은 이번 작업에서 수행하지 않았습니다.

## 다른 프로젝트에서 사용

`src/index.js`를 **신뢰하는 로컬 Node 백엔드**에서 가져오면 됩니다. 문제은행 코드·학습 기록·DB에 의존하지 않습니다.

```js
import { AIConnector, MemoryStore, createOpenAIProvider } from 'C:/AI_Login_Connector/src/index.js';

const connector = new AIConnector({
  store: new MemoryStore(),
  providers: [createOpenAIProvider({ appName: 'My Learning App' })],
});

// 호스트가 127.0.0.1 콜백 서버를 먼저 실행한 뒤 로그인 URL을 엽니다.
const login = await connector.connect('openai', {
  redirectUri: 'http://127.0.0.1:49152/auth/callback',
});
// 기본 브라우저로 login.authorizationUrl을 열고,
// 실제 콜백 URL을 백엔드에서 connector.completeConnect(callbackUrl)에 전달합니다.

// 로그인 후:
// const models = await connector.models('openai');
// const result = await connector.generate('openai', {
//   model: models[0].id, prompt: '영어 학습 문제를 한 개 만들어줘.',
// });
```

재시작 후 연결 유지가 필요하면 `MemoryStore` 대신 `WindowsEncryptedStore` 또는 프로젝트의 보호된 저장소를 주입하세요.
브라우저에 모듈을 번들링하거나 로그인 자격 증명을 넘겨서는 안 됩니다. 웹/Android에서는 별도의 실행 환경과 해당 플랫폼의 인증 흐름을 설계해야 합니다.
라이브러리 예제는 `examples/in-process.js`, 타입 정의는 `src/index.d.ts`, 구조 설명은 `docs/STRUCTURE.md`에 있습니다.

## 저장·연결 경계

- Windows 데이터 위치: `%LOCALAPPDATA%\AI_Login_Connector\credentials.enc`.
- Windows DPAPI의 현재 사용자 범위로 암호화합니다. 다른 PC/Windows 사용자로 파일을 복사해 연결을 공유하는 용도가 아닙니다.
- 암호화와 브라우저 열기에 Windows 기본 PowerShell/.NET 기능을 사용합니다. AI 실행 도구를 사용하는 방식이 아닙니다.
- 로그인 자격 증명, 갱신 자격 증명, ID 토큰은 브라우저 저장소·화면·로그로 반환하지 않습니다. 인증 제공자로 이동하는 URL도 진단 로그에 출력하지 않습니다.
- 로컬 HTTP 호스트 제한, 시작 인증, HttpOnly 쿠키, 요청 검증을 넣었습니다. 이에 대한 보안 검증은 아직 수행하지 않았습니다.
- 저장소별 로컬 파이프 잠금과 요청 직렬화로 갱신 및 저장 충돌을 줄이도록 작성했습니다. 비정상 종료·동시 실행 검증은 남아 있습니다.
- 연결 해제는 현재 선택한 계정만 대상으로 합니다. 저장된 다른 계정은 유지합니다. 원격 해제를 확인하지 못하면 화면에 따로 표시합니다.
- 질문·학습 이력·랭킹 데이터는 이 모듈에 저장하지 않습니다.

## 남은 검증

GPT 실계정 연결 상태와 모델 조회를 확인했습니다. 승인 거절/권한 일부 거절, 계정 전환, 실제 응답 완료, 사용 한도 오류, 재시작 후 복원, 자격 증명 갱신/원격 해제, 팝업 차단, Windows 저장소 접근 실패를 확인해야 합니다.
잘못된/재사용된 OAuth state, ID 토큰 서명·발급자·대상·만료·nonce 변조, 다른 웹사이트의 로컬 요청도 검증해야 합니다.
로그인 화면 확인과 모델 조회가 실제 AI 출제·배포 검증을 의미하지는 않습니다.

## 공식 문서 및 배포 조건

작성 기준: 2026-10-02. 서비스 접근 조건과 공급자 지원 범위는 배포 전에 다시 확인해야 합니다.

- [OpenAI 로컬/오픈소스 계정 연결 적용 범위](https://developers.openai.com/siwc/token-sharing-open-source)
- [OpenAI 등록과 로그인](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [OpenAI 계정·갱신·해제](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [OpenAI 모델 및 응답 완료](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Gemini API OAuth](https://ai.google.dev/gemini-api/docs/oauth)
- [Gemini API 키 만들기](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini 무료 등급과 가격](https://ai.google.dev/gemini-api/docs/pricing)
- [Google Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Gemini CLI 개인 로그인 종료](https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals)

OpenAI DevKit나 타 프로젝트의 인증 코드를 복사·설치하지 않았습니다. 서비스 프로토콜을 직접 구현한 코드입니다.
독립 코드 작성이 서비스의 상업 이용 권한을 자동으로 부여하지는 않습니다. 유료·원격 서비스로 확장할 때는 OpenAI 승인 조건과 각 공급자 조건을 별도로 확인해야 합니다.
모듈 배포 라이선스는 소유자가 결정하도록 남겨 두었고 npm 패키지는 `private: true`입니다. Git 원격·게시·배포는 설정하지 않았습니다.
