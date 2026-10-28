import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, Image, RefreshControl, View } from 'react-native';
import { Coin, coinsOf } from '@/components/Coin';
import { useGiftsReceived } from '@/components/GiftsReceivedCard';
import { Empty, Header, Loader, Screen, Text } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { formatDateTime, rupees } from '@/lib/format';
import { colors, radius, shadow, space } from '@/theme';

export default function GiftsScreen() {
  const q = useGiftsReceived();
  const t = q.data?.total;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Gifts mile" />
      {q.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(g) => g.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: space.xxl }}
          ListHeaderComponent={
            t ? (
              <LinearGradient colors={['#FF9A6B', '#FF5E7E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm, gap: 4 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Ab tak mile gifts</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Coin size={26} />
                  <Text style={{ color: colors.white, fontSize: 30 }}>{coinsOf(t.price)}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>coins · {t.count} gifts</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 13 }}>Platform fee ke baad aapki kamai: {rupees(t.earning)} (wallet mein jud chuki)</Text>
              </LinearGradient>
            ) : null
          }
          ListEmptyComponent={<Empty icon="gift-outline" title="Abhi koi gift nahi mila" text="Call ke dauran users gift bhej sakte hain" />}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, ...shadow.card }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center' }}>
                {item.thumbUrl ? <Image source={{ uri: `${API_URL}${item.thumbUrl}` }} style={{ width: 42, height: 42 }} resizeMode="contain" /> : <Ionicons name="gift" size={22} color="#FF7A59" />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {item.userName ?? 'User'} ne {item.giftName} bheja
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Coin size={12} />
                  <Text variant="caption">
                    {coinsOf(item.price)} · {formatDateTime(item.createdAt)}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.success, fontSize: 14 }}>+{rupees(item.vendorEarning)}</Text>
            </View>
          )}
        />
      )}
      <View />
    </Screen>
  );
}
