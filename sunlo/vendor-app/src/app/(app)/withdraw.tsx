import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Card, Header, Input, Loader, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { rupees } from '@/lib/format';
import { qk, useEarnings, useVendorMe } from '@/lib/queries';
import { colors, space } from '@/theme';

export default function Withdraw() {
  const me = useVendorMe();
  const e = useEarnings();
  const qc = useQueryClient();
  const [amt, setAmt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!me.data || !e.data) return <Loader />;
  const bal = e.data.balance;
  const min = me.data.limits.minWithdrawalPaise;
  const p = me.data.payout;

  async function submit() {
    const paise = Math.round(Number(amt) * 100);
    if (!(paise >= min)) return setError(`Kam se kam ${rupees(min)}`);
    if (paise > bal) return setError('Balance se zyada nahi nikal sakte');
    setSaving(true);
    setError(null);
    try {
      await api('/vendor/withdrawals', { method: 'POST', body: { amount: paise } });
      await Promise.all([qc.invalidateQueries({ queryKey: ['earnings'] }), qc.invalidateQueries({ queryKey: ['withdrawals'] }), qc.invalidateQueries({ queryKey: qk.me })]);
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Paise nikaalein" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 4 }}>
          <Text variant="caption">Uplabdh balance</Text>
          <Text variant="h1">{rupees(bal)}</Text>
        </Card>
        {!p ? (
          <Card style={{ gap: space.md }}>
            <Text variant="body">Pehle apna bank account ya UPI ID jodein.</Text>
            <Button title="Bank / UPI jodein" onPress={() => router.replace('/payout')} />
          </Card>
        ) : (
          <>
            <Text variant="small">
              Paisa yahan bheja jayega: <Text variant="bodyStrong">{p.method === 'UPI' ? p.upiId : `A/c ••••${p.accountLast4} (${p.ifsc})`}</Text>
            </Text>
            <Input label={`Raqam (kam se kam ${rupees(min)})`} value={amt} onChangeText={(t) => setAmt(t.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" left={<Text variant="bodyStrong">₹</Text>} placeholder="Amount" />
            <Button title="Poora balance" kind="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => setAmt(String(Math.floor(bal / 100)))} />
            {error ? (
              <Text variant="small" color={colors.danger}>
                {error}
              </Text>
            ) : null}
            <Button title="Withdrawal request bhejein" onPress={submit} loading={saving} />
            <Text variant="caption">Request ke baad raqam wallet se hold ho jaati hai aur 2-3 working days mein account mein aati hai.</Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
