import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';

export interface UserManualModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  visible,
  onClose,
}) => {
  // 처음에는 4개 제목만 깔끔하게 보이고, 누르면 해당 항목이 열림
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const sections = [
    {
      id: 'upload',
      icon: '📁',
      title: '교재 업로드 가이드',
      subtitle: '구글드라이브/카톡 파일 넣기, TXT/ZIP 추천, HWP 변환법',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>📲 1. 스마트폰에 교재 파일 쉽게 넣는 법</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>클라우드 연동 (가장 편리 ⭐)</Text>: PC에서 구글 드라이브(Google Drive), OneDrive, 또는 카카오톡 '나와의 채팅'에 교재를 올려두세요. 앱에서 파일 첨부를 누른 뒤 구글 드라이브를 탭하면 폰 용량 없이 바로 첨부됩니다.{'\n'}
              • <Text style={styles.bold}>다운로드 폴더</Text>: 스마트폰 웹에서 다운받은 파일은 [다운로드] 폴더에서 즉시 선택할 수 있습니다.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>📑 2. 추천 파일 형식</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>TXT, MD, ZIP (강력 추천 ⭐)</Text>: 원본 텍스트가 100% 온전하게 AI에게 전달되어 문제 출제 적중률이 가장 높습니다.{'\n'}
              • <Text style={styles.bold}>PDF 파일</Text>: PDF 문서 첨부 지원. 텍스트 추출 정확도를 극대화하려면 텍스트(.txt)로 저장하여 올리시는 것을 권장합니다.
            </Text>
          </View>

          <View style={[styles.tipBox, styles.cautionBox]}>
            <Text style={[styles.tipTitle, { color: '#991b1b' }]}>⚠️ 3. 한글 문서(.hwp, .hwpx) 주의사항</Text>
            <Text style={[styles.tipText, { color: '#7f1d1d' }]}>
              • 한글 문서는 AI가 직접 읽을 수 없는 특수 규격입니다.{'\n'}
              • 한글 프로그램에서 <Text style={styles.bold}>[파일 ➔ 다른 이름으로 저장 ➔ PDF 또는 텍스트(.txt)]</Text>로 변환하신 후 첨부해 주세요.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'curriculum',
      icon: '🎯',
      title: '30단계 목차 학습법',
      subtitle: '5단계 마이크로 스텝 원리 및 입문 vs 실전 레벨 가이드',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🪜 1. 30단계 촘촘한 마이크로 스텝</Text>
            <Text style={styles.tipText}>
              • 한 번에 많은 양을 공부하다 지치지 않도록, 5개 단원씩 '촘촘한 계단(Micro-Step)'으로 분할 설계됩니다.{'\n'}
              • 1단계(01~05단원)를 마치면 [🚀 다음 5단계 목차 생성]을 눌러 30단원 마스터까지 계속 진도를 확장하세요.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🎯 2. 학습자 난이도 수준 선택 가이드</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>입문 / 기본</Text>: 기초 용어부터 정규 교과과정을 01단원부터 차근차근 밟아나가는 정석 코스입니다.{'\n'}
              • <Text style={styles.bold}>실전</Text>: 뻔한 기초 개념은 생략하고, 대학교 3학년 및 실제 시험 기출 함정/디버깅 문제부터 바로 시작하는 월반(편입) 패스트트랙입니다.{'\n'}
              • <Text style={styles.bold}>심화</Text>: 고난도 킬러 문항 및 융합 추론 중심의 전문가 코스입니다.
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
              • 문제를 풀다가 나중에 꼭 다시 보고 싶은 중요한 문제는 <Text style={styles.bold}>[☆ 기억하기]</Text> 버튼을 누르세요.{'\n'}
              • 과목자료함의 [⭐ 나만의 오답노트]에 담겨, 시험 직전 나만의 핵심 족보로 집중 복습할 수 있습니다.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>📝 2. 전체 CBT 검증 후 넘어가기</Text>
            <Text style={styles.tipText}>
              • 다음 단계 단원을 추가하기 전, 지금까지 풀고 쌓아둔 해당 과목의 모든 기존 문제들을 실전 CBT 시험장 형태로 한 번에 총정리 복습할 수 있습니다.
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: 'backup',
      icon: '💾',
      title: '백업 & 데이터 보안',
      subtitle: '100% 로컬 프라이버시 및 기기 변경 시 데이터 이동 방법',
      content: (
        <View style={styles.detailContainer}>
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>🔒 1. 100% 로컬 프라이버시 보장</Text>
            <Text style={styles.tipText}>
              • Celueste는 외부 중앙 서버에 사용자의 개인 학습 데이터나 교재를 수집하지 않습니다.{'\n'}
              • 모든 과목, 단원, 문제, 오답노트는 고객님의 스마트폰 내부 저장소에만 안전하게 보관됩니다.
            </Text>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>💾 2. 스마트폰 변경 시 데이터 이동 방법</Text>
            <Text style={styles.tipText}>
              • <Text style={styles.bold}>[설정 ➔ 백업 파일 내보내기]</Text>를 누르면 지금까지의 모든 학습 데이터가 파일로 안전하게 저장됩니다.{'\n'}
              • 새 폰에서 앱을 켜고 <Text style={styles.bold}>[설정 ➔ 백업 파일 복원하기]</Text>를 누르면 1초 만에 이전 학습 기록이 그대로 복원됩니다.
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
        {...(Platform.OS === 'web' ? ({ onClick: onClose } as any) : {})}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalCard}
          onPress={(e) => e.stopPropagation?.()}
          {...(Platform.OS === 'web' ? ({ onClick: (e: any) => e.stopPropagation?.() } as any) : {})}
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
              {...(Platform.OS === 'web' ? ({ onClick: onClose } as any) : {})}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>← 뒤로</Text>
            </TouchableOpacity>
          </View>

          {/* 깔끔한 4개 아코디언 메뉴 목록 */}
          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {sections.map((sec) => {
              const isExpanded = expandedSection === sec.id;
              return (
                <View key={sec.id} style={[styles.menuItemCard, isExpanded && styles.menuItemCardExpanded]}>
                  <TouchableOpacity
                    style={styles.menuItemHeader}
                    onPress={() => toggleSection(sec.id)}
                    {...(Platform.OS === 'web' ? ({ onClick: () => toggleSection(sec.id) } as any) : {})}
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
            {...(Platform.OS === 'web' ? ({ onClick: onClose } as any) : {})}
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    borderColor: '#fda4af',
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
    color: '#881337',
  },
  subtitle: {
    fontSize: 11.5,
    color: '#9f1239',
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
    borderColor: '#fecdd3',
    marginBottom: 10,
    overflow: 'hidden',
  },
  menuItemCardExpanded: {
    borderColor: '#f43f5e',
    backgroundColor: '#fffbfe',
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
    backgroundColor: '#f43f5e',
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
    backgroundColor: '#f43f5e',
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
