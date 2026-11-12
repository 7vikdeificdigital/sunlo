import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { Button, Card, Header, Input, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { qk, useCheckins } from '@/lib/queries';
import { colors, radius, space } from '@/theme';

export const MOOD_FACES = [
  { v: 1, e: '😞', l: 'Bahut bura' },
  { v: 2, e: '😕', l: 'Thoda bura' },
  { v: 3, e: '😐', l: 'Theek-thaak' },
  { v: 4, e: '🙂', l: 'Achha' },
  { v: 5, e: '😄', l: 'Bahut achha' },
];

/** Roz ka 1-tap mood check-in, streak, aur pichhle 30 din. Yeh diagnosis nahi, sirf apne mann par nazar. */
export default function Checkin() {
  const qc = useQueryClient();
  const q = useCheckins();
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!mood) return;
    setSaving(true);
    setErr(null);
    try {
      await api('/checkins', { method: 'POST', body: { mood, ...(note.trim() ? { note: note.trim() } : {}) } });
      setNote('');
      setMood(null);
      qc.invalidateQueries({ queryKey: ['checkins'] });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleReminder(on: boolean) {
    await api('/me', { method: 'PATCH', body: { checkinReminder: on } }).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ['checkins'] });
    qc.invalidateQueries({ queryKey: qk.me });
  }

  if (q.isLoading || !q.data) return <Screen><Header title="Aaj kaisa din tha?" /><Loader /></Screen>;
  const d = q.data;
  const byDay = new Map(d.items.map((i) => [i.day, i]));
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const t = new Date(`${d.today}T00:00:00Z`).getTime() - (13 - i) * 86400_000;
    return new Date(t).toISOString().slice(0, 10);
  });

  return (
    <Screen edges={['top']}>
      <Header title="Aaj kaisa din tha?" subtitle="Roz 1 tap. Sirf aapko dikhta hai" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: space.md }}>
          <Text variant="h3">{d.checkedInToday ? 'Aaj ka mood badalna hai?' : 'Aaj ka mood chunein'}</Text>
          <Row style={{ justifyContent: 'space-between' }}>
            {MOOD_FACES.map((f) => {
              const on = mood === f.v;
              return (
                <Pressable key={f.v} onPress={() => setMood(f.v)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={f.l} style={{ alignItems: 'center', gap: 4, padding: 6, borderRadius: radius.md, backgroundColor: on ? colors.primarySoft : 'transparent' }}>
                  <Text style={{ fontSize: 34, lineHeight: 42 }} raw>
                    {f.e}
                  </Text>
                  <Text variant="caption" color={on ? colors.primaryDark : colors.textFaint}>
                    {f.l}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
          {mood ? <Input value={note} onChangeText={setNote} placeholder="Ek line mein kuch likhna hai? (optional, encrypted)" maxLength={200} /> : null}
          {err ? (
            <Text variant="small" color={colors.danger}>
              {err}
            </Text>
          ) : null}
          <Button title="Save karein" disabled={!mood} loading={saving} onPress={save} />
        </Card>

        {d.suggestion ? (
          <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
            <Text variant="body">{d.suggestion.text}</Text>
            <Row gap={space.sm}>
              <Button title="Listener se baat" icon="chatbubbles-outline" size="md" style={{ flex: 1 }} onPress={() => router.push('/connect')} />
              <Button title={`Call ${d.suggestion.helpline.phone}`} kind="secondary" icon="call-outline" size="md" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${d.suggestion!.helpline.phone}`)} />
            </Row>
          </View>
        ) : null}

        <Card style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text variant="caption">Lagaatar</Text>
              <Text variant="h2">🔥 {d.streak} din</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="caption">7 din ka ausat</Text>
              <Text variant="h2">{d.avg7 ?? '—'}</Text>
            </View>
          </Row>
          <Text variant="label">Pichhle 14 din</Text>
          <Row style={{ justifyContent: 'space-between' }}>
            {last14.map((day) => {
              const it = byDay.get(day);
              return (
                <View key={day} style={{ alignItems: 'center', gap: 2 }} accessibilityLabel={`${day}: ${it ? it.label : 'check-in nahi'}`}>
                  <Text style={{ fontSize: 16 }} raw>
                    {it ? MOOD_FACES[it.mood - 1].e : '·'}
                  </Text>
                  <Text variant="caption">{Number(day.slice(8))}</Text>
                </View>
              );
            })}
          </Row>
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="notifications-outline" size={20} color={colors.primaryDark} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Raat 9:30 baje yaad dilayein</Text>
            <Text variant="caption">Check-in na kiya ho tabhi, din mein ek baar</Text>
          </View>
          <Switch value={d.reminder} onValueChange={toggleReminder} accessibilityLabel="Raat ka reminder" />
        </Card>
        <Text variant="caption" style={{ textAlign: 'center' }}>
          Yeh koi medical jaanch nahi hai. Aap jab chahein Settings &gt; Data aur privacy se sab mita sakte hain.
        </Text>
      </ScrollView>
    </Screen>
  );
}
