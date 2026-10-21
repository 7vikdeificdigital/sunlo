import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { Button, Card, Header, Input, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { rupees } from '@/lib/format';
import { qk, useVendorMe } from '@/lib/queries';
import { colors, space } from '@/theme';

type Key = 'chat' | 'call' | 'video';
const LABEL: Record<Key, string> = { chat: 'Chat', call: 'Voice call', video: 'Video call' };

/** Vendor apna rate khud tay kare, admin ki min/max seema ke andar */
export default function Rates() {
  const me = useVendorMe();
  const qc = useQueryClient();
  const [rates, setRates] = useState<Record<Key, string>>({ chat: '', call: '', video: '' });
  const [on, setOn] = useState<Record<Key, boolean>>({ chat: true, call: true, video: false });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const v = me.data;

  useEffect(() => {
    if (!v) return;
    setRates({ chat: String(v.chatRatePerMin / 100), call: String(v.callRatePerMin / 100), video: String(v.videoRatePerMin / 100) });
    setOn({ chat: v.chatEnabled, call: v.callEnabled, video: v.videoEnabled });
  }, [v]);

  if (!v) return <Loader />;
  const min = v.limits.minRatePerMinPaise;
  const max = v.limits.maxRatePerMinPaise;
  const earnPct = 100 - v.limits.commissionPct;

  async function save() {
    const p = (k: Key) => Math.round(Number(rates[k]) * 100);
    for (const k of ['chat', 'call', 'video'] as Key[]) {
      if (!(p(k) >= min && p(k) <= max)) return setError(`${LABEL[k]} ka rate ${rupees(min)} se ${rupees(max)} ke beech rakhein`);
    }
    if (!on.chat && !on.call && !on.video) return setError('Kam se kam ek seva chalu rakhein');
    setSaving(true);
    setError(null);
    try {
      await api('/vendor/rates', {
        method: 'PATCH',
        body: { chatRatePerMin: p('chat'), callRatePerMin: p('call'), videoRatePerMin: p('video'), chatEnabled: on.chat, callEnabled: on.call, videoEnabled: on.video },
      });
      await qc.invalidateQueries({ queryKey: qk.me });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Rate aur services" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Text variant="small">
          Rate {rupees(min)} se {rupees(max)} per minute ke beech rakh sakte hain. Har rupaye mein se aapko {earnPct}% milta hai.
        </Text>
        {(['chat', 'call', 'video'] as Key[]).map((k) => {
          const val = Number(rates[k]) || 0;
          return (
            <Card key={k} style={{ gap: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="title">{LABEL[k]}</Text>
                <Switch value={on[k]} onValueChange={(x) => setOn({ ...on, [k]: x })} trackColor={{ true: colors.primaryTint, false: colors.border }} thumbColor={on[k] ? colors.primary : colors.white} accessibilityLabel={`${LABEL[k]} chalu/band`} />
              </Row>
              <View style={{ opacity: on[k] ? 1 : 0.5 }}>
                <Input
                  value={rates[k]}
                  onChangeText={(t) => setRates({ ...rates, [k]: t.replace(/[^\d.]/g, '').slice(0, 6) })}
                  keyboardType="decimal-pad"
                  editable={on[k]}
                  left={<Text variant="bodyStrong">₹</Text>}
                  placeholder="Rate per minute"
                  accessibilityLabel={`${LABEL[k]} rate`}
                />
              </View>
              <Text variant="caption">Aapki kamai: lagbhag {rupees(Math.round(val * earnPct))}/min</Text>
            </Card>
          );
        })}
        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        <Button title="Save karein" onPress={save} loading={saving} />
      </ScrollView>
    </Screen>
  );
}
