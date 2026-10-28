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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = me.data;
  if (!v) return <Loader />;
  const paise = type === 'AUDIO' ? v.callRatePerMin : v.videoRatePerMin;
  const earnPct = 100 - v.limits.commissionPct;

  async function start() {
    setError(null);
    if (title.trim().length < 3) return setError('Room ka naam kam se kam 3 akshar ka rakhein');
    if (!v!.isOnline) return setError('Pehle Home par jaakar Online ho jayein');
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/vendor/rooms', { method: 'POST', body: { title: title.trim(), type } });
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
          <Text variant="label">Entry rate (aapke {type === 'AUDIO' ? 'voice call' : 'video call'} rate ke barabar)</Text>
          <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 24 }}>{rupees(paise)}/min</Text>
          <Text variant="caption">
            Room mein jo bhi aayega usse yahi rate lagega, aur jab tak room live hai yeh badlega nahi. Aapko har rupaye mein {earnPct}% milega, plus gifts alag. Rate badalna ho to Rates mein jaakar badlein, phir room shuru karein.
          </Text>
          <Text variant="caption" color={colors.primary} onPress={() => router.push('/rates')}>Rate badlein</Text>
        </Card>
        {error ? <Text variant="small" color={colors.danger}>{error}</Text> : null}
        <Button title="Live jayein" icon="radio" loading={busy} onPress={() => void start()} />
      </ScrollView>
    </Screen>
  );
}
