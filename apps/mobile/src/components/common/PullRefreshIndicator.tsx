import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';

interface PullRefreshIndicatorProps {
  pullDistance: number;
  refreshing: boolean;
}

export const PullRefreshIndicator: React.FC<PullRefreshIndicatorProps> = ({
  pullDistance,
  refreshing,
}) => {
  if (pullDistance <= 0 && !refreshing) return null;

  return (
    <View style={[styles.container, { height: Math.max(pullDistance, refreshing ? 45 : 0) }]}>
      <View style={styles.bubble}>
        <ActivityIndicator size="small" color="#f43f5e" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
});
