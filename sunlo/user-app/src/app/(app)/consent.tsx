import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DobInput, isAdult } from '@/components/DobInput';
import { Button, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { qk, useAppConfig, useMe } from '@/lib/queries';
import { colors, radius, space } from '@/theme';

/**
 * Naya privacy notice aaya ho ya janm-tithi nahi di ho (purane users): DPDP ke hisaab se
 * saaf notice padhkar sahmati, aur janm-tithi se 18+ ki jaanch.
 */
export default function Consent() {
  const qc = useQueryClient();
  const me = useMe();
  const cfg = useAppConfig();
  const [dob, setDob] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsDob = me.data?.needsDob ?? false;
  const version = cfg.data?.settings.policyVersion;

  async function save() {
    if (needsDob && !dob) return setErr('Apni janm-tithi daalein');
    if (needsDob && dob && !isAdult(dob)) return setErr('Bondty sirf 18 saal ya usse bade logon ke liye hai');
    if (!agree) return setErr('Aage badhne ke liye sahmati dein');
    setSaving(true);
    setErr(null);
    try {
      if (needsDob && dob) await api('/me', { method: 'PATCH', body: { dateOfBirth: dob } });
      if (version) await api('/me/consent', { method: 'POST', body: { version } });
      await qc.invalidateQueries({ queryKey: qk.me });
      router.replace('/');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Text variant="h2" style={{ marginTop: space.lg }}>
          Hamari privacy notice
        </Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: 6 }}>
          <Text variant="small">• Hum aapka phone number (login), naam, janm-tithi (18+ jaanch), wallet aur session ka hisaab rakhte hain.</Text>
          <Text variant="small">• Chat {cfg.data?.settings.chatRetentionDays ?? 90} din baad mit jaati hai. Call record nahi hoti.</Text>
          <Text variant="small">• Aapka data bechte nahi, aur aapki baaton se ads nahi dikhate.</Text>
          <Text variant="small">• Aap kabhi bhi apna data le sakte hain ya sahmati wapas lekar sab mita sakte hain (Account &gt; Data aur privacy).</Text>
          <Text variant="small">• Shikayat: Account &gt; Shikayat / Grievance Officer.</Text>
          <Pressable onPress={() => router.push('/legal')}>
            <Text variant="label" color={colors.primaryDark}>
              Poori Terms aur Privacy Policy padhein →
            </Text>
          </Pressable>
        </View>
        {needsDob ? <DobInput value={dob} onChange={setDob} /> : null}
        <Pressable
          onPress={() => setAgree((x) => !x)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agree }}
          style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, borderWidth: 1.5, borderColor: agree ? colors.primary : colors.border }}
        >
          <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={22} color={agree ? colors.primary : colors.textFaint} />
          <Text variant="body" style={{ flex: 1 }}>
            Maine privacy notice padh li hai aur iske hisaab se apna data use karne ki sahmati deta/deti hoon.
          </Text>
        </Pressable>
        {err ? (
          <Text variant="small" color={colors.danger}>
            {err}
          </Text>
        ) : null}
        <Button title="Sahmat hoon, aage badhein" onPress={save} loading={saving} />
      </ScrollView>
    </Screen>
  );
}
