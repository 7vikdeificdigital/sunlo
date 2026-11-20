import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { VendorListCard } from '@/components/VendorCard';
import { Button, Card, Empty, Header, Loader, Row, Screen, Segmented, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAppConfig, useScheduledCalls, useSessions, useVendors } from '@/lib/queries';
import type { ScheduledCall, Session } from '@/lib/types';
import { colors, radius, space } from '@/theme';

const STATUS: Record<ScheduledCall['status'], { l: string; c: string; bg: string }> = {
  PENDING: { l: 'Listener ke jawab ka intezaar', c: colors.busy, bg: '#FFF4DB' },
  CONFIRMED: { l: 'Pakki ✅', c: colors.success, bg: colors.successSoft },
  DECLINED: { l: 'Listener free nahi', c: colors.danger, bg: colors.dangerSoft },
  CANCELLED: { l: 'Cancel', c: colors.textMuted, bg: colors.surfaceAlt },
  COMPLETED: { l: 'Ho gayi', c: colors.textMuted, bg: colors.surfaceAlt },
  MISSED: { l: 'Chhoot gayi', c: colors.textMuted, bg: colors.surfaceAlt },
};
const TYPE_L = { CHAT: 'Chat', AUDIO: 'Voice call', VIDEO: 'Video call' } as const;

type Tab = 'bookings' | 'past' | 'all';

/** Request a call: meri bookings, pehle jinse baat ki, aur saare listeners */
export default function Bookings() {
  const [tab, setTab] = useState<Tab>('bookings');
  return (
    <Screen edges={['top']}>
      <Header title="Request a call" subtitle="Apne listener ke saath baad ka time" />
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'bookings', label: 'My bookings' },
            { value: 'past', label: 'Past listeners' },
            { value: 'all', label: 'All listeners' },
          ]}
        />
      </View>
      {tab === 'bookings' ? <MyBookings /> : tab === 'past' ? <PastListeners /> : <AllListeners />}
    </Screen>
  );
}

// ---------------- 1. Meri bookings ----------------
function MyBookings() {
  const qc = useQueryClient();
  const q = useScheduledCalls();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function start(c: ScheduledCall) {
    setBusy(c.id);
    setErr(null);
    try {
      const r = await api<{ session: Session }>(`/scheduled-calls/${c.id}/start`, { method: 'POST' });
      qc.invalidateQueries({ queryKey: ['scheduled-calls'] });
      router.push(r.session.type === 'CHAT' ? `/session/${r.session.id}` : `/call/${r.session.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function cancel(c: ScheduledCall) {
    setBusy(c.id);
    await api(`/scheduled-calls/${c.id}/cancel`, { method: 'POST' }).catch((e) => setErr(errorMessage(e)));
    qc.invalidateQueries({ queryKey: ['scheduled-calls'] });
    setBusy(null);
  }

  const items = q.data?.items ?? [];
  const upcoming = items.filter((c) => c.status === 'PENDING' || c.status === 'CONFIRMED');
  const past = items.filter((c) => !upcoming.includes(c));

  if (q.isLoading) return <Loader />;
  if (!items.length)
    return (
      <Empty
        icon="calendar-outline"
        title="Koi booking nahi"
        text="Kisi listener ki profile par 'Baad ka time book karein' dabayein"
        action="Listeners dekhein"
        onAction={() => router.replace('/chat')}
      />
    );

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      {err ? (
        <Text variant="small" color={colors.danger}>
          {err}
        </Text>
      ) : null}
      {[...upcoming, ...past].map((c) => {
        const st = STATUS[c.status];
        return (
          <Card key={c.id} style={{ gap: space.sm, opacity: upcoming.includes(c) ? 1 : 0.7 }}>
            <Row gap={space.md}>
              <Avatar name={c.vendor.displayName} uri={c.vendor.avatarUrl} size={44} status={c.vendor.isOnline ? 'online' : undefined} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{c.vendor.displayName}</Text>
                <Text variant="small">
                  {TYPE_L[c.type]} · {formatDateTime(c.scheduledAt)} · {c.durationMin} min
                </Text>
              </View>
            </Row>
            <View style={{ alignSelf: 'flex-start', backgroundColor: st.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text variant="caption" color={st.c}>
                {st.l}
                {c.declineReason ? `: ${c.declineReason}` : ''}
              </Text>
            </View>
            {c.note ? (
              <Text variant="small" raw>
                "{c.note}"
              </Text>
            ) : null}
            {upcoming.includes(c) ? (
              <Row gap={space.sm}>
                {c.canStart ? <Button title="Shuru karein" icon="call" size="md" style={{ flex: 1 }} loading={busy === c.id} onPress={() => start(c)} /> : null}
                <Button title="Cancel" kind="ghost" size="md" style={{ flex: c.canStart ? 0 : 1 }} disabled={busy === c.id} onPress={() => cancel(c)} />
              </Row>
            ) : null}
          </Card>
        );
      })}
      <Row gap={6} style={{ justifyContent: 'center' }}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textFaint} />
        <Text variant="caption">Booked samay se 10 minute pehle "Shuru karein" khulta hai. Ek samay par ek hi booking ho sakti hai.</Text>
      </Row>
    </ScrollView>
  );
}

// ---------------- 2. Jinse pehle baat ki ----------------
function PastListeners() {
  const q = useSessions();

  const items = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; avatarUrl: string | null; at: string; count: number }>();
    for (const s of q.data?.items ?? []) {
      if (!s.vendor || s.status !== 'COMPLETED') continue;
      const cur = seen.get(s.vendor.id);
      if (cur) {
        cur.count += 1;
        if (new Date(s.requestedAt) > new Date(cur.at)) cur.at = s.requestedAt;
      } else {
        seen.set(s.vendor.id, { id: s.vendor.id, name: s.vendor.displayName, avatarUrl: s.vendor.avatarUrl, at: s.requestedAt, count: 1 });
      }
    }
    return [...seen.values()].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [q.data]);

  if (q.isLoading) return <Loader />;
  if (!items.length)
    return (
      <Empty
        icon="people-outline"
        title="Abhi kisi se baat nahi hui"
        text="Jinse aap baat karenge wo yahan dikhenge, taaki dobara aasani se mil jayein"
        action="Listeners dekhein"
        onAction={() => router.replace('/chat')}
      />
    );

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      {items.map((v) => (
        <Card key={v.id} onPress={() => router.push(`/vendor/${v.id}`)}>
          <Row gap={space.md}>
            <Avatar name={v.name} uri={v.avatarUrl} size={48} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{v.name}</Text>
              <Text variant="small">
                {v.count} baar baat hui · aakhri {formatDateTime(v.at)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Row>
        </Card>
      ))}
    </ScrollView>
  );
}

// ---------------- 3. Saare listeners (online + offline) ----------------
function AllListeners() {
  const cfg = useAppConfig();
  const listenerCat = cfg.data?.categories.find((c) => c.kind === 'LISTENER');
  const q = useVendors({ service: 'chat', categoryId: listenerCat?.id, limit: 20 });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  if (q.isLoading) return <Loader />;
  if (!items.length) return <Empty icon="people-outline" title="Koi listener nahi mila" text="Thodi der baad dobara dekhein" />;

  return (
    <FlatList
      data={items}
      keyExtractor={(v) => v.id}
      contentContainerStyle={{ paddingTop: space.sm, paddingBottom: space.xxl }}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListFooterComponent={q.isFetchingNextPage ? <Loader /> : null}
      renderItem={({ item }) => <VendorListCard a={item} service="chat" onStart={() => router.push(`/vendor/${item.id}`)} />}
    />
  );
}
