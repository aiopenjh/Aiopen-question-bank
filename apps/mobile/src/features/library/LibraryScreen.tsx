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
import { LibraryTopicSummaryCard } from './LibraryTopicSummaryCard';
import { ReviewHouseSection } from './ReviewHouseSection';
import { CustomNotebookModal } from '../../components/modals/CustomNotebookModal';
import { PullRefreshIndicator } from '../../components/common/PullRefreshIndicator';
import { StateIllustration } from '../../components/common/StateIllustration';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

export interface LibraryScreenProps {
  isActive?: boolean;
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
  onSaveSource: () => Promise<boolean>;
  onPickSourceFile?: () => Promise<void>;
  selectedSourceTopicId?: string | null;
  onSelectSourceTopicId?: (topicId: string | null) => void;
  onOpenSettings?: () => void;
  openCustomNotebookRequest?: number;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  isActive = false,
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
  openCustomNotebookRequest = 0,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [selectedLibraryTopicId, setSelectedLibraryTopicId] = useState<string | null>(null);
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [isCustomNotebookOpen, setIsCustomNotebookOpen] = useState(false);
  const [customNotebookRevision, setCustomNotebookRevision] = useState(0);
  const lastHandledCustomNotebookRequest = React.useRef(0);
  const scrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    if (
      isActive &&
      openCustomNotebookRequest > lastHandledCustomNotebookRequest.current
    ) {
      lastHandledCustomNotebookRequest.current = openCustomNotebookRequest;
      setIsCustomNotebookOpen(true);
    }
  }, [isActive, openCustomNotebookRequest]);

  React.useEffect(() => {
    if (!isActive) {
      setIsCustomNotebookOpen(false);
      setSelectedLibraryTopicId(null);
      setIsQuestionBankOpen(false);
    }
  }, [isActive]);

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

  const selectedLibraryTopic = React.useMemo(
    () => topics.find((topic) => topic.id === selectedLibraryTopicId) || null,
    [topics, selectedLibraryTopicId]
  );
  const selectedTopicUnits = React.useMemo(
    () => units.filter((unit) => unit.topicId === selectedLibraryTopicId),
    [units, selectedLibraryTopicId]
  );
  const selectedTopicQuestions = React.useMemo(
    () => questions.filter((question) => question.topicId === selectedLibraryTopicId),
    [questions, selectedLibraryTopicId]
  );
  React.useEffect(() => {
    if (selectedLibraryTopicId && !selectedLibraryTopic) {
      setSelectedLibraryTopicId(null);
    }
  }, [selectedLibraryTopic, selectedLibraryTopicId]);

  const showTopicList = () => {
    setSelectedLibraryTopicId(null);
    setIsQuestionBankOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const showTopicDetail = (topicId: string) => {
    setIsQuestionBankOpen(false);
    setSelectedLibraryTopicId(topicId);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const showQuestionBank = () => {
    setSelectedLibraryTopicId(null);
    setIsQuestionBankOpen(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleUnitPress = (topic: Topic, unit: Unit) => {
    onQuickGenerateForUnit(topic.id, topic.name, unit.id, unit.title);
  };

  return (
    <>
      <ScrollView
        ref={scrollRef}
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
        {/* 자료함 요약 */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerEyebrow}>MY LIBRARY</Text>
              <Text style={styles.headerTitle}>학습 자료함</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.questionBankBtn, isQuestionBankOpen && styles.questionBankBtnActive]}
                onPress={showQuestionBank}
                activeOpacity={0.8}
              >
                <Text style={[styles.questionBankBtnText, isQuestionBankOpen && styles.questionBankBtnTextActive]}>
                  문제 보관함
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.newTopicBtn} onPress={onOpenTopicModal} activeOpacity={0.8}>
                <Text style={styles.newTopicBtnText}>+ 과목 추가</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.headerSubtitle}>
            {isQuestionBankOpen
              ? '출제한 문제를 과목과 단원별로 확인하고 관리하세요.'
              : selectedLibraryTopic
                ? '선택한 과목의 단원과 문제만 집중해서 관리하세요.'
                : '과목을 선택하면 해당 과목의 단원과 문제만 표시됩니다.'}
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{topics.length}</Text>
              <Text style={styles.summaryLabel}>과목</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{units.length}</Text>
              <Text style={styles.summaryLabel}>단원</Text>
            </View>
          </View>
        </View>

        {isQuestionBankOpen ? (
          <View>
            <View style={styles.topicDetailNavigation}>
              <TouchableOpacity
                style={styles.topicBackButton}
                onPress={showTopicList}
                activeOpacity={0.75}
              >
                <Text style={styles.topicBackButtonText}>← 과목 목록</Text>
              </TouchableOpacity>
              <Text style={styles.topicDetailHint}>전체 문제를 과목과 단원별로 관리합니다.</Text>
            </View>
            <ReviewHouseSection
              mode="bank"
              questions={questions}
              topics={topics}
              units={units}
              incorrectQuestions={incorrectQuestions}
              onDeleteQuestion={onDeleteQuestion}
              refreshCustomNotesRequest={customNotebookRevision}
            />
          </View>
        ) : selectedLibraryTopic ? (
          <View>
            <View style={styles.topicDetailNavigation}>
              <TouchableOpacity
                style={styles.topicBackButton}
                onPress={showTopicList}
                activeOpacity={0.75}
              >
                <Text style={styles.topicBackButtonText}>← 과목 목록</Text>
              </TouchableOpacity>
              <Text style={styles.topicDetailHint}>단원을 눌러 출제하거나 문제를 풀어보세요.</Text>
            </View>

            <TopicFolderCard
              topic={selectedLibraryTopic}
              units={selectedTopicUnits}
              questions={selectedTopicQuestions}
              isExpanded={true}
              onToggleExpand={showTopicList}
              showAccordionControl={false}
              onStartExamWithQuestions={onStartExamWithQuestions}
              onGenerateCurriculumForTopic={onGenerateCurriculumForTopic}
              onDeduplicateUnits={onDeduplicateUnits}
              onDeleteTopic={onDeleteTopic}
              onDeleteUnit={onDeleteUnit}
              onUnitPress={handleUnitPress}
              isAiGenerating={isAiGenerating}
              generatingUnitId={generatingUnitId}
            />

          </View>
        ) : (
          <View>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={styles.sectionTitle}>과목 목록</Text>
                <Text style={styles.sectionDescription}>학습할 과목을 선택하면 해당 단원만 정리해서 보여드립니다.</Text>
              </View>
            </View>

            {categories.length > 1 && (
              <View style={styles.categoryWrap}>
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
              </View>
            )}

            {filteredTopics.length === 0 ? (
              <View style={styles.emptyCard}>
                <StateIllustration kind="emptyLibrary" width={132} style={styles.emptyIllustration} />
                <Text style={styles.emptyTitle}>첫 과목을 준비해 보세요</Text>
                <Text style={styles.emptyDesc}>
                  공부할 과목을 등록하면 목차를 구성하고 단원별 문제를 만들 수 있습니다.
                </Text>
                <TouchableOpacity style={styles.primaryActionButton} onPress={onOpenTopicModal}>
                  <Text style={styles.primaryActionText}>과목 추가하기</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.topicList}>
                {filteredTopics.map((topic) => (
                  <LibraryTopicSummaryCard
                    key={topic.id}
                    topic={topic}
                    units={units}
                    onPress={() => showTopicDetail(topic.id)}
                  />
                ))}
              </View>
            )}

          </View>
        )}
      </ScrollView>

      {/* 나만의 오답노트 전용 창 (조용하고 쾌적한 학습 공간) */}
      <CustomNotebookModal
        visible={isCustomNotebookOpen}
        onClose={() => setIsCustomNotebookOpen(false)}
        questions={questions}
        topics={topics}
        onCustomNoteChanged={() => setCustomNotebookRevision((revision) => revision + 1)}
      />
    </>
  );
};
