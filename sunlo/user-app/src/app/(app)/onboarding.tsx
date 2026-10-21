import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Input, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/queries';
import type { Gender } from '@/lib/types';
import { colors, radius, space } from '@/theme';

/** Pehli baar login ke baad: naam, (optional) gender, aur 18+ ki pushti */
export default function Onboarding() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (name.trim().length < 2) return setError('Apna naam likhein (koi bhi naam chalega)');
    if (!adult) return setError('Sunlo sirf 18 saal ya usse bade logon ke liye hai');
    setSaving(true);
    setError(null);
    try {
      await api('/me', { method: 'PATCH', body: { name: name.trim(), ...(gender ? { gender } : {}), ageConfirmed: true } });
      await qc.invalidateQueries({ queryKey: qk.me });
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4, marginTop: space.lg }}>
            <Text variant="h1">Swagat hai 🙏</Text>
            <Text variant="body" color={colors.textMuted}>
              Bas do baatein. Aap chahein to asli naam ki jagah koi bhi naam rakh sakte hain; listener/expert ko sirf aapka pehla naam dikhega.
            </Text>
          </View>
          <Input label="Aapka naam" value={name} onChangeText={setName} placeholder="Jaise: Rahul" autoCapitalize="words" maxLength={60} />
          <View style={{ gap: 6 }}>
            <Text variant="label">Gender (optional)</Text>
            <Row gap={space.sm}>
              {(
                [
                  ['MALE', 'Male', 'male'],
                  ['FEMALE', 'Female', 'female'],
                  ['OTHER', 'Other', 'male-female'],
                ] as const
              ).map(([g, l, i]) => (
                <Chip key={g} label={l} icon={i} active={gender === g} onPress={() => setGender(gender === g ? null : g)} />
              ))}
            </Row>
          </View>
          <Pressable
            onPress={() => setAdult((x) => !x)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: adult }}
            style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, borderWidth: 1.5, borderColor: adult ? colors.primary : colors.border }}
          >
            <Ionicons name={adult ? 'checkbox' : 'square-outline'} size={22} color={adult ? colors.primary : colors.textFaint} />
            <Text variant="body" style={{ flex: 1 }}>
              Main 18 saal ya usse bada/badi hoon aur Terms of Use aur Privacy Policy se sahmat hoon.
            </Text>
          </Pressable>
          {error ? (
            <Text variant="small" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button title="Shuru karein" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
