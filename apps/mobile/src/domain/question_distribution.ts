/**
 * Balanced Random Distribution Engine for Quiz Options
 * Reference: CogniQuest_개발명세_v1
 *
 * - 특정 번호(1번이나 2번)로 정답이 고정되거나 몰리는 현상을 100% 원천 차단합니다.
 * - 3문제/5문제/10문제 등 한 시험 세트 내에서 정답 위치(1, 2, 3, 4번)가 서로 다른 번호로 골고루 무작위 분산되도록 강제합니다.
 * - 연속된 두 문제의 정답이 동일한 번호로 중복되지 않도록 방지합니다.
 */

import { QuestionRevision } from '../contracts/types';
import { generateUUID } from '../data/db';

export function distributeQuestionAnswersRandomly(questions: QuestionRevision[]): QuestionRevision[] {
  if (!questions || questions.length === 0) return [];

  const n = questions.length;
  const baseSlots = [0, 1, 2, 3]; // 0: 1번, 1: 2번, 2: 3번, 3: 4번
  const targetSlots: number[] = [];

  while (targetSlots.length < n) {
    // 0~3 무작위 셔플
    const pool = [...baseSlots];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (const slot of pool) {
      if (targetSlots.length >= n) break;
      // 바로 직전 문제와 정답 번호가 겹치지 않도록 방어
      if (targetSlots.length > 0 && targetSlots[targetSlots.length - 1] === slot) {
        const alt = baseSlots.find((s) => s !== slot && s !== targetSlots[targetSlots.length - 1]);
        targetSlots.push(alt !== undefined ? alt : (slot + 1) % 4);
      } else {
        targetSlots.push(slot);
      }
    }
  }

  return questions.map((q, qIdx) => {
    const targetSlot = targetSlots[qIdx]; // 0~3 중 이번 문제의 정답 위치

    // 현재 문제의 공식 정답 선지 및 오답 선지 분리
    const correctOption = q.options.find((o) => o.id === q.answerOptionId) || q.options[0];
    const distractors = q.options.filter((o) => o.id !== correctOption.id);

    // 오답 선지 셔플
    for (let i = distractors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
    }

    // 새 4지선다 보기 배열 생성: targetSlot 위치에 공식 정답을 정확히 배치
    const newOptions: typeof q.options = [];
    let distractorIdx = 0;

    for (let slot = 0; slot < 4; slot++) {
      if (slot === targetSlot) {
        newOptions.push({
          ...correctOption,
          isDistractor: false,
        });
      } else {
        if (distractors[distractorIdx]) {
          newOptions.push({
            ...distractors[distractorIdx],
            isDistractor: true,
          });
          distractorIdx++;
        } else {
          newOptions.push({
            id: generateUUID(),
            text: `기타 선지 ${slot + 1}`,
            isDistractor: true,
          });
        }
      }
    }

    return {
      ...q,
      options: newOptions,
      answerOptionId: correctOption.id,
    };
  });
}
