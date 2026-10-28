import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';
import { brand, colors, font } from '@/theme';
import { Text } from './ui';

const TOP = 'M75 65H330A103 103 0 0 1 433 168V200C433 255 410 290 380 300H75Z M229 143H268A57 57 0 0 1 268 258H229A57 57 0 0 1 229 143Z';
const BOT = 'M75 300H372A130 130 0 0 1 502 430V470C502 520 478 565 437 600L555 692L350 635H75Z M242 392H305A70 70 0 0 1 305 540H242A70 70 0 0 1 242 392Z';

/** Bondty ka mark: upar violet B, neeche coral bubble-B (tail ke saath) */
export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="-15 48 660 660">
      <Path d={TOP} fill={colors.primary} fillRule="evenodd" />
      <Path d={BOT} fill={colors.accent} fillRule="evenodd" />
    </Svg>
  );
}

/** Mark + naam + (optional) tagline */
export function Logo({ size = 56, light = false, tagline = false }: { size?: number; light?: boolean; tagline?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.22 }}>
      <LogoMark size={size} />
      <View>
        <Text style={{ fontFamily: font.bold, fontSize: size * 0.62, lineHeight: size * 0.8, letterSpacing: -0.8, color: light ? colors.white : colors.text }}>{brand.short}</Text>
        {tagline ? <Text style={{ fontFamily: font.regular, fontSize: size * 0.24, color: light ? 'rgba(255,255,255,0.75)' : colors.textMuted }}>{brand.tagline}</Text> : null}
      </View>
    </View>
  );
}
