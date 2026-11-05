import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { VoicePlayer, VoiceRecorder } from '@/components/Voice';
import { Button, Card, Chip, Empty, ErrorBox, Header, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { audioSrc, uploadClip } from '@/lib/voice';
import { colors, space } from '@/theme';

type Reply = { id: string; vendorId: string; name: string; headline: string; avatarUrl: string | null; ratingAvg: number; isOnline: boolean; audioUrl: string; durationSec: number };
type Note = { id: string; topic: string | null; status: 'OPEN' | 'CLOSED'; chosenVendorId: string | null; expiresAt: string; audioUrl: string; durationSec: number; replies: Reply[] };

const TOPICS = ['Akelapan', 'Rishte', 'Career', 'Tanav', 'Kuch aur'];

export default function VoiceBoard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['voice-mine'], queryFn: () => api<{ note: Note | null }>('/voice/notes/mine'), refetchInterval: 20_000 });
  const [clip, setClip] = useState<{ uri: string; sec: number } | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const note = q.data?.note ?? null;
  const open = note && note.status === 'OPEN' && new Date(note.expiresAt) > new Date();

  async function send() {
    if (!clip) return;
    setBusy(true);
    setErr(null);
    try {
      const up = await uploadClip(clip.uri, clip.sec);
      await api('/voice/notes', { method: 'POST', body: { clipId: up.id, topic: topic ?? undefined } });
      setClip(null);
      setTopic(null);
      await qc.invalidateQueries({ queryKey: ['voice-mine'] });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function choose(r: Reply) {
    if (!note) return;
    setBusy(true);
    try {
      await api(`/voice/notes/${note.id}/choose`, { method: 'POST', body: { vendorId: r.vendorId } });
      await qc.invalidateQueries({ queryKey: ['voice-mine'] });
      router.push(`/vendor/${r.vendorId}`);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function closeNote() {
    if (!note) return;
    await api(`/voice/notes/${note.id}/close`, { method: 'POST' }).catch(() => null);
    await qc.invalidateQueries({ queryKey: ['voice-mine'] });
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Voice note" />
      {q.isLoading ? (
        <Loader />
      ) : q.isError ? (
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
          {open && note ? (
            <>
              <Card style={{ gap: space.sm }}>
                <Text variant="title">Aapka voice note</Text>
                <Text variant="small">Ye sirf listeners ko dikhta hai. 24 ghante tak khula rahega.</Text>
                <VoicePlayer uri={audioSrc(note.audioUrl)} durationSec={note.durationSec} />
                <Button title="Note band karein" kind="ghost" size="sm" onPress={closeNote} />
              </Card>
              <Text variant="h3">Listeners ke jawab ({note.replies.length})</Text>
              {note.replies.length === 0 ? (
                <Empty icon="mic-outline" title="Abhi koi jawab nahi aaya" text="Listeners online aate hi sunkar jawab denge. Aapko notification milegi." />
              ) : (
                note.replies.map((r) => (
                  <Card key={r.id} style={{ gap: space.sm }}>
                    <Row gap={space.md}>
                      <Avatar name={r.name} uri={r.avatarUrl} size={44} status={r.isOnline ? 'online' : 'offline'} />
                      <View style={{ flex: 1 }}>
                        <Text variant="title" numberOfLines={1}>{r.name}</Text>
                        <Text variant="small" numberOfLines={1}>{r.headline}</Text>
                      </View>
                      <Text variant="small">⭐ {r.ratingAvg.toFixed(1)}</Text>
                    </Row>
                    <VoicePlayer uri={audioSrc(r.audioUrl)} durationSec={r.durationSec} />
                    <Button title="Inhe chunein aur baat karein" size="md" loading={busy} onPress={() => choose(r)} />
                  </Card>
                ))
              )}
            </>
          ) : (
            <>
              {note?.chosenVendorId ? (
                <Card>
                  <Text variant="title">Pichhla note band ho chuka hai</Text>
                  <Text variant="small">Aap naya note chhod sakte hain.</Text>
                </Card>
              ) : null}
              <Card style={{ gap: space.md }}>
                <Text variant="h3">Apni baat bolkar chhod dein</Text>
                <Text variant="small">Abhi koi online nahi? Apni baat 1 minute tak record karein. Listeners sunkar apna jawab denge, aur aap jise chahein chun sakte hain.</Text>
                <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
                  {TOPICS.map((t) => (
                    <Chip key={t} label={t} active={topic === t} onPress={() => setTopic(topic === t ? null : t)} />
                  ))}
                </Row>
                <VoiceRecorder maxSec={60} onReady={(uri, sec) => setClip({ uri, sec })} onClear={() => setClip(null)} />
                {err ? <Text variant="small" color={colors.danger}>{err}</Text> : null}
                <Button title="Listeners ko bhejein" disabled={!clip} loading={busy} onPress={send} />
              </Card>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
