import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';

const LOCAL_INSPIRATIONS: string[] = [
  '작은 진전도 진전입니다. 오늘 3문제로 어제보다 한 걸음 더 성장했어요! 🚀',
  '코드 한 줄, 문제 하나가 모여 대체 불가능한 실력이 됩니다. ☕',
  '모르는 것을 마주했다는 것은 배울 기회를 찾았다는 증거입니다. ✨',
  '오늘의 10분이 내일의 큰 차이를 만듭니다. 오늘도 파이팅! 🔥',
  '완벽하지 않아도 괜찮아요, 중요한 건 멈추지 않는 꾸준함입니다. 🌈',
  'Python 비동기처럼 당신의 가능성도 무한히 확장되고 있어요! ⚡',
  '틀린 문제는 내 약점을 채워주는 가장 고마운 나침반입니다. 🧭',
  '지치지 않는 비결은 오늘 할 수 있는 작은 목표에 집중하는 것입니다. 🎯',
  '공부할 때 쓴 에너지는 절대 사라지지 않고 실력으로 남습니다. 💡',
  '천천히 가도 괜찮습니다. 올바른 방향으로 나아가고 있으니까요! 🌿',
  '오늘 푼 문제들이 쌓여 언젠가 완벽한 해결책이 될 거예요. 🏆',
  '새로운 개념을 이해하는 순간의 짜릿함을 오늘도 느껴보세요! ⭐',
  '작은 습관이 모여 커다란 기적을 만듭니다. 당신을 응원해요! 🌸',
  '문제를 해결하는 기쁨, 오늘도 한 걸음 더 가까워졌습니다. 💻',
  '스스로를 믿으세요. 지금까지도 충분히 잘 해내왔습니다! 👏',
  '배움은 결코 헛되지 않는 가장 확실한 투자입니다. 💎',
  '하루 3문제의 힘, 한 달이면 90문제의 내공이 쌓입니다! 📈',
  '어려운 문제를 풀었을 때의 성취감을 오늘 다시 맛보세요! 🎈',
  '잠깐 쉬어가도 좋습니다. 포기하지만 않는다면 충분해요. 🍀',
  '오늘 하루도 나 자신을 위해 값진 노력을 더해가는 중입니다! 🌟',
  '위대한 업적은 대단한 힘이 아니라 꾸준함에서 탄생합니다. - 사무엘 존슨 🏛️',
  '시작하기 위해 위대해질 필요는 없지만, 위대해지려면 시작해야 합니다. - 레스 브라운 🏃',
  '가장 어두운 밤도 언젠가는 끝나고 해가 떠오릅니다. - 빅토르 위고 🌅',
  '나무를 심기에 가장 좋은 시간은 20년 전이었고, 두 번째로 좋은 시간은 바로 지금입니다. 🌳',
  '성공은 매일 반복되는 작은 노력들의 합화입니다. - 로버트 콜리어 🧱',
  '어려움 속에 기회가 숨어 있습니다. - 알베르트 아인슈타인 🔑',
  '단련된 자는 거센 바람을 두려워하지 않고 날아오릅니다. 오늘도 힘내요! 🦅',
  '스스로 한계를 정하지 마세요. 당신의 잠재력은 생각보다 훨씬 큽니다! 🌌',
  '버그(Bug)와 오답은 실패가 아니라 더 견고한 실력으로 가는 디딤돌입니다. 🛠️',
  '지식에 투자하는 것이 언제나 최고의 이자를 냅니다. - 벤자민 프랭클린 🪙',
  '오늘 심은 배움의 씨앗은 내일 커다란 숲이 될 거예요. 🌱',
  '남들과 비교하지 마세요. 어제의 나와 비교하며 1%만 성장하면 충분합니다! 🥇',
  '탁월함은 일회성 행동이 아니라 하나의 습관입니다. - 아리스토텔레스 🎯',
  '시작하는 용기, 버티는 인내, 끝내는 집중력이 당신을 빛나게 합니다. ✨',
  '넘어지는 것은 부끄러운 일이 아니지만, 일어서지 않는 것은 부끄러운 일입니다. 🥊',
  '매일 아침의 3문제, 당신의 인생을 바꿀 강력한 나비효과입니다! 🦋',
  '포기하고 싶을 때가 바로 목표에 가장 가까워진 순간입니다. 한 걸음만 더! 🏁',
  '비 온 뒤에 땅이 굳듯이, 고민한 문제 뒤에 진짜 실력이 굳어집니다. ☔',
  '오늘의 노력이 내일의 당신을 감동시킬 거예요. 당신을 진심으로 응원합니다! 💖',
  '세상을 움직이려면 먼저 나 자신부터 움직여야 합니다. - 소크라테스 🌍',
  '당신이 걸어가는 그 길이 곧 당신만의 멋진 정답이 됩니다. 믿고 나아가세요! 🧭',
];

function getRandomLocalMessage(): string {
  const randomIndex = Math.floor(Math.random() * LOCAL_INSPIRATIONS.length);
  return LOCAL_INSPIRATIONS[randomIndex];
}

export const DailyInspirationCard: React.FC = () => {
  const [currentMessage, setCurrentMessage] = useState<string>(getRandomLocalMessage);

  const handleRefresh = () => {
    let nextMsg = getRandomLocalMessage();
    while (nextMsg === currentMessage && LOCAL_INSPIRATIONS.length > 1) {
      nextMsg = getRandomLocalMessage();
    }
    setCurrentMessage(nextMsg);
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeIcon}>✦</Text>
          <Text style={styles.badgeTitle}>오늘의 문장</Text>
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.refreshBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.messageText}>
        {currentMessage || '오늘도 당신의 꿈을 향해 힘차게 나아가세요! 🌟'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeIcon: {
    color: colors.gold,
    fontSize: 14,
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  refreshBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnText: {
    color: colors.gold,
    fontSize: 17,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    lineHeight: 20,
  },
});
