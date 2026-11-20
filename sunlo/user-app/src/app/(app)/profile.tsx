import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { LevelBadge, coinPriceText, levelFromMinutes } from '@/components/LevelBadge';
import { Button, Chip, Header, Input, Loader, Row, Screen, Text } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { qk, useAppConfig, useMe } from '@/lib/queries';
import type { Gender } from '@/lib/types';
import { colors, radius, space } from '@/theme';

export default function Profile() {
  const me = useMe();
  const cfg = useAppConfig();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const nameLocked = !!me.data?.user.name && me.data.user.name.trim().length >= 2;
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = me.data?.user;
    if (!u) return;
    setName(u.name ?? '');
    setUsername(u.username ?? '');
    setEmail(u.email ?? '');
    setGender(u.gender);
    setAnonymous(!!u.anonymous);
  }, [me.data?.user]);

  async function save() {
    if (name.trim().length < 2) return setError('Naam likhein');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Email sahi nahi hai');
    setSaving(true);
    setError(null);
    try {
      const uname = username.trim().toLowerCase();
      if (uname && uname !== (me.data?.user.username ?? '')) {
        if (!/^[a-z][a-z0-9_.]{2,19}$/.test(uname)) {
          setSaving(false);
          return setError('Username 3-20 akshar ka ho: a-z, 0-9, _ ya . (shuru letter se)');
        }
        try {
          await api('/me/username', { method: 'PATCH', body: { username: uname } });
        } catch (e) {
          setSaving(false);
          return setError(errorMessage(e));
        }
      }
      await api('/me', {
        method: 'PATCH',
        body: { ...(nameLocked ? {} : { name: name.trim() }), email: email.trim() || null, ...(gender ? { gender } : {}), anonymous },
      });
      await qc.invalidateQueries({ queryKey: qk.me });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const u = me.data?.user;
  const minutes = u?.totalMinutes ?? 0;
  const st = cfg.data?.settings;
  const level = levelFromMinutes(minutes, st?.levelIntermediateMinutes ?? 500, st?.levelExpertMinutes ?? 1500);
  const coinPaise = level === 'EXPERT' ? (st?.coinPaiseExpert ?? 50) : level === 'INTERMEDIATE' ? (st?.coinPaiseIntermediate ?? 60) : (st?.coinPaiseBeginner ?? 80);
  const nextAt = level === 'BEGINNER' ? (st?.levelIntermediateMinutes ?? 500) : level === 'INTERMEDIATE' ? (st?.levelExpertMinutes ?? 1500) : null;
  const isDefaultUsername = !!u?.username && !!u?.publicId && u.username === `user${u.publicId}`;

  if (me.isLoading) return <Loader />;
  return (
    <Screen edges={['top']}>
      <Header title="Meri Profile" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.lg }}>
            <Input label="Mobile number" value={me.data?.user.phone ?? ''} editable={false} style={{ color: colors.textMuted }} />
            <Input label="Bondty ID" value={me.data?.user.publicCode ?? ''} editable={false} style={{ color: colors.textMuted }} />
            <View style={{ gap: 4 }}>
              <Input label="Username" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} maxLength={20} autoCapitalize="none" autoCorrect={false} placeholder="apna username" />
              {isDefaultUsername ? <Text variant="caption">Abhi apne aap bana hua username hai. Apni pasand ka rakh lein.</Text> : null}
            </View>
            <View style={{ gap: 4 }}>
              <Input label="Naam" value={name} onChangeText={setName} maxLength={60} editable={!nameLocked} style={nameLocked ? { color: colors.textMuted } : undefined} />
              {nameLocked ? <Text variant="caption">Naam ek baar save hone ke baad badla nahi ja sakta.</Text> : null}
            </View>
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
          {/* Listener ko kaun sa naam dikhe */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
            <Text variant="label">Listener ko kya dikhe</Text>
            {(
              [
                [false, name.trim() ? name.trim().split(' ')[0] : 'Aapka naam', 'Asli naam', 'person-outline'],
                [true, username ? `@${username}` : '@username', 'Username (naam chhupa rahega)', 'eye-off-outline'],
              ] as const
            ).map(([val, title, sub, ic]) => (
              <Pressable
                key={String(val)}
                onPress={() => setAnonymous(val)}
                accessibilityRole="radio"
                accessibilityState={{ selected: anonymous === val }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  borderWidth: 1.5,
                  borderColor: anonymous === val ? colors.primary : colors.border,
                  backgroundColor: anonymous === val ? colors.primarySoft : colors.surface,
                  borderRadius: radius.md,
                  padding: space.md,
                }}
              >
                <Ionicons name={ic} size={20} color={anonymous === val ? colors.primary : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" raw>
                    {title}
                  </Text>
                  <Text variant="small">{sub}</Text>
                </View>
                <Ionicons name={anonymous === val ? 'radio-button-on' : 'radio-button-off'} size={20} color={anonymous === val ? colors.primary : colors.textFaint} />
              </Pressable>
            ))}
            <Text variant="caption">Aapka mobile number kisi listener ko kabhi nahi dikhta.</Text>
          </View>

          {/* Level */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
            <Row gap={space.sm}>
              <Avatar name={me.data?.user.name ?? 'U'} uri={me.data?.user.avatarUrl} gender={gender} size={44} />
              <View style={{ flex: 1, gap: 4 }}>
                <LevelBadge level={level} />
                <Text variant="small">
                  {minutes} minute baat ho chuki hai · {coinPriceText(coinPaise)}
                </Text>
              </View>
            </Row>
            {nextAt ? <Text variant="caption">{Math.max(0, nextAt - minutes)} minute aur baat karein, phir coins aur saste ho jayenge.</Text> : null}
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
