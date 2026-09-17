import { StyleSheet } from 'react-native';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';

export const quizCountModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(64, 48, 56, 0.44)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  closeButtonText: {
    color: colors.inkMuted,
    fontSize: 24,
    lineHeight: 25,
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  currentLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.lg,
  },
  levelMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: spacing.sm,
  },
  levelMarkText: {
    fontSize: 15,
  },
  currentLevelCopy: {
    flex: 1,
  },
  currentLevelLabel: {
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  currentLevelValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  originTag: {
    color: colors.primaryPressed,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  lockedLevelNote: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  adjustableLevelNote: {
    color: colors.inkMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: spacing.sm,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHint: {
    color: colors.inkMuted,
    fontSize: 10,
  },
  resetText: {
    color: colors.primaryPressed,
    fontSize: 10,
    fontWeight: '700',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 6,
  },
  levelChip: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  levelChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  levelChipIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  levelChipText: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  levelChipTextActive: {
    color: colors.primaryPressed,
    fontWeight: '800',
  },
  countSectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  countList: {
    gap: spacing.sm,
  },
  countCard: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  countCardRecommended: {
    borderColor: '#DFC2CB',
    backgroundColor: '#FFFBFC',
  },
  countNumberBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: spacing.md,
  },
  countNumber: {
    color: colors.primaryPressed,
    fontSize: 16,
    fontWeight: '900',
  },
  countCopy: {
    flex: 1,
    minWidth: 0,
  },
  countTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  countMeta: {
    marginLeft: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  countMetaRecommended: {
    backgroundColor: colors.primarySoft,
  },
  countMetaText: {
    color: colors.inkMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  countMetaTextRecommended: {
    color: colors.primaryPressed,
  },
  countDescription: {
    color: colors.inkMuted,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 3,
  },
  countArrow: {
    color: colors.primary,
    fontSize: 22,
    marginLeft: spacing.sm,
  },
  backupNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.mintSoft,
  },
  backupNoticeIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  backupNoticeCopy: {
    flex: 1,
  },
  backupNoticeTitle: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: '800',
  },
  backupNoticeText: {
    color: colors.inkMuted,
    fontSize: 9.5,
    marginTop: 2,
  },
  backupNoticeAction: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
  privacyNote: {
    color: colors.inkMuted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

