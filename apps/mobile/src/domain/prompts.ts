import { LearnerKnowledgeLevel, QuestionType } from '../contracts/types';
import { createQuestionTypePlan } from './question_type_plan';
import { ScopedIntent } from './intent';
import { getDifficultyProfile, legacyLevelToDifficulty, normalizeDifficultyLevel } from './difficulty';

export function buildQuestionGenerationPrompt(params: {
  intent: ScopedIntent;
  resolvedDomain: string;
  category?: string;
  unitTitle?: string;
  customContext?: string;
  currentInformationInstruction?: string;
  questionTypePlan?: QuestionType[];
}): string {
  const { intent, resolvedDomain, category, unitTitle, customContext, currentInformationInstruction } = params;
  const questionTypePlan = params.questionTypePlan ?? createQuestionTypePlan(intent.targetCount, undefined, intent.questionTypeMode);

  return `당신은 사용자가 선택한 어떤 학습 주제에도 대응하는 문제 출제 전문가입니다.
아래 주제의 의미를 먼저 판정한 뒤, 지정된 JSON 중 하나만 출력하세요.

[사용자가 지정한 학습 범위]
- 원문 주제: ${resolvedDomain}
${category ? `- 보관함 표시 분류: ${category} (정리용 메타데이터이며 출제 주제를 바꾸거나 대신할 수 없음)` : ''}
${unitTitle ? `- 선택 단원: ${unitTitle}` : ''}
- 세분화 난이도: ${intent.levelLabel} (숫자가 1씩 높아질 때 선행지식과 사고 부담도 조금씩만 높일 것)
${intent.knownScope ? `- 학습자가 밝힌 현재 도달점: ${intent.knownScope}` : ''}
- 출제 기준: ${intent.levelBriefing || '학습자 수준에 맞는 난이도'}
- 사용자의 세부 요청: ${intent.focusConcepts.join(', ')}
${customContext ? `- 사용자 자료 및 추가 조건:\n${customContext}` : ''}
${currentInformationInstruction ? `\n${currentInformationInstruction}` : ''}

[주제 판정]
1. READY: 주제가 낯설거나 희귀해도 학습 의도가 일관되고 문제를 만들 수 있으면 선택합니다.
2. NEEDS_CLARIFICATION: 단어 각각은 의미가 있지만 서로의 관계가 여러 방식으로 해석되어 무엇을 공부하려는지 확정할 수 없을 때만 선택합니다.
3. REJECTED: 빈 입력, 의미를 판별할 수 없는 문자 나열처럼 학습 주제를 구성할 수 없을 때만 선택합니다.
4. 공인 시험이나 표준 교육과정이 없다는 이유만으로 주제를 무시하거나 다른 일반 과목으로 바꾸지 마세요.
5. 보관함 표시 분류, 일반적인 단원 용어, 난이도 표현보다 원문 주제와 사용자의 세부 요청을 우선합니다.
6. 불확실한 사실, 효능, 수치, 역사 또는 고유명사를 만들어내지 마세요. 근거가 부족하면 그 주장을 정답으로 사용하지 마세요.
7. 입력의 일부를 오타나 불필요한 말로 임의 판단해 버리지 마세요. 원문에 관계를 설명할 수 없는 단어나 문자 조각이 섞여 있으면 정상 부분만 골라 출제하지 말고 NEEDS_CLARIFICATION을 반환하세요.

[READY일 때 문제 작성 규칙]
1. 정확히 ${intent.targetCount}문항을 작성합니다.
2. 앱이 각 문항의 유형을 정했습니다. questions 배열의 questionType은 다음 순서를 정확히 따르세요: ${JSON.stringify(questionTypePlan)}. 같은 유형만 연속되거나 전체가 한 유형이어도 그대로 출제합니다. 비율을 맞추거나 유형을 변경하지 마세요. 모든 난이도에서 모든 유형을 허용하되, 단답형·서술형의 요구 지식과 답안 길이도 지정된 학습자 수준에 맞추세요.
3. questionType이 "multiple_choice"인 문제는 보기 1번, 2번, 3번, 4번의 4지선다이며 정답은 하나만 존재해야 합니다. correctOptionNumber에는 사용자에게 보이는 정답 번호 1, 2, 3, 4 중 하나를 기록합니다. 0부터 시작하는 번호를 사용하지 마세요. 오답은 실제로 혼동하기 쉬운 인접 개념으로 만들고, 각 오답 이유를 설명합니다.
4. questionType이 "cloze"인 문제는 options/correctOptionNumber를 생략합니다. stem 안에 빈칸을 {{1}}, {{2}}... 순서대로(1부터, 건너뛰지 않고) 표시하고, blanks 배열에 그 순서와 정확히 대응하는 항목을 각각 작성합니다. blanks 각 항목의 correctAnswers는 그 빈칸에 들어갈 정답 표현들의 배열입니다(표기가 여러 개 가능하면 모두 나열, 최소 1개). 한 문제에 빈칸은 1~3개로 합니다. 빈칸이 명칭이나 용어를 물을 때는 아래 두 경우 중 실제 근거에 맞는 하나만 따르고, 지문에 적은 요구 형식과 correctAnswers의 채점 기준이 항상 서로 일치하게 하세요: (a) 자료에 그 약어가 명확히 쓰여 있어 정답으로도 인정하는 경우, correctAnswers에 정식 명칭과 그 약어를 함께 넣고 지문에는 정답 약어 자체를 쓰지 않은 채 "정식 명칭이나 자료에 쓰인 약어로 답하세요"처럼 약어가 허용된다는 사실만 밝힙니다. (b) 그런 근거가 없으면 지문에 정식 명칭(풀네임)으로만 답하도록 명시하고 correctAnswers에도 정식 명칭만 넣습니다(약어 허용을 언급하지 않음). 약어의 의미를 추정해서 확인 없이 정답 목록에 넣지 마세요.
5. questionType이 "short_answer"인 문제는 options/correctOptionNumber를 생략하고 modelAnswer(핵심 키워드 중심의 짧은 모범답안 한 문장)만 작성합니다. 답이 여러 표현으로 가능하면 modelAnswer에 핵심 키워드를 명시합니다.
6. questionType이 "essay"인 문제는 options/correctOptionNumber를 생략하고 modelAnswer(모범답안 전체)와 gradingChecklist(모범답안의 핵심 요소 2~5개, 각 항목의 판정 기준 criterion과 배점 points, 배점 합계는 반드시 100)를 작성합니다. "논리적 일관성" 같은 주관적 기준이 아니라, 답안에 그 핵심 요소가 실제로 포함되었는지로만 판정 가능한 기준을 씁니다.
7. 기존 문제와 지문·핵심 질문·정답 개념이 사실상 같은 문제를 반복하지 않습니다.
8. 해설에는 정답의 근거와 오답을 구분하는 기준을 분명하게 적습니다(단답형/서술형/빈칸형은 모범답안의 핵심 근거를 설명).
9. 아래 예시는 유형별 필드 형태만 보여줍니다. 실제 문항 수와 유형 순서는 위에서 지정한 추첨 결과를 따르세요.
10. stem(지문)은 그 자체로 완결된 시험 문장이어야 하며, 별도 설명 없이 바로 답할 수 있어야 합니다. "~하는 판단 기준은?", "어떻게 접근해야 하는가?"처럼 출제자가 스스로에게 묻는 듯한 메타 질문을 쓰지 마세요. 풀이 과정이나 접근 방법을 지문 안에 미리 설명하지 말고, 그런 설명은 전부 explanation에만 담습니다.
11. 수식이 필요한 문제(지문/보기/해설/힌트 어디든)는 모든 수식을 반드시 $...$ 기호로 감싸고, 분수는 \\frac{분자}{분모}, 제곱근은 \\sqrt{...}, 지수는 ^{...}, 아래첨자는 _{...}, 그리스 문자·시그마·적분 등은 \\sigma, \\sum, \\int 같은 LaTeX 명령으로 씁니다.
12. deepReasoningHint(힌트)는 모든 문제 유형에 반드시 작성합니다. 최대 1~2개의 짧은 문장(200자 이내)으로 쓰고 정답 번호, 정답 문구, 최종 수치나 완성된 계산식을 노출하지 마세요.
13. 좌표계의 축 방향·원점 위치, 인덱스 시작 번호, 단위, 표기법, 버전별 동작처럼 도구·표준·환경마다 관례가 다른 내용은 지문에 기준 환경을 명시하세요(예: "Win32 화면 좌표 기준", "Unity 2D 월드 좌표 기준"). 서로 다른 기준(예: 게임 엔진의 월드 좌표와 모니터 화면 좌표)을 한 문장에 섞지 마세요. 기준을 명시할 수 없으면 그 내용으로 출제하지 마세요. 객관식은 지문에 적은 기준에서 정답이 정확히 하나여야 하며, 널리 쓰이는 다른 기준으로 보면 오답 보기가 정답이 되는 문제는 만들지 마세요. 단답형·서술형의 modelAnswer와 gradingChecklist도 지문에 적은 기준으로 작성합니다.
14. 단답형·서술형은 정의·원리·사실·절차처럼 객관적으로 확인할 수 있는 핵심 답안 요소와 채점 기준이 있는 문제만 출제합니다. 답안 문장을 하나로 고정할 필요는 없지만, 표현이 달라도 같은 핵심 요소로 채점할 수 있어야 합니다. 의견·가치판단·찬반, "어떤 입장이 더 옳은가"처럼 여러 논증이 가능한 질문, 학습자의 경험이나 생각을 묻는 질문, 기준이 모호한 지문은 만들지 마세요(예: "칸트 정언명령의 개념을 설명하시오"는 가능, "어떤 윤리관이 더 옳은가"는 불가). 지정된 유형으로 이런 조건을 지킨 문제를 만들 수 없으면 READY를 반환하지 말고 NEEDS_CLARIFICATION으로 이유를 알리십시오.

[출력 JSON]
READY (questionType별로 필드가 다름에 유의):
{
  "intentStatus": "READY",
  "questions": [
    {
      "questionType": "multiple_choice",
      "stem": "문제 지문",
      "options": [
        { "text": "1번 보기", "distractorRationale": "오답인 경우 그 이유" },
        { "text": "2번 보기", "distractorRationale": "오답인 경우 그 이유" },
        { "text": "3번 보기", "distractorRationale": "정답이면 빈 문자열" },
        { "text": "4번 보기", "distractorRationale": "오답인 경우 그 이유" }
      ],
      "correctOptionNumber": 3,
      "explanation": "정답과 판단 근거를 설명하는 해설",
      "deepReasoningHint": "정답을 밝히지 않고 어떤 개념·조건을 다시 확인해야 하는지만 짧게 안내하는 1~2문장",
      "currentReference": {
        "referenceDate": "최신 정보 검증 주제일 때만 YYYY-MM-DD",
        "effectiveStatus": "currently_effective",
        "sourceAgency": "공식 기관명",
        "sourceTitle": "공식 문서 또는 법령명",
        "sourceUrl": "공식 원문 URL"
      }
    },
    {
      "questionType": "cloze",
      "stem": "{{1}}은 대한민국의 수도이며, {{2}}년에 대한민국 정부가 수립되었다.",
      "blanks": [
        { "correctAnswers": ["서울", "서울특별시"] },
        { "correctAnswers": ["1948"] }
      ],
      "explanation": "정답 근거 해설",
      "deepReasoningHint": "정답을 노출하지 않는 짧은 개념 안내"
    },
    {
      "questionType": "short_answer",
      "stem": "단답형 문제 지문",
      "modelAnswer": "핵심 키워드 중심 모범답안",
      "explanation": "정답 근거 해설",
      "deepReasoningHint": "정답을 노출하지 않는 짧은 개념 안내"
    },
    {
      "questionType": "essay",
      "stem": "서술형 문제 지문",
      "modelAnswer": "모범답안 전체",
      "gradingChecklist": [
        { "criterion": "핵심 요소 1 포함 여부", "points": 40 },
        { "criterion": "핵심 요소 2 포함 여부", "points": 30 },
        { "criterion": "핵심 요소 3 포함 여부", "points": 30 }
      ],
      "explanation": "정답 근거 해설",
      "deepReasoningHint": "정답을 노출하지 않는 짧은 개념 안내"
    }
  ]
}

NEEDS_CLARIFICATION:
{
  "intentStatus": "NEEDS_CLARIFICATION",
  "message": "어떤 관계나 범위를 확인해야 하는지 묻는 한 문장",
  "clarificationChoices": ["가능한 해석 1", "가능한 해석 2"]
}

REJECTED:
{
  "intentStatus": "REJECTED",
  "message": "주제를 조금 더 구체적으로 입력해 달라는 안내",
  "clarificationChoices": []
}`;
}

export function buildCurriculumPrompt(params: {
  topicName: string;
  topicDescription?: string;
  category?: string;
  learnerLevel?: LearnerKnowledgeLevel;
  difficultyLevel?: number;
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
    difficultyLevel,
    knownScope,
    startUnitIndex = 1,
    stageName,
    existingUnitTitles = [],
  } = params;

  const normalizedDifficulty = normalizeDifficultyLevel(
    difficultyLevel,
    legacyLevelToDifficulty(learnerLevel)
  );
  const difficultyProfile = getDifficultyProfile(normalizedDifficulty);

  const startIdx = Math.max(1, startUnitIndex);
  const endIdx = startIdx + 4;
  const startPad = String(startIdx).padStart(2, '0');
  const endPad = String(endIdx).padStart(2, '0');

  return `당신은 사용자가 원하는 어떤 주제든 점진적인 학습 단원으로 설계하는 전문가입니다.
먼저 주제의 의미를 판정한 뒤, 지정된 JSON 중 하나만 출력하세요.

[학습 주제]
- 사용자가 입력한 원문 주제: ${topicName}
${category ? `- 보관함 표시 분류: ${category} (정리용 메타데이터이며 학습 주제를 바꾸거나 대신할 수 없음)` : ''}
${topicDescription ? `- 사용자가 적은 설명 또는 목표: ${topicDescription}` : ''}
- 시작 난이도: 레벨 ${normalizedDifficulty} · ${difficultyProfile.bandLabel}
- 난이도 기준: ${difficultyProfile.briefing}
${knownScope ? `- 사용자가 이미 아는 범위: ${knownScope}` : ''}
- 이번 생성 범위: ${startPad}단원부터 ${endPad}단원까지 정확히 5개
- 단계 목표: ${stageName || '앞 단원에서 자연스럽게 이어지는 다음 학습 단계'}
${existingUnitTitles.length > 0 ? `- 기존 단원(중복 금지):\n${existingUnitTitles.map((title) => `  * ${title}`).join('\n')}` : ''}

[주제 판정]
1. READY: 주제가 희귀하거나 일반적인 문제은행에 없어도 의미가 일관되면 선택합니다.
2. NEEDS_CLARIFICATION: 여러 정상적인 해석이 충돌해 사용자의 실제 학습 대상을 확정할 수 없을 때만 선택합니다.
3. REJECTED: 의미를 판별할 수 없는 문자 나열처럼 학습 주제를 구성할 수 없을 때만 선택합니다.
4. 표준 교육과정이나 자격시험이 없다는 이유로 다른 과목으로 바꾸거나 주제를 무시하지 마세요.
5. 시험·자격 주제면 공식 체계를 따르고, 취미·게임·생태·실무 등은 해당 분야의 실제 맥락과 검증 가능한 지식을 따릅니다.
6. 불확실한 사실이나 효능을 만들어내지 마세요. 근거가 부족한 주장은 학습 사실로 단정하지 않습니다.
7. 입력 일부를 임의로 버리거나 정상 단어만 골라 주제를 재구성하지 마세요. 의미 관계를 설명할 수 없는 단어나 문자 조각이 섞여 있으면 NEEDS_CLARIFICATION을 반환하세요.

[READY일 때 단원 설계 규칙]
1. 각 단원은 한 개의 핵심 개념이나 기능에 집중합니다.
2. 바로 전 단원에서 다음 단원으로 넘어갈 때 필요한 선행지식이 급격히 뛰지 않게 합니다.
3. 숫자 레벨은 모든 주제에 동일한 지식량을 뜻하지 않습니다. 사용자가 입력한 주제 안에서 레벨 ${normalizedDifficulty}에 맞는 상대적 깊이와 사고 부담을 적용합니다.
4. 기존 단원과 같은 제목이나 사실상 같은 학습 목표를 반복하지 않습니다.
5. 단원 제목은 ${startPad}단원부터 ${endPad}단원까지 순서대로 번호를 붙입니다.
6. 30단원 이후에는 난이도를 무한히 올리기보다 새로운 범위, 사례, 관점과 활용으로 확장합니다.

[출력 JSON]
READY:
{
  "intentStatus": "READY",
  "units": [
    { "title": "${startPad}단원. ...", "description": "핵심 학습 목표" },
    { "title": "${String(startIdx + 1).padStart(2, '0')}단원. ...", "description": "핵심 학습 목표" },
    { "title": "${String(startIdx + 2).padStart(2, '0')}단원. ...", "description": "핵심 학습 목표" },
    { "title": "${String(startIdx + 3).padStart(2, '0')}단원. ...", "description": "핵심 학습 목표" },
    { "title": "${endPad}단원. ...", "description": "핵심 학습 목표" }
  ]
}

NEEDS_CLARIFICATION:
{
  "intentStatus": "NEEDS_CLARIFICATION",
  "message": "확인이 필요한 관계나 범위를 묻는 한 문장",
  "clarificationChoices": ["가능한 해석 1", "가능한 해석 2"]
}

REJECTED:
{
  "intentStatus": "REJECTED",
  "message": "주제를 조금 더 구체적으로 입력해 달라는 안내",
  "clarificationChoices": []
}`;
}
