import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { rupees } from '@/lib/format';
import { useMe } from '@/lib/queries';
import { colors, font, radius, shadow } from '@/theme';
import { Text } from './ui';

export function WalletChip() {
  const me = useMe();
  return (
    <Pressable
      onPress={() => router.push('/wallet')}
      accessibilityRole="button"
      accessibilityLabel="Wallet"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingLeft: 10, paddingRight: 4, height: 36, ...shadow.card }}
    >
      <Ionicons name="wallet-outline" size={16} color={colors.primaryDark} />
      <Text style={{ fontFamily: font.semibold, fontSize: 13 }}>{rupees(me.data?.walletBalance ?? 0)}</Text>
      <Ionicons name="add-circle" size={26} color={colors.primary} />
    </Pressable>
  );
}
