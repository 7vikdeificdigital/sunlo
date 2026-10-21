import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { Button, Card, Header, Input, Row, Screen, Segmented, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { qk, useVendorMe } from '@/lib/queries';
import { colors, radius, space } from '@/theme';

/** Payout account. Bank account number server par encrypt hokar save hota hai; app mein sirf last 4 dikhte hain. */
export default function Payout() {
  const me = useVendorMe();
  const qc = useQueryClient();
  const cur = me.data?.payout;
  const [method, setMethod] = useState<'UPI' | 'BANK'>(cur?.method ?? 'UPI');
  const [upi, setUpi] = useState(cur?.method === 'UPI' ? cur.upiId : '');
  const [holder, setHolder] = useState(cur?.method === 'BANK' ? cur.accountHolder : '');
  const [acc, setAcc] = useState('');
  const [acc2, setAcc2] = useState('');
  const [ifsc, setIfsc] = useState(cur?.method === 'BANK' ? cur.ifsc : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (method === 'BANK' && acc !== acc2) return setError('Dono account number ek jaise hone chahiye');
    setSaving(true);
    try {
      await api('/vendor/payout-account', {
        method: 'PUT',
        body: method === 'UPI' ? { method, upiId: upi.trim() } : { method, accountHolder: holder.trim(), accountNumber: acc.trim(), ifsc: ifsc.trim().toUpperCase() },
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
      <Header title="Bank / UPI details" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
          {cur ? (
            <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text variant="caption">Abhi juda hua</Text>
                <Text variant="bodyStrong">{cur.method === 'UPI' ? cur.upiId : `${cur.accountHolder} · A/c ••••${cur.accountLast4} · ${cur.ifsc}`}</Text>
              </View>
            </Card>
          ) : null}
          <Segmented
            value={method}
            onChange={setMethod}
            options={[
              { value: 'UPI', label: 'UPI ID' },
              { value: 'BANK', label: 'Bank account' },
            ]}
          />
          {method === 'UPI' ? (
            <Input label="UPI ID" value={upi} onChangeText={setUpi} autoCapitalize="none" placeholder="naam@okhdfcbank" />
          ) : (
            <View style={{ gap: space.lg }}>
              <Input label="Account holder ka naam" value={holder} onChangeText={setHolder} autoCapitalize="words" />
              <Input label="Account number" value={acc} onChangeText={(t) => setAcc(t.replace(/\D/g, '').slice(0, 18))} keyboardType="number-pad" secureTextEntry />
              <Input label="Account number dobara" value={acc2} onChangeText={(t) => setAcc2(t.replace(/\D/g, '').slice(0, 18))} keyboardType="number-pad" />
              <Input label="IFSC code" value={ifsc} onChangeText={(t) => setIfsc(t.toUpperCase().slice(0, 11))} autoCapitalize="characters" placeholder="HDFC0001234" />
            </View>
          )}
          <Row gap={8} align="flex-start" style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md }}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.primaryDark} />
            <Text variant="small" color={colors.primaryDark} style={{ flex: 1 }}>
              Aapka account number encrypted rehta hai. Sirf payout ke waqt admin team dekh sakti hai, aur har baar uska record banta hai.
            </Text>
          </Row>
          {error ? (
            <Text variant="small" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button title="Save karein" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
