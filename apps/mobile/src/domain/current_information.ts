const TIME_SENSITIVE_STUDY_TERMS = [
  /세율|세금|과세|소득세|양도소득세|취득세|재산세|종합부동산세|부가가치세|법인세/,
  /부동산.{0,8}(법|정책|규제|세제)|주택.{0,8}(법|정책|규제|세제)/,
  /법률|법령|시행령|시행규칙|조례|행정규칙|판례|규정|개정안|입법예고/,
  // 이름만으로 법 과목이 분명한 경우만 직접 감지한다. '○○법' 전체를 법으로 보지 않는다
  // (영문법·문법·기법·요리법·최소제곱법·연상법은 법 과목이 아니다). 앞에 한글이 붙으면 다른 단어로 본다.
  /(?:^|[^가-힣])(?:민법|형법|상법|헌법|행정법|세법|노동법|경제법|국제법|가족법|민사소송법|형사소송법|행정소송법|민사집행법|근로기준법)/,
];

// 과목 분류가 법학/행정이면 과목 이름과 관계없이 최신 법령을 검증한다(TopicModal 분류 값).
const LAW_CATEGORY = '법학/행정';

export type CurrentInformationReference = {
  referenceDate: string;
  effectiveStatus: 'currently_effective';
  sourceAgency: string;
  sourceTitle: string;
  sourceUrl: string;
};

const TRUSTED_OFFICIAL_HOSTS = [
  'law.go.kr',
  'open.law.go.kr',
  'nts.go.kr',
  'molit.go.kr',
  'mois.go.kr',
  'moef.go.kr',
  'wetax.go.kr',
  'gov.kr',
  'data.go.kr',
  'easylaw.go.kr',
];

export function requiresCurrentOfficialSources(input: {
  category?: string;
  texts: Array<string | undefined>;
}): boolean {
  if (input.category?.trim() === LAW_CATEGORY) return true;
  const target = input.texts.filter(Boolean).join(' ');
  return TIME_SENSITIVE_STUDY_TERMS.some((pattern) => pattern.test(target));
}

export function getKoreanReferenceDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isTrustedOfficialSourceUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return TRUSTED_OFFICIAL_HOSTS.some(
      (officialHost) => host === officialHost || host.endsWith(`.${officialHost}`)
    );
  } catch {
    return false;
  }
}

export function buildCurrentInformationInstruction(referenceDate: string): string {
  return `[최신 법령·세율 검증 — 반드시 준수]
이 주제는 시간이 지나면 정답이 바뀔 수 있으므로 Google 검색으로 대한민국 정부 공식 출처를 확인하십시오.
- 기준일: ${referenceDate} (대한민국 시간)
- 허용 출처: 국가법령정보센터, 국세청, 기획재정부, 국토교통부, 행정안전부, 위택스, 정부24, 공공데이터포털, 찾기쉬운 생활법령정보의 공식 페이지
- 현재 시행 중인 법령·세율만 정답 근거로 사용하고, 공포 후 시행 전·입법예고·개정안은 현재 규정과 분리하십시오.
- 공식 출처에서 확인되지 않은 수치나 요건은 문제로 만들지 마십시오.
- 기관·직위 명칭은 기준일 현행 조문의 표기를 그대로 쓰고, 개정 전 옛 명칭(예: 지방경찰청 → 현행 시·도경찰청)은 지문·보기·정답·correctAnswers에 넣지 마십시오.
- 모든 문항에 currentReference를 넣고, sourceUrl은 검색 결과의 공식 원문 URL을 기록하십시오.
- 공식 출처를 확인하지 못하면 READY를 반환하지 말고 NEEDS_CLARIFICATION으로 확인 실패를 알리십시오.`;
}
