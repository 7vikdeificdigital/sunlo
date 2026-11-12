import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Empty, Header, Input, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useVendorBookings } from '@/lib/queries';
import type { VendorBooking } from '@/lib/types';
import { colors, radius, space } from '@/theme';

const TYPE_L = { CHAT: 'Chat', AUDIO: 'Voice call', VIDEO: 'Video call' } as const;
const ST: Record<VendorBooking['status'], [string, string]> = {
  PENDING: ['Aapke jawab ka intezaar', colors.busy],
  CONFIRMED: ['Pakki', colors.success],
  DECLINED: ['Aapne mana kiya', colors.textMuted],
  CANCELLED: ['Cancel', colors.textMuted],
  COMPLETED: ['Ho gayi', colors.textMuted],
  MISSED: ['Chhoot gayi', colors.danger],
};

/** Users ki booked calls: confirm / decline. 10 minute pehle reminder aata hai, us waqt online rahein. */
export default function Bookings() {
  const qc = useQueryClient();
  const q = useVendorBookings();
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function act(id: string, path: string, body?: unknown) {
    setBusy(id);
    setErr(null);
    try {
      await api(`/vendor/scheduled-calls/${id}/${path}`, { method: 'POST', body: body ?? {} });
      setDeclining(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['vendor-bookings'] });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const items = q.data?.items ?? [];
  return (
    <Screen edges={['top']}>
      <Header title="Booked calls" subtitle="Users ne aapke saath time book kiya" />
      {q.isLoading ? (
        <Loader />
      ) : !items.length ? (
        <Empty icon="calendar-outline" title="Abhi koi booking nahi" text="Users aapki profile se baad ka time book kar sakte hain" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          {err ? (
            <Text variant="small" color={colors.danger}>
              {err}
            </Text>
          ) : null}
          {items.map((b) => (
            <Card key={b.id} style={{ gap: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="title">{b.userName}</Text>
                <Text variant="caption" color={ST[b.status][1]}>
                  {ST[b.status][0]}
                </Text>
              </Row>
              <Text variant="small">
                {TYPE_L[b.type]} · {formatDateTime(b.scheduledAt)} · {b.durationMin} min
              </Text>
              {b.note ? (
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: space.sm }}>
                  <Text variant="small" raw>
                    "{b.note}"
                  </Text>
                </View>
              ) : null}
              {b.status === 'PENDING' ? (
                declining === b.id ? (
                  <View style={{ gap: space.sm }}>
                    <Input value={reason} onChangeText={setReason} placeholder="Wajah (optional), jaise: us din chhutti" maxLength={200} />
                    <Row gap={space.sm}>
                      <Button title="Wapas" kind="ghost" size="md" style={{ flex: 1 }} onPress={() => setDeclining(null)} />
                      <Button title="Mana karein" kind="danger" size="md" style={{ flex: 1 }} loading={busy === b.id} onPress={() => act(b.id, 'decline', reason.trim() ? { reason: reason.trim() } : {})} />
                    </Row>
                  </View>
                ) : (
                  <Row gap={space.sm}>
                    <Button title="Confirm" icon="checkmark" size="md" style={{ flex: 1 }} loading={busy === b.id} onPress={() => act(b.id, 'confirm')} />
                    <Button title="Mana karein" kind="ghost" size="md" style={{ flex: 1 }} onPress={() => setDeclining(b.id)} />
                  </Row>
                )
              ) : b.status === 'CONFIRMED' ? (
                <Button
                  title="Cancel karein"
                  kind="ghost"
                  size="md"
                  loading={busy === b.id}
                  onPress={async () => {
                    setBusy(b.id);
                    await api(`/scheduled-calls/${b.id}/cancel`, { method: 'POST' }).catch((e) => setErr(errorMessage(e)));
                    qc.invalidateQueries({ queryKey: ['vendor-bookings'] });
                    setBusy(null);
                  }}
                />
              ) : null}
            </Card>
          ))}
          <Row gap={6} style={{ justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={14} color={colors.textFaint} />
            <Text variant="caption">Call se 10 minute pehle reminder aayega. Us waqt online rahein.</Text>
          </Row>
        </ScrollView>
      )}
    </Screen>
  );
}
