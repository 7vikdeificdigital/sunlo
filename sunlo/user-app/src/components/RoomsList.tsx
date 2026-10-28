import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { api } from '@/lib/api';
import type { LiveRoom } from '@/lib/types';
import { colors, font, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { CoinPrice } from './Coin';
import { Text } from './ui';

export function useLiveRooms() {
  return useQuery({ queryKey: ['rooms'], queryFn: () => api<{ items: LiveRoom[] }>('/rooms'), refetchInterval: 8000, staleTime: 4000 });
}

/** Abhi live rooms: tap karke andar jayein (host ne paisa rakha ho to rate dikhta hai) */
export function RoomsList() {
  const q = useLiveRooms();
  const items = q.data?.items ?? [];
  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor="#fff" />}
      contentContainerStyle={{ padding: space.md, gap: space.sm, flexGrow: 1 }}
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: space.xl }}>
          <Ionicons name={q.isLoading ? 'hourglass-outline' : 'radio-outline'} size={42} color="rgba(255,255,255,0.8)" />
          <Text style={{ fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>{q.isLoading ? 'Rooms dhoondh rahe hain...' : 'Abhi koi room live nahi hai. Thodi der baad dekhein'}</Text>
        </View>
      }
      renderItem={({ item: r }) => (
        <Pressable onPress={() => router.push(`/room/${r.id}`)} accessibilityRole="button" accessibilityLabel={r.title} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' })}>
          <Avatar name={r.host.displayName} uri={r.host.avatarUrl} size={54} ring />
          <View style={{ flex: 1, gap: 3 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 15, color: colors.white }}>{r.title}</Text>
            <Text numberOfLines={1} style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{r.host.displayName}{r.host.language ? ` · ${r.host.language}` : ''}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={r.type === 'VIDEO' ? 'videocam' : 'mic'} size={13} color="#7CF0AC" />
                <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: '#7CF0AC' }}>LIVE</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }}>{r.listeners}</Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            {r.ratePerMin > 0 ? (
              <>
                <CoinPrice paise={r.ratePerMin} size={13} color="#fff" />
                <Text style={{ fontFamily: font.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.75)' }}>/min</Text>
              </>
            ) : (
              <View style={{ backgroundColor: '#22B35E', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: '#fff' }}>FREE</Text>
              </View>
            )}
          </View>
        </Pressable>
      )}
    />
  );
}
