import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Coin } from '@/components/Coin';
import { RoomChat } from '@/components/RoomChat';
import { RoomView } from '@/components/RoomView';
import { Loader, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { mmss } from '@/lib/format';
import { useHostRoom } from '@/lib/rooms';
import { useRoomLive } from '@/lib/useRoom';
import { useElapsed } from '@/lib/useLiveSession';
import { callGradient, colors, font, radius, space } from '@/theme';

/** Host ka live room: apna video/awaaz, listeners ki list, chat, gifts. End karne par room band. */
export default function HostRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const st = useHostRoom(4000);
  const [showList, setShowList] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);
  const live = useRoomLive(id, { onEnded: (r) => setEnded(r === 'HOST_OFFLINE' ? 'Aap offline ho gaye the, isliye room band ho gaya.' : 'Room khatam ho gaya.') });
  const room = st.data?.room;
  const elapsed = useElapsed(room?.startedAt, !!room && !ended);

  const finish = () => {
    void qc.invalidateQueries({ queryKey: ['vroom'] });
    void qc.invalidateQueries({ queryKey: ['me'] });
    router.replace('/(tabs)');
  };

  async function end() {
    try {
      await api(`/vendor/rooms/${id}/end`, { method: 'POST' });
      finish();
    } catch (e) {
      Alert.alert('Room band nahi hua', errorMessage(e));
    }
  }

  if (st.isLoading) return (<Screen><Loader /></Screen>);
  if (!room || room.id !== id || ended) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl }}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          <Text variant="title" style={{ textAlign: 'center' }}>{ended ?? 'Yeh room ab live nahi hai'}</Text>
          <Pressable onPress={finish} style={{ backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ color: colors.white, fontFamily: font.semibold }}>Home par jayein</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const video = room.type === 'VIDEO';
  const count = live.listeners ?? st.data?.listeners.length ?? 0;
  return (
    <LinearGradient colors={[...callGradient]} style={{ flex: 1 }}>
      <RoomView roomId={id} video={video} host />
      <Screen edges={['top', 'bottom']} style={{ backgroundColor: 'transparent' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D64545', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' }} />
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#fff' }}>LIVE {mmss(elapsed)}</Text>
            </View>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.white }}>{room.title}</Text>
            <Pressable onPress={() => setShowList((x) => !x)} accessibilityLabel="Listeners" style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Ionicons name="people" size={14} color={colors.white} />
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.white }}>{count}</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Coin size={14} />
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white }}>Is room ki kamai: {Math.round(room.totalEarned / 100)} coins + gifts</Text>
          </View>

          {showList ? (
            <View style={{ marginHorizontal: 12, marginTop: 8, maxHeight: 220, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.lg, padding: 10 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.white, marginBottom: 6 }}>Sunne wale ({st.data?.listeners.length ?? 0})</Text>
              <ScrollView>
                {(st.data?.listeners ?? []).map((l) => (
                  <View key={l.userId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ flex: 1, color: colors.white, fontFamily: font.regular, fontSize: 13.5 }}>{l.name}</Text>
                    <Pressable
                      onPress={() =>
                        Alert.alert(`${l.name} ko hatayein?`, 'Woh is room mein dobara nahi aa payenge.', [
                          { text: 'Ruko', style: 'cancel' },
                          {
                            text: 'Hatayein',
                            style: 'destructive',
                            onPress: () => api(`/vendor/rooms/${id}/kick`, { method: 'POST', body: { userId: l.userId } }).then(() => st.refetch()).catch((e) => Alert.alert('Nahi hata paye', errorMessage(e))),
                          },
                        ])
                      }
                      accessibilityLabel={`${l.name} ko hatayein`}
                    >
                      <Ionicons name="remove-circle-outline" size={22} color="#FF8A8A" />
                    </Pressable>
                  </View>
                ))}
                {!st.data?.listeners.length ? <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5 }}>Abhi koi nahi judha</Text> : null}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ flex: 1 }} />
          <RoomChat messages={live.messages} onSend={live.send} placeholder="Sabse baat karein..." />
          <Pressable
            onPress={() => Alert.alert('Room band karein?', 'Sab sunne wale bahar ho jayenge aur unka hisaab ho jayega.', [{ text: 'Ruko', style: 'cancel' }, { text: 'Band karein', style: 'destructive', onPress: () => void end() }])}
            accessibilityLabel="Room band karein"
            style={{ marginHorizontal: 12, marginBottom: 10, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D64545', flexDirection: 'row', gap: 8 }}
          >
            <Ionicons name="stop-circle" size={20} color="#fff" />
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#fff' }}>Room band karein</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </Screen>
    </LinearGradient>
  );
}
