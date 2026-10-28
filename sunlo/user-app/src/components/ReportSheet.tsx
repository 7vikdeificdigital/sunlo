import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorMessage } from '@/lib/api';
import { colors, radius, space } from '@/theme';
import { Button, Input, Text } from './ui';

const REASONS = [
  { v: 'INAPPROPRIATE_BEHAVIOUR', l: 'Galat ya ashleel vyavhar' },
  { v: 'ASKED_FOR_MONEY_OR_CONTACT', l: 'Alag se paise ya number maanga' },
  { v: 'HARASSMENT', l: 'Pareshaan / dhamki' },
  { v: 'SPAM_OR_FAKE', l: 'Fake profile / spam' },
  { v: 'OTHER', l: 'Kuch aur' },
] as const;

/** Vendor ki shikayat: seedha admin panel mein jaati hai */
export function ReportSheet({ vendorId, sessionId, context, onClose }: { vendorId: string; sessionId?: string; context?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<(typeof REASONS)[number]['v'] | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) return;
    setState('saving');
    setError(null);
    try {
      await api('/reports', { method: 'POST', body: { vendorId, sessionId, reason, details: [context, details.trim()].filter(Boolean).join(' · ') || undefined } });
      setState('done');
    } catch (e) {
      setError(errorMessage(e));
      setState('idle');
    }
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Band karein" />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: space.xl + insets.bottom, gap: space.md }}>
        {state === 'done' ? (
          <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text variant="h3">Shikayat mil gayi</Text>
            <Text variant="small" style={{ textAlign: 'center' }}>
              Hamari team 24 ghante mein jaanch karegi. Zaroorat ho to paisa wapas kiya jayega.
            </Text>
            <Button title="Theek hai" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: space.md }} />
          </View>
        ) : (
          <>
            <Text variant="h3">Report karein</Text>
            {REASONS.map((r) => (
              <Pressable key={r.v} onPress={() => setReason(r.v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }} accessibilityRole="radio" accessibilityState={{ checked: reason === r.v }}>
                <Ionicons name={reason === r.v ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === r.v ? colors.primary : colors.textFaint} />
                <Text variant="body">{r.l}</Text>
              </Pressable>
            ))}
            <Input value={details} onChangeText={setDetails} placeholder="Thoda vistaar se batayein (optional)" maxLength={1000} multiline />
            {error ? (
              <Text variant="small" color={colors.danger}>
                {error}
              </Text>
            ) : null}
            <Button title="Shikayat bhejein" kind="danger" disabled={!reason} loading={state === 'saving'} onPress={submit} />
          </>
        )}
      </View>
    </Modal>
  );
}
