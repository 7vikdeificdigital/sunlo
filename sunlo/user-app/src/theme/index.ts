/**
 * Sunlo design tokens: shaant teal + garam coral. Purana layout, naya polish.
 * Saare rang/space/font yahin se aate hain; screens mein hard-coded rang nahi.
 */
export const colors = {
  primary: '#12968A',
  primaryDark: '#0B6E66',
  primarySoft: '#E3F4F1',
  primaryTint: '#BFE6DF',
  accent: '#FF7A59',
  accentSoft: '#FFEDE7',
  bg: '#F5FAF9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF5F3',
  text: '#14211F',
  textMuted: '#5C6E6A',
  textFaint: '#93A39F',
  border: '#DDEBE7',
  success: '#1E9E5A',
  successSoft: '#E3F5EB',
  danger: '#D64545',
  dangerSoft: '#FCE8E8',
  info: '#2E6FD8',
  online: '#22B35E',
  busy: '#E5A100',
  offline: '#B8AFA6',
  overlay: 'rgba(20,33,31,0.45)',
  white: '#FFFFFF',
};

/** Brand gradient (header, wallet card) */
export const gradient = ['#22B8A7', '#0B6E66'] as const;
export const callGradient = ['#123B37', '#0A1F1D'] as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const shadow = {
  card: {
    shadowColor: '#0B3B36',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0B3B36',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

/** Avatar ke liye naam se pakka rang */
const AVATAR_COLORS = ['#12968A', '#E2595B', '#7B61FF', '#E08A00', '#2E6FD8', '#C2410C', '#9D4EDD', '#0F9D58'];
export const avatarColor = (seed: string) => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
