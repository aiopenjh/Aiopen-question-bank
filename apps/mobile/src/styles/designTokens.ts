export const colors = {
  canvas: '#FBEFF3',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F5F5',
  ink: '#403A43',
  inkMuted: '#777178',
  primary: '#C9788E',
  primaryPressed: '#A95F75',
  primarySoft: '#F8EDF1',
  lavender: '#8B7BB8',
  lavenderSoft: '#F0EDF7',
  mint: '#4F8C7A',
  mintSoft: '#E8F3EF',
  gold: '#B88745',
  goldSoft: '#F8F0E2',
  border: '#E9E2E4',
  danger: '#B64555',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const shadows = {
  soft: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  action: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;
