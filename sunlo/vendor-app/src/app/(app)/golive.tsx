import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Header, Input, Loader, Screen, Segmented, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { rupees } from '@/lib/format';
import { useVendorMe } from '@/lib/queries';
import { colors, space } from '@/theme';

/** Live room shuru karein: naam, voice/video, aur per-minute rate (0 = free, kamai sirf gifts se) */
export default function GoLive() {
  const me = useVendorMe();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'AUDIO' | 'VIDEO'>('AUDIO');
  const [rate, setRate] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = me.data;
  if (!v) return <Loader />;
  const { minRatePerMinPaise: min, maxRatePerMinPaise: max, commissionPct } = v.limits;
  const paise = Math.round((Number(rate) || 0) * 100);
  const earnPct = 100 - commissionPct;

  async function start() {
    setError(null);
    if (title.trim().length < 3) return setError('Room ka naam kam se kam 3 akshar ka rakhein');
    if (paise !== 0 && (paise < min || paise > max)) return setError(`Rate ${rupees(min)} se ${rupees(max)} ke beech rakhein, ya 0 (free)`);
    if (!v!.isOnline) return setError('Pehle Home par jaakar Online ho jayein');
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/vendor/rooms', { method: 'POST', body: { title: title.trim(), type, ratePerMin: paise } });
      await qc.invalidateQueries({ queryKey: ['vroom'] });
      router.replace(`/room/${r.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Live room shuru karein" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Text variant="small">Room mein bahut se users judkar aapko sun/dekh sakte hain, chat kar sakte hain aur gifts bhej sakte hain. Room live rehne tak aap 1:1 requests nahi le payenge.</Text>
        <Input label="Room ka naam" value={title} onChangeText={setTitle} placeholder="Jaise: Raat ki dil ki baatein" maxLength={60} />
        <View style={{ gap: 6 }}>
          <Text variant="label">Room ka type</Text>
          <Segmented options={[{ value: 'AUDIO', label: 'Voice room' }, { value: 'VIDEO', label: 'Video room' }]} value={type} onChange={setType} />
        </View>
        <Card style={{ gap: space.sm }}>
          <Input
            label="Entry rate per minute (0 = free)"
            value={rate}
            onChangeText={(t) => setRate(t.replace(/[^\d.]/g, '').slice(0, 6))}
            keyboardType="decimal-pad"
            left={<Text variant="bodyStrong">₹</Text>}
            accessibilityLabel="Room rate"
          />
          <Text variant="caption">
            {paise === 0
              ? 'Free room: kamai sirf gifts se (gift ka kuch hissa aapko milta hai).'
              : `Har sunne wale se ${rupees(paise)}/min. Aapko har rupaye mein ${earnPct}% milega, plus gifts alag.`}
          </Text>
        </Card>
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title="Live jayein" icon="radio" loading={busy} onPress={() => void start()} />
      </ScrollView>
    </Screen>
  );
}
