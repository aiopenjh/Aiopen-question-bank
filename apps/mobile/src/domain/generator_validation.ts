/**
 * AI 출제 응답 검증 (generator.ts에서 분리, 500줄 제한 준수)
 * Reference: AGENTS.md & CogniQuest_개발명세_v1
 *
 * questionType(multiple_choice/short_answer/essay/cloze)별로 필요한 필드가 다르므로
 * 유형에 따라 분기하여 검증합니다.
 */

import { GradingChecklistItem, QuestionType } from '../contracts/types';
import { generateUUID } from '../data/db';
import { CurrentInformationReference, isTrustedOfficialSourceUrl } from './current_information';

export interface GeneratedQuestionInput {
  questionType: QuestionType;
  stem: string;
  conceptDefinition?: string;
  options: Array<{
    text: string;
    distractorRationale?: string;
  }>;
  correctOptionNumber: number;
  modelAnswer?: string;
  gradingChecklist?: GradingChecklistItem[];
  clozeBlanks?: { correctAnswers: string[] }[];
  explanation: string;
  deepReasoningHint?: string;
  currentReference?: CurrentInformationReference;
}

export const MAX_ESSAY_ANSWER_LENGTH = 2000; // 합의된 서술형 답안 최대 글자수
export const MAX_HINT_LENGTH = 200;

const META_QUESTION_LEAK_PATTERNS = [
  '판단 기준은', '판단 기준이', '어떻게 접근해야', '접근 방법은', '추가 정보가 필요하다면',
];
const ANSWER_LEAK_PATTERNS = [/정답은/, /정답:/, /답은\s*\d/, /\d\s*번(이|입니다|이다|이며)/];

export function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function containsMetaQuestionLeak(stem: string): boolean {
  return META_QUESTION_LEAK_PATTERNS.some((pattern) => stem.includes(pattern));
}

export function containsAnswerLeak(hint: string, correctAnswerText?: string): boolean {
  if (ANSWER_LEAK_PATTERNS.some((pattern) => pattern.test(hint))) return true;
  return Boolean(
    correctAnswerText &&
    correctAnswerText.trim().length >= 2 &&
    normalizeComparableText(hint).includes(normalizeComparableText(correctAnswerText))
  );
}

export function readOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readQuestionType(value: unknown, number: number): QuestionType {
  // 기존 AI 응답에는 questionType이 없다. 비어 있으면 기존 기본형인 객관식으로 해석한다.
  if (value === undefined || value === null || value === '') return 'multiple_choice';
  if (value === 'multiple_choice' || value === 'short_answer' || value === 'essay' || value === 'cloze') {
    return value;
  }
  throw new Error(`AI 응답의 ${number}번 문제 유형(questionType)이 올바르지 않습니다. 다시 시도해 주세요.`);
}

// cloze: stem 안의 {{1}},{{2}}...가 1부터 건너뛰지 않고 순서대로 등장하고,
// blanks 배열 길이와 정확히 일치해야 한다(1~3개).
function readClozeBlanks(value: unknown, stem: string, number: number): { correctAnswers: string[] }[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw new Error(`AI 응답의 ${number}번 빈칸형 문제 blanks가 1~3개가 아닙니다. 다시 시도해 주세요.`);
  }

  const blanks = value.map((raw, idx) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`AI 응답의 ${number}번 문제 빈칸 ${idx + 1}번 형식이 올바르지 않습니다. 다시 시도해 주세요.`);
    }
    const item = raw as Record<string, unknown>;
    const rawAnswers = Array.isArray(item.correctAnswers) ? item.correctAnswers : [];
    const correctAnswers = rawAnswers
      .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      .map((a) => a.trim());
    if (correctAnswers.length === 0) {
      throw new Error(`AI 응답의 ${number}번 문제 빈칸 ${idx + 1}번 정답(correctAnswers)이 비어 있습니다. 다시 시도해 주세요.`);
    }
    return { correctAnswers };
  });

  for (let i = 0; i < blanks.length; i++) {
    if (!stem.includes(`{{${i + 1}}}`)) {
      throw new Error(`AI 응답의 ${number}번 문제 지문에 {{${i + 1}}} 빈칸 마커가 없습니다. 다시 시도해 주세요.`);
    }
  }
  if (stem.includes(`{{${blanks.length + 1}}}`)) {
    throw new Error(`AI 응답의 ${number}번 문제 지문에 blanks 배열보다 많은 빈칸 마커가 있습니다. 다시 시도해 주세요.`);
  }

  return blanks;
}

function readGradingChecklist(value: unknown, number: number): GradingChecklistItem[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 5) {
    throw new Error(`AI 응답의 ${number}번 서술형 문제 채점 기준(gradingChecklist)이 2~5개가 아닙니다. 다시 시도해 주세요.`);
  }
  const items = value.map((raw, idx) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`AI 응답의 ${number}번 문제 채점 기준 ${idx + 1}번 형식이 올바르지 않습니다. 다시 시도해 주세요.`);
    }
    const item = raw as Record<string, unknown>;
    const criterion = readOptionalText(item.criterion);
    const points = typeof item.points === 'number' ? item.points : NaN;
    if (!criterion || !Number.isFinite(points) || points <= 0) {
      throw new Error(`AI 응답의 ${number}번 문제 채점 기준 ${idx + 1}번이 비어 있거나 배점이 올바르지 않습니다. 다시 시도해 주세요.`);
    }
    return { id: generateUUID(), criterion, points };
  });
  const total = items.reduce((sum, item) => sum + item.points, 0);
  if (Math.abs(total - 100) > 0.5) {
    throw new Error(`AI 응답의 ${number}번 문제 채점 기준 배점 합계가 100이 아닙니다(${total}). 다시 시도해 주세요.`);
  }
  return items;
}

export function validateGeneratedQuestions(
  value: unknown,
  expectedCount: number,
  currentInformationRequired = false,
  expectedReferenceDate?: string,
  groundingWasUsed = false,
  subjectiveAllowed = false
): GeneratedQuestionInput[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('AI 응답 형식을 확인할 수 없습니다. 다시 시도해 주세요.');
  }

  const questions = (value as { questions?: unknown }).questions;
  if (!Array.isArray(questions) || questions.length !== expectedCount) {
    throw new Error(
      `AI가 요청한 ${expectedCount}문항을 완전하게 반환하지 않았습니다. 다시 시도해 주세요.`
    );
  }

  const knownStems = new Set<string>();

  if (currentInformationRequired && !groundingWasUsed) {
    throw new Error('최신 공식 자료 검색 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return questions.map((rawQuestion, questionIndex) => {
    const number = questionIndex + 1;
    if (typeof rawQuestion !== 'object' || rawQuestion === null || Array.isArray(rawQuestion)) {
      throw new Error(`AI 응답의 ${number}번 문제 형식이 올바르지 않습니다. 다시 시도해 주세요.`);
    }

    const question = rawQuestion as Record<string, unknown>;
    const stem = typeof question.stem === 'string' ? question.stem.trim() : '';
    if (!stem) {
      throw new Error(`AI 응답의 ${number}번 문제 지문이 비어 있습니다. 다시 시도해 주세요.`);
    }
    if (containsMetaQuestionLeak(stem)) {
      throw new Error(`AI 응답의 ${number}번 문제 지문이 완결된 질문이 아닙니다. 다시 시도해 주세요.`);
    }

    const normalizedStem = normalizeComparableText(stem);
    if (knownStems.has(normalizedStem)) {
      throw new Error(`AI 응답에 동일한 문제 지문이 반복되었습니다. 다시 시도해 주세요.`);
    }
    knownStems.add(normalizedStem);

    const questionType = readQuestionType(question.questionType, number);
    // 호출자가 허용한 유형인지 검증한다. 일반 출제는 모든 레벨에서 주관식을 허용한다.
    if ((questionType === 'short_answer' || questionType === 'essay') && !subjectiveAllowed) {
      throw new Error(`AI가 이번 난이도에서 허용되지 않는 문제 유형(${questionType})을 반환했습니다. 다시 시도해 주세요.`);
    }

    let options: Array<{ text: string; distractorRationale?: string }> = [];
    let correctOptionNumber = 0;
    let modelAnswer: string | undefined;
    let gradingChecklist: GradingChecklistItem[] | undefined;
    let clozeBlanks: { correctAnswers: string[] }[] | undefined;

    if (questionType === 'multiple_choice') {
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        throw new Error(`AI 응답의 ${number}번 문제 보기가 4개가 아닙니다. 다시 시도해 주세요.`);
      }

      const knownOptions = new Set<string>();
      options = question.options.map((rawOption, optionIndex) => {
        if (typeof rawOption !== 'object' || rawOption === null || Array.isArray(rawOption)) {
          throw new Error(
            `AI 응답의 ${number}번 문제 ${optionIndex + 1}번 보기 형식이 올바르지 않습니다. 다시 시도해 주세요.`
          );
        }

        const option = rawOption as Record<string, unknown>;
        const text = typeof option.text === 'string' ? option.text.trim() : '';
        if (!text) {
          throw new Error(
            `AI 응답의 ${number}번 문제 ${optionIndex + 1}번 보기가 비어 있습니다. 다시 시도해 주세요.`
          );
        }

        const normalizedOption = normalizeComparableText(text);
        if (knownOptions.has(normalizedOption)) {
          throw new Error(`AI 응답의 ${number}번 문제에 중복 보기가 있습니다. 다시 시도해 주세요.`);
        }
        knownOptions.add(normalizedOption);

        return {
          text,
          distractorRationale: readOptionalText(option.distractorRationale),
        };
      });

      if (
        typeof question.correctOptionNumber !== 'number' ||
        !Number.isInteger(question.correctOptionNumber) ||
        question.correctOptionNumber < 1 ||
        question.correctOptionNumber > options.length
      ) {
        throw new Error(`AI 응답의 ${number}번 문제 정답 번호가 올바르지 않습니다. 다시 시도해 주세요.`);
      }
      correctOptionNumber = question.correctOptionNumber;
    } else if (questionType === 'cloze') {
      clozeBlanks = readClozeBlanks(question.blanks, stem, number);
    } else {
      // short_answer / essay: 4지선다 없이 모범답안(+서술형은 채점 체크리스트) 기반
      modelAnswer = readOptionalText(question.modelAnswer);
      if (!modelAnswer) {
        throw new Error(`AI 응답의 ${number}번 문제 모범답안(modelAnswer)이 비어 있습니다. 다시 시도해 주세요.`);
      }
      if (questionType === 'essay') {
        gradingChecklist = readGradingChecklist(question.gradingChecklist, number);
      }
    }

    const explanation =
      typeof question.explanation === 'string' ? question.explanation.trim() : '';
    if (!explanation) {
      throw new Error(`AI 응답의 ${number}번 문제 해설이 비어 있습니다. 다시 시도해 주세요.`);
    }

    const deepReasoningHint = readOptionalText(question.deepReasoningHint);
    if (!deepReasoningHint) {
      throw new Error(`AI 응답의 ${number}번 문제에 힌트(deepReasoningHint)가 누락되었습니다. 다시 시도해 주세요.`);
    }
    if (deepReasoningHint.length > MAX_HINT_LENGTH) {
      throw new Error(`AI 응답의 ${number}번 문제 힌트가 너무 깁니다. 다시 시도해 주세요.`);
    }
    const correctAnswerText = questionType === 'multiple_choice'
      ? options[correctOptionNumber - 1]?.text
      : modelAnswer ?? clozeBlanks?.[0]?.correctAnswers[0];
    if (containsAnswerLeak(deepReasoningHint, correctAnswerText)) {
      throw new Error(`AI 응답의 ${number}번 문제 힌트에 정답이 노출되었습니다. 다시 시도해 주세요.`);
    }

    let currentReference: CurrentInformationReference | undefined;
    if (currentInformationRequired) {
      const rawReference = question.currentReference;
      if (typeof rawReference !== 'object' || rawReference === null || Array.isArray(rawReference)) {
        throw new Error(`AI가 ${number}번 문제의 최신 공식 출처를 확인하지 못했습니다. 다시 시도해 주세요.`);
      }
      const reference = rawReference as Record<string, unknown>;
      const referenceDate = readOptionalText(reference.referenceDate);
      const sourceAgency = readOptionalText(reference.sourceAgency);
      const sourceTitle = readOptionalText(reference.sourceTitle);
      const sourceUrl = readOptionalText(reference.sourceUrl);
      if (
        !referenceDate ||
        referenceDate !== expectedReferenceDate ||
        reference.effectiveStatus !== 'currently_effective' ||
        !sourceAgency ||
        !sourceTitle ||
        !sourceUrl ||
        !isTrustedOfficialSourceUrl(sourceUrl)
      ) {
        throw new Error(`AI가 ${number}번 문제에 현재 시행 중인 공식 근거를 제시하지 못했습니다. 다시 시도해 주세요.`);
      }
      currentReference = {
        referenceDate,
        effectiveStatus: 'currently_effective',
        sourceAgency,
        sourceTitle,
        sourceUrl,
      };
    }

    return {
      questionType,
      stem,
      conceptDefinition: readOptionalText(question.conceptDefinition),
      options,
      correctOptionNumber,
      modelAnswer,
      gradingChecklist,
      clozeBlanks,
      explanation,
      deepReasoningHint,
      currentReference,
    };
  });
}
