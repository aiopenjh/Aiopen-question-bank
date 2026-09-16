import { StyleSheet } from 'react-native';
import { colors, radius, shadows, spacing } from '../../styles/designTokens';

export const settingsDetailStyles = StyleSheet.create({
  goalCard: {
    padding: 14,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalCardTitle: {
    marginBottom: 0,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  goalInputCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 36,
    minWidth: 74,
    maxWidth: 92,
    gap: 4,
  },
  goalInputField: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.ink,
    textAlign: 'center',
    width: 26,
    padding: 0,
    margin: 0,
  },
  goalInputSuffix: {
    fontSize: 12.5,
    color: colors.primaryPressed,
    fontWeight: '700',
  },
  goalValidationText: {
    color: colors.danger,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 7,
  },
  goalSaveButton: {
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryPressed,
    paddingHorizontal: 12,
  },
  goalSaveButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalSaveButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  goalSaveButtonTextDisabled: {
    color: colors.inkMuted,
  },
  alarmItemBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  alarmItemBlockDisabled: {
    backgroundColor: '#F7F6F5',
    borderColor: colors.border,
  },
  alarmItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alarmPeriodMarker: {
    width: 28,
    color: colors.lavender,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  alarmItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.ink,
  },
  alarmItemSubText: {
    fontSize: 10,
    color: colors.inkMuted,
  },
  alarmToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alarmToggleOn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#EDC6D0',
  },
  alarmToggleOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alarmToggleTextOn: {
    color: colors.primaryPressed,
    fontSize: 11,
    fontWeight: 'bold',
  },
  alarmToggleTextOff: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: 'bold',
  },
  alarmControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alarmControlRowDisabled: {
    backgroundColor: '#F7F6F5',
    borderColor: colors.border,
  },
  stepperArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#EDC6D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperArrowBtnDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  stepperArrowText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primaryPressed,
  },
  stepperArrowTextDisabled: {
    color: '#cbd5e1',
  },
  timeDisplayCenter: {
    alignItems: 'center',
  },
  timeDisplayText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  timeDisplaySub: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 1,
    fontWeight: '600',
  },
  compactCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  compactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  compactCardSubtitle: {
    fontSize: 11,
    color: colors.inkMuted,
  },
  compactBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtnPrimary: {
    backgroundColor: colors.primaryPressed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  miniBtnPrimaryText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  miniBtnSecondary: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  miniBtnSecondaryText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  miniResetBtn: {
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  miniResetBtnText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  apiSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  apiSummaryCopy: {
    flex: 1,
    marginRight: spacing.sm,
  },
  apiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apiTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  apiProviderText: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  apiActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  apiEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  apiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  apiCancelText: {
    color: colors.inkMuted,
    fontSize: 11,
  },
  apiSaveButton: {
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  dangerActionButton: {
    backgroundColor: '#FFF7F7',
    borderColor: '#F1C8CD',
  },
  dangerActionText: {
    color: colors.danger,
  },
  resetCard: {
    backgroundColor: '#FFFCFC',
    borderColor: '#F1E1E3',
  },
  resetTitle: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  disabledText: {
    color: '#A8ADB5',
  },
  updateButton: {
    backgroundColor: colors.lavender,
  },

});

