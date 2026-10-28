/**
 * Bondty design tokens: violet + coral + gehra navy. Purana layout, naya polish.
 * Saare rang/space/font yahin se aate hain; screens mein hard-coded rang nahi.
 */
export const colors = {
  primary: '#6B4CFF',
  primaryDark: '#4A31D9',
  primarySoft: '#EFEBFF',
  primaryTint: '#CFC8FF',
  accent: '#FF6A4A',
  accentSoft: '#FFEDE8',
  bg: '#F7F6FB',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EEF8',
  text: '#18133C',
  textMuted: '#6A6688',
  textFaint: '#9B97B5',
  border: '#E3E0F0',
  success: '#1E9E5A',
  successSoft: '#E3F5EB',
  danger: '#D64545',
  dangerSoft: '#FCE8E8',
  info: '#2E6FD8',
  online: '#22B35E',
  busy: '#E5A100',
  offline: '#B8AFA6',
  overlay: 'rgba(26,19,64,0.5)',
  white: '#FFFFFF',
};

/** Brand gradient (header, wallet card) */
export const gradient = ['#7D61FF', '#5A3BEF'] as const;
export const callGradient = ['#241A66', '#130E3A'] as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 8, md: 14, lg: 18, xl: 24, pill: 999 };

export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const shadow = {
  card: {
    shadowColor: '#18133C',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#18133C',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

/** Avatar ke liye naam se pakka rang */
const AVATAR_COLORS = ['#6B4CFF', '#E2595B', '#7B61FF', '#E08A00', '#2E6FD8', '#C2410C', '#9D4EDD', '#0F9D58'];
export const avatarColor = (seed: string) => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

/** App ka naam + tagline ek jagah (naam badalna ho to sirf yahin) */
export const brand = { name: 'Bondty', short: 'Bondty', tagline: 'Talk it out' };
