import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Topic, Unit } from '../../contracts/types';
import { styles } from './libraryStyles';

export interface LibraryTopicSummaryCardProps {
  topic: Topic;
  units: Unit[];
  unitCount?: number;
  onPress: () => void;
}

export const LibraryTopicSummaryCard: React.FC<LibraryTopicSummaryCardProps> = ({
  topic,
  units,
  unitCount: suppliedUnitCount,
  onPress,
}) => {
  const unitCount = suppliedUnitCount ?? units.filter((unit) => unit.topicId === topic.id).length;

  return (
    <TouchableOpacity
      style={styles.topicSummaryCard}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={styles.topicSummaryCopy}>
        <Text style={styles.categoryBadge}>{topic.category || '📚 일반'}</Text>
        <Text style={styles.topicSummaryTitle} numberOfLines={2}>
          {topic.name}
        </Text>
        <Text style={styles.topicSummaryMeta}>단원 {unitCount}개</Text>
      </View>
      <View style={styles.topicSummaryOpenButton}>
        <Text style={styles.topicSummaryOpenText}>과목 열기</Text>
        <Text style={styles.topicSummaryArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
};
