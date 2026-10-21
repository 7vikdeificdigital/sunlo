import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { perMin } from '@/lib/format';
import { qk } from '@/lib/queries';
import type { Session } from '@/lib/types';
import { colors, font, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { Button, Row, Text } from './ui';

const TYPE_LABEL = { CHAT: 'Chat', AUDIO: 'Voice call', VIDEO: 'Video call' } as const;

/** Naya request aate hi poori screen par popup: Accept / Reject, 60 sec ki ulti ginti */
export function IncomingRequest({ s, onDone }: { s: Session; onDone: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(() => Math.max(0, 60 - Math.floor((Date.now() - new Date(s.requestedAt).getTime()) / 1000)));

  useEffect(() => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (left === 0) onDone();
  }, [left, onDone]);

  async function act(kind: 'accept' | 'reject') {
    setBusy(kind);
    setError(null);
    try {
      await api(`/vendor/sessions/${s.id}/${kind}`, { method: 'POST' });
      qc.invalidateQueries({ queryKey: qk.pending });
      onDone();
      if (kind === 'accept') router.push(s.type === 'CHAT' ? `/session/${s.id}` : `/call/${s.id}`);
    } catch (e) {
      setError(errorMessage(e));
      qc.invalidateQueries({ queryKey: qk.pending });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: space.xl }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.xl, gap: space.md, alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.accent }}>NAYA {TYPE_LABEL[s.type].toUpperCase()} REQUEST</Text>
          </View>
          <Avatar name={s.userName ?? 'User'} size={84} />
          <Text variant="h2">{s.userName ?? 'User'}</Text>
          {s.intake?.topic ? (
            <Row gap={6}>
              <Ionicons name="pricetag-outline" size={15} color={colors.primaryDark} />
              <Text variant="bodyStrong" color={colors.primaryDark}>
                {s.intake.topic}
              </Text>
            </Row>
          ) : null}
          {s.intake?.note ? (
            <View style={{ alignSelf: 'stretch', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md }}>
              <Text variant="small" color={colors.text}>
                “{s.intake.note}”
              </Text>
            </View>
          ) : null}
          <Text variant="small">
            {perMin(s.ratePerMin)} · {left} sec mein jawab dein
          </Text>
          {error ? (
            <Text variant="small" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Row gap={space.md} style={{ alignSelf: 'stretch', marginTop: space.sm }}>
            <Button title="Reject" kind="ghost" style={{ flex: 1 }} loading={busy === 'reject'} disabled={!!busy} onPress={() => act('reject')} />
            <Button title="Accept" kind="success" icon={s.type === 'CHAT' ? 'chatbubble-ellipses' : 'call'} style={{ flex: 1.4 }} loading={busy === 'accept'} disabled={!!busy} onPress={() => act('accept')} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}
