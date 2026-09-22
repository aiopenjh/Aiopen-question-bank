# 🛠️ Celueste (셀루에스테) — Developer & Maintainer Guide

> 이 문서는 Celueste 플랫폼의 **로컬 개발 환경 설정, 정적 웹 배포, 모바일 앱 빌드, 그리고 시스템 아키텍처**를 다루는 개발자 및 관리자 전용 기술 문서입니다.  
> 인공지능(AI) 협업 표준 및 불변 헌법은 [AGENTS.md](AGENTS.md)를 참고하십시오.

---

## 🚀 1. 개발 및 배포 명령어 (Developer Ops)

### 1-1. 로컬 개발 환경 실행
```bash
# 모바일 앱 디렉토리로 이동
cd apps/mobile

# 패키지 설치
npm install

# 로컬 개발 서버 실행 (웹 & Expo Go)
npm start

# 또는 웹 브라우저 즉시 열기
npm run web
```

### 1-2. GitHub Pages 원클릭 정적 웹 배포
프로젝트 루트에 준비된 PowerShell 원클릭 배포 스크립트를 실행합니다.
이 스크립트는 `apps/mobile/dist` 정적 번들 생성, SPA 라우팅을 위한 `404.html`, GitHub Pages 처리용 `.nojekyll`, 그리고 캐시 갱신 감지용 `version.json`을 자동으로 패키징하여 `gh-pages` 브랜치로 푸시합니다.

```powershell
# 프로젝트 루트 디렉토리에서 실행
powershell -ExecutionPolicy Bypass -File .\deploy-gh-pages.ps1
```

### 1-3. 안드로이드 APK 파일 빌드 (.apk)
Expo Application Services(EAS)를 통해 설치형 APK를 빌드합니다.
```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build -p android --profile preview
```

### 1-4. TypeScript 정적 타입 검증
코드를 수정하거나 커밋하기 전, 반드시 타입 오류 0건을 확인하십시오.
```bash
cd apps/mobile
cmd.exe /c npx tsc --noEmit
```

---

## 🏛️ 2. 핵심 아키텍처 및 도메인 엔진

Celueste는 외부 백엔드 서버 없이 클라이언트 기기 자체에서 구동되는 **로컬 퍼스트(Local-First)** 아키텍처를 채택하고 있습니다.

### 2-1. 출제 엔진 헌법 (`apps/mobile/src/domain/prompts.ts`)
* **교차 분야 충돌 우선순위 (Cross-Domain Conflict Resolution)**:
  * 대주제(예: `바람의나라`)와 소주제(예: `바리스타 기초`)가 상이한 경우, 학습자가 실제 의도한 세부 학습 대상(`바리스타 커피 지식`)을 최우선 기준으로 채택합니다.
* **엉뚱한 입력/오타 자동 폴백 (Nonsense Fallback)**:
  * 소주제에 장난, 무의미한 자모(`ㅁㄴㅇㄹ`, `asdf`), 특수문자 입력 시 엉뚱한 소주제는 즉시 무시하고 본래 대주제(과목명) 기준으로 안전하게 출제합니다.
* **원점 대주제 고정 (Root Domain Anchoring)**:
  * 심화/고난도 문제 생성 시에도 본래 과목의 본질적인 학습 맥락을 끝까지 유지하여 인접 타 분야로의 Context Drift(탈선)를 원천 차단합니다.
* **4단계 입체 해설 구조**:
  * 선택 오답 분석, 핵심 개념 정리, 오답 방지 팁, 정답 및 명쾌한 도출 과정.

### 2-2. 정답 균등 무작위 분산 엔진 (`apps/mobile/src/domain/question_distribution.ts`)
* **Fisher-Yates 셔플 알고리즘**:
  * 프롬프트 인젝션("답은 항상 3번으로 해줘" 등)을 시스템 코드 레벨에서 원천 방어합니다.
  * 1~4번 선지 정답 위치를 수학적으로 균등하게 분산시키며, 이전 문제와 연속 동일 번호 중복을 방지합니다.

### 2-3. 범용 AI 통신 엔진 (`apps/mobile/src/domain/ai_client.ts`)
* 단일 인터페이스에서 API 키 프리픽스를 자동 감지하여 다중 모델 지원:
  * `sk-ant-` ➔ **Anthropic Claude 3.5 Sonnet**
  * `sk-` ➔ **OpenAI GPT-4o**
  * 일반 키 ➔ **Google Gemini 3.5 Flash ➔ Flash-Lite ➔ 2.5 ➔ 2.0 자동 캐스케이드 및 타임아웃 방어**

---

## 📱 3. 모바일 웹 최적화 (Anti-Zoom Hardening)

* **입력창 화면 작아짐(Pinch-Zoom) 원천 차단**:
  * 모바일 브라우저(iOS Safari, Android Chrome)가 16px 미만 폰트 터치 시 화면을 강제 확대/축소하는 고질적 현상을 방어하기 위해 전역 `font-size: 16px` 이상 스타일 및 메타태그(`maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover`)를 적용했습니다.
* **반응형 모달 및 겹침 없는 독립 스크롤**:
  * 소형 스마트폰 화면부터 태블릿, PC 와이드 모니터까지 매끄러운 반응형 레이아웃을 제공합니다.

---

## 📂 4. 프로젝트 디렉토리 구조

```
AI-powered test generator app/
├── README.md                           # 서비스 소개 및 사용자 매뉴얼 (Public 대문)
├── DEVELOPER.md                        # 개발자 및 관리자 기술 가이드 (본 문서)
├── CHANGELOG.md                        # v2.0.0 ~ v2.3.4 통합 릴리스 변경 이력
├── AGENTS.md                           # Tri-AI(Gemini·Claude·GPT) 9대 불변 협업 헌법
├── AI_SHARED_CONTEXT.md                # 1초 AI 동기화 인수인계 프롬프트
├── CLAUDE.md                           # Claude 어시스턴트 전용 가이드
├── deploy-gh-pages.ps1                 # GitHub Pages 원클릭 빌드 & 배포 스크립트
├── run_mobile.bat                      # 윈도우 원클릭 로컬 실행 스크립트
├── docs/
│   ├── ARCHITECTURE_WORKFLOW_V2.md     # v2.3+ 시스템 아키텍처, UI/UX 디자인 시스템 및 런타임 데이터 흐름
│   └── PRODUCT_ROADMAP_AND_BETA_PLAN.md # 제품 비전, Beta 1 핵심 과제(랭킹/주관식/풀이공간) 및 로드맵
└── apps/
    └── mobile/
        ├── App.tsx                     # 메인 화면 오케스트레이션 및 전역 뷰포트 보호
        ├── dist/                       # GitHub Pages 배포용 정적 프로덕션 번들
        └── src/
            ├── components/
            │   ├── common/             # Header, UpdateBanner 등 공통 UI
            │   └── modals/             # TopicModal, UnitModal, BackupModal 등 14종 모달
            ├── contracts/              # 도메인 TypeScript 인터페이스 (types.ts)
            ├── data/                   # 로컬 영구 스토리지 Facade (db.ts)
            │   └── repositories/       # 도메인별 분리된 리포지토리 레이어
            ├── domain/
            │   ├── prompts.ts          # AI 출제 헌법, 도메인 고정, 충돌 예외처리
            │   ├── generator.ts        # AI 통신 및 4지선다 생성 파이프라인
            │   ├── question_distribution.ts # Fisher-Yates 정답 균등 무작위 셔플러
            │   └── curriculum_generator.ts  # 공인 5단계 표준 목차 자동 생성기
            ├── features/
            │   ├── study/              # 메인 학습 맵 화면
            │   ├── library/            # 과목자료함 & 문제은행 보관실
            │   ├── exam/               # 실전 CBT 시험장 & 4단계 오답 해설지
            │   └── settings/           # API 키 보안 등록, 일일 목표, 백업/복원
            └── hooks/                  # UI 상태 관리 및 비즈니스 로직 분리 커스텀 훅 (9종)
```

---

## 🤝 5. 인공지능 협업 가이드
본 프로젝트를 ChatGPT, Claude, Gemini 등의 다른 AI와 협업하여 수정할 경우, 반드시 루트의 [AGENTS.md](AGENTS.md)에 정의된 **9대 불변 개발 헌법**을 전달하십시오.
