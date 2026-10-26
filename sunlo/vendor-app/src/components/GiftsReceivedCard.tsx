import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { rupees } from '@/lib/format';
import { colors, radius, shadow, space } from '@/theme';
import { Coin, coinsOf } from './Coin';
import { Text } from './ui';

export type GiftsReceived = {
  total: { count: number; price: number; earning: number };
  items: { id: string; sessionId: string; giftName: string; price: number; vendorEarning: number; createdAt: string; userName: string | null; thumbUrl: string | null }[];
};
export const useGiftsReceived = () => useQuery({ queryKey: ['vendor-gifts'], queryFn: () => api<GiftsReceived>('/vendor/gifts') });

/** Kamai/history ke upar ek chhota card: kitne gifts mile, kitni kamai. Dabane par poori list. */
export function GiftsReceivedCard() {
  const q = useGiftsReceived();
  const t = q.data?.total;
  if (!t || t.count === 0) return null;
  return (
    <Pressable onPress={() => router.push('/gifts' as never)} style={{ borderRadius: radius.lg, overflow: 'hidden', ...shadow.card }}>
      <LinearGradient colors={['#FF9A6B', '#FF5E7E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="gift" size={22} color={colors.white} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.white, fontSize: 15 }}>Gifts mile · {t.count}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Coin size={13} />
            <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 12.5 }}>
              {coinsOf(t.price)} coins · aapki kamai {rupees(t.earning)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.white} />
      </LinearGradient>
    </Pressable>
  );
}
