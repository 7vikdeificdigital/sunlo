import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { DobInput, isAdult } from '@/components/DobInput';
import { Button, Chip, Input, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { qk, useAppConfig, useMe } from '@/lib/queries';
import type { Gender } from '@/lib/types';
import { colors, radius, space } from '@/theme';

/** Pehli baar login ke baad: naam, (optional) gender, aur 18+ ki pushti */
export default function Onboarding() {
  const qc = useQueryClient();
  const me = useMe();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [adult, setAdult] = useState(false);
  const [dob, setDob] = useState<string | null>(null);
  const cfg = useAppConfig();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Server ne apne aap 'user123456' jaisa username diya hai: user apni pasand ka rakh sakta hai
  useEffect(() => {
    const u = me.data?.user;
    if (u?.username && !username) setUsername(u.username);
  }, [me.data?.user, username]);

  async function save() {
    if (name.trim().length < 2) return setError('Apna naam likhein (koi bhi naam chalega)');
    const uname = username.trim().toLowerCase();
    if (uname && !/^[a-z][a-z0-9_.]{2,19}$/.test(uname)) return setError('Username 3-20 akshar ka ho: a-z, 0-9, _ ya . (shuru letter se)');
    if (!dob) return setError('Apni janm-tithi sahi daalein');
    if (!isAdult(dob)) return setError('Bondty sirf 18 saal ya usse bade logon ke liye hai');
    if (!adult) return setError('Aage badhne ke liye Terms aur Privacy notice par sahmati dein');
    setSaving(true);
    setError(null);
    try {
      if (uname && uname !== (me.data?.user.username ?? '')) {
        try {
          await api('/me/username', { method: 'PATCH', body: { username: uname } });
        } catch (e) {
          setSaving(false);
          return setError(errorMessage(e));
        }
      }
      await api('/me', { method: 'PATCH', body: { name: name.trim(), ...(gender ? { gender } : {}), anonymous, dateOfBirth: dob, ageConfirmed: true } });
      // DPDP: kis privacy notice par sahmati di, uska record
      const version = cfg.data?.settings.policyVersion;
      if (version) await api('/me/consent', { method: 'POST', body: { version } }).catch(() => undefined);
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
            <Input
              label="Username"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase())}
              placeholder="jaise: shant_mann"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            <Text variant="caption">Apni pasand ka username rakh lein. Baad mein badal bhi sakte hain.</Text>
          </View>
          <View style={{ gap: 6 }}>
            <Text variant="label">Listener ko kya dikhe</Text>
            <Row gap={space.sm}>
              <Chip label="Mera naam" icon="person" active={!anonymous} onPress={() => setAnonymous(false)} />
              <Chip label="Sirf username" icon="eye-off" active={anonymous} onPress={() => setAnonymous(true)} />
            </Row>
            <Text variant="caption">Naam chhupana ho to username chunein. Mobile number kisi ko kabhi nahi dikhta.</Text>
          </View>
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
          <DobInput value={dob} onChange={setDob} />
          <Pressable
            onPress={() => setAdult((x) => !x)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: adult }}
            style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, borderWidth: 1.5, borderColor: adult ? colors.primary : colors.border }}
          >
            <Ionicons name={adult ? 'checkbox' : 'square-outline'} size={22} color={adult ? colors.primary : colors.textFaint} />
            <Text variant="body" style={{ flex: 1 }}>
              Main 18 saal ya usse bada/badi hoon. Maine Terms of Use aur Privacy notice padh li hai aur apna data uske hisaab se use karne ki sahmati deta/deti hoon.
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
