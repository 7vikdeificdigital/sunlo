import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { VoicePlayer, VoiceRecorder } from '@/components/Voice';
import { Button, Card, Empty, ErrorBox, Header, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { audioSrc, uploadClip } from '@/lib/voice';
import { colors, space } from '@/theme';

type Item = { id: string; topic: string | null; userName: string; createdAt: string; audioUrl: string; durationSec: number; replied: boolean };

function NoteCard({ n, onDone }: { n: Item; onDone: () => void }) {
  const [clip, setClip] = useState<{ uri: string; sec: number } | null>(null);
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (!clip) return;
    setBusy(true);
    setErr(null);
    try {
      const up = await uploadClip(clip.uri, clip.sec);
      await api(`/vendor/voice/notes/${n.id}/reply`, { method: 'POST', body: { clipId: up.id } });
      onDone();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: space.sm }}>
      <Row gap={space.sm}>
        <Text variant="title" style={{ flex: 1 }}>{n.userName}</Text>
        {n.topic ? <Text variant="small">{n.topic}</Text> : null}
      </Row>
      <VoicePlayer uri={audioSrc(n.audioUrl)} durationSec={n.durationSec} />
      {n.replied ? (
        <Text variant="small" color={colors.success}>Aap jawab de chuke hain ✓</Text>
      ) : replying ? (
        <>
          <Text variant="small">Apna voice jawab record karein (max 60 sec). Samjhdari aur apnapan se bolein.</Text>
          <VoiceRecorder maxSec={60} onReady={(uri, sec) => setClip({ uri, sec })} onClear={() => setClip(null)} />
          {err ? <Text variant="small" color={colors.danger}>{err}</Text> : null}
          <Button title="Jawab bhejein" disabled={!clip} loading={busy} onPress={send} />
        </>
      ) : (
        <Button title="Voice jawab dein" size="md" icon="mic" onPress={() => setReplying(true)} />
      )}
    </Card>
  );
}

export default function VoiceBoard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['voice-board'], queryFn: () => api<{ items: Item[] }>('/vendor/voice/notes'), refetchInterval: 30_000 });
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Voice notes" subtitle="Users ke chhode hue notes" />
      {q.isLoading ? (
        <Loader />
      ) : q.isError ? (
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
          {(q.data?.items ?? []).length === 0 ? (
            <Empty icon="mic-outline" title="Abhi koi voice note nahi" text="Jab koi user note chhodega, yahan dikhega aur notification milegi." />
          ) : (
            q.data!.items.map((n) => <NoteCard key={n.id} n={n} onDone={() => qc.invalidateQueries({ queryKey: ['voice-board'] })} />)
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
