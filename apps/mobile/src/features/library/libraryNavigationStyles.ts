import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../styles/designTokens';

export const libraryNavigationStyles = StyleSheet.create({
  topicList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  topicSummaryCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
  },
  topicSummaryCopy: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: spacing.md,
  },
  topicSummaryTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    marginTop: 7,
  },
  topicSummaryMeta: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 4,
  },
  topicSummaryOpenButton: {
    minWidth: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#DFC2CB',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  topicSummaryOpenText: {
    color: colors.primaryPressed,
    fontSize: 12,
    fontWeight: '800',
  },
  topicSummaryArrow: {
    color: colors.primaryPressed,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '800',
    marginLeft: 5,
  },
  topicDetailNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  topicBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  topicBackButtonText: {
    color: colors.primaryPressed,
    fontSize: 12,
    fontWeight: '800',
  },
  topicDetailHint: {
    flex: 1,
    color: colors.inkMuted,
    fontSize: 11,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },
});
