import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button, Card, Empty, Header, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useScheduledCalls } from '@/lib/queries';
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

/** Meri bookings: aage ki calls, unka status, aur samay par "Shuru karein" */
export default function Bookings() {
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

  return (
    <Screen edges={['top']}>
      <Header title="Meri bookings" subtitle="Apne listener ke saath baad ka time" />
      {q.isLoading ? (
        <Loader />
      ) : !items.length ? (
        <Empty icon="calendar-outline" title="Koi booking nahi" text="Kisi listener ki profile par 'Baad ka time book karein' dabayein" action="Listeners dekhein" onAction={() => router.replace('/chat')} />
      ) : (
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
            <Text variant="caption">Booked samay se 10 minute pehle "Shuru karein" khulta hai.</Text>
          </Row>
        </ScrollView>
      )}
    </Screen>
  );
}
