import { Image, View } from 'react-native';
import { brand, colors, font } from '@/theme';
import { Text } from './ui';

// Bondty ka asli mark (transparent PNG): b + dil + do dots
const MARK = require('../assets/bondty-mark.png');
const RATIO = 392 / 420;

export function LogoMark({ size = 64 }: { size?: number }) {
  return <Image source={MARK} style={{ width: size * RATIO, height: size }} resizeMode="contain" accessibilityLabel={brand.short} />;
}

/** Wordmark: "bond" + gulabi "ty" (logo jaisa) */
export function Wordmark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  return (
    <Text style={{ fontFamily: font.bold, fontSize: size, letterSpacing: -0.5, color: light ? colors.white : colors.text }}>
      bond<Text style={{ fontFamily: font.bold, fontSize: size, color: colors.accent }}>ty</Text>
    </Text>
  );
}

/** Mark + wordmark (+ tagline) */
export function Logo({ size = 56, light = false, tagline = false }: { size?: number; light?: boolean; tagline?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.2 }}>
      <LogoMark size={size} />
      <View>
        <Wordmark size={size * 0.56} light={light} />
        {tagline ? <Text style={{ fontFamily: font.regular, fontSize: size * 0.22, color: light ? 'rgba(255,255,255,0.75)' : colors.textMuted }}>{brand.tagline}</Text> : null}
      </View>
    </View>
  );
}
