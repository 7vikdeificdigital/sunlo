import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Card, IconButton, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatTime, perMin, rupees } from '@/lib/format';
import { useHostRoom } from '@/lib/rooms';
import { qk, useEarnings, useNotifications, usePending, useVendorMe } from '@/lib/queries';
import { colors, font, gradient, radius, shadow, space } from '@/theme';

const TYPE = { CHAT: 'Chat', AUDIO: 'Voice call', VIDEO: 'Video call' } as const;

export default function Dashboard() {
  const qc = useQueryClient();
  const me = useVendorMe();
  const earn = useEarnings();
  const pending = usePending(true);
  const notif = useNotifications();
  const hostRoom = useHostRoom(10_000);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = me.data;
  if (!v) return null;

  const active = pending.data?.items.find((s) => s.status === 'ACTIVE');
  const waiting = pending.data?.items.filter((s) => s.status === 'REQUESTED') ?? [];

  async function setOnline(isOnline: boolean) {
    setToggling(true);
    setError(null);
    qc.setQueryData(qk.me, { ...v!, isOnline });
    try {
      await api('/vendor/status', { method: 'PATCH', body: { isOnline } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setToggling(false);
      qc.invalidateQueries({ queryKey: qk.me });
    }
  }

  return (
    <Screen>
      <Row style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }} gap={space.md}>
        <Avatar name={v.displayName} uri={v.avatarUrl} size={44} status={v.isOnline ? 'online' : 'offline'} />
        <View style={{ flex: 1 }}>
          <Text variant="small">Namaste</Text>
          <Text variant="title" numberOfLines={1}>
            {v.displayName}
          </Text>
        </View>
        <IconButton name="notifications-outline" label="Notifications" badge={notif.data?.unread} onPress={() => router.push('/notifications')} />
      </Row>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => Promise.all([me.refetch(), earn.refetch(), pending.refetch()])} tintColor={colors.primary} />}
      >
        {/* Online toggle */}
        <LinearGradient
          colors={v.isOnline ? [...gradient] : ['#5C6E6A', '#3E4C49']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: space.xl, gap: 6 }}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 22, color: colors.white }}>{v.isOnline ? 'Aap online hain' : 'Aap offline hain'}</Text>
            <Switch
              value={v.isOnline}
              onValueChange={setOnline}
              disabled={toggling}
              trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.45)' }}
              thumbColor={colors.white}
              accessibilityLabel="Online/offline"
            />
          </Row>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
            {v.isOnline ? 'Users aapko list mein dekh rahe hain aur request bhej sakte hain.' : 'Online hote hi users aapse baat kar payenge.'}
          </Text>
          <Row gap={space.sm} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {(
              [
                ['Chat', v.chatEnabled, v.chatRatePerMin],
                ['Call', v.callEnabled, v.callRatePerMin],
                ['Video', v.videoEnabled, v.videoRatePerMin],
              ] as const
            ).map(([l, on, r]) => (
              <Pressable key={l} onPress={() => router.push('/rates')} style={{ backgroundColor: on ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.15)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.white }}>{on ? `${l} · ${perMin(r)}` : `${l} band`}</Text>
              </Pressable>
            ))}
          </Row>
        </LinearGradient>
        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        {active ? (
          <Pressable onPress={() => router.push(active.type === 'CHAT' ? `/session/${active.id}` : `/call/${active.id}`)} style={{ backgroundColor: colors.successSoft, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Ionicons name="radio-button-on" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{TYPE[active.type]} chal raha hai</Text>
              <Text variant="small">{active.userName} ke saath · kholne ke liye tap karein</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.success} />
          </Pressable>
        ) : null}

        {/* Live room */}
        {hostRoom.data?.room ? (
          <Pressable onPress={() => router.push(`/room/${hostRoom.data!.room!.id}`)} style={{ backgroundColor: '#FDECEC', borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Ionicons name="radio" size={22} color="#D64545" />
            <View style={{ flex: 1 }}>
              <Text variant="title">Aapka room live hai</Text>
              <Text variant="small">{hostRoom.data.room.title} · {hostRoom.data.listeners.length} sun rahe hain · wapas jaane ke liye tap karein</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D64545" />
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/golive')} style={{ borderRadius: radius.lg, overflow: 'hidden', ...shadow.card }}>
            <LinearGradient colors={['#8B6CFF', '#F2559F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Ionicons name="radio" size={26} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#fff' }}>Live room shuru karein</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.92)' }}>Voice ya video room, bahut se users ek saath. Entry rate aap tay karein.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}

        {/* Stats */}
        <Row gap={space.md}>
          {[
            ['Aaj ki kamai', rupees(earn.data?.today.earning ?? 0)],
            ['Aaj ke minute', String(earn.data?.today.minutes ?? 0)],
            ['Wallet', rupees(earn.data?.balance ?? v.walletBalance)],
          ].map(([l, val]) => (
            <View key={l} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: 2, ...shadow.card }}>
              <Text variant="caption">{l}</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 17 }}>{val}</Text>
            </View>
          ))}
        </Row>

        <Row gap={space.md}>
          <Card style={{ flex: 1, gap: 2 }} onPress={() => router.push('/reviews')}>
            <Row gap={4}>
              <Ionicons name="star" size={16} color={colors.accent} />
              <Text style={{ fontFamily: font.semibold, fontSize: 17 }}>{v.ratingAvg ? v.ratingAvg.toFixed(1) : '—'}</Text>
            </Row>
            <Text variant="caption">{v.ratingCount} reviews</Text>
          </Card>
          <Card style={{ flex: 1, gap: 2 }} onPress={() => router.push('/sessions')}>
            <Text style={{ fontFamily: font.semibold, fontSize: 17 }}>{v.totalSessions}</Text>
            <Text variant="caption">kul sessions</Text>
          </Card>
        </Row>

        <SectionHeader title="Intezaar mein requests" />
        {waiting.length ? (
          waiting.map((s) => (
            <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: -space.sm }}>
              <Avatar name={s.userName ?? 'U'} size={42} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{s.userName}</Text>
                <Text variant="caption">
                  {TYPE[s.type]} · {s.intake?.topic ?? ''} · {formatTime(s.requestedAt)}
                </Text>
              </View>
              <Text variant="label" color={colors.accent}>
                Naya
              </Text>
            </Card>
          ))
        ) : (
          <Text variant="small" style={{ marginTop: -space.sm }}>
            {v.isOnline ? 'Abhi koi request nahi. Nayi request aate hi popup aayega.' : 'Online hone par requests yahan dikhengi.'}
          </Text>
        )}

        <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: space.lg, gap: 6, marginTop: space.sm }}>
          <Row gap={8}>
            <Ionicons name="bulb-outline" size={18} color={colors.primaryDark} />
            <Text variant="title" color={colors.primaryDark}>
              Achhi rating ke liye
            </Text>
          </Row>
          <Text variant="small" color={colors.text}>
            • Request jaldi accept karein (60 sec){'\n'}• User ka naam lekar baat shuru karein{'\n'}• Phone number ya bahar ka payment kabhi na maangein: account band ho sakta hai
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
