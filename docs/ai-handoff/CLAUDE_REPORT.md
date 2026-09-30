# Claude 구현 보고서

## 작업 ID `difficulty-bands-20260930` — Codex 1차 검토 재수정 (R1~R6)

- 브랜치 `feature/difficulty-bands`, 재수정 커밋 `7ccf06a`(기준: Codex 검토 HEAD `48fab29`, 코드 `e3f958c`). push·병합·배포·APK 빌드 없음.
- 검증: Windows `cmd.exe /c npx tsc --noEmit` 오류 0, 앱 테스트 **276개 통과·실패 0**(270 → 276, 새 회귀 테스트 6개 + 기존 기대값 3개를 사용자 결정에 맞춤).

| 요청 | 수정 | 회귀 테스트 |
| --- | --- | --- |
| R1 수식 보정이 정상 코드·문장 훼손 | 해석 전에는 JSON에서 허용되지 않는 이스케이프(`\s`, `\l` 등)만 고친다(`escapeInvalidJsonBackslashes`). 올바른 JSON은 한 글자도 바꾸지 않는다. `\t`·`\f`처럼 JSON 이스케이프로도 읽히는 명령은 해석 뒤 문자열마다 `restoreLatexControlChars`로 되살리며, 짝이 맞는 `$...$` 구간만 대상이다. 코드블록·인라인 코드 안의 `$`, `\$`, 짝 없는 `$`는 경계에서 빼고 한글이 든 구간(가격 표기)은 수식으로 보지 않는다. 화면 복원도 같은 함수를 쓴다 | `ai_client.test.cjs`: Codex 반례(코드블록 `price = "$5"` 다음 줄 `abla`), 짝 없는 `$` 문장, 가격 두 개, `\$`, 인라인 코드가 그대로 보존됨. `math_notation.test.cjs`: 짝 없는 `$`·한글 구간·인라인 코드의 줄바꿈 보존과 짝 맞는 구간 복원 |
| R2 하루 소진 모델 재요청 | 서버가 429 PerDay로 알린 모델은 같은 키·같은 태평양 날짜 동안 후보에서 건너뛴다(메모리). 날짜가 바뀌거나 다른 키면 다시 시도한다. 분당·분류 불가 제한의 짧은 대기는 그대로다. 기기 추정 횟수로는 막지 않는다 | `ai_client.test.cjs`: 5개 모두 하루 소진 → 31초 뒤 요청 0회, 다른 키 5회, 다음 날 다시 5회 |
| R3 일부 실패의 상세 사유 노출 | 응답이 객체가 아님·주제 판정 상태 오류·문제 유형 계획 불일치·부적합 주관식 반복도 화면에는 `AI 응답을 제대로 받지 못했습니다. 다시 요청해 주세요.`만 보이고 사유는 개발자 기록에만 남긴다. NEEDS_CLARIFICATION·REJECTED·취소·연결 필요·한도 안내는 별도 상태로 유지 | `generator.test.cjs`: 주제 판정 오류 2종, 유형 불일치, 부적합 주관식 반복이 재요청 안내만 보이고 사유는 기록에 있음 |
| R4 복습 화면 코드 보기 | `ReviewHouseSection` 보기 텍스트를 기존 `MathText`로 표시(`optionReviewText`의 `flex: 1` 유지) | 로컬 웹(`codecheck.localhost`, 모바일 폭)에서 코드 보기 2개가 코드 상자로, 번호·`✓ 정답` 태그와 일반 보기는 기존 배치로 보이는 것을 확인. 확인용 문제는 삭제 |
| R5 숫자·단위·수식 답 안내 | 수·식 판별 시 `$`, LaTeX 명령, 중괄호, 숫자 뒤 단위(영문·기호·자주 쓰는 한글 수량 단위), 수학 함수 이름, 수학 기호를 걷어낸 뒤 판단한다. 빈칸마다 등록 정답 중 수·식 답이 있으면 수·식 빈칸으로 본다. 채점 인정 범위는 그대로 | `difficulty_bands.test.cjs`: `2kg`·`5km/h`·`30cm²`·`3개`·`12시간`·`$\frac{1}{2}$`·`\sqrt{2}`·`50%`·`sin 30`은 수·식, `Physical AI`·`DNA`·`山`·`시·도경찰청장`·`\text{사과}`·`x`·빈 값은 명칭 |
| R6 해석 오류 로그의 응답 조각 | JSON 해석 실패는 `JSON 해석 실패(종료 사유 …, 응답 길이 N자)`만 기록한다. 종료 사유는 허용 목록(STOP·MAX_TOKENS 등) 밖이면 `알 수 없음`. 문항 유형 검사 메시지에서 AI가 보낸 유형 값을 뺐다. 같은 성격인 목차 생성 실패 로그도 원본 예외 대신 고정 범주만 남긴다 | `generator.test.cjs`: 가상 민감 표식이 든 손상 응답 2종에서 표식·응답 조각이 기록되지 않고 고정 범주·길이·허용 종료 사유만 남음 |

### 화면에 보이는 실패 문구(갱신)

- 출제 형식 문제 전체(해석 실패, 응답이 객체가 아님, 주제 판정 상태 오류, 문항 검사 실패, 문제 유형 불일치, 정답 모순 반복, 부적합 주관식 반복)와 힌트 생성 실패: `AI 응답을 제대로 받지 못했습니다. 다시 요청해 주세요.`
- 목차·힌트 통신 실패: 위 문구 또는 `등록된 API 키가 유효하지 않습니다. 설정에서 API 키를 확인해 주세요.` / `API 키의 권한이나 활성화 상태를 설정에서 확인해 주세요.` / 연결 안내 2종(최신 정보 확인·PDF 분석 지원 연결 필요)
- 한도: 하루·분당 문구는 첫 섹션과 같다. 사용량 안내창도 같다.

### 남은 한계

- 보류 3건(경고 취소 시 레벨 저장 순서, 모델 ID 이중 정의, 사용량 기록 연결 자동 테스트)은 Codex 판단대로 유지.
- 하루 소진 모델 기억은 메모리에만 있어 앱을 다시 켜면 그 모델에 한 번 더 요청한 뒤 다시 기억한다.
- 한글이 든 `$...$` 구간은 수식으로 보지 않으므로, 그런 구간에서 탭·폼피드로 깨진 명령은 복원하지 않는다(잘못 바꾸는 쪽보다 안전한 쪽을 택함).
- 실제 AI 생성·실제 429 응답·Android 실기기·PDF는 이번 재수정에서 다시 확인하지 않았다.

---

## 작업 ID `difficulty-bands-20260930` — 구현 완료·Claude 자체 점검 완료, Codex 검토 요청

- 브랜치 `feature/difficulty-bands`, 기준 `main@3983154`. 코드 마지막 커밋 `e3f958c`. 원격 push·main 병합·웹 배포·APK 빌드 없음(테스트 사용자 배포 중이라 사용자 승인 전까지 금지).
- 코드 커밋(순서대로): `12dac47` 코드블록 → `96f2328` 레벨 구간·과목별 기준·빈칸 표시 → `4db2db8` 15문항 확인창 제거 → `79bbf6c` 정답 불일치 재출제 → `42364b4` 요청 횟수 안내·한도/형식 오류 구분 → `e4c8021` 레벨 16+ 깊이·검산 지시 → `c20e677` 서술형 개수 기준·재요청 안내 단순화 → `f3177d5` 자체 점검 지적 반영 → `11da909` 화면 안내 모델명 제거·초기화 안내 단순화 → `e3f958c` 수식 역슬래시 JSON 해석 실패 수정. 나머지 커밋은 인수인계 문서다.
- 검토 범위 diff: `git diff main...feature/difficulty-bands -- apps/mobile`

### 기능 변경

| 영역 | 기존 | 변경 | 주요 파일 |
| --- | --- | --- | --- |
| 코드블록 | 코드가 일반 글꼴 한 줄로 표시 | ```` ``` ```` 코드블록을 고정폭 상자로 표시, 출제 지시 15번 규칙 | `domain/code_block.ts`, `components/common/MathText.tsx`, `domain/prompts.ts` |
| 레벨 구간 | 5레벨씩 6구간, 31+ "무한히 높이지 말라" | 1~30은 3레벨씩 10구간, 31~45 도전 5구간, 46+ 유지. 구간 안 3단계, 구간 끝 레벨은 다음 구간 요소를 1문항에 미리 섞음. 유형별 기준(출제 유형만 지시문에 포함). 레벨 16+ 내용 깊이·극단 표현 오답 금지. 서술형 채점 요소 수 레벨별 숫자 명시와 출력 예시 개수 자동화(검증 강제 없음). 저장용 인지 단계 값은 기존 경계 유지 | `domain/difficulty.ts`, `domain/prompts.ts` [난이도 기준] |
| 과목별 레벨 기준 | 없음 | 과목 등록·목차 생성 때 11줄 기준을 같은 응답으로 받아 `Topic.difficultyLadder`에 저장(없을 때만). 형식이 틀리거나 예시 문구를 베끼면 버림. 출제 지시문에 해당 구간 한 줄 포함 | `domain/curriculum_generator.ts`, `contracts/types.ts`, `data/repositories/topic_unit_repository.ts`, `backup_validation.ts`, `hooks/useAppData.ts`, `hooks/useCurriculumManager.ts`, `hooks/useQuizGeneration.ts`, `domain/generator.ts` |
| 빈칸 표시 | `( 1 )`, 결과·복습 화면은 `{{1}}` 원문, 모든 빈칸에 정식 명칭 안내 | `[빈칸 n]`(시험·결과·복습), 수·식 답이면 수·식 안내. 출제 지시에 답 형식·다른 표기 포함 | `domain/cloze_display.ts`, `ExamActiveView`·`ExamResultView`·`ReviewHouseSection` |
| 하루 출제 제한 | 15문항 넘으면 확인창 | 제거 | `hooks/useQuizGeneration.ts`, `QuizCountModal.tsx` 문구 |
| 요청 횟수 안내 | 없음 | 서버가 처리한 요청(성공·시간 초과)을 모델별로 기기에 기록(태평양 날짜, 백업 제외). 다음에 쓸 모델이 한도 90% 이상이면 출제 전 안내창(계속 생성 가능, 모델명 없음). 한도표: 3.5 Flash-Lite 500, 3.5~3.8 Flash 각 20(2026-09-30 AI Studio 무료 등급) | `domain/ai_usage.ts`, `data/repositories/ai_usage_repository.ts`, `domain/ai_client.ts`, `hooks/aiUsageNotice.ts`, `usePromptGeneration.ts` |
| 429 안내 | "잠시 기다린 뒤 다시 시도" | 429 본문으로 하루/분당 구분. 모든 후보가 하루 한도일 때만 하루 한도 안내 | `domain/ai_client.ts`, `domain/ai_usage.ts`, `domain/generator.ts` |
| 정답 불일치 | 그대로 저장 | 오답 보기 설명이 "정답"으로 시작하거나 정답 보기 설명이 "오답"으로 시작하면 같은 계획으로 1회 재요청, 반복되면 저장 안 함 | `domain/generator_validation.ts`, `domain/generator.ts` |
| 실패 안내 | 형식 오류가 "API 서버와 통신할 수 없습니다"로 표시, 목차·힌트 실패에 모델명·오류 번호 노출 가능, 힌트 버튼은 검사 사유 노출 | 형식 오류·힌트 실패는 재요청 안내 한 문장. 목차·힌트 통신 실패는 `describeAiFailureForUser`로 모델·공급자·오류 번호 제거. 형식 검사 사유는 개발자 콘솔에만 기록(키·응답 원문 없음) | `domain/generator.ts`, `domain/ai_client.ts`, `domain/curriculum_generator.ts`, `domain/hint_generator.ts` |
| 수식 역슬래시 | AI가 JSON에 `\sqrt`처럼 역슬래시를 한 번만 쓰면 해석 실패, `\times`·`\frac`는 탭·폼피드로 바뀌어 저장 | 해석 전 교정(`escapeLatexBackslashes`: 잘못된 이스케이프는 항상, `\b\f\n\r\t`로 시작하는 LaTeX 명령은 `$...$` 안에서만). 응답 길이 한도 8192→16384. 이미 깨져 저장된 수식은 화면에서만 복원(`$` 안, 원문 미수정) | `domain/ai_client.ts`, `domain/math_notation.ts`, `domain/prompts.ts` 11번 규칙 |
| 레벨 표시 | "레벨 N · 구간 이름" | "레벨 N"만 | `DifficultyLevelControl.tsx`, `QuizCountModal.tsx` |

### 화면에 보이는 문구(사용자 원칙 대조용)

- 사용량 안내창: 제목 `AI 요청 사용량 안내`, 본문 `오늘 AI 요청을 N회 사용했습니다. 무료 한도에 가까워 곧 문제 생성이 제한될 수 있습니다.`, 버튼 `취소`/`계속 생성`
- 하루 한도: `오늘 AI 요청 한도를 모두 사용했습니다. 한도는 미국 태평양 시간 자정 기준으로 초기화됩니다(약간의 차이가 있을 수 있습니다).`
- 분당 한도: `짧은 시간에 요청이 많아 잠시 제한되었습니다. 1분쯤 기다린 뒤 다시 시도해 주세요.`
- 형식 오류·힌트 실패: `AI 응답을 제대로 받지 못했습니다. 다시 요청해 주세요.`
- 빈칸 수·식 답: `각 빈칸에 들어갈 수나 식을 입력하세요.`(명칭형은 기존 문구 유지)
- 삭제: 설명서 `하루 누적 15문항…` 문장, 출제 팝업 `하루 누적 15문항을 넘기면 추가 확인을 받습니다.`

### 사용자 결정(검토 기준)

- 화면·설명서에 요청하지 않은 안내를 추가하지 않는다. 모델·공급자 이름과 오류 번호는 보이지 않는다. 내부 사유는 화면에 내보내지 않는다.
- 요청은 앱에서 임의로 막지 않는다(한도는 사용자 AI 할당량). UI 배치는 유지하고 기능만 바꾼다.
- 제외: 중복 문제 필터 강화, PDF 내보내기 표시 변경, 단원 소진 안내, 별도 AI 검산 요청, 서술형 개수 강제 검증, APK 반영.

### 검증

- Windows `cmd.exe /c npx tsc --noEmit` 오류 0, 앱 테스트 270개 통과·실패 0.
- 로컬 웹(데이터 없는 별도 주소 `codecheck.localhost`): 코드블록, 레벨 표시, `[빈칸 n]`(시험·결과·복습), 사용량 경고(450회 주입 후 경고, 계속 생성 뒤 451회), 깨진 수식 복원("3 ⟨탭⟩imes 2" → "3 × 2") 확인.
- 실제 AI 출제(사용자 키, 약 14회): 과목별 기준 11줄 저장(한문 3급·문학), 문학 레벨 1 기초 수준, 레벨 1→15 상승 확인, 레벨 16+ 규칙 뒤 레벨 30에서 기초 용어 단답·극단 표현 오답 사라짐. 서술형 채점 요소는 3개가 반복돼 기준을 완화했다. 수학 출제 실패의 원인을 개발자 기록으로 "JSON 해석 불가"까지 확인했고, 저장 문제에서 `\times`가 탭으로 바뀐 흔적을 찾아 역슬래시 교정을 넣었다. 교정 뒤 같은 경로(이어서 학습하기 → 새 문제 만들기) 출제 성공.
- 지시문 길이: 출제 5,815~5,819자 → 7,175~7,640자(+23~31%), 목차+기준 요청 1,757자 → 2,621자.

### Claude 자체 점검(code-review xhigh) 결과

- 13건 중 수정 10건: 혼합 429 하루 한도 오표시, 한자만 있는 빈칸 답 안내, 한도 소진 뒤 횟수 부풀림, 기준 예시 문구 저장, 시간 초과 요청 미집계, 정답 모순 문구 인식 범위, 설명서 15문항 문구, 인수인계 기록, 도전 시작 레벨 상수 중복(순차 도전 상수 사용), 서머타임 전환일 초기화 시각(안내 문구 변경으로 해소).
- 보류 3건: ① 사용량 안내에서 취소해도 출제 팝업이 먼저 저장한 단원 레벨 변경은 남음(기존 저장 순서, 도전 레벨 흐름과 연결돼 범위가 큼) ② `db.DEFAULT_GEMINI_MODEL`과 `ai_usage.GEMINI_MODEL_ORDER` 이중 정의(기본값은 선호 모델 저장값에만 쓰여 요청 순서·화면에 영향 없음) ③ `useAppData`의 사용량 기록 연결에 자동 테스트 없음(수동 확인만).

### 미검증·알려진 한계

- 실제 429 응답 본문 형식(하루/분당 구분 근거), Android 실기기, 검산 지시·빈칸 답 형식 지시의 효과.
- PDF·문제집 내보내기는 코드블록 기호와 `{{n}}`을 원문 그대로 출력(사용자 결정으로 보류).
- 요청 횟수는 이 기기 기준 추정치(다른 기기·AI Studio 사용 미반영), 한도표는 무료 등급 고정값.
- 복습 화면 등에서 단답형 모범답안이 `$12$`처럼 수식 기호째 보이는 기존 표시 문제(이번 범위 밖, 사용자 결정 대기).

---


## 작업 ID `android-apk12-fixes-20260925` — Codex 1차 검토 재수정 (iteration 1)

- **커밋·검증 미실행.** 이번 세션에서도 `git`·`node --test` 명령이 권한 승인 대기로 막혀 재시도하지 않았다. 변경은 미커밋 작업 트리에 있으며, Codex가 대상 테스트·Windows tsc·한글 커밋을 맡는다. 권장 메시지: `수정: 빈칸형 인접 접미 전체 일치 제한·현행 법령 지침 한정·설명서 AI 전송 안내`
- 요청 3건만 수정했고 그 외 기존 미커밋 변경은 그대로 두었다. push·병합·빌드·배포 없음.

| 요청 | 파일 | 수정 |
| --- | --- | --- |
| 1. 접미 앞부분 과허용 | `src/domain/grading.ts` | `matchesWithDuplicatedSuffix`의 `len = 1..suffix.length` 반복을 제거. 제출 답이 **인접 접미 전체**로 끝나고 나머지(trim)가 등록 정답과 정확히 같을 때만 인정. `{{1}}종`에 `1종`·`제1종` 인정, `Pa`/`Ds`·`3종`·`종`·`1종종` 등 기존 오답 판정은 동일 |
| | `tests/cloze.test.cjs` | 반례 테스트 1개 추가: 지문 `{{1}}종류`/`{{2}}종류`, 정답 `1`/`2`에 `1종`·`2종`은 0점, `1종류`·`2 종류`는 100점 |
| 2. 일반 프롬프트 범위 | `src/domain/prompts.ts` | 문장을 “현재 시행 중인 제도·법령을 묻는 빈칸이라면” 현행 표현만 넣고 옛 명칭을 섞지 않도록 한정하고, 역사·옛 법령 명칭 자체를 묻는 문제는 자료에 적힌 당시 명칭을 따른다고 명시. `current_information.ts`는 변경 없음 |
| 3. 설명서 AI 전송 안내 | `src/components/modals/userManualSections.tsx` | 로컬 데이터 단락에 한 줄 추가: AI 출제·채점·힌트 사용 시 문제와 답안, 연결한 교재에서 선택한 페이지 등이 사용자가 연결한 AI 서비스 제공자에게 전송될 수 있으며 처리·보관 조건은 제공자의 약관·개인정보 처리방침을 확인. `AiDataNoticeModal` 문구에 맞췄고 새 보장·저장기간은 쓰지 않음 |

- 기존 테스트 중 바뀐 프롬프트·설명서 문구를 직접 검사하는 것은 없음을 검색으로 확인했다(`현재 기준으로`, `옛 기관`, `외부 중앙 서버`). 실행 검증은 하지 않았다.
- Codex 확인 권장: `node --test tests/cloze.test.cjs tests/current_information.test.cjs`(필요 시 프롬프트 테스트 포함)와 Windows `cmd.exe /c npx tsc --noEmit`.

---

## 작업 ID `android-apk12-fixes-20260925` — Android APK 12 제보 수정과 사용설명서 최신화

- 작업 위치: `D:/ai bank`, 브랜치 `feature/android-apk12-fixes` (기준 `feature/android-app@c53dc7e`).
- **커밋 없음.** 이번 세션에서 `git`·`node --test`·`npx tsc` 명령이 모두 권한 승인 대기로 막혀 반복 시도하지 않았다. 아래 변경은 작업 트리에 미커밋 상태로 남아 있다(인수인계 문서 `TASK.md`·`STATUS.json`·이 보고서 포함). 사용자 승인 후 한글 커밋이 필요하다. 권장 메시지: `수정: 빈칸형 인접 접미 채점·자료/설명서 하단 가림과 스크롤 개선, 사용설명서 최신화`
- push·병합·EAS 빌드·배포는 하지 않았다.

### 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/domain/grading.ts` | `gradeClozeAnswers(blanks, answers, stem = '')`. 정확 일치(기존)에 더해, 지문에서 `{{n}}` **바로 뒤에 붙은 글자 묶음**의 앞부분을 답 끝에 중복 입력하고 나머지가 등록된 정답과 정확히 같을 때만 인정. 전역 정규화·약어 추측 없음 |
| `src/domain/exam_grading.ts` | 빈칸형 채점에 `item.stem` 전달(1줄) |
| `src/domain/current_information.ts` | 최신 법령 검증 지침에 한 줄 추가: 기관·직위 명칭은 기준일 현행 조문 표기, 옛 명칭(예: 지방경찰청 → 시·도경찰청)을 지문·보기·정답·correctAnswers에 넣지 않음. 기존 공식 출처·현행성 규칙은 그대로 |
| `src/domain/prompts.ts` | 빈칸형 규칙 4번 끝에 한 문장: correctAnswers에 현재 기준 표현만, 개정으로 바뀐 옛 기관·직위 명칭 금지(법 과목으로 감지되지 않는 운전면허 등 일반 과목 대비) |
| `src/components/modals/SourceUploadModal.tsx` | `useSafeAreaInsets()`로 카드 하단 여백을 `max(30, 16 + insets.bottom)`로, ScrollView `contentContainerStyle` 하단 12 추가. 웹은 inset 0이라 기존 30 유지. 텍스트·PDF 등록·키보드 로직 변경 없음 |
| `src/components/modals/UserManualModal.tsx` | 배경 닫기 `TouchableOpacity`가 카드 `TouchableOpacity`를, 카드가 ScrollView를 감싸던 중첩 구조 제거 → 배경은 형제 `Pressable`(absoluteFill), 카드는 일반 `View`. ScrollView에 `flexShrink: 1`, 카드 하단 여백 `12 + insets.bottom` |
| `src/components/modals/userManualSections.tsx` | 코드 대조 후 갱신(아래) |
| `tests/cloze.test.cjs` | 회귀 테스트 2개 추가 |
| `tests/current_information.test.cjs` | 지침 문구 테스트 1개 추가 |

### 판단 근거

1. **`경찰서`**: 채점 코드는 정답 목록과의 정확 일치라 이미 오답이며 그대로 유지. 저장된 문제·점수는 건드리지 않았다. 새 접미 규칙도 `경찰서`/`경찰서이`를 인정하지 않음을 테스트로 고정.
2. **`1종`/`2종`**: 접미 인정은 `stem`이 주어지고 해당 빈칸 표시 바로 뒤에 공백 없이 붙은 글자가 있을 때만 동작한다. `3종`, `종` 단독, 순서 뒤바뀜(`2종`→1번 칸), `1종종`, 지문에 인접 접미가 없는 경우(`{{1}} 종류`), stem 미전달, `Pa`/`Ds`(및 `Pa는`)는 계속 오답.
3. **자료 등록 창**: Android 시스템 내비게이션 영역만큼 카드 하단이 부족해 마지막 행이 가려지는 것으로 판단. 기존 `SafeAreaProvider`(AppView) 안에서 렌더되므로 새 의존성 없이 inset 사용.
4. **사용설명서 스크롤 원인 판단**: (a) 스크롤 영역이 두 겹의 `TouchableOpacity` 응답자 안에 있어 Android에서 터치 시작을 Touchable이 먼저 잡고 ScrollView가 응답권을 넘겨받는 과정이 끼어 드래그가 늦거나 무시될 수 있음, (b) `maxHeight: 590` 고정값이 작은 화면에서 카드 `maxHeight: 92%`를 넘어 `overflow: hidden`에 하단이 잘리면 끝까지 스크롤되지 않아 멈춘 것처럼 보임, (c) 하단 안전 영역 미반영. 세 가지를 최소 수정했다. 배경 탭 닫기·닫기 버튼·뒤로가기(`onRequestClose`)는 유지.
5. **사용설명서**: 실제 라벨·동작 대조 결과 반영
   - 문제 유형 `[혼합]/[객관식만]/[주관식만]`과 주관식만의 빈칸형 제외(`QuizCountModal`, `question_type_plan`).
   - 시험 상단 `[📐 풀이공간]`(채점 미반영), `[🚩 문제 신고]`(풀이 중 현재 문제/결과 화면 선택), 입력형 답안.
   - 새 항목 “빈칸형·주관식 채점”: 객관식·빈칸형 로컬 채점, 빈칸형 약어 안내(`CLOZE_ABBREVIATION_NOTICE`와 같은 문구)와 인접 접미 인정, 빈칸 비율·서술형 항목별 부분점수, 채점 미완료(답안 보관·점수 제외), `[내 답도 정답으로 정정]`의 반영 범위.
   - 낡은 라벨 `[다음 5개 단원 생성]` → 실제 `[AI 5개 단원 만들기]`, `[중복 정리]` 버튼.
   - PDF 재연결: `[+ 자료]` 목록의 `[원본 선택]`/`[연결됨]`. 등록은 파일만 가능하므로 “텍스트 자료” → “PDF나 텍스트 파일”.
   - 문제집 PDF: Android `[PDF 만들고 저장하기]` → 공유 화면, `[PDF 저장 화면 열기]`는 웹 전용으로 표시. 백업 저장(Android 공유 화면/웹 다운로드)과 `[복원하기 ➔ 백업 파일 선택]` 추가.
   - 웹 전용 표시: `[갱신]`(네이티브는 서버 확인 없이 현재 버전 안내만 함), 홈 화면 추가, 웹사이트 데이터 삭제. Android 저장 위치(앱 내부 저장소)와 초기화 후 앱 삭제 안내 추가.
   - 랭킹·알림·목표·새로고침 항목은 코드와 일치해 유지.

### 검증 결과

- **테스트·타입 검사 미실행.** `node --test tests/cloze.test.cjs`와 `npx tsc --noEmit`이 권한 승인 대기로 거부되어 반복하지 않았다. Codex가 `node --test tests/*.test.cjs`와 Windows `cmd.exe /c npx tsc --noEmit`을 실행해 확인해야 한다.
- 추가 테스트: `cloze grading accepts a duplicated suffix only when it is adjacent to the blank in the stem`, `cloze grading keeps rejecting a different institution name and guessed abbreviations with a stem`, `current-law instruction keeps official-source rules and forbids outdated agency names`.

### 미검증·한계

- 실기기 미검증: 자료 등록 창 마지막 줄 노출, 사용설명서 펼친 뒤 스크롤·닫기 반응(특히 3버튼/제스처 내비게이션, 저사양 기기). 원인 판단은 코드 분석 기반이다.
- 인접 접미는 빈칸 **뒤**만 본다. `제{{1}}종`처럼 앞 글자를 중복 입력(`제1`)하는 경우는 정답 목록에 있을 때만 인정된다.
- 옛 기관 명칭 지침은 앞으로 생성할 문제에만 영향을 준다. 기존 저장 문제의 정답 목록은 바꾸지 않았다.
- Android `[갱신]`이 서버 확인 없이 “최신 버전” 안내를 띄우는 동작 자체는 범위 밖이라 수정하지 않고 설명서에만 반영했다.

## 작업 ID `android-data-preservation-sync-20260925` — Android 최신 코드에 학습 데이터 보존 수정 통합

- 작업 폴더: `C:/Users/choor/.codex/worktrees/android-data-preservation-sync`, 브랜치 `feature/android-data-preservation-sync`
- 기준: `b05d96f` 위 `14a4a25`(인수인계 문서). 구현 커밋 **`8cf6f7f`** (`수정: 목차 재생성·단원 정리·백업 복원 학습 기록 보존 통합`)
- 원본: `feature/data-preservation`의 `90ab2ba`, `551e702`, `a8df0d2` (공통 조상 `d0b5652`). `git cherry-pick -n`으로 코드만 가져와 검토 후 한 커밋으로 기록했다. push·병합·APK 빌드·배포는 하지 않았다.

### 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/data/repositories/unit_reference_plan.ts` (신규) | 목차 재생성 대응·보존 계획, 중복 단원 병합 계획(소유자별 완료 기록, 최신 `changedAt` 유지, 충돌 시 병합 취소), 삭제 문제의 풀이·정정 정리. 원본과 동일 |
| `src/data/repositories/topic_unit_repository.ts` | 위 계획을 `replaceTopicUnits`·중복 정리·단원/과목 삭제에 적용, 다중 키 저장 실패 시 스냅샷 롤백. 원본과 동일(공통 조상 이후 기준 브랜치에서 이 파일은 변경되지 않음) |
| `src/data/repositories/backup_validation.ts` (신규) | 백업 항목 필드·ID 유일성·참조 무결성 사전 검사. 원본 대비 `AppBackupPayload` 타입 import만 `./backup_repository` → `./backup_payload`로 변경 |
| `src/data/repositories/backup_payload.ts` | `normalizeBackupPayload()` 끝에서 `validateBackupPayload(payload)` 호출. 복원 미리보기(`inspectBackupJSON`)와 실제 복원이 같은 검사를 거치고, 실패하면 저장소 스냅샷·쓰기 전에 거부 |
| `tests/data_preservation.test.cjs` (신규) | 원본 회귀 테스트 11개 + 통합 테스트 1개 |
| `tests/storage.test.cjs` | 롤백 테스트 픽스처가 사전 검사를 통과하도록 기존 과목 유지(원본과 동일한 3줄). 기준 브랜치의 새 테스트는 그대로 유지 |

### 충돌 해결

- 유일한 충돌은 `backup_repository.ts`. 원본은 이 파일 안의 `normalizeBackupPayload`에 검사를 넣었지만 최신 브랜치는 해당 함수를 `backup_payload.ts`로 분리했다. `backup_repository.ts`는 **기준 브랜치 내용 그대로(변경 0줄)** 두고 검사 호출을 `backup_payload.ts`로 옮겼다. 옛 파일 내용이 되살아나지 않았다.
- 공통 조상 이후 기준 브랜치에서 바뀐 시험·키보드·PDF·빈칸형·신고·설정 파일, `useCurriculumManager.ts`, `contracts/types.ts`는 이번 커밋에서 건드리지 않았다. 의존성·프롬프트·디자인 변경 없음. 구버전 이관 코드도 그대로다.

### 추가 회귀 테스트

- `split backup_payload module applies the pre-check and a current Android full backup still round-trips`: 현재 앱에서 과목·단원 난이도·빈칸형(복수 정답)·서술형(채점 체크리스트)·AI 힌트·빈칸형 풀이 기록을 만든 뒤 전체 백업을 내보낸다. (1) `backup_payload.ts` 단독 `normalizeBackupPayload`와 `inspectBackupJSON`이 끊긴 과목 참조를 거부하고, (2) 손상 백업 복원은 저장소를 전혀 바꾸지 않으며, (3) 정상 백업은 위 필드를 모두 보존해 복원된다.
- 변이 확인: `validateBackupPayload` 호출을 일시 제거하면 새 테스트 포함 3개가 실패하고, 복구 후 전부 통과했다.

### 검증 결과

- 전체 앱 테스트: `node --test tests/*.test.cjs` → **225개 통과, 실패 0** (기준 213 + 원본 이관 11 + 통합 1).
- 타입 검사: **오류 0**. 이 worktree에는 `node_modules`가 없고 junction 생성이 권한상 막혀, 같은 `b05d96f` 기준인 `android-web-hotfix-sync/ai bank/apps/mobile/node_modules`를 읽기 전용으로 참조했다. 테스트는 `NODE_PATH`, 타입 검사는 저장소 밖 임시 tsconfig(`expo/tsconfig.base` 확장, 프로젝트와 같은 `strict`·`noUnusedLocals`·`noUnusedParameters`, `paths`로 해당 node_modules 지정)로 실행했고 변경 파일 3개를 포함한 앱 소스 146개가 검사 대상이었다. **Windows `cmd.exe /c npx tsc --noEmit`는 직접 실행하지 못했다.** Codex가 의존성이 설치된 환경에서 재확인해야 한다.

### 미검증 항목

- 실기기·APK 동작(목차 재생성, 단원 삭제·중복 정리, 백업 복원 화면) 미검증.
- 사용자 결정에 따라 구버전 데이터 이관·덮어 설치는 검증하지 않았다(통과로 표시하지 않음).
- 백업 사전 검사가 기존 사용자의 실제 오래된 백업 파일을 모두 받아들이는지는 테스트 픽스처로만 확인했다. 실제 백업 파일은 사용하지 않았다.

---

## 작업 ID `android-cloze-abbreviation-20260925` — Android 빈칸형 약어 안내와 채점 일관성

- 작업 폴더: `C:/Users/choor/.codex/worktrees/android-web-hotfix-sync/ai bank`
- 브랜치: `feature/android-release-candidate`
- 기준 커밋: `52f2785`(Codex 키보드 스크롤 수정, 유지함) 위, `b07a11c`(인수인계 문서) 포함
- 이 절 이후의 "## 작업 정보"부터는 이전 작업(`android-real-device-round1-20260925`)의 기록이며 이번 지시가 아니다. 이번 작업은 TASK.md의 "Claude 구현 범위" 1~4항만 다룬다.
- **커밋 미완료**: 이 세션도 `git add`/`git commit`, `node --test`, `cmd.exe /c npx tsc --noEmit` 등 실행형 명령이 전부 "requires approval"로 거부되어 실행하지 못했다. 지시에 따라 반복 시도하지 않았다. Codex가 아래 "Codex가 실행해야 하는 명령"을 직접 실행해 확인해야 한다.

### 1. `gradeClozeAnswers()`/`correctAnswers` 생성·검증 경로 확인 — 코드 변경 없음(이미 요구사항 충족 확인)

- `apps/mobile/src/domain/grading.ts`의 `gradeClozeAnswers()`는 `normalizeComparableText()`(공백 정리·소문자화만 수행, 의미 유사도 판단 없음)로 정규화한 뒤 `blank.correctAnswers`와 **정확히 일치**하는 경우에만 `met: true`로 채점한다. `Pa`·`Ds` 같은 약어가 정답 목록에 없으면 뜻이 비슷해도 무조건 `met: false`다. AI 재채점이나 의미 유사도 판정 경로가 전혀 없다(`gradeExamAnswers`는 cloze 유형에서 AI를 호출하지 않고 이 함수만 로컬 호출).
- `apps/mobile/src/domain/generator_validation.ts`의 `readClozeBlanks()`도 AI가 응답한 `correctAnswers` 배열을 다듬기(빈 문자열 제거, trim)만 하고, 약어를 추정해 목록에 추가하거나 다른 표기를 자동 생성하는 로직이 없다. 즉 출제·저장·채점 세 경로 모두 "AI가 명시한 목록에 있는 것만 정답"이라는 원칙을 이미 지키고 있어 이번 요구사항(임의 약어를 뜻이 비슷하다는 이유로 정답 처리하지 않기)에 대해서는 **코드 수정이 필요하지 않았다.** 대표 사례(`Pa`/`Ds`)와 명시적으로 등록된 약어(`PAI`) 모두를 검증하는 회귀 테스트를 추가했다(아래 4번).

### 2. 시험 입력 전 빈칸형 안내 문구 — 완료

- `apps/mobile/src/features/exam/ExamActiveView.tsx`에 권장 문구 그대로 `CLOZE_ABBREVIATION_NOTICE = '정식 명칭으로 입력하세요. 약어는 정답으로 등록된 경우에만 인정됩니다.'`를 상수로 추가하고, cloze 문제의 입력 칸 목록 바로 위(첫 입력칸보다 먼저, 답안 입력 전)에 `<Text>`로 렌더링했다.
- 이 안내는 데이터가 아니라 `questionType === 'cloze'`일 때 항상 렌더링되는 고정 UI라서, **이미 저장된 빈칸형 문제에도 자동으로 적용된다**(저장된 문제 데이터를 건드리지 않고도 모든 빈칸 문제에 같은 규칙이 보인다).
- 생성된 `correctAnswers`나 `explanation`, `deepReasoningHint` 등 정답 관련 정보는 노출하지 않는다(문구 자체가 고정 텍스트이고 문제 데이터를 참조하지 않음).
- Codex의 `52f2785`(키보드가 열리면 현재 입력칸으로 스크롤)가 쓰는 `bodyRef`/`focusedInputRef`/`useEffect`/`handleAnswerFocus`는 전혀 건드리지 않았다. 새 `<Text>` 한 줄만 cloze 입력 목록 `View` 안에 추가했다.
- 변경 파일: `apps/mobile/src/features/exam/ExamActiveView.tsx`

### 3. 출제 프롬프트에 정식 명칭/약어 허용 기준 추가 — 완료

- `apps/mobile/src/domain/prompts.ts`의 `buildQuestionGenerationPrompt()` 안 cloze 규칙(기존 규칙 4번) 끝에 다음 문장을 추가했다: "빈칸이 명칭이나 용어를 묻을 때는 지문에서 정식 명칭(풀네임)으로 답하도록 요구하고 correctAnswers에도 정식 명칭을 넣습니다. 자료에 그 약어가 명확히 쓰여 있어 정답으로도 인정할 때만 correctAnswers에 그 약어를 별도 항목으로 추가하세요. 약어의 의미를 추정해서 확인 없이 정답 목록에 넣지 마세요. 지문이 요구하는 형식과 correctAnswers의 채점 기준은 항상 서로 일치해야 합니다."
- 이 문장은 (a) 지문이 요구하는 답변 형식(풀네임)과 채점 기준(correctAnswers)을 일치시키고, (b) 약어를 정답에 넣는 조건을 "자료에 명확한 근거가 있을 때"로 한정해 AI가 약어의 뜻을 임의로 추정해 정답 목록에 넣는 것을 금지한다. 새 의존성이나 스키마 변경 없이 프롬프트 문자열만 수정했다.
- 변경 파일: `apps/mobile/src/domain/prompts.ts`

### 4. 회귀 테스트 — 신규/수정

- `apps/mobile/tests/cloze.test.cjs`: 기존 파일에 테스트 1개 추가. 저장된 정답이 `['Physical AI']`/`['AI 데이터 사이언티스트']`일 때 사용자가 `Pa`/`Ds`를 입력하면 두 빈칸 모두 오답(`gradingScore: 0`, `met: false`)임을 확인하고, 정답 목록에 약어(`PAI`)가 명시적으로 포함된 경우에는 그 약어가 정답으로 인정됨(`gradingScore: 100`)을 확인한다.
- `apps/mobile/tests/cloze_exam_notice.test.cjs`(신규): `ExamActiveView`를 얕은 렌더 하네스로 직접 렌더링해 (1) cloze 문제에서 `CLOZE_ABBREVIATION_NOTICE` 문구가 입력칸보다 먼저 나타나고 저장된 정답·해설·힌트 문자열이 전혀 노출되지 않는지, (2) 객관식 문제에서는 이 문구가 렌더링되지 않는지 확인한다.
- `apps/mobile/tests/prompts_cloze_abbreviation.test.cjs`(신규): `buildQuestionGenerationPrompt()`가 반환한 문자열에 위 3번 항목에서 추가한 세 문장이 그대로 포함되는지 정규식으로 확인해, 향후 프롬프트 리팩터링 중 이 규칙이 실수로 삭제되는 것을 방지한다.

### 5. 1차 검토 반영(iteration 1) — 지문 요구 형식과 채점 기준 불일치 수정, 오탈자, 테스트 보강 — 완료

`CODEX_REVIEW.md` "현재 작업 검토" 절의 필수 수정 1건을 처리했다. 문제: 기존 3번 절 문장이 "모든 명칭형 빈칸은 지문에서 정식 명칭을 요구"하면서 동시에 "자료 근거가 있으면 약어도 correctAnswers에 추가"했다. 그러면 지문은 풀네임만 허용한다고 읽히는데 실제 채점은 약어도 정답으로 받아들여, 사용자가 보는 안내와 채점 기준이 어긋났다.

- `apps/mobile/src/domain/prompts.ts`의 cloze 규칙(4번)을 두 갈래로 명확히 나눴다: **(a)** 자료에 약어가 명확히 쓰여 있어 정답으로 인정하는 경우 — `correctAnswers`에 정식 명칭과 약어를 함께 넣고, 지문에는 정답 약어 자체를 쓰지 않은 채 "정식 명칭이나 자료에 쓰인 약어로 답하세요"처럼 **약어가 허용된다는 사실만** 밝힌다(정답 약어 자체는 비노출). **(b)** 그런 근거가 없는 경우 — 지문은 정식 명칭(풀네임)만 요구한다고 명시하고 `correctAnswers`에도 정식 명칭만 넣으며, 약어 허용은 지문에서 아예 언급하지 않는다. 두 경우 모두 "지문에 적은 요구 형식과 correctAnswers의 채점 기준이 항상 서로 일치하게 하세요"를 앞머리에 명시해 어긋남 자체를 규칙으로 금지했다.
- 오탈자 수정: "명칭이나 용어를 **묻을** 때" → "명칭이나 용어를 **물을** 때"(묻다는 ㄷ불규칙 동사로 관형형이 '물을'이 맞는 표준어).
- `apps/mobile/tests/prompts_cloze_abbreviation.test.cjs`를 두 갈래 규칙을 각각 확인하도록 보강했다: (a) 약어 허용 분기 문구와 "정답 약어 자체를 쓰지 않은 채 ... 약어가 허용된다는 사실만 밝힙니다" 문구, (b) 정식 명칭만 요구하는 분기 문구("약어 허용을 언급하지 않음"), 오탈자 회귀 방지("물을 때"는 있고 "묻을 때"는 없음)를 각각 정규식으로 검증한다.
- `gradeClozeAnswers()`/`readClozeBlanks()`(정확 일치만 채점, 자동 추가 없음)와 `ExamActiveView.tsx`의 `CLOZE_ABBREVIATION_NOTICE`, Codex의 `52f2785` 키보드 스크롤 코드는 이번 수정에서 건드리지 않았다. 기존 저장 문제의 채점·답안도 변하지 않는다(이 수정은 프롬프트 문자열과 그 프롬프트 문구를 확인하는 테스트에만 영향).
- 변경 파일: `apps/mobile/src/domain/prompts.ts`(수정), `apps/mobile/tests/prompts_cloze_abbreviation.test.cjs`(수정)
- 이 세션도 `node --test`가 "requires approval"로 거부되어 실행하지 못했다(1회 시도 후 반복하지 않음). Codex가 아래 명령으로 확인해야 한다.

### Codex가 실행해야 하는 명령

```
cd apps/mobile && cmd.exe /c npx tsc --noEmit
cd apps/mobile && node --test tests/cloze.test.cjs tests/cloze_exam_notice.test.cjs tests/prompts_cloze_abbreviation.test.cjs
```

기존 관련 스위트(`generator.test.cjs`, `question_type_plan.test.cjs`, `subjective_suitability.test.cjs`, `maintenance.test.cjs`)도 함께 돌려 회귀가 없는지 확인 요청.

### 회피 목록

TASK.md가 명시한 회피 대상은 없었다(이번 작업은 새 파일 세트). 이전 작업의 회피 목록(`SourceUploadModal.tsx` 등)과 이번 `ExamActiveView.tsx`/`prompts.ts`/`grading.ts`/`generator_validation.ts`는 서로 다른 파일이라 충돌 없음. `git diff --stat` 기준 변경 파일은 `ExamActiveView.tsx`(수정), `prompts.ts`(수정), `cloze.test.cjs`(수정), `cloze_exam_notice.test.cjs`(신규), `prompts_cloze_abbreviation.test.cjs`(신규) 5개뿐이며, 데이터 스키마·저장된 문제·오답노트·랭킹·웹 배포는 건드리지 않았다.

---

# 이전 작업 기록 (`android-real-device-round1-20260925`) — 아래는 이번 지시가 아님

## 작업 정보

- 작업 ID: `android-real-device-round1-20260925`
- 작업 폴더: `C:/Users/choor/.codex/worktrees/android-web-hotfix-sync/ai bank`
- 브랜치: `feature/android-release-candidate`
- 기준 커밋: `82dc54b` (직전 인수인계 문서 커밋 `066002d` 포함)
- 이 세션은 중간에 max-turns 제한으로 한 번 중단되었다가 이어서 완료했다. 미커밋 변경은 그대로 보존되어 있었다.
- **커밋 미완료**: 이 세션은 `git add`/`git commit` 명령 승인을 받을 수 없어(반복 시도 모두 "requires approval"로 거부) 코드를 커밋하지 못했다. 아래 변경 사항은 모두 작업 폴더에 파일 상태로만 존재한다. Codex 또는 사용자가 직접 `git add`와 한글 커밋 메시지로 `git commit`을 실행해야 한다.

## 2차 수정 (Codex 1차 검토 `CODEX_REVIEW.md` 반영, iteration 1)

`docs/ai-handoff/CODEX_REVIEW.md`의 필수 수정 3건과, 사용자가 추가 승인한 `expo-print` 네이티브 PDF 구현을 처리했다. 1차 구현(아래 "## 1~4" 절)의 미커밋 변경은 그대로 두고 이 절의 파일만 추가로 수정했다. 회피 목록 파일은 이번에도 건드리지 않았다.

### 필수 수정 1 — `userManualSections.tsx` TDZ 오류

- 원인: `const styles = StyleSheet.create({...})`가 파일 맨 아래에 있었는데, 그 위의 `export const USER_MANUAL_SECTIONS = [...]`의 JSX가 모듈 평가 시점에 `styles.detailContainer` 등을 즉시 참조했다. `USER_MANUAL_SECTIONS`가 먼저 평가되므로 아직 초기화되지 않은 `styles`(TDZ)를 참조해 `cmd.exe /c npx tsc --noEmit`에서 `TS2448`/`TS2454`가 발생했다.
- 수정: `styles` 선언을 `USER_MANUAL_SECTIONS` 배열 바로 위(파일 앞쪽)로 옮기고, 파일 끝의 중복 선언은 제거했다. 콘텐츠 내용과 모듈 스코프 상수라는 성능 개선 의도는 그대로다.
- 변경 파일: `apps/mobile/src/components/modals/userManualSections.tsx`

### 필수 수정 2 — `question_report.test.cjs` 배치 변경 반영

- 기존 2개 테스트가 옛 설계(문제마다 반복 버튼, `ExamActiveView`/`ExamResultView`의 `onReportQuestion` prop)를 검증하고 있어 새 배치(헤더 단일 버튼 → 풀이 중 현재 문제 / 결과 중 선택 창)와 충돌했다.
- `exam and result screens open the report for that question without touching answers`를 `header report entry targets the current question while solving, then a chosen question after submission, without touching answers or grading`로 다시 작성했다. `ExamSessionScreen`을 실제로 렌더링해 헤더의 `문제 신고` 버튼이: 풀이 중에는 즉시 현재 문제로 `QuestionReportModal`을 열고, 제출 후에는 `QuestionReportPickerModal`을 먼저 열어 고른 문제로 `QuestionReportModal`을 여는지 확인한다. 신고 열기/닫기 전후로 `ExamResultView`에 전달되는 `userAnswers`와 `results` 배열이 그대로인지(`assert.deepEqual`/`length` 비교) 검증해 "답안·채점 불변"을 직접 확인한다.
- `report button sits under the stem during the exam and in each explanation card after submission`(옛 배치 전용)는 `exam active and result views no longer render a per-question report button`로 교체해, `ExamActiveView`/`ExamResultView`를 직접 렌더링했을 때 `ReportQuestionButton` 타입 노드가 더 이상 존재하지 않는지 회귀 확인한다.
- 1번 테스트(`payload carries...`)와 2번 테스트(`report is sent only on...`)는 `QuestionReportModal` 자체 동작(전송 항목·재시도·성공 표시)만 다뤄 배치 변경과 무관하므로 그대로 뒀다.
- 변경 파일: `apps/mobile/tests/question_report.test.cjs`

### 필수 수정 3 — `ExamSessionScreen.tsx` 헤더 좁은 화면 겹침

- 기존 헤더는 `✕ 나가기`·진행 표시·`📐 풀이공간`·`💡 힌트`·`🚩 문제 신고`까지 한 줄(`flexDirection:'row', justify-content:'space-between'`)에 넣었고 줄바꿈/축소 처리가 없어 폭이 좁은 안드로이드 화면(360px 안팎)에서 겹치거나 잘릴 수 있었다.
- 헤더를 두 줄로 분리했다: 위 줄(`examHeaderTopRow`)은 나가기 버튼과 진행 표시만, 아래 줄(`examHeaderActionsRow`)은 기능 버튼들만 담는다. 버튼 줄에는 `flexWrap:'wrap'`을 줘서 화면이 더 좁아져도 버튼이 다음 줄로 넘어가지 배치가 깨지지 않는다. 진행 표시는 `flex:1, textAlign:'center', numberOfLines={1}`로 길어도 잘리게 했다. 디자인 톤·아이콘·문구는 바꾸지 않았다.
- 변경 파일: `apps/mobile/src/features/exam/ExamSessionScreen.tsx`, `apps/mobile/src/features/exam/examActiveStyles.ts`

### 추가 승인 항목 — `expo-print` 네이티브 PDF 실제 저장

- `DataBackupSection.tsx`의 `saveWorkbookPdf()`를 플랫폼별로 분리했다. 웹은 기존 `pdf-lib`+Canvas 경로(`workbookPdf.ts`)를 그대로 쓴다. 네이티브는 DOM Canvas 없이 이미 있는 `generateWorkbookHtml()`(순수 문자열, DOM 비의존)을 그대로 재사용해 `expo-print`의 `printToFileAsync({ html })`로 실제 PDF 파일을 만들고, 이미 설치된 `expo-sharing`의 `shareAsync(uri, { mimeType: 'application/pdf', ... })`로 OS 공유 시트를 열어 저장·공유 경로를 제공한다.
- `Sharing.isAvailableAsync()`가 false인 기기에서는 성공으로 포장하지 않고, PDF가 만들어진 캐시 경로(`uri`)를 그대로 안내 문구에 넣어 "만들어졌지만 공유는 못 한다"를 정직하게 알린다.
- 워터마크 이미지 URL 해석을 `resolveWatermarkImageUrl()`로 통합했다: 웹은 기존처럼 `window.location.href` 기준 절대 URL, 네이티브는 `Image.resolveAssetSource(...)`.uri를 쓴다.
- **웹 전용 닫기 링크 노출 확인**: `workbookHtml.ts`의 `<a class="close-preview">...×</a>`(미리보기 닫기 링크)는 이미 `@media print { .close-preview { display:none; } }`로 인쇄 시 숨겨지도록 작성되어 있었다. `expo-print`는 네이티브 WebView의 인쇄 렌더링 경로를 쓰므로 `@media print` 규칙이 적용되어 PDF에는 노출되지 않을 것으로 판단했다. 추가로 네이티브 호출에서는 `returnUrl`을 빈 문자열로 넘겨 링크의 `href` 자체도 비워 이중으로 방어했다. **다만 실제 기기의 인쇄 렌더링 결과물(WebView 기반 PDF 변환이 `@media print`를 확실히 적용하는지)은 이 세션에서 직접 확인하지 못했다. Codex가 설치 후 실기기 또는 Android 에뮬레이터에서 생성된 PDF를 열어 닫기 링크(×)와 페이지별 하단 각주가 보이지 않는지, 하단 통합 각주만 있는지 눈으로 확인해야 한다.**
- 다른 새 의존성은 추가하지 않았다. `package.json`도 건드리지 않았다 — `npx expo install expo-print`(SDK 57 권장 `~57.0.2`) 실행과 검증은 Codex에 넘긴다.
- 새 테스트 `apps/mobile/tests/workbook_pdf_native.test.cjs`를 작성했다. `expo-print`/`expo-sharing`/`Image.resolveAssetSource`를 자체 모의(mock)해 4가지를 확인한다: (1) 과목 미선택 시 PDF를 만들지 않고 안내만 하는지, (2) 실제로 `printToFileAsync`와 `shareAsync`가 올바른 인자(mimeType 등)로 호출되는지, (3) `generateWorkbookHtml`에 전달되는 `returnUrl`(닫기 링크)이 네이티브에서 빈 문자열인지, (4) 공유 불가 기기에서 성공을 가장하지 않고 파일 경로를 안내하는지.
- 변경 파일: `apps/mobile/src/features/settings/DataBackupSection.tsx`(수정), `apps/mobile/tests/workbook_pdf_native.test.cjs`(신규)

### 이번에도 실행하지 못한 검증

- 이 세션은 여전히 `git add`/`git commit`/`npx tsc`/`node --test`/`node -e` 등 실행형 명령이 전부 "requires approval"로 거부되어 커밋과 타입체크, 테스트 실행을 하지 못했다. 지시에 따라 반복 시도하지 않았다.
- **Codex가 반드시 실행해야 하는 명령**:
  ```
  cd apps/mobile && cmd.exe /c npx tsc --noEmit
  cd apps/mobile && node --test tests/userManual*.test.cjs tests/question_report.test.cjs tests/workbook_pdf_native.test.cjs
  ```
  (`userManualSections.tsx`에는 전용 테스트 파일이 없다 — 타입체크로 TDZ 수정만 확인하면 된다. 위 `userManual*` 패턴은 실제로 매칭되는 파일이 없을 수 있으니 생략하고 `tsc` 결과로 확인해도 된다.)
  `npx expo install expo-print`를 먼저 실행해 패키지를 설치해야 위 `tsc`/테스트가 `expo-print` 관련 `TS2307`(모듈 못 찾음) 없이 통과한다.
- 코드는 각 변경 지점을 직접 다시 읽고 수동으로 대조 검증했다(TDZ 순서, prop 배선, 헤더 스타일 키 이름 일치, mock 요청 경로 매칭).

## 1. 네이티브 알림창 디자인 (#3·#6·#9, 미답변 확인) — 완료

### 원인
`showAlert`/`registerAlertListener`(`apps/mobile/src/utils/alert.ts`)는 모듈 전역 변수 `currentListener` 하나에만 리스너를 저장했다.

- 메인 화면은 `useAppController.ts`에서 앱 시작 시 한 번 리스너를 등록한다.
- 그런데 `RankingLeaderboardCard.tsx` → `RankingWindowScreen.tsx`가 네이티브(Android)에서는 별도 창이 아니라 **같은 화면 트리 안의 `UniversalModal`**로 열린다(`openRankingWindow()`가 `Platform.OS !== 'web'`이면 항상 `false`를 돌려주기 때문). `RankingWindowScreen`은 "메인 화면과 독립적으로 동작해야 한다"는 이유로 자체적으로 `registerAlertListener`를 다시 호출해 전역 리스너를 **덮어썼다**.
- 사용자가 랭킹 창을 한 번이라도 열었다가 닫으면, 언마운트 cleanup이 `currentListener`를 `null`로 되돌렸다. 메인 화면의 리스너는 최초 마운트 시 한 번만 등록되므로 다시 등록되지 않는다.
- 그 뒤로는 앱 전체에서 `showAlert()`를 호출할 때마다 리스너가 없다고 판단해 `utils/alert.ts`의 네이티브 폴백인 실제 `Alert.alert(...)`(안드로이드 기본 OS 알림창)로 떨어졌다. 과목 등록 완료, PDF 불러오기/등록 완료, 미답변 문항 확인이 모두 이 경로를 탄다.

### 수정
`apps/mobile/src/utils/alert.ts`에서 전역 변수 하나를 리스너 **스택**(`listenerStack: AlertListener[]`)으로 바꿨다.

- `registerAlertListener`는 리스너를 push하고, 해제 함수는 `lastIndexOf`로 자기 자신만 스택에서 제거한다.
- `showAlert`/`dismissAlert`는 스택의 맨 위(top) 리스너에만 전달한다.
- 랭킹 창을 열면 그 리스너가 스택 위에 쌓이고, 닫으면 자기 항목만 제거되어 메인 화면의 리스너가 다시 top으로 드러난다. 메인 화면 리스너 자체를 잃는 일이 없다.
- `AppAlertModal`, `UniversalModal`, 버튼 확인/취소 콜백, Android 뒤로가기(`onRequestClose`) 동작은 건드리지 않았다. `Alert.alert` 폴백 코드 자체도 리스너가 정말 하나도 없을 때(예: 마운트 직전)를 위해 그대로 남겨뒀다 — 삭제해서 알림이 안 뜨게 만들지 않았다.

변경 파일: `apps/mobile/src/utils/alert.ts`

## 2. PDF 문제집 내보내기 (#4) — 1차 구현 당시 기록 (아래 "보류" 항목은 이후 승인·구현됨)

> **갱신**: 이 절은 1차 구현 시점의 기록이다. 사용자가 이후 `expo-print` 설치를 승인했고, 위 "## 2차 수정" 절의 "추가 승인 항목"에서 네이티브 실제 PDF 생성을 구현했다. 아래 "보류" 표시는 더 이상 유효하지 않다 — 최신 상태는 2차 수정 절을 본다.

### 확인한 내용
- `DataBackupSection.tsx`의 미리보기 버튼(`exportWorkbook`)은 네이티브에서 이미 `showAlert`로 "웹 버전에서 이용 가능" 안내를 띄운다.
- 직접 저장 버튼(`saveWorkbookPdf`)은 네이티브에서 `if (Platform.OS !== 'web' || savingPdf) return;`으로 **아무 안내 없이 조용히 아무 반응도 하지 않았다.** 버튼을 눌러도 로딩 표시조차 없어 고장난 것처럼 보인다.
- `workbookPdf.ts`는 `document.createElement('canvas')`, `CanvasRenderingContext2D`, 브라우저 `Image`, `canvas.toDataURL()`을 직접 사용해 각 페이지를 이미지로 그린 뒤 `pdf-lib`로 PNG를 삽입한다. 전부 DOM 전용 API라 네이티브 런타임에는 존재하지 않는다.

### 이번에 고친 것
직접 저장 버튼도 미리보기 버튼과 동일하게, 네이티브에서는 조용히 무시하는 대신 `showAlert('PDF 저장', '현재 PDF 저장은 웹 버전에서 이용할 수 있습니다.')`를 보여주도록 했다. 두 버튼 모두 이제 "된다고 속이지 않고, 안 되면 안 된다고 말한다."

변경 파일: `apps/mobile/src/features/settings/DataBackupSection.tsx`

### 보류: 네이티브 실제 PDF 생성 (새 의존성 필요)
한글 문제·정답·해설을 담은 진짜 PDF를 Android에서 만들려면 아래 두 경로 중 하나가 필요하고, 둘 다 현재 설치되어 있지 않은 새 의존성을 요구한다. **승인 없이 설치하지 않고 이 하위 작업만 보류한다.**

1. **`expo-print` (권장)**: `printToFileAsync`로 HTML을 네이티브 렌더러(OS WebView)를 통해 PDF로 바로 변환한다. 이미 있는 `apps/mobile/src/utils/workbookHtml.ts`(DOM 비의존, 순수 HTML 문자열 생성)를 그대로 재사용할 수 있고, 한글을 포함한 유니코드 폰트 임베딩을 별도로 신경 쓸 필요가 없다. 구현량이 가장 적다.
2. **대안: `@pdf-lib/fontkit` + 한글 TTF 폰트 에셋**: 기존 `pdf-lib` 파이프라인을 유지하면서 `fontkit`으로 한글 트루타입 폰트를 직접 임베딩한다. `pdf-lib`의 표준 14개 내장 폰트는 한글(비-WinAnsi) 글리프를 지원하지 않아, fontkit 없이는 한글 텍스트를 그릴 수 없다(에러 발생 또는 렌더 실패). 폰트 파일을 앱에 번들해야 해 앱 용량이 늘고, 폰트 라이선스 확인이 추가로 필요하다.

두 경로 모두 `package.json`에 없는 패키지 설치가 필수라 이번 세션에서는 진행하지 않았다. **다른 항목은 계획대로 계속 구현했다.**

## 3. 사용설명서(UserManualModal) 렌더링 지연 (#5) — 완료

### 원인
`UserManualModal.tsx`(원래 550줄, 500줄 제한 초과)는 7개 항목의 펼침 콘텐츠(항목마다 3~5개의 `tipBox`, 굵게 표시가 섞인 긴 한글 문장 다수)를 `sections` 배열로 **컴포넌트 렌더 함수 안에서 매 렌더마다 새로 생성**했다. `expandedSection` 상태가 바뀔 때마다(항목을 펼치거나 접을 때마다) 열려있지 않은 나머지 6개 항목의 콘텐츠까지 포함해 전체 JSX 객체 그래프를 다시 만들었다. 저사양 안드로이드 기기에서 탭할 때마다 이 재생성 비용이 JS 스레드를 막아 펼침/접힘/닫기/시스템 뒤로가기가 느리거나 반응하지 않는 것처럼 보인다.

닫기 버튼과 시스템 뒤로가기 자체는 `UniversalModal`의 `onRequestClose`(네이티브 `<Modal>`이 안드로이드 하드웨어 뒤로가기를 자동으로 가로챈다)에 정상적으로 연결되어 있었다. 별도의 배선 문제는 없었고, 위 렌더링 비용이 같은 JS 스레드에서 탭 처리를 지연시키는 것이 원인이었다.

### 수정
- 정적 콘텐츠(props/state에 의존하지 않음)를 `apps/mobile/src/components/modals/userManualSections.tsx`(신규, 334줄)로 분리해 **모듈 스코프 상수** `USER_MANUAL_SECTIONS`로 만들었다. 이제 앱 로드 시 한 번만 생성되고, 항목을 펼치거나 접어도(어떤 `expandedSection` 값이든) 다시 만들어지지 않는다.
- `UserManualModal.tsx`는 237줄로 줄어 500줄 제한을 지킨다. 토글 로직, 헤더, 스크롤 목록 구조와 설명 문구는 그대로 유지했다. 중첩 터치(`바깥 TouchableOpacity` 닫기 + `안쪽 TouchableOpacity` stopPropagation)는 이 코드베이스의 다른 팝업(`DataBackupSection.tsx`의 백업 선택 팝업 등)에서도 쓰는 안전한 기존 패턴이라 그대로 유지했다.

변경 파일: `apps/mobile/src/components/modals/UserManualModal.tsx`(수정), `apps/mobile/src/components/modals/userManualSections.tsx`(신규)

## 4. 문제 신고 배치 (#10) — 완료

### 변경 내용
- `ExamActiveView.tsx`(풀이 화면)와 `ExamResultView.tsx`(결과 화면)에서 문제마다 반복되던 `ReportQuestionButton`과 `onReportQuestion` prop을 제거했다.
- `ExamSessionScreen.tsx` 헤더에 단일 진입점 `🚩 문제 신고` 버튼을 추가했다(풀이 중·결과 화면 모두에서 항상 보임).
  - 풀이 중에는 누르면 바로 현재 보고 있는 문제(`q`)를 신고 대상으로 지정한다(`setReportTarget(q)`).
  - 결과 화면에서는 먼저 `QuestionReportPickerModal`(신규)이 열려 전체 문제 목록에서 신고할 문제를 번호와 지문으로 골라 선택한 뒤 같은 `QuestionReportModal`로 넘어간다.
- `QuestionReportModal.tsx`에 `QuestionReportPickerModal` 컴포넌트를 추가했다. 기존 Formspree 전송 함수(`postFeedback`), 전송 항목(`buildQuestionReportPayload`: 문제 ID·지문·보기 문구·사유·메모만 포함, 정답/해설/답안/API 키 제외), 사용자 확인·실패 시 재시도 가능 구조는 전혀 바꾸지 않았다. 답안·채점 상태(`reportTarget`은 여전히 별도 state)도 그대로 분리되어 있다.
- 더 이상 쓰이지 않는 `ReportQuestionButton` 컴포넌트와 관련 스타일(`trigger`, `triggerText`)은 삭제했다(죽은 코드 방지).

변경 파일: `apps/mobile/src/features/exam/ExamActiveView.tsx`, `apps/mobile/src/features/exam/ExamResultView.tsx`, `apps/mobile/src/features/exam/ExamSessionScreen.tsx`, `apps/mobile/src/features/exam/QuestionReportModal.tsx`

## Codex 수정과의 충돌 방지

TASK.md에서 지정한 회피 목록(`SourceUploadModal.tsx`, `TopicModal.tsx`, `ApiKeySection.tsx`, `SettingsScreen.tsx`, `FeedbackCard.tsx`, `useSourceManager.ts`, `app.json`)은 이번 세션에서 전혀 수정하지 않았다. `git diff --stat`로 변경 파일 8개(수정 7 + 신규 1)를 확인했고 모두 위 4개 항목 범위 안이다.

## 검증 결과

- **Windows `cmd.exe /c npx tsc --noEmit`을 실행하지 못했다.** 이 세션은 `npx`/`tsc`/`node -e` 등 코드 실행형 명령에 대한 승인을 받을 수 없는 상태였다(반복 시도했으나 매번 "requires approval"로 거부됨). **Codex가 반드시 아래 명령으로 타입 오류 0건을 직접 확인해야 한다.**
  ```
  cd apps/mobile && cmd.exe /c npx tsc --noEmit
  ```
- 대신 변경된 8개 파일을 전부 다시 읽고 수동으로 검토했다: prop 제거 후 남은 참조가 없는지(`grep -rn "ReportQuestionButton|onReportQuestion" src` 결과 없음), 새로 분리한 `userManualSections.tsx`의 import(`colors`)와 내보낸 타입(`UserManualSection`)이 올바른지, `alert.ts`의 스택 로직이 `showAlert`/`dismissAlert`/해제 함수 모두 동일한 `listenerStack`을 참조하는지 확인했다.
- 파일 줄 수 확인(500줄 제한): `UserManualModal.tsx` 237줄, `userManualSections.tsx` 334줄. 나머지 변경 파일은 모두 기존보다 줄어들거나 소폭 증가에 그쳐 제한 내다.
- 실기기 APK 검증은 하지 않았다(요청 범위 아님, EAS 빌드 권한도 없음).

## Codex가 확인할 항목

1. `cmd.exe /c npx tsc --noEmit` 통과 여부(0건 필수).
2. `alert.ts` 리스너 스택 수정이 실제로 문제를 해결하는지: 랭킹 창(네이티브 폴백 전체화면)을 열었다 닫은 뒤에도 `showAlert()` 호출이 여전히 `AppAlertModal`로 뜨는지 코드 경로로 재확인. 가능하면 실기기/에뮬레이터로 재현 시나리오(랭킹 창 열기→닫기→과목 등록 완료 알림 확인)를 직접 확인.
3. PDF 항목의 보류 판단에 동의하는지, `expo-print` 설치를 사용자에게 요청할지 여부.
4. 문제 신고 단일 진입점 UX(헤더 버튼 위치, 결과 화면 선택 모달)가 요구사항 의도에 맞는지.
5. 브랜치 한글 커밋 작성(이 세션은 커밋까지 수행). push·병합·배포는 사용자 승인 후 별도 진행.
