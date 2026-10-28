import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CoinPrice } from '@/components/Coin';
import { DriftingPeople } from '@/components/DriftingPeople';
import { RoomsList, useLiveRooms } from '@/components/RoomsList';
import { Screen, Text } from '@/components/ui';
import { WalletChip } from '@/components/WalletChip';
import { TYPE_META, useRandomOverview } from '@/lib/randomConnect';
import type { SessionType } from '@/lib/types';
import { colors, font, radius, space } from '@/theme';

const BUTTONS: { t: SessionType; label: string }[] = [
  { t: 'AUDIO', label: 'Voice' },
  { t: 'VIDEO', label: 'Video' },
  { t: 'CHAT', label: 'Chat' },
];

export default function Connect() {
  const [tab, setTab] = useState<'random' | 'rooms'>('random');
  const rooms = useLiveRooms();
  const ov = useRandomOverview();
  const total = Math.max(0, ...(['CHAT', 'AUDIO', 'VIDEO'] as SessionType[]).map((t) => ov.data?.[t]?.online ?? 0));
  const people = ov.data?.people ?? [];

  return (
    <Screen edges={['top']} style={{ backgroundColor: '#2A1670' }}>
      <LinearGradient colors={['#8B6CFF', '#F2559F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <WalletChip />
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: total > 0 ? '#4DFF9A' : '#B7B3D6' }} />
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#fff' }}>{total} free</Text>
          </View>
        </View>
        <Text style={{ fontFamily: font.bold, fontSize: 26, lineHeight: 31, color: '#fff', marginTop: space.md }}>Bondty{'\n'}Connect Rooms</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>Kisi ko chuno ya neeche se random connect karo</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
          {([['random', 'Random', 'shuffle'], ['rooms', `Live Rooms${rooms.data?.items.length ? ` · ${rooms.data.items.length}` : ''}`, 'radio']] as const).map(([k, l, ic]) => (
            <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="button" accessibilityState={{ selected: tab === k }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: tab === k ? '#fff' : 'rgba(255,255,255,0.22)' }}>
              <Ionicons name={ic} size={14} color={tab === k ? colors.primaryDark : '#fff'} />
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: tab === k ? colors.primaryDark : '#fff' }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      <LinearGradient colors={['#4B1FA8', '#2A1670', '#1B0F4D']} style={{ flex: 1 }}>
        {tab === 'rooms' ? (
          <RoomsList />
        ) : people.length > 0 ? (
          <DriftingPeople people={people} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: space.xl }}>
            <Ionicons name={ov.isLoading ? 'hourglass-outline' : 'moon-outline'} size={40} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>
              {ov.isLoading ? 'Listeners dhoondh rahe hain...' : 'Abhi koi free nahi hai. Thodi der baad dekhein'}
            </Text>
          </View>
        )}

        {tab === 'random' ? (
        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md }}>
          {BUTTONS.map(({ t, label }) => {
            const m = TYPE_META[t];
            const rate = ov.data?.[t]?.minRate;
            return (
              <Pressable key={t} onPress={() => router.push({ pathname: '/connecting', params: { type: t } })} accessibilityRole="button" accessibilityLabel={`Random ${label}`} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.88 : 1 })}>
                <LinearGradient colors={m.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, paddingVertical: 10, alignItems: 'center', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name={m.icon} size={15} color="#fff" />
                    <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: '#fff' }}>{label}</Text>
                  </View>
                  {rate ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <CoinPrice paise={rate} size={11.5} color="#fff" />
                      <Text style={{ fontFamily: font.regular, fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>/min</Text>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: font.regular, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>abhi nahi</Text>
                  )}
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
        ) : null}
      </LinearGradient>
    </Screen>
  );
}
