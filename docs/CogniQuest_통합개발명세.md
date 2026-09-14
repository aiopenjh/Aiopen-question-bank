# 📘 CogniQuest AI — 통합 개발명세서 (v1.0 현행화)

> **프로젝트 정의**: 책·사이트·교안·AI 검색을 통해 확보한 팩트 자료를 근거로 시험 문제를 생성하고, 개인의 수험/학습 리듬에 맞춰 지속적으로 실력을 향상시키는 **AI 기반 맞춤형 시험 문제 생성 및 CBT 학습 모바일 애플리케이션**.

---

## 1. 핵심 요구사항 및 구현 기준선 (R01 ~ R14)

| ID | 핵심 요구사항 | 구현 상태 및 충족 기준 |
|---|---|---|
| **R01** | 개인 사용 우선 & 배포 확장 경계 | 개인 데이터 소유권 보장, 임의 공용 게시 금지, 오프라인 우선(Local First) |
| **R02** | 자유 주제 & 유연한 학습 범위 | 특정 과목(파이썬, 회계 등)에 종속되지 않고 수학, 과학, 자격증 등 임의 주제 생성/삭제 가능 |
| **R03** | 책·파일 입력 지원 구조 | 텍스트 PDF 및 일반 텍스트 자료 등록 인터페이스 구비 |
| **R04** | 사이트 입력 지원 구조 | 공개 웹 본문 수집 인터페이스 연결부 구비 |
| **R05** | 교안 입력 지원 구조 | DOCX/PPTX 교안 기반 학습 범위 설정 인터페이스 구비 |
| **R06** | AI 검색 입력 지원 구조 | 질의 기반 외부 지식 검색 및 팩트 추출 통로 연계 |
| **R07** | 자료 및 팩트 기반 출제 | 공인된 학술/교과 팩트에 근거하여 환각 없는 4지선다형 CBT 문제 생성 |
| **R08** | 정답 및 근거 정밀 검토 | 단일 정답 무결성, 오답 선지 3개의 타당성(Distractor Rationale) 검증 |
| **R09** | 풀이·해설·이어 풀기 | 문제 진행률 저장, 중단 후 재개, 시험 완료 시 단원 정복 자동 기록 |
| **R10** | 루틴·망각곡선 복습·진도 | 에빙하우스 간격 반복(SM-2 기반 Spaced Repetition) 복습 주기 자동 계산 |
| **R11** | 데이터 보존·백업·복원 | JSON 내보내기/불러오기(Import/Export) 및 DB 초기화 기능 완비 |
| **R12** | 보안·비밀값 격리 | Google Gemini API Key 대칭 솔트 암호화 저장 (`secure_storage.ts`), 백업 JSON 유출 원천 차단 |
| **R13** | 알림 및 학습 독려 | 매일 학습 리듬에 맞춘 격려 메시지 및 알림 안내 |
| **R14** | 실패와 상태의 정직한 표시 | API 미연동 시 `[연결 필요]` 상태 솔직 표시, 하드코딩된 가짜 문제 생성 차단 |

---

## 2. 시스템 아키텍처 및 모듈 구조

```
apps/mobile/
├── App.tsx                     # 전역 상태 및 화면 네비게이션 오케스트레이터
├── src/
│   ├── contracts/              # 데이터 엔티티 및 인터페이스 계약
│   │   └── types.ts            # Topic, Unit, QuestionRevision, Routine 등 핵심 타입 정의
│   ├── data/                   # 오프라인 영속 저장소 계층
│   │   └── db.ts               # AsyncStorage 기반 CRUD, 백업/복원, API Key 암호화 위임
│   ├── integrations/           # 외부 연동 및 보안 계층
│   │   └── secure_storage.ts   # 암호화 키 분리 및 대칭키 기반 API Key 암복호화
│   ├── domain/                 # 비즈니스 로직 및 알고리즘
│   │   ├── generator.ts        # Gemini REST API 통신 및 정밀 JSON 출제 엔진
│   │   ├── adaptive_scaffolding.ts # 오답 시 하향 비계(ZPD) 사전 개념 추출 엔진
│   │   ├── routine.ts          # 학습 리듬 및 멘토 메시지 생성
│   │   └── spaced_repetition.ts# SM-2 변형 망각곡선 복습 주기 산출 엔진
│   ├── components/             # 공통 UI 및 팝업 모달
│   │   ├── common/Header.tsx, TabBar.tsx
│   │   └── modals/TopicModal, UnitModal, FactModal, BackupModal, CuteRetryModal
│   └── features/               # 기능별 분리 화면 컴포넌트
│       ├── home/HomeScreen.tsx
│       ├── study/StudyMapScreen.tsx
│       ├── generate/GenerateScreen.tsx
│       ├── library/LibraryScreen.tsx
│       ├── settings/SettingsScreen.tsx
│       └── exam/
│           ├── ExamSessionScreen.tsx
│           └── DeepConceptSolidifierCard.tsx # 3단계 지식 굳히기 심화 해설 카드
```

---

## 3. 핵심 사용자 경험 (UX) 기능

1. **감성적인 오답 케어 (`CuteRetryModal`)**:
   - 오답 시 "틀렸습니다!" 대신 귀여운 토닥토닥 팝업(🐾) 제공.
   - `[다시 생각해볼래요 (한 번 더 기회)]` 및 `[힌트 살짝 엿보기]`를 통한 학습자 심리적 안정감 제공.
2. **정답 시 지식 굳히기 (`DeepConceptSolidifierCard`)**:
   - 찍어서 맞히거나 긴가민가했던 문제도 확실한 지식으로 고정.
   - `📌 1분 핵심 정의`, `🔍 오답 선지 3선 함정 분석`, `🧠 심화 팁`의 3단계 탭 인터랙션 제공.
3. **적응형 하향 비계 (Scaffolding)**:
   - 오답이 누적되었을 때 원클릭으로 선수 학습 개념을 추출하여 기초 다지기 문제를 생성.
4. **학습맵 단원 자동 정복 연동**:
   - 특정 단원 문제를 완주하면 학습맵의 목차에 `[✅ 정복 완료]` 체크가 자동 반영.
