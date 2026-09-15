import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

interface DailyInspirationCardProps {
  apiKey?: string;
  topicName?: string;
}

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
];

export const DailyInspirationCard: React.FC<DailyInspirationCardProps> = ({
  apiKey,
  topicName,
}) => {
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);

  const getRandomLocalMessage = useCallback((): string => {
    const randomIndex = Math.floor(Math.random() * LOCAL_INSPIRATIONS.length);
    return LOCAL_INSPIRATIONS[randomIndex];
  }, []);

  const fetchAiInspiration = useCallback(async (key: string, topic?: string) => {
    setIsLoadingAi(true);
    try {
      const prompt = `학습자를 위한 따뜻하고 힘이 되는 한 줄 응원 메시지를 작성해줘.${
        topic ? ` (현재 학습 중인 과목: ${topic})` : ''
      } 조건: 한국어로 친절하고 격려하는 톤, 어울리는 이모지 포함, 50자 이내, 따옴표나 군더더기 없이 본문 한 문장만 출력.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 60,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`AI HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        setCurrentMessage(text.replace(/^["']|["']$/g, ''));
      } else {
        setCurrentMessage(getRandomLocalMessage());
      }
    } catch {
      setCurrentMessage(getRandomLocalMessage());
    } finally {
      setIsLoadingAi(false);
    }
  }, [getRandomLocalMessage]);

  const handleRefresh = () => {
    if (apiKey && apiKey.trim().length > 10) {
      fetchAiInspiration(apiKey.trim(), topicName);
    } else {
      let nextMsg = getRandomLocalMessage();
      while (nextMsg === currentMessage && LOCAL_INSPIRATIONS.length > 1) {
        nextMsg = getRandomLocalMessage();
      }
      setCurrentMessage(nextMsg);
    }
  };

  useEffect(() => {
    if (apiKey && apiKey.trim().length > 10) {
      fetchAiInspiration(apiKey.trim(), topicName);
    } else {
      setCurrentMessage(getRandomLocalMessage());
    }
  }, [apiKey, topicName, fetchAiInspiration, getRandomLocalMessage]);

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeIcon}>💌</Text>
          <Text style={styles.badgeTitle}>오늘의 응원 한마디</Text>
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={isLoadingAi}
          style={styles.refreshBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isLoadingAi ? (
            <ActivityIndicator size="small" color="#c2410c" />
          ) : (
            <Text style={styles.refreshBtnText}>🔄</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.messageText}>
        "{currentMessage || '오늘도 당신의 꿈을 향해 힘차게 나아가세요! 🌟'}"
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.2,
    borderColor: '#fed7aa',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeIcon: {
    fontSize: 16,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9a3412',
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  refreshBtnText: {
    fontSize: 13,
  },
  messageText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#431407',
    lineHeight: 21,
  },
});
