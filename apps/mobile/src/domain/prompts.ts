import { ScopedIntent } from './generator';
import { LearnerKnowledgeLevel } from '../contracts/types';

export function buildQuestionGenerationPrompt(params: {
  intent: ScopedIntent;
  resolvedDomain: string;
  category?: string;
  unitTitle?: string;
  customContext?: string;
}): string {
  const { intent, resolvedDomain, category, unitTitle, customContext } = params;

  return `당신은 대한민국 최고 권위의 공인 시험 출제위원 및 평가 전문가(Certified Psychometrician)입니다.
아래 명세에 맞추어 최고 품질의 4지선다형 객관식 시험 문제 ${intent.targetCount}문항을 생성하여 순수 JSON 포맷으로 출력하세요.

[학습 과목 및 출제 범위]
- 과목/도메인: ${resolvedDomain}${category ? ` / 세부 분류(영역): ${category}` : ''}
${unitTitle ? `- 지정 단원(공식 목차): ${unitTitle}` : ''}
- 학습자 지식 수준: ${intent.levelLabel} (${intent.learnerLevel || 'basic'})
${intent.knownScope ? `- 학습자가 밝힌 현재 학습 도달점: "${intent.knownScope}"` : ''}
- 출제 브리핑: ${intent.levelBriefing || '수준에 꼭 맞는 적정 난이도로 출제'}
- 세부 요구사항: ${intent.focusConcepts.join(', ')}
${customContext ? `- 참고 자료 및 특별 지침:\n${customContext}` : ''}

[과목 일치 및 교차 분야 혼동 방지 절대 헌법 (CRITICAL - Strict Domain Isolation)]
1. [지정 과목 및 세부 영역 일치 헌법 (Cross-Domain Conflict Resolution & Fallback)]:
   - 본 시험 문제는 반드시 지정된 과목 [${resolvedDomain}] 및 세부 영역 [${category || resolvedDomain}]에 100% 국한하여 출제해야 합니다.
   - [상호 모순/충돌 및 엉뚱한 입력 예외 처리 3대 원칙]:
     ① [소주제/분류가 무의미하거나 장난인 경우 폴백 (Nonsense Fallback)]:
        - 만약 세부 영역/분류('${category}')가 단순 오타, 장난, 무의미한 자모/영문('ㅁㄴㅇㄹ', 'asdf', 특수문자 등)이거나 공인된 교육과정이 없는 엉뚱한 문구인 경우:
        - 엉뚱한 소주제는 즉시 무시하고, 정규 학술/수험 체계가 확립된 **본래 과목/대주제('${resolvedDomain}')**를 기준으로 출제하십시오.
     ② [대주제와 소주제가 서로 다른 정상 학문인 경우 (Cross-Domain Prioritization)]:
        - 만약 대주제/과목명('${resolvedDomain}')과 세부 영역/분류('${category}')이 둘 다 실존하지만 서로 다른 분야인 경우(예: 과목명은 '바람의나라', 세부 분류는 '바리스타 기초과정'):
        - 수험자가 구체적으로 배우고자 밝힌 **실제 학습 대상인 '${category}'(예: 바리스타 커피 지식 및 에스프레소 추출, 원두 가공, 스팀 밀크 등)**을 최우선 기준으로 채택하여 출제하십시오. 게임 캐릭터 생성, 국가 선택 등 엉뚱한 타 분야 시스템으로 문제를 왜곡해서는 안 됩니다!
     ③ [대주제와 소주제 둘 다 엉뚱한 경우]:
        - 허구의 이론을 날조(환각)하지 말고, 상식적이고 객관적인 사실에 기반하여 질문하십시오.
2. [단원명/용어에 의한 타 분야 왜곡 절대 금지]:
   - 단원명(${unitTitle ? `"${unitTitle}"` : '지정 단원'})이나 세부 요구사항에 '기초', '원리', '문법', '구조', '기초과정', '입문' 등의 일반적 어휘가 있더라도, 절대 다른 분야(예: 컴퓨터 프로그래밍 언어, 파이썬, 코딩, 수학 등)로 분야를 혼동하여 출제하지 마십시오.
   - [예시]: 과목이 '토익', '영어', '영단어'인 경우, 단원이 '기초과정'이라도 반드시 토익 빈출 필수 영단어, 어휘 의미, 알맞은 단어 채우기, 품사 구분, 예문 독해 문항이어야 하며, 파이썬(Python)이나 컴퓨터 프로그래밍 코드가 단 한 줄이라도 들어가서는 절대 안 됩니다! 100% [${resolvedDomain}] 과목의 공식 시험 문제입니다.
3. [심화/고난도 출제 시 원점 대주제 탈선 절대 금지 (Root Domain Anchoring - Context Drift Prevention)]:
   - 난이도가 '심화', '실전', '마스터'로 깊어지더라도, **반드시 본래 과목/대주제인 [${resolvedDomain}]의 본질적인 목적과 학습 맥락을 끝까지 유지**해야 합니다.
   - [오탈선 사례 및 예방 규칙]:
     * [게임 관련 과목]: 만약 과목이 '게임 총기/무기 시스템'이나 '게임 개발'인 경우, 심화 문제로 갈수록 '인게임 반동 패턴 구현, 히트스캔 vs 투사체 물리 연산, 데미지 감쇄 공식, 게임 밸런싱 데이터 구조' 등 **게임의 관점에서 심화**되어야 합니다. 현실의 군사 총기 내부 화약 배합비나 실제 총기 분해 결합처럼 게임과 무관한 현실 군사학으로 엉뚱하게 탈선해서는 절대 안 됩니다!
     * [법학 과목]: '법학개론'이 심화되더라도 현행 법 체계와 판례 법리로 심화되어야 하며, 고대 로마 역사나 철학사로 왜곡되어서는 안 됩니다.
     * [비즈니스/어학]: '비즈니스 영어'가 심화되더라도 무역/계약/이메일 비즈니스 맥락이어야 하며, 고대 영문학 시 구절로 빠져서는 안 됩니다.
   - 항상 질문의 본질이 **[${resolvedDomain}]을 공부하는 수험자에게 진정으로 유의미한 전문 지식**이어야 합니다.
4. [철저한 공인 팩트 기반]: 실제 정규 교과서, 공인 기출문제, 공식 기술 표준 문서에 등재된 "100% 검증된 정통 학술 팩트"에만 근거하여 출제하십시오. 존재하지 않는 가짜 이론, 틀린 공식, 인위적으로 날조한 단어/함수/명령어(환각 증세)를 절대 배제하십시오.
5. [단 하나의 명백한 유일 정답]: 4개의 보기 중 오직 1개만이 완전무결하고 반박 불가능한 정답이어야 합니다. 복수정답 시비가 없도록 발문(stem)에 명확한 조건("다음 중 가장 적절한 것은?", "올바른 설명만을 있는 대로 고른 것은?" 등)을 부여하십시오.
6. [정답 위치의 완전 무작위 분산]: 정답 번호(correctIndex: 0~3)는 특정 번호(1번, 2번 등)에 고정되지 않도록 1, 2, 3, 4번 선지에 걸쳐 골고루 무작위로 분산하여 배치하십시오.
7. [매력적인 오답 선지 및 명확한 오답 이유 (distractorRationale)]: 3개의 오답 선지는 지어낸 허구의 단어가 아니라, 수험자가 실제로 혼동하기 쉬운 인접 개념이나 전형적인 오개념을 활용하여 설계하십시오. 각 오답 선지마다 distractorRationale에 "수험자가 왜 이 보기를 골라 틀리기 쉬운지, 무엇이 잘못된 것인지"를 학습자가 납득할 수 있도록 명확히 서술하십시오 (정답 선지의 distractorRationale은 빈 문자열 "").
8. [명쾌하고 상세한 문제 풀이 (explanation)]: 정답이 왜 옳은지, 문제를 해결하는 핵심 원리와 도출 과정을 친절하고 상세하게 서술하십시오. 불필요하게 "[출제 근거 팩트: ...]" 같은 딱딱한 꼬리표를 붙이지 말고, 수험자가 오답노트를 보고 왜 틀렸는지 완벽히 이해할 수 있는 정통 풀이 및 해설 형태로 작성하십시오.

[출력 JSON 스키마 규격]
{
  "questions": [
    {
      "stem": "문제 지문",
      "options": [
        { "text": "선지 1", "distractorRationale": "이 보기가 오답인 이유 및 빠지기 쉬운 함정" },
        { "text": "선지 2", "distractorRationale": "이 보기가 오답인 이유 및 빠지기 쉬운 함정" },
        { "text": "선지 3", "distractorRationale": "" },
        { "text": "선지 4", "distractorRationale": "이 보기가 오답인 이유 및 빠지기 쉬운 함정" }
      ],
      "correctIndex": 2,
      "explanation": "정답 도출 과정과 원리를 설명하는 명쾌하고 상세한 문제 풀이"
    }
  ]
}`;
}

export function buildCurriculumPrompt(params: {
  topicName: string;
  topicDescription?: string;
  category?: string;
  learnerLevel?: LearnerKnowledgeLevel;
  knownScope?: string;
  startUnitIndex?: number;
  stageName?: string;
  existingUnitTitles?: string[];
}): string {
  const {
    topicName,
    topicDescription,
    category,
    learnerLevel = 'basic',
    knownScope,
    startUnitIndex = 1,
    stageName,
    existingUnitTitles = [],
  } = params;

  const levelMap: Record<LearnerKnowledgeLevel, string> = {
    beginner: '입문 기초 (공인 교육과정의 필수 기본 개념 및 정통 표준 용어 체계)',
    basic: '표준 정규과정 (공인 교과서 핵심 원리 및 체계적 필수 표준 단원)',
    advanced: '실전 시험대비 (빈출 기출 핵심 및 함정 극복)',
    master: '심화/종합 (고난도 복합 융합 추론)',
  };

  const startIdx = Math.max(1, startUnitIndex);
  const endIdx = startIdx + 4;
  const startPad = String(startIdx).padStart(2, '0');
  const endPad = String(endIdx).padStart(2, '0');

  return `당신은 대한민국 교육부 및 국가공인 평가원 수준의 최고 권위 교육과정 설계 전문가(National Curriculum Architect)입니다.
학습자가 공부하고자 하는 주제("${topicName}"${category ? ` / 분류: "${category}"` : ''})에 대해, 학계 및 공인 시험(수능, 내신, 국가자격증, 표준 대학 교재 등)에서 공식적으로 사용하는 표준 교육과정에 철저히 기반하여 체계적인 5단계 단원(목차)을 설계하여 순수 JSON 포맷으로 출력하세요.

[학습 주제 및 단계 정보]
- 과목/주제: ${topicName}
${category ? `- 과목 분류/영역: ${category}` : ''}
${topicDescription ? `- 주제 설명/목표: ${topicDescription}` : ''}
- 학습자 지식 수준: ${levelMap[learnerLevel]}
${knownScope ? `- 학습자가 이미 알고 있는 범위: "${knownScope}"` : ''}
- 생성 단계 목표: ${stageName || `${startPad}단원부터 이어지는 다음 연속 교육과정`}
- 이번 회차 출제 단원 번호: ${startPad}단원 ~ ${endPad}단원 (총 5개 단원)
${existingUnitTitles.length > 0 ? `- 이미 이전 단계에 등록된 단원 목록 (※ 절대 중복 생성 금지, 이 단원들을 마친 후 이어지는 다음 연계 심화 과정으로 설계할 것):\n${existingUnitTitles.map((t) => `  * ${t}`).join('\n')}` : ''}

[절대적 공인 교육과정 설계 헌법 (Universal Fine-Grained Micro-Step Curriculum for All Fields)]
1. [지정 과목 및 세부 영역 일치 헌법 (Cross-Domain Conflict Resolution & Fallback)]:
   - 반드시 지정된 과목 [${topicName}] 및 세부 영역 [${category || topicName}]의 공식 표준 교육과정에 국한하여 목차를 설계하십시오.
   - [상호 모순/충돌 및 엉뚱한 입력 예외 처리 3대 원칙]:
     ① [소주제/분류가 무의미하거나 장난인 경우 폴백 (Nonsense Fallback)]:
        - 만약 세부 영역/분류('${category}')가 단순 오타, 장난, 무의미한 자모/영문('ㅁㄴㅇㄹ', 'asdf', 특수문자 등)이거나 공인된 교육과정이 없는 엉뚱한 문구인 경우:
        - 엉뚱한 소주제는 즉시 무시하고, 정규 학술/수험 체계가 확립된 **본래 과목/대주제('${topicName}')**를 기준으로 단원을 설계하십시오.
     ② [대주제와 소주제가 서로 다른 정상 학문인 경우 (Cross-Domain Prioritization)]:
        - 만약 과목명('${topicName}')과 분류/영역('${category}')이 둘 다 실존하지만 서로 다른 분야인 경우(예: 과목명은 '바람의나라', 분류는 '바리스타 기초과정'):
        - 사용자가 구체적으로 배우고자 밝힌 **실제 학습 대상인 '${category}'(예: 바리스타 커피 지식 및 에스프레소 추출, 원두 분쇄 등)**을 최우선 기준으로 채택하여 목차를 구성하십시오. 엉뚱하게 다른 분야의 일반 시스템(예: 게임 캐릭터 생성 등)으로 덮어씌워서는 절대 안 됩니다!
     ③ [대주제와 소주제 둘 다 엉뚱한 경우]:
        - 허구의 이론을 날조(환각)하지 말고, 상식적이고 객관적인 사실에 기반하여 질문하십시오.
2. [단원 번호 연속성 필수 준수]: 각 단원의 제목은 반드시 "${startPad}단원. [공인 단원명]"부터 시작하여 순차적으로 번호를 매겨 "${endPad}단원. [공인 단원명]"까지 총 5개 단원을 출력하십시오.
3. [전 분야 공통 적용: 촘촘한 마이크로 스텝 설계 (급격한 난이도 비약 및 건너뛰기 절대 금지)]:
   - 본 규칙은 프로그래밍, 수학, 영어, 행정학, 공무원/자격증 시험, 과학, 역사 등 **모든 학문과 수험 분야에 예외 없이 동일하게 적용**됩니다.
   - 초보자/기초 학습자가 단원 간의 난이도 차이나 급격한 비약(건너뛰기)을 느끼지 않도록, 개념 하나하나를 아주 잘게 쪼갠 '촘촘한 마이크로 계단(Micro-Steps)' 형태로 설계하십시오.
   - [필수]: 한 단원에 서로 다른 복합 개념을 뭉뚱그리지 마십시오. 1단원당 1개의 핵심 원리/주제에 집중하십시오.
   - [분야별 촘촘한 계단식 예시]:
     * [수학]: 01단원 거듭제곱과 지수법칙 ➔ 02단원 다항식의 덧셈/뺄셈 ➔ 03단원 곱셈공식 ➔ 04단원 조립제법과 다항식 나눗셈 ➔ 05단원 항등식과 나머지정리...
     * [영어]: 01단원 be동사와 인칭대명사 ➔ 02단원 일반동사 현재형 ➔ 03단원 과거시제와 불규칙동사 ➔ 04단원 미래시제와 기본 조동사 ➔ 05단원 문장의 5가지 기본 형식...
     * [행정학/법률/공무원]: 01단원 행정의 개념과 본질 ➔ 02단원 공행정과 사행정의 비교 ➔ 03단원 행정이념 ➔ 04단원 행정학의 태동과 주요 학파 ➔ 05단원 정책의 의의...
     * [프로그래밍/IT]: 01단원 변수와 print/input ➔ 02단원 숫자형과 사칙연산자 ➔ 03단원 문자열 인덱싱/슬라이싱 ➔ 04단원 불리언과 비교/논리연산자 ➔ 05단원 리스트 기본 인덱싱...
     * [경영/회계/자격증]: 01단원 기본 용어와 개념 정의 ➔ 02단원 기본 원리와 분류 ➔ 03단원 핵심 처리 절차...
   - 학습자가 한 계단씩 안정적으로 밟아나갈 수 있도록 단원 주제를 세밀하고 촘촘하게 분할하십시오.
4. [선행 단원과의 중복 금지 및 발전적 연계]: 이전 단계 단원들과 중복되지 않도록, 선행 지식을 바탕으로 자연스럽게 이어지는 다음 수준의 심화/응용/실전/문제해결 목차를 설계하십시오.
5. [공인 교과서/기출 표준 단원명 필수 준수]: 반드시 해당 분야의 정규 공인 교과서나 기출 기준의 "정통 학술/표준 단원 명칭"을 정확히 채택하십시오.
6. [유치한 은유 및 가짜 창작 단원 절대 금지]: 감성적이거나 모호하고 유치한 창작 단원명을 배제하고 학술적 공인 단원명을 사용할 것.

[출력 JSON 규격]
{
  "units": [
    { "title": "${startPad}단원. ...", "description": "해당 단원의 정통 핵심 학습 목표 1줄 요약" },
    { "title": "${String(startIdx + 1).padStart(2, '0')}단원. ...", "description": "..." },
    { "title": "${String(startIdx + 2).padStart(2, '0')}단원. ...", "description": "..." },
    { "title": "${String(startIdx + 3).padStart(2, '0')}단원. ...", "description": "..." },
    { "title": "${endPad}단원. ...", "description": "..." }
  ]
}`;
}
