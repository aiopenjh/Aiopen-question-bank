import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { Source, QuestionRevision, Topic, Unit, ManualCompletion, ReviewState } from '../../contracts/types';
import { styles } from './libraryStyles';
import { TopicFolderCard } from './TopicFolderCard';
import { ReviewHouseSection } from './ReviewHouseSection';
import { CustomNotebookModal } from '../../components/modals/CustomNotebookModal';
import { PullRefreshIndicator } from '../../components/common/PullRefreshIndicator';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

export interface LibraryScreenProps {
  questions: QuestionRevision[];
  topics: Topic[];
  units: Unit[];
  completions: ManualCompletion[];
  onOpenTopicModal: () => void;
  onOpenUnitModal: () => void;
  onDeleteTopic: (id: string, name: string) => void;
  onToggleUnitCompletion: (unitId: string) => Promise<void>;
  onDeleteUnit: (unitId: string) => Promise<void>;
  onGenerateCurriculumForTopic: (topicId: string, topicName: string) => Promise<void>;
  onQuickGenerateForUnit: (topicId: string, topicName: string, unitId: string, unitTitle: string) => void | Promise<void>;
  onDeduplicateUnits?: (topicId: string) => Promise<void>;
  isAiGenerating?: boolean;
  generatingUnitId?: string | null;
  onStartExamWithQuestions: (questions: QuestionRevision[]) => void;
  onDeleteQuestion?: (questionId: string) => Promise<void>;

  // 당겨서 새로고침 (Pull to Refresh)
  refreshing?: boolean;
  onRefresh?: () => Promise<void> | void;

  // Review & Incorrect questions
  incorrectQuestions?: QuestionRevision[];
  reviewStates?: ReviewState[];
  onOpenSourceModal?: () => void;
  onDeleteSource?: (sourceId: string) => Promise<void>;

  // Source / Text notes
  sources: Source[];
  sourceTitle: string;
  onChangeSourceTitle: (text: string) => void;
  sourceText: string;
  onChangeSourceText: (text: string) => void;
  onSaveSource: () => Promise<void>;
  onPickSourceFile?: () => Promise<void>;
  selectedSourceTopicId?: string | null;
  onSelectSourceTopicId?: (topicId: string | null) => void;
  onOpenSettings?: () => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  questions,
  topics,
  units,
  onOpenTopicModal,
  onDeleteTopic,
  onDeleteUnit,
  onGenerateCurriculumForTopic,
  onQuickGenerateForUnit,
  onDeduplicateUnits,
  isAiGenerating = false,
  generatingUnitId = null,
  onStartExamWithQuestions,
  onDeleteQuestion,
  refreshing = false,
  onRefresh,
  incorrectQuestions = [],
  onOpenSettings,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [isCustomNotebookOpen, setIsCustomNotebookOpen] = useState(false);

  const { pullDistance, handleScroll, touchHandlers } = usePullToRefresh({
    refreshing,
    onRefresh,
  });

  // 카테고리 목록
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => {
      if (t.category) set.add(t.category);
      else set.add('📚 일반');
    });
    return ['전체', ...Array.from(set)];
  }, [topics]);

  // 필터링된 토픽
  const filteredTopics = React.useMemo(() => {
    if (selectedCategory === '전체') return topics;
    return topics.filter((t) => (t.category || '📚 일반') === selectedCategory);
  }, [topics, selectedCategory]);

  // 등록된 토픽 ID 세트
  const topicIdSet = React.useMemo(() => new Set(topics.map((t) => t.id)), [topics]);

  const handleUnitPress = (topic: Topic, unit: Unit) => {
    onQuickGenerateForUnit(topic.id, topic.name, unit.id, unit.title);
  };

  return (
    <>
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={[styles.scrollPadding, { flexGrow: 1 }]}
        bounces={true}
        alwaysBounceVertical={true}
        overScrollMode="always"
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        {...touchHandlers}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#f43f5e', '#be123c']}
              tintColor="#f43f5e"
              titleColor="#be123c"
              progressBackgroundColor="#ffffff"
              progressViewOffset={Platform.OS === 'android' ? 20 : 0}
            />
          ) : undefined
        }
      >
        {/* 화면 위로 당겨서 새로고침 인디케이터 (버튼 없는 자연스러운 제스처) */}
        <PullRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
        {/* 1. 상단 통계 및 과목 생성 헤더 */}
        <View style={styles.headerCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.headerTitle}>📁 내 학습 과목 & 문제 보관함</Text>
              <Text style={styles.headerSubtitle}>
                등록된 과목 {topics.length}개 · 총 {questions.length}문항 보관 중
              </Text>
            </View>
            <TouchableOpacity style={styles.newTopicBtn} onPress={onOpenTopicModal} activeOpacity={0.8}>
              <Text style={styles.newTopicBtnText}>+ 과목 추가</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. 대분류 카테고리 필터 칩 바 */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={{ alignItems: 'flex-start' }}
            onTouchStart={(e: any) => e.stopPropagation?.()}
            onTouchMove={(e: any) => e.stopPropagation?.()}
            onTouchEnd={(e: any) => e.stopPropagation?.()}
            {...({ 'data-horizontal-scroll': 'true' } as any)}
          >
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* 3. 과목별 문제집 (폴더 카드 리스트) */}
        {filteredTopics.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📚</Text>
            <Text style={styles.emptyTitle}>등록된 과목이 없습니다.</Text>
            <Text style={styles.emptyDesc}>
              [+ 과목 추가]를 눌러 공부하고 싶은 주제를 추가하면 체계적인 5단계 목차와 문제집이 자동 구성됩니다.
            </Text>
            <TouchableOpacity style={styles.primaryActionButton} onPress={onOpenTopicModal}>
              <Text style={styles.primaryActionText}>✨ 과목 추가하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredTopics.map((topic) => (
            <TopicFolderCard
              key={topic.id}
              topic={topic}
              units={units}
              questions={questions}
              isExpanded={expandedTopicId === topic.id}
              onToggleExpand={() => setExpandedTopicId(expandedTopicId === topic.id ? null : topic.id)}
              onStartExamWithQuestions={onStartExamWithQuestions}
              onGenerateCurriculumForTopic={onGenerateCurriculumForTopic}
              onDeduplicateUnits={onDeduplicateUnits}
              onDeleteTopic={onDeleteTopic}
              onDeleteUnit={onDeleteUnit}
              onUnitPress={handleUnitPress}
              isAiGenerating={isAiGenerating}
              generatingUnitId={generatingUnitId}
            />
          ))
        )}

        {/* 4. 오답노트 섹션 (오답노트 전용 창 열기 + 전체 보관 문제 검토) */}
        <ReviewHouseSection
          questions={questions}
          topics={topics}
          units={units}
          incorrectQuestions={incorrectQuestions}
          onDeleteQuestion={onDeleteQuestion}
          onOpenCustomNotebook={() => setIsCustomNotebookOpen(true)}
        />
      </ScrollView>

      {/* 나만의 오답노트 전용 창 (조용하고 쾌적한 학습 공간) */}
      <CustomNotebookModal
        visible={isCustomNotebookOpen}
        onClose={() => setIsCustomNotebookOpen(false)}
        questions={questions}
        topics={topics}
        onDeleteQuestion={onDeleteQuestion}
      />
    </>
  );
};
