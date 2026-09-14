import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { QuestionRevision } from '../../contracts/types';

interface DeepConceptSolidifierCardProps {
  question: QuestionRevision;
}

type TabKey = 'definition' | 'distractors' | 'deep_hint';

export const DeepConceptSolidifierCard: React.FC<DeepConceptSolidifierCardProps> = ({
  question,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('definition');
  const [guessedFlag, setGuessedFlag] = useState<boolean>(false);

  // 핵심 개념 정의 fallback 추출 (기존 문제 호환용)
  const conceptText =
    question.conceptDefinition ||
    question.explanation.split('.')[0] + '.' ||
    '출제 문항의 핵심 개념을 짚어보고 확실한 지식으로 정착시킵니다.';

  return (
    <View style={styles.cardContainer}>
      {/* 1. 상단 축하 및 지식 굳히기 안내 헤더 */}
      <View style={styles.celebrateHeader}>
        <View style={styles.celebrateBadge}>
          <Text style={styles.celebrateBadgeText}>✨ PERFECT ANSWER</Text>
        </View>
        <Text style={styles.celebrateTitle}>🎉 정답입니다! 지식을 확실히 굳혀볼까요?</Text>
        <Text style={styles.celebrateSubtitle}>
          대강 알거나 찍어서 맞힌 문제도, 1분 복습이면 평생 가는 진짜 실력이 됩니다.
        </Text>
      </View>

      {/* 2. '혹시 찍어서 맞히셨나요?' 자가 진단 토글 */}
      <TouchableOpacity
        style={[styles.guessCheckBanner, guessedFlag && styles.guessCheckBannerActive]}
        onPress={() => setGuessedFlag(!guessedFlag)}
        activeOpacity={0.8}
      >
        <Text style={styles.guessCheckIcon}>{guessedFlag ? '🎯' : '💡'}</Text>
        <View style={styles.guessCheckContent}>
          <Text style={styles.guessCheckTitle}>
            {guessedFlag
              ? '찍어서 맞힌 문제로 체크됨 (집중 복습 모드 가동)'
              : '혹시 긴가민가하거나 찍어서 맞히셨나요?'}
          </Text>
          <Text style={styles.guessCheckDesc}>
            {guessedFlag
              ? '아래 핵심 정의와 오답 함정 분석을 꼭 정독해 보세요!'
              : '여기를 터치하여 집중 복습 모드로 전환하고 개념을 완전히 체화하세요.'}
          </Text>
        </View>
        <View style={[styles.guessPill, guessedFlag && styles.guessPillActive]}>
          <Text style={[styles.guessPillText, guessedFlag && styles.guessPillTextActive]}>
            {guessedFlag ? '체크 완료' : '찍었어요'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 3. 3단계 심화 해설 탭 전환기 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'definition' && styles.tabButtonActive]}
          onPress={() => setActiveTab('definition')}
        >
          <Text
            style={[styles.tabButtonText, activeTab === 'definition' && styles.tabButtonTextActive]}
          >
            📌 1분 핵심 정의
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'distractors' && styles.tabButtonActive]}
          onPress={() => setActiveTab('distractors')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'distractors' && styles.tabButtonTextActive,
            ]}
          >
            🔍 오답 함정 3선
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'deep_hint' && styles.tabButtonActive]}
          onPress={() => setActiveTab('deep_hint')}
        >
          <Text
            style={[styles.tabButtonText, activeTab === 'deep_hint' && styles.tabButtonTextActive]}
          >
            🧠 심화 팁
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. 탭별 상세 내용 (창이 바뀌는 효과) */}
      <View style={styles.tabContentArea}>
        {/* [탭 1] 1분 핵심 개념 및 공식 정의 */}
        {activeTab === 'definition' && (
          <View style={styles.contentBlock}>
            <View style={styles.definitionBox}>
              <View style={styles.definitionHeaderRow}>
                <Text style={styles.definitionBadge}>핵심 정의 (Definition)</Text>
                <Text style={styles.definitionTag}>#개념완전정복</Text>
              </View>
              <Text style={styles.definitionText}>{conceptText}</Text>
            </View>

            <View style={styles.explanationBox}>
              <Text style={styles.boxSubTitle}>✅ 정답 도출 원리 및 상세 해설</Text>
              <Text style={styles.explanationBody}>{question.explanation}</Text>
            </View>
          </View>
        )}

        {/* [탭 2] 오답 선지 함정 파헤치기 */}
        {activeTab === 'distractors' && (
          <View style={styles.contentBlock}>
            <Text style={styles.distractorIntro}>
              ⚠️ 다른 3개 보기는 왜 답이 아닐까요? (출제자의 함정 노트)
            </Text>
            {question.options.map((opt, idx) => {
              const isAnswer = opt.id === question.answerOptionId;
              if (isAnswer) {
                return (
                  <View key={opt.id} style={styles.distractorItemCorrect}>
                    <View style={styles.distractorItemHeader}>
                      <Text style={styles.distractorBadgeCorrect}>선지 {idx + 1} (정답)</Text>
                      <Text style={styles.distractorTextCorrect}>{opt.text}</Text>
                    </View>
                    <Text style={styles.distractorReasonCorrect}>
                      정답 선지입니다. 문제의 출제 조건에 정확히 부합합니다.
                    </Text>
                  </View>
                );
              }

              return (
                <View key={opt.id} style={styles.distractorItemWrong}>
                  <View style={styles.distractorItemHeader}>
                    <Text style={styles.distractorBadgeWrong}>선지 {idx + 1} (오답 함정)</Text>
                    <Text style={styles.distractorTextWrong}>{opt.text}</Text>
                  </View>
                  <Text style={styles.distractorReasonWrong}>
                    💡 {opt.distractorRationale || '출제 팩트와 상충되거나 조건을 왜곡한 오답 선지입니다.'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* [탭 3] 심화 역추론 및 실전 팁 */}
        {activeTab === 'deep_hint' && (
          <View style={styles.contentBlock}>
            <View style={styles.proTipBox}>
              <Text style={styles.proTipTitle}>🚀 다음 변형 문제 대비 실전 가이드</Text>
              <Text style={styles.proTipBody}>
                {question.deepReasoningHint ||
                  '이 개념은 단골 출제 영역입니다. 단순 암기보다 "왜 이 원리가 성립하는가"를 이해해 두면 다른 난이도의 변형 문제도 쉽게 풀어낼 수 있습니다.'}
              </Text>
            </View>

            <View style={styles.memoryAnchorBox}>
              <Text style={styles.memoryAnchorTitle}>🔒 30초 장기기억 고정법</Text>
              <Text style={styles.memoryAnchorText}>
                눈을 감고 방금 확인한 [핵심 정의]의 핵심 단어 2개를 마음속으로 떠올려보세요. 지금 10초를 투자하면 다음 시험까지 기억이 유지됩니다!
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  celebrateHeader: {
    marginBottom: 12,
  },
  celebrateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  celebrateBadgeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  celebrateTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  celebrateSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  guessCheckBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  guessCheckBannerActive: {
    backgroundColor: '#172554',
    borderColor: '#3b82f6',
  },
  guessCheckIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  guessCheckContent: {
    flex: 1,
    marginRight: 8,
  },
  guessCheckTitle: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  guessCheckDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  guessPill: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  guessPillActive: {
    backgroundColor: '#3b82f6',
  },
  guessPillText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  guessPillTextActive: {
    color: '#ffffff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#3b82f6',
  },
  tabButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  tabContentArea: {
    minHeight: 140,
  },
  contentBlock: {},
  definitionBox: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  definitionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  definitionBadge: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
  },
  definitionTag: {
    color: '#64748b',
    fontSize: 11,
  },
  definitionText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  explanationBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  boxSubTitle: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  explanationBody: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
  },
  distractorIntro: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  distractorItemCorrect: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  distractorItemWrong: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  distractorItemHeader: {
    marginBottom: 4,
  },
  distractorBadgeCorrect: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  distractorBadgeWrong: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  distractorTextCorrect: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  distractorTextWrong: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  distractorReasonCorrect: {
    color: '#34d399',
    fontSize: 11,
    marginTop: 4,
  },
  distractorReasonWrong: {
    color: '#fca5a5',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  proTipBox: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 4,
    borderLeftColor: '#8b5cf6',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  proTipTitle: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  proTipBody: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 19,
  },
  memoryAnchorBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  memoryAnchorTitle: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  memoryAnchorText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
});
