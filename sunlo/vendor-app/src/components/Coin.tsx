import { View } from 'react-native';
import { Text } from './ui';

/** 1 coin = ₹1 (paise / 100) */
export const coinsOf = (paise: number) => Math.round(paise / 100).toLocaleString('en-IN');

/** Sone ka chhota coin icon (rupee sign ki jagah) */
export function Coin({ size = 16 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFC857', borderWidth: Math.max(1, size * 0.1), borderColor: '#E59A00', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.46, height: size * 0.46, borderRadius: size * 0.23, borderWidth: Math.max(1, size * 0.09), borderColor: '#E59A00' }} />
    </View>
  );
}

/** [coin] 1,000 */
export function CoinPrice({ paise, size = 14, color = '#FFC857' }: { paise: number; size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Coin size={size + 2} />
      <Text style={{ color, fontSize: size }}>{coinsOf(paise)}</Text>
    </View>
  );
}
