import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Empty, Input, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useReviews } from '@/lib/queries';
import { colors, font, radius, space } from '@/theme';

export default function Reviews() {
  const q = useReviews();
  const [replying, setReplying] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function send(id: string) {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/vendor/reviews/${id}/reply`, { method: 'POST', body: { reply: text.trim() } });
      setReplying(null);
      setText('');
      await q.refetch();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Row style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, justifyContent: 'space-between' }}>
        <Text variant="h2">Reviews</Text>
        {q.data ? (
          <Row gap={4}>
            <Ionicons name="star" size={18} color={colors.accent} />
            <Text style={{ fontFamily: font.semibold, fontSize: 18 }}>{q.data.ratingAvg ? q.data.ratingAvg.toFixed(1) : '—'}</Text>
            <Text variant="small"> ({q.data.ratingCount})</Text>
          </Row>
        ) : null}
      </Row>
      {q.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.xl }}
          ListEmptyComponent={<Empty icon="star-outline" title="Abhi koi review nahi" text="Session ke baad users rating dete hain" />}
          renderItem={({ item }) => (
            <Card style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="bodyStrong">{item.userName}</Text>
                <Text variant="caption">{formatDate(item.createdAt)}</Text>
              </Row>
              <Row gap={2}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name={i < item.rating ? 'star' : 'star-outline'} size={14} color={colors.accent} />
                ))}
              </Row>
              {item.comment ? <Text variant="body">{item.comment}</Text> : null}
              {item.reply ? (
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: space.sm }}>
                  <Text variant="caption">Aapka jawab</Text>
                  <Text variant="small" color={colors.text}>
                    {item.reply}
                  </Text>
                </View>
              ) : replying === item.id ? (
                <View style={{ gap: space.sm }}>
                  <Input value={text} onChangeText={setText} placeholder="Dhanyavaad likhein..." maxLength={500} multiline />
                  {error ? (
                    <Text variant="small" color={colors.danger}>
                      {error}
                    </Text>
                  ) : null}
                  <Row gap={space.sm}>
                    <Button title="Cancel" kind="ghost" size="sm" onPress={() => setReplying(null)} />
                    <Button title="Jawab bhejein" size="sm" loading={saving} onPress={() => send(item.id)} />
                  </Row>
                </View>
              ) : (
                <Button
                  title="Jawab dein"
                  kind="ghost"
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => {
                    setReplying(item.id);
                    setText('');
                  }}
                />
              )}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
