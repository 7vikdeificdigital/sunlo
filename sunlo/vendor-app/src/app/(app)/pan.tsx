import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { Button, Card, Header, Input, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { qk, useVendorMe } from '@/lib/queries';
import { colors, radius, space } from '@/theme';

/**
 * PAN: TDS ke liye zaroori (Income-tax Act 2025 Sec 393, purana 194-O).
 * PAN ke saath 0.1% TDS, bina PAN 5%. Server par poora PAN encrypted; app mein sirf last 4.
 */
export default function Pan() {
  const me = useVendorMe();
  const qc = useQueryClient();
  const cur = me.data?.pan;
  const tds = me.data?.tds;
  const [pan, setPan] = useState('');
  const [name, setName] = useState(cur?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api('/vendor/pan', { method: 'PUT', body: { pan, name: name.trim() } });
      await qc.invalidateQueries({ queryKey: qk.me });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="PAN (TDS ke liye)" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, gap: 4 }}>
            <Text variant="title">TDS kyon?</Text>
            <Text variant="small">
              Sarkari niyam ke hisaab se Bondty aapki har kamai ki gross raqam par TDS kaat kar sarkar ko jama karta hai. PAN ho to sirf {tds?.pctWithPan ?? 0.1}%, PAN na ho to {tds?.pctWithoutPan ?? 5}%. Yeh TDS aap apne income tax return mein wapas claim kar sakte hain.
            </Text>
          </View>
          {cur ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text variant="title">PAN juda hai: XXXXXX{cur.last4}</Text>
                <Text variant="small">{cur.name}</Text>
              </View>
            </Card>
          ) : null}
          <Input label={cur ? 'Naya PAN (badalna ho to)' : 'PAN number'} value={pan} onChangeText={(t) => setPan(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} error={pan.length === 10 && !valid ? 'PAN sahi nahi lag raha' : undefined} />
          <Input label="PAN par likha naam" value={name} onChangeText={setName} maxLength={80} autoCapitalize="characters" />
          {error ? (
            <Text variant="small" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button title="PAN save karein" icon="shield-checkmark-outline" disabled={!valid || name.trim().length < 3} loading={saving} onPress={save} />
          <Row gap={6}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.textFaint} />
            <Text variant="caption" style={{ flex: 1 }}>
              PAN encrypted rakha jaata hai aur sirf TDS return ke liye istemaal hota hai.
            </Text>
          </Row>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
