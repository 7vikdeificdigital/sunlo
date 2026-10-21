import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { Button, Chip, Header, Input, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { qk, useMe } from '@/lib/queries';
import type { Gender } from '@/lib/types';
import { colors, radius, space } from '@/theme';

export default function Profile() {
  const me = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = me.data?.user;
    if (!u) return;
    setName(u.name ?? '');
    setEmail(u.email ?? '');
    setGender(u.gender);
  }, [me.data?.user]);

  async function save() {
    if (name.trim().length < 2) return setError('Naam likhein');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Email sahi nahi hai');
    setSaving(true);
    setError(null);
    try {
      await api('/me', { method: 'PATCH', body: { name: name.trim(), email: email.trim() || null, ...(gender ? { gender } : {}) } });
      await qc.invalidateQueries({ queryKey: qk.me });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (me.isLoading) return <Loader />;
  return (
    <Screen edges={['top']}>
      <Header title="Meri Profile" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.lg }}>
            <Input label="Mobile number" value={me.data?.user.phone ?? ''} editable={false} style={{ color: colors.textMuted }} />
            <Input label="Naam" value={name} onChangeText={setName} maxLength={60} />
            <Input label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="aap@example.com" />
            <View style={{ gap: 6 }}>
              <Text variant="label">Gender</Text>
              <Row gap={space.sm}>
                {(
                  [
                    ['MALE', 'Male'],
                    ['FEMALE', 'Female'],
                    ['OTHER', 'Other'],
                  ] as const
                ).map(([g, l]) => (
                  <Chip key={g} label={l} active={gender === g} onPress={() => setGender(g)} />
                ))}
              </Row>
            </View>
          </View>
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
