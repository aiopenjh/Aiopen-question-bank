import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { UniversalModal as Modal } from '../common/UniversalModal';
import { colors } from '../../styles/designTokens';
import { USER_MANUAL_SECTIONS } from './userManualSections';

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

  useEffect(() => {
    if (!visible) setExpandedSection(null);
  }, [visible]);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

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
          <View style={styles.headerRow}>
            <View style={styles.headerCopyRow}>
              <View style={styles.headerIconBadge}>
                <Text style={styles.headerIcon}>📖</Text>
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>사용설명서</Text>
                <Text style={styles.subtitle}>필요한 항목을 눌러 확인하세요</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>닫기 ×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {USER_MANUAL_SECTIONS.map((sec) => {
              const isExpanded = expandedSection === sec.id;
              return (
                <View key={sec.id} style={[styles.menuItemCard, isExpanded && styles.menuItemCardExpanded]}>
                  <TouchableOpacity
                    style={styles.menuItemHeader}
                    onPress={() => toggleSection(sec.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuLeft}>
                      <View style={styles.menuIconBadge}>
                        <Text style={styles.menuIcon}>{sec.icon}</Text>
                      </View>
                      <View style={styles.menuCopy}>
                        <Text style={styles.menuTitle}>{sec.title}</Text>
                        <Text style={styles.menuSubtitle} numberOfLines={1}>{sec.subtitle}</Text>
                      </View>
                    </View>
                    <Text style={[styles.arrowText, isExpanded && styles.arrowTextExpanded]}>
                      {isExpanded ? '⌃' : '⌄'}
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && sec.content}
                </View>
              );
            })}
          </ScrollView>

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
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCopyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  headerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: 10,
  },
  headerIcon: {
    fontSize: 17,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  subtitle: {
    fontSize: 11.5,
    color: colors.inkMuted,
    marginTop: 2,
  },
  closeBtn: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.inkMuted,
  },
  menuScroll: {
    maxHeight: 590,
  },
  menuScrollContent: {
    paddingBottom: 4,
  },
  menuItemCard: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemCardExpanded: {
    backgroundColor: colors.surfaceMuted,
  },
  menuItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  menuIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: 10,
  },
  menuIcon: {
    fontSize: 16,
  },
  menuCopy: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  menuSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.inkMuted,
    marginTop: 2,
  },
  arrowText: {
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '800',
    color: colors.primary,
  },
  arrowTextExpanded: {
    color: colors.primaryPressed,
  },
});
