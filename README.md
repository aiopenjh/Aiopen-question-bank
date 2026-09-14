# 🎓 CogniQuest — AI 기반 맞춤형 시험 문제 생성기 & CBT 학습 플랫폼

> **"원하는 모든 교재·자료로 실시간 시험 문제를 출제하고, 취약점을 집중 보완하는 나만의 AI 학습 파트너"**

---

## 🚀 빠른 시작 (실행 방법)

프로젝트 루트 폴더에서 아래 배치 파일을 더블 클릭하여 앱을 바로 실행할 수 있습니다:

- **[run_mobile.bat](file:///c:/AI-powered%20test%20generator%20app/run_mobile.bat)** 실행 ➔ 브라우저에서 `w` 키를 눌러 웹 모드로 보거나, 모바일 Expo Go 앱으로 QR 코드를 스캔합니다.

---

## ✨ 핵심 기능

1. **자유로운 학습 주제 & 단원(목차) 관리**
   - 수학, 과학, 회계, 자격증 등 원하는 모든 주제를 자유롭게 추가/삭제.
   - 단원(대단원/중단원)별로 문제를 연계하여 출제하고, 퀴즈 완주 시 학습맵에 `[✅ 정복 완료]` 자동 기록.
2. **Google Gemini 실시간 팩트 출제 엔진**
   - 허위 사실(환각) 없는 공인 교육과정/학술 팩트 기반 4지선다형 CBT 문항 생성.
   - API Key 미연동 시 `[연결 필요]` 상태를 정직하게 안내하여 가짜 문제를 원천 배제.
3. **감성적인 오답 케어 (`CuteRetryModal`)**
   - "틀렸습니다!" 대신 귀여운 토닥토닥 팝업(🐾)과 랜덤 응원 메시지.
   - `[다시 생각해볼래요]`로 2차 기회 부여 및 `[힌트 살짝 엿보기]` 제공.
4. **정답 시 지식 굳히기 심화 해설 (`DeepConceptSolidifierCard`)**
   - 찍어서 맞힌 문제도 완벽한 자기 실력으로 고정할 수 있도록 창이 전환되는 3단계 탭 인터랙션:
     - `📌 1분 핵심 정의` (용어/공식 요약)
     - `🔍 오답 선지 3선 함정 분석` (왜 다른 보기는 오답인가)
     - `🧠 심화 팁` (변형 문제 대비 & 30초 장기기억 고정법)
5. **적응형 하향 비계 (Adaptive Scaffolding)**
   - 오답이 누적되었을 때 원클릭으로 선수 학습 개념을 추출하여 기초 다지기 문제를 생성.
6. **보안 & 데이터 영속성**
   - Gemini API Key 대칭 솔트 암호화 격리 저장 (`secure_storage.ts`).
   - JSON 백업 내보내기/불러오기(Import/Export) 및 DB 완전 초기화 기능 지원.

---

## 📁 디렉터리 구조

```
c:/AI-powered test generator app/
├── README.md                 # 본 프로젝트 마스터 가이드
├── run_mobile.bat            # 원클릭 모바일/웹 앱 실행 스크립트
├── docs/                     # 통합 명세서 및 개발 리포트
│   ├── CogniQuest_통합개발명세.md
│   └── walkthrough.md
└── apps/
    └── mobile/               # Expo/React Native 모바일 애플리케이션
        ├── App.tsx           # 메인 오케스트레이터
        └── src/
            ├── components/   # 모듈화된 UI 컴포넌트 & 모달
            ├── contracts/    # 데이터 타입 정의 (types.ts)
            ├── data/         # 로컬 영속 저장소 (db.ts)
            ├── domain/       # AI 출제, 적응형 비계, 에빙하우스 복습 엔진
            ├── features/     # 기능별 분리 화면 (Home, Study, Generate, Exam, Settings)
            └── integrations/ # 보안 암호화 저장소 (secure_storage.ts)
```

---

## 📖 상세 명세서

전체 시스템 아키텍처 및 세부 데이터 계약은 아래 통합 명세서를 참조하세요:
- [docs/CogniQuest_통합개발명세.md](file:///c:/AI-powered%20test%20generator%20app/docs/CogniQuest_통합개발명세.md)
