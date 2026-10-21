import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { pickAndUpload } from '@/lib/pickImage';
import { qk, useAppConfig } from '@/lib/queries';
import type { Gender, VendorMe } from '@/lib/types';
import { colors, radius, space } from '@/theme';
import { Avatar, resolveFileUrl } from './Avatar';
import { Button, Chip, Input, Row, Text } from './ui';

const KYC_TYPES = [
  ['AADHAAR', 'Aadhaar'],
  ['PAN', 'PAN'],
  ['PASSPORT', 'Passport'],
  ['DRIVING_LICENCE', 'Driving Licence'],
  ['VOTER_ID', 'Voter ID'],
] as const;

/**
 * Vendor profile ka form: onboarding aur edit dono mein.
 * Step 1: Parichay · Step 2: Categories/bhasha · Step 3: Photo + ID
 */
export function ProfileForm({ me, mode, onSaved }: { me: VendorMe; mode: 'onboarding' | 'edit'; onSaved: () => void }) {
  const qc = useQueryClient();
  const cfg = useAppConfig();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(me.displayName);
  const [headline, setHeadline] = useState(me.headline);
  const [bio, setBio] = useState(me.bio);
  const [gender, setGender] = useState<Gender | null>(me.gender);
  const [exp, setExp] = useState(String(me.experienceYears || ''));
  const [cats, setCats] = useState<string[]>(me.categories.map((c) => c.id));
  const [langs, setLangs] = useState<string[]>(me.languages);
  const [tags, setTags] = useState(me.tags.join(', '));
  const [avatar, setAvatar] = useState<{ id?: string; uri: string | null }>({ uri: me.avatarUrl });
  const [kyc, setKyc] = useState<{ id?: string; uri?: string; done: boolean }>({ done: me.hasKyc });
  const [kycType, setKycType] = useState<string | null>(me.kycDocType);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kycLocked = me.status === 'PENDING';

  useEffect(() => setError(null), [step]);

  const steps = mode === 'onboarding' ? ['Parichay', 'Topics', 'Photo & ID'] : ['Parichay', 'Topics', 'Photo'];

  function validate(s: number): string | null {
    if (s === 0) {
      if (displayName.trim().length < 3) return 'Naam kam se kam 3 akshar ka';
      if (headline.trim().length < 5) return 'Ek line ka parichay (headline) likhein';
      if (bio.trim().length < 50) return `Parichay kam se kam 50 akshar ka (abhi ${bio.trim().length})`;
      if (!gender) return 'Gender chunein';
    }
    if (s === 1) {
      if (!cats.length) return 'Kam se kam ek category chunein';
      if (!langs.length) return 'Kam se kam ek bhasha chunein';
    }
    if (s === 2) {
      if (!avatar.uri) return 'Profile photo lagayein';
      if (mode === 'onboarding' && (!kyc.done || !kycType)) return 'ID document ka type chunein aur photo upload karein';
    }
    return null;
  }

  async function save(final: boolean) {
    const err = validate(step);
    if (err) return setError(err);
    if (!final) return setStep(step + 1);
    setBusy('save');
    setError(null);
    try {
      await api('/vendor/me', {
        method: 'PATCH',
        body: {
          displayName: displayName.trim(),
          headline: headline.trim(),
          bio: bio.trim(),
          gender: gender ?? undefined,
          experienceYears: Math.max(0, Math.min(60, Number(exp) || 0)),
          categoryIds: cats,
          languages: langs,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length >= 2)
            .slice(0, 8),
          ...(avatar.id ? { avatarUploadId: avatar.id } : {}),
          ...(!kycLocked && kyc.id ? { kycUploadId: kyc.id } : {}),
          ...(!kycLocked && kycType && mode === 'onboarding' ? { kycDocType: kycType } : {}),
        },
      });
      if (mode === 'onboarding') await api('/vendor/me/submit', { method: 'POST' });
      await qc.invalidateQueries({ queryKey: qk.me });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function upload(kind: 'AVATAR' | 'KYC') {
    setBusy(kind);
    setError(null);
    try {
      const r = await pickAndUpload(kind);
      if (!r) return;
      if (kind === 'AVATAR') setAvatar({ id: r.id, uri: r.previewUri });
      else setKyc({ id: r.id, uri: r.previewUri, done: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const toggle = (arr: string[], v: string, max: number) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.length < max ? [...arr, v] : arr);

  return (
    <View style={{ gap: space.lg }}>
      {/* Stepper */}
      <Row gap={space.sm}>
        {steps.map((t, i) => (
          <Pressable key={t} onPress={() => i < step && setStep(i)} style={{ flex: 1, gap: 6 }} accessibilityRole="tab" accessibilityState={{ selected: i === step }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.primary : colors.border }} />
            <Text variant="caption" color={i === step ? colors.primaryDark : colors.textFaint}>
              {i + 1}. {t}
            </Text>
          </Pressable>
        ))}
      </Row>

      {step === 0 ? (
        <View style={{ gap: space.lg }}>
          <Input label="Profile par dikhne wala naam" value={displayName} onChangeText={setDisplayName} maxLength={50} placeholder="Jaise: Meera Sharma" />
          <Input label="Ek line mein parichay" value={headline} onChangeText={setHeadline} maxLength={80} placeholder="Jaise: Trained listener · bina judge kiye sunti hoon" />
          <Input
            label={`Apne baare mein (${bio.trim().length}/50+ akshar)`}
            value={bio}
            onChangeText={setBio}
            maxLength={1500}
            multiline
            style={{ minHeight: 110, textAlignVertical: 'top' }}
            placeholder="Aap kis tarah logon ki madad karte hain, aapka anubhav kya hai..."
          />
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
          <Input label="Anubhav (saal)" value={exp} onChangeText={(t) => setExp(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="0" />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: space.lg }}>
          <View style={{ gap: 8 }}>
            <Text variant="label">Kin topics par baat karenge? (max 4)</Text>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              {cfg.data?.categories.map((c) => (
                <Chip key={c.id} label={`${c.name}${c.kind === 'LISTENER' ? ' · Listener' : ''}`} active={cats.includes(c.id)} onPress={() => setCats(toggle(cats, c.id, 4))} />
              ))}
            </Row>
          </View>
          <View style={{ gap: 8 }}>
            <Text variant="label">Bhashayein</Text>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              {cfg.data?.languages.map((l) => (
                <Chip key={l} label={l} active={langs.includes(l)} onPress={() => setLangs(toggle(langs, l, 8))} />
              ))}
            </Row>
          </View>
          <Input label="Khaas skills (comma se alag, optional)" value={tags} onChangeText={setTags} placeholder="Jaise: Stress, Interview, Tax" maxLength={200} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: space.lg }}>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            {avatar.uri ? (
              avatar.id ? (
                <Image source={{ uri: avatar.uri }} style={{ width: 110, height: 110, borderRadius: 55 }} />
              ) : (
                <Image source={{ uri: resolveFileUrl(avatar.uri) }} style={{ width: 110, height: 110, borderRadius: 55 }} />
              )
            ) : (
              <Avatar name={displayName || 'V'} size={110} />
            )}
            <Button title={avatar.uri ? 'Photo badlein' : 'Profile photo lagayein'} kind="secondary" size="md" icon="camera-outline" loading={busy === 'AVATAR'} onPress={() => upload('AVATAR')} />
            <Text variant="caption" style={{ textAlign: 'center' }}>
              Saaf, muskurata chehra. Users ko yahi dikhega.
            </Text>
          </View>

          {mode === 'onboarding' ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
              <Row gap={8}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} />
                <Text variant="title">ID verification</Text>
              </Row>
              <Text variant="small">Yeh sirf admin team verification ke liye dekhti hai. Users ko kabhi nahi dikhta.</Text>
              <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                {KYC_TYPES.map(([v, l]) => (
                  <Chip key={v} label={l} active={kycType === v} onPress={() => !kycLocked && setKycType(v)} />
                ))}
              </Row>
              {kyc.uri ? <Image source={{ uri: kyc.uri }} style={{ width: '100%', height: 160, borderRadius: radius.md }} resizeMode="cover" /> : null}
              <Button
                title={kyc.done ? 'Upload ho gaya ✓ · badlein' : 'Document ki photo upload karein'}
                kind={kyc.done ? 'ghost' : 'secondary'}
                size="md"
                icon="document-attach-outline"
                loading={busy === 'KYC'}
                disabled={kycLocked}
                onPress={() => upload('KYC')}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <Row gap={space.md}>
        {step > 0 ? <Button title="Peeche" kind="ghost" style={{ flex: 0.6 }} onPress={() => setStep(step - 1)} /> : null}
        {step < steps.length - 1 ? (
          <Button title="Aage" style={{ flex: 1 }} onPress={() => save(false)} />
        ) : (
          <Button title={mode === 'onboarding' ? 'Review ke liye bhejein' : 'Save karein'} style={{ flex: 1.4 }} loading={busy === 'save'} onPress={() => save(true)} />
        )}
      </Row>
    </View>
  );
}
