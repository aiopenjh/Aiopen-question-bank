import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export interface UpdateNotificationBannerProps {
  hasUpdate: boolean;
  latestVersion?: string;
  onApplyUpdate: () => void;
  onDismiss?: () => void;
}

export const UpdateNotificationBanner: React.FC<UpdateNotificationBannerProps> = ({
  hasUpdate,
  latestVersion,
  onApplyUpdate,
  onDismiss,
}) => {
  if (!hasUpdate) return null;

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.contentRow}>
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={styles.badge}>NEW</Text>
            <Text style={styles.bannerTitle}>
              새로운 업데이트 {latestVersion ? `(${latestVersion})` : ''}
            </Text>
          </View>
          <Text style={styles.bannerSubtitle}>
            최신 개선 기능이 준비되었습니다. 1초 만에 바로 적용하세요!
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={onApplyUpdate}
            activeOpacity={0.8}
          >
            <Text style={styles.applyBtnText}>지금 갱신 ⚡</Text>
          </TouchableOpacity>

          {onDismiss && (
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissBtnText}>✕ 닫기</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1.5,
    borderBottomColor: '#93c5fd',
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 999,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  badge: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 1,
  },
  applyBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  dismissBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#1e40af',
    fontSize: 12,
    fontWeight: '700',
  },
});
