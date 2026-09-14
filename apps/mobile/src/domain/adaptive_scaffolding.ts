/**
 * Adaptive Scaffolding (하향 비계 기반 적응형 출제 엔진)
 * 
 * 목적: 학습자가 문제를 틀렸을 때, 인지 난이도를 한 단계 낮추고
 *       해당 오개념의 직전 선수 지식(Prerequisite Knowledge)을 보충해주는 맞춤형 출제 명세서 생성
 * 참조: CogniQuest_개발명세_v1 & 인지학습이론(ZPD 근접발달영역)
 */

import { QuestionRevision, CognitiveLevel } from '../contracts/types';
import { ScopedIntent } from './generator';

export interface ScaffoldingPackage {
  intent: ScopedIntent;
  scaffoldingContext: string;
  sourceQuestionCount: number;
}

/**
 * 최근 오답 문제들을 분석하여 맞춤형 기초 다지기 출제 명세서 조합
 */
export function buildAdaptiveScaffoldingSpec(params: {
  incorrectQuestions: QuestionRevision[];
  topicName: string;
}): ScaffoldingPackage | null {
  const { incorrectQuestions, topicName } = params;

  if (!incorrectQuestions || incorrectQuestions.length === 0) {
    return null;
  }

  // 최근 오답 최대 3문항 추출하여 분석
  const targetMistakes = incorrectQuestions.slice(0, 3);
  const mistakeSummaries = targetMistakes.map((q, idx) => {
    return `${idx + 1}. [문제]: ${q.stem.slice(0, 100)}\n   [출제근거 및 해설]: ${q.explanation.slice(0, 120)}`;
  }).join('\n');

  const focusConceptSummary = targetMistakes
    .map((q) => q.stem.replace(/\[.*?\]/g, '').slice(0, 20).trim())
    .join(', ');

  const scaffoldingContext = `[학습자 맞춤형 오답 분석 및 하향 비계 지침]
학습자가 최근 아래 문제들을 풀면서 오답을 선택해 개념 혼란을 겪었습니다.
${mistakeSummaries}

[출제 요구]
1. 위 문제들에서 발생한 오개념을 바로잡을 수 있도록, 해당 지식의 '직전 단계(선수 지식, 기초 정의)'를 확인하는 친절한 4지선다 문제를 출제하세요.
2. 지나치게 복잡한 계산이나 응용은 배제하고, '원리 이해'와 '개념 식별'에 초점을 맞추세요.
3. 해설에는 학습자가 혼동했던 포인트가 왜 오답이었는지 명쾌하게 짚어주세요.`;

  const intent: ScopedIntent = {
    domain: `${topicName} (오답 개념 기초 다지기)`,
    level: 'comprehend' as CognitiveLevel,
    levelLabel: 'Lv.2 원리 이해 & 오개념 교정',
    style: '선수 지식 확인 및 오개념 극복 맞춤형 4지선다',
    targetCount: Math.min(3, Math.max(2, targetMistakes.length)),
    focusConcepts: [focusConceptSummary || '최근 오답 관련 핵심 개념'],
    factReferencePolicy: '공인 표준 교재 기초 개념 및 오답 극복 원전 팩트',
  };

  return {
    intent,
    scaffoldingContext,
    sourceQuestionCount: targetMistakes.length,
  };
}
