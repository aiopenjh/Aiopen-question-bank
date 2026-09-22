import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { colors } from '../../styles/designTokens';

export interface UserManualModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  visible,
  onClose,
}) => {
  // 처음에는 제목만 깔끔하게 보이고, 누르면 해당 항목이 열림
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const sections = [
    {
      id: 'start',
      icon: '✨',
      title: '처음 시작 & 문제 출제',
      subtitle: 'API 키 등록부터 자유 주제 4지선다 문제 만들기까지',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🔑 1. 내 API 키 연결하기</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>[설정 ➔ AI 연결]</Text>에서 본인의 API 키를 저장합니다. 키가 없으면 가짜 문제를 만들지 않고 연결 안내를 표시합니다.{'\n'}
              • Gemini는 3.5 이상 모델만 사용하며 일반 화면에는 모델명을 별도 표시하지 않습니다.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🧩 2. 자유 주제로 문제 만들기</Text>
            <Text style={styles.tipText}>
              • 메인 화면 또는 <Text style={styles.bold}>[자료함 ➔ 과목 추가]</Text>에서 자격증, 언어, 게임, 동식물 등 원하는 주제를 입력합니다.{'\n'}
              • 과목과 시작 레벨을 정하면 첫 5개 단원이 구성됩니다. 단원을 고른 뒤 문항 수와 레벨을 확인하면 1~4번 4지선다 문제가 생성됩니다.{'\n'}
              • 출제 중 취소하면 진행 중인 요청과 저장을 중단합니다. 요청 한도(429)나 무응답이 발생하면 잠시 기다린 뒤 다시 시도해 주세요.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🏛️ 3. 최신 세율·법령 문제</Text>
            <Text style={styles.tipText}>
              • 세율, 부동산법, 법령처럼 바뀔 수 있는 주제는 출제할 때 공식 정부 자료를 검색해 현재 시행 중인 내용만 사용합니다.{`\n`}
              • 풀이 결과와 문제 보관함에서 기준일, 공식 기관과 원문 링크를 확인할 수 있습니다.{`\n`}
              • 공식 근거를 확인하지 못하면 문제를 임의로 만들지 않고 출제를 중단합니다. 이 기능은 Google 검색을 지원하는 Gemini API 키가 필요합니다.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'upload',
      icon: '📁',
      title: '교재 업로드 가이드',
      subtitle: '내 파일 연결, PDF 페이지 분할과 API 사용 안내',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>📲 1. 스마트폰에 교재 파일 쉽게 넣는 법</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>클라우드 파일 선택</Text>: PC에서 구글 드라이브, OneDrive 또는 카카오톡 '나와의 채팅'에 교재를 보관한 뒤 기기의 파일 선택 화면에서 불러올 수 있습니다.{'\n'}
              • <Text style={styles.bold}>다운로드 폴더</Text>: 스마트폰 웹에서 다운받은 파일은 [다운로드] 폴더에서 즉시 선택할 수 있습니다.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>📑 2. 추천 파일 형식</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>TXT, MD, CSV, JSON</Text>: 실제 본문을 읽어 등록하므로 문제 출제 자료로 가장 적합합니다.{'\n'}
              • <Text style={styles.bold}>ZIP</Text>: 압축 안의 TXT, MD, CSV, JSON 텍스트 파일을 함께 불러옵니다.{'\n'}
              • <Text style={styles.bold}>PDF</Text>: 기기에서 페이지 수를 확인하고 선택한 페이지를 목차·문제 생성 요청에 함께 전달합니다. 파일 원본과 전체 본문은 저장하지 않습니다.{'\n'}
              • <Text style={styles.bold}>자료함 ➔ 과목 추가 ➔ 내 파일 불러오기</Text>에서 등록한 자료를 과목에 연결하면 해당 자료를 기준으로 단원과 문제를 만듭니다. 앱을 다시 연 뒤 PDF를 사용할 때는 같은 원본 파일을 다시 선택해야 합니다.{'\n'}
              • 30페이지가 넘는 PDF는 10~20페이지씩 나누고, 문제도 한 번에 3~5문항씩 생성하는 것을 권장합니다. 하루 누적 15문항을 넘기면 무료 할당량 소진이나 429 제한이 발생할 수 있습니다.
            </Text>
          </View>

          <View style={[styles.tipBox, styles.cautionBox]}>
            <Text style={[styles.tipTitle, { color: '#991b1b' }]}>⚠️ 3. 한글 문서(.hwp, .hwpx) 주의사항</Text>
            <Text style={[styles.tipText, { color: '#7f1d1d' }]}>
              • 한글 문서는 현재 앱이 본문을 직접 읽지 못합니다.{'\n'}
              • 한글 프로그램에서 <Text style={styles.bold}>[파일 ➔ 다른 이름으로 저장 ➔ PDF 또는 텍스트(.txt)]</Text>로 변환하신 후 첨부해 주세요.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'curriculum',
      icon: '🎯',
      title: '30단원 이상 목차 학습법',
      subtitle: '5개 단원씩 확장하는 방법과 1~30 이상 난이도 레벨 가이드',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🪜 1. 30단원 이상 촘촘한 학습 목차</Text>
            <Text style={styles.tipText}>
              • 한 번에 많은 양을 공부하다 지치지 않도록, 5개 단원씩 '촘촘한 계단(Micro-Step)'으로 분할 설계됩니다.{'\n'}
              • 01~05단원을 마치면 [🚀 다음 5개 단원 생성]을 눌러 30단원 이후까지 계속 진도를 확장하세요.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🎯 2. 문제 난이도 레벨 선택 가이드</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>레벨 1~10</Text>: 필수 용어와 핵심 차이를 작은 간격으로 익힙니다.{'\n'}
              • <Text style={styles.bold}>레벨 11~20</Text>: 기본 적용에서 응용 판단까지 점진적으로 넓힙니다.{'\n'}
              • <Text style={styles.bold}>레벨 21~30</Text>: 세부 조건, 오개념 판별, 종합 추론을 다룹니다.{'\n'}
              • <Text style={styles.bold}>레벨 31 이상</Text>: 난이도만 올리지 않고 새로운 사례와 관점으로 범위를 확장합니다. 정답률로 레벨이 자동 변경되지는 않습니다.{'\n'}
              • <Text style={styles.bold}>단원별 레벨 유지</Text>: 첫 출제는 과목의 시작 레벨을 사용합니다. 이후 원하는 레벨을 고르고 3문제 또는 5문제를 누른 뒤 변경 방식을 선택하면 해당 단원에 저장되어 앱을 다시 열어도 유지됩니다.{'\n'}
              • <Text style={styles.bold}>문제 유지·삭제</Text>: <Text style={styles.bold}>기존문제유지 + 레벨변경</Text>은 새 문제를 누적하고, <Text style={styles.bold}>기존문제삭제 + 레벨변경</Text>은 새 문제 저장이 성공한 뒤 해당 단원의 이전 문제만 삭제합니다. 취소하거나 설정창을 닫으면 선택한 레벨은 저장되지 않습니다.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'exam',
      icon: '📝',
      title: 'CBT & 오답노트 활용법',
      subtitle: '나만의 오답노트 찜하기 및 전체 CBT 검증 모의고사',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>⭐ 1. 나만의 오답노트 활용법</Text>
            <Text style={styles.tipText}>
              • 문제 보관함에서 다시 보고 싶은 문제의 <Text style={styles.bold}>[오답노트 저장]</Text>을 누르세요.{'\n'}
              • 메인 화면의 <Text style={styles.bold}>[나만의 오답노트]</Text>에서 저장한 문제만 모아 집중 복습할 수 있습니다.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>📝 2. 전체 CBT 검증 후 넘어가기</Text>
            <Text style={styles.tipText}>
              • 다음 단계 단원을 추가하기 전, 지금까지 풀고 쌓아둔 해당 과목의 모든 기존 문제들을 실전 CBT 시험장 형태로 한 번에 총정리 복습할 수 있습니다.
              {'\n'}• 과목 전체 삭제는 과목 카드의 <Text style={styles.bold}>[과목 삭제]</Text>, 단원 삭제는 목차를 펼친 뒤 해당 단원의 삭제 버튼에서 실행합니다. 삭제한 데이터는 복구할 수 없으므로 먼저 백업하세요.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'settings',
      icon: '⚙️',
      title: '학습 목표 & 알림 설정',
      subtitle: '일일 문항 저장, 아침·저녁 알림, 당겨서 새로고침',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🎯 1. 일일 학습 목표 저장</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>[설정 ➔ 학습 루틴]</Text>에서 1~30 사이의 목표 문항 수를 입력하거나 화살표로 조절합니다.{'\n'}
              • 숫자를 바꾼 뒤 <Text style={styles.bold}>[목표 n문항 저장]</Text>을 누르면 메인 화면의 일일 달성 기준에 반영됩니다.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>⏰ 2. 아침·저녁 학습 알림</Text>
            <Text style={styles.tipText}>
              • 알림 요일과 아침·저녁 시간을 직접 선택합니다. 기기 또는 브라우저의 알림 권한이 허용되어야 합니다.{'\n'}
              • 알림을 누르면 앱으로 이동하지만 단원이나 문제를 자동 시작하지 않습니다. 자료함에서 원하는 학습 대상을 직접 선택하세요.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>↻ 3. 화면 새로고침</Text>
            <Text style={styles.tipText}>
              • 메인, 자료함, 설정 화면의 맨 위에서 아래로 당기면 저장된 최신 학습 데이터를 다시 불러옵니다.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'backup',
      icon: '💾',
      title: '백업 & 데이터 보안',
      subtitle: '로컬 저장, ZIP/JSON 백업과 홈 화면 추가 방법',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🔒 1. 로컬 학습 데이터</Text>
            <Text style={styles.tipText}>
              • Celueste는 외부 중앙 서버에 사용자의 개인 학습 데이터나 교재를 수집하지 않습니다.{'\n'}
              • 웹에서는 과목, 단원, 문제와 풀이 기록을 현재 기기의 개인 IndexedDB에 자동 보관합니다. 별도로 DB를 만들거나 설정할 필요가 없습니다. 브라우저 데이터 삭제나 앱 초기화 전에는 백업 파일을 만들어 두세요.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>💾 2. 스마트폰 변경 시 데이터 이동 방법</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>[설정 ➔ 백업/출력]</Text>은 API 키를 제외한 학습 데이터와 인쇄용 문제지·해설지를 ZIP으로 저장합니다.{'\n'}
              • 새 기기의 <Text style={styles.bold}>[설정 ➔ 복원]</Text>에서 ZIP 또는 JSON을 선택하면 형식을 검사한 뒤 학습 기록을 복원합니다. API 키는 새 기기에서 다시 등록합니다.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>📱 3. 홈 화면에 앱 아이콘 추가</Text>
            <Text style={styles.tipText}>
              • Android Chrome은 메뉴의 <Text style={styles.bold}>[홈 화면에 추가]</Text>, iPhone Safari는 공유 메뉴의 <Text style={styles.bold}>[홈 화면에 추가]</Text>를 사용합니다.{'\n'}
              • 이전 바로가기가 기본 아이콘으로 보이면 기존 바로가기를 삭제한 뒤 다시 추가하세요.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>⚠️ 4. 학습 데이터 삭제 방법</Text>
            <Text style={styles.tipText}>
              • 가장 확실한 방법은 앱의 <Text style={styles.bold}>[설정 ➔ 데이터 관리 ➔ 전체 데이터 초기화]</Text>를 먼저 실행한 뒤 홈 화면 아이콘을 삭제하는 것입니다. 과목, 단원, 문제, 풀이 기록과 등록한 API 키가 함께 삭제되며 복구할 수 없습니다.{'\n'}
              • 추후 복구를 원하시면 전체 초기화 전에 <Text style={styles.bold}>[백업/출력]</Text>에서 백업 데이터를 저장해 두시길 권장합니다.{'\n'}
              • 홈 화면 아이콘만 삭제하는 것으로는 학습 데이터 삭제가 보장되지 않습니다. 같은 브라우저에서 기존 주소를 다시 열면 데이터가 남아 있을 수 있습니다.{'\n'}
              • 앱에서 초기화하지 못한 경우에는 Android Chrome 또는 iPhone Safari 설정의 <Text style={styles.bold}>웹사이트 데이터</Text>에서 <Text style={styles.bold}>aiopenjh.github.io</Text> 항목을 삭제하세요.
            </Text>
          </View>
        </View>
      ),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.overlay}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalCard}
          onPress={(e) => e.stopPropagation?.()}
        >
          {/* 모달 헤더 */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 22 }}>📖</Text>
              <View>
                <Text style={styles.title}>앱 공식 이용 가이드</Text>
                <Text style={styles.subtitle}>궁금한 항목을 터치하면 상세 설명이 펼쳐집니다</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>← 뒤로</Text>
            </TouchableOpacity>
          </View>

          {/* 아코디언 메뉴 목록 */}
          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {sections.map((sec) => {
              const isExpanded = expandedSection === sec.id;
              return (
                <View key={sec.id} style={[styles.menuItemCard, isExpanded && styles.menuItemCardExpanded]}>
                  <TouchableOpacity
                    style={styles.menuItemHeader}
                    onPress={() => toggleSection(sec.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuLeft}>
                      <Text style={styles.menuIcon}>{sec.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.menuTitle}>{sec.title}</Text>
                        <Text style={styles.menuSubtitle} numberOfLines={1}>{sec.subtitle}</Text>
                      </View>
                    </View>
                    <View style={[styles.arrowBadge, isExpanded && styles.arrowBadgeExpanded]}>
                      <Text style={[styles.arrowText, isExpanded && styles.arrowTextExpanded]}>
                        {isExpanded ? '접기 ▲' : '열기 ▼'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* 펼쳤을 때 나오는 상세 설명 내용 */}
                  {isExpanded && sec.content}
                </View>
              );
            })}
          </ScrollView>

          {/* 하단 확인 닫기 버튼 */}
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmBtnText}>닫기</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(64, 48, 56, 0.44)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 2,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  subtitle: {
    fontSize: 11.5,
    color: colors.inkMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b',
  },
  menuScroll: {
    maxHeight: 520,
  },
  menuItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  menuItemCardExpanded: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  menuItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  menuIcon: {
    fontSize: 22,
  },
  menuTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#881337',
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#9f1239',
    marginTop: 2,
  },
  arrowBadge: {
    backgroundColor: '#fff1f4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fda4af',
  },
  arrowBadgeExpanded: {
    backgroundColor: colors.primaryPressed,
    borderColor: '#f43f5e',
  },
  arrowText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#be123c',
  },
  arrowTextExpanded: {
    color: '#ffffff',
  },
  detailContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#ffe4e6',
    paddingTop: 12,
  },
  tipBox: {
    backgroundColor: '#fff7f8',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffe4e6',
  },
  cautionBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  tipTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#881337',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 11.5,
    color: '#4b5563',
    lineHeight: 18,
  },
  bold: {
    fontWeight: 'bold',
    color: '#1f2937',
  },
  confirmBtn: {
    backgroundColor: colors.primaryPressed,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
