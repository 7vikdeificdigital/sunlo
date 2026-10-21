import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '@/lib/api';
import { rupees, perMin } from '@/lib/format';
import { useAppConfig, useMe } from '@/lib/queries';
import type { Session, SessionType, VendorCard } from '@/lib/types';
import { colors, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { Button, Input, Row, Text } from './ui';

export function StartSessionSheet({ vendor, initialType, topic, onClose }: { vendor: VendorCard | null; initialType: SessionType; topic?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const me = useMe();
  const cfg = useAppConfig();
  const [type, setType] = useState<SessionType>(initialType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  if (!vendor) return null;

  const options: { t: SessionType; label: string; icon: keyof typeof Ionicons.glyphMap; rate: number; on: boolean }[] = [
    { t: 'CHAT', label: 'Chat', icon: 'chatbubble-ellipses-outline', rate: vendor.chatRatePerMin, on: vendor.chatEnabled },
    { t: 'AUDIO', label: 'Voice Call', icon: 'call-outline', rate: vendor.callRatePerMin, on: vendor.callEnabled },
    { t: 'VIDEO', label: 'Video Call', icon: 'videocam-outline', rate: vendor.videoRatePerMin, on: vendor.videoEnabled },
  ];
  const current = options.find((o) => o.t === type) ?? options[0];
  const minMin = cfg.data?.settings.minSessionMinutes ?? 5;
  const balance = me.data?.walletBalance ?? 0;
  const required = current.rate * minMin;
  const enough = balance >= required;
  const minutesAffordable = Math.floor(balance / current.rate);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const s = await api<Session>('/sessions', {
        method: 'POST',
        body: {
          vendorId: vendor!.id,
          type,
          intake: { topic: topic ?? vendor!.categories[0]?.name, note: note.trim() || undefined },
        },
      });
      qc.invalidateQueries({ queryKey: ['sessions'] });
      onClose();
      router.push(type === 'CHAT' ? `/session/${s.id}` : `/call/${s.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SESSION_ALREADY_OPEN') {
        const open = await api<{ session: Session | null }>('/sessions/open').catch(() => null);
        if (open?.session) {
          onClose();
          router.push(open.session.type === 'CHAT' ? `/session/${open.session.id}` : `/call/${open.session.id}`);
          return;
        }
      }
      setError(e instanceof ApiError ? e.message : 'Kuch gadbad ho gayi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Band karein" />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: space.xl + insets.bottom, gap: space.lg }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: -8 }} />
        <Row gap={space.md}>
          <Avatar name={vendor.displayName} uri={vendor.avatarUrl} size={52} status="online" />
          <View style={{ flex: 1 }}>
            <Text variant="h3" numberOfLines={1}>
              {vendor.displayName}
            </Text>
            <Text variant="small" numberOfLines={1}>
              {vendor.headline}
            </Text>
          </View>
        </Row>

        <Row gap={space.sm}>
          {options
            .filter((o) => o.on)
            .map((o) => {
              const on = o.t === type;
              return (
                <Pressable
                  key={o.t}
                  onPress={() => setType(o.t)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={{
                    flex: 1,
                    padding: space.md,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: on ? colors.primary : colors.border,
                    backgroundColor: on ? colors.primarySoft : colors.surface,
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name={o.icon} size={20} color={on ? colors.primaryDark : colors.textMuted} />
                  <Text variant="label" color={on ? colors.primaryDark : colors.text}>
                    {o.label}
                  </Text>
                  <Text variant="caption">{perMin(o.rate)}</Text>
                </Pressable>
              );
            })}
        </Row>

        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small">Wallet balance</Text>
            <Text variant="bodyStrong">{rupees(balance)}</Text>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small">Kam se kam ({minMin} min)</Text>
            <Text variant="bodyStrong">{rupees(required)}</Text>
          </Row>
          {enough ? (
            <Text variant="caption">Aap lagbhag {minutesAffordable} minute baat kar sakte hain. Paisa sirf baat hue minuton ka katega.</Text>
          ) : (
            <Text variant="small" color={colors.danger}>
              {rupees(required - balance)} aur chahiye. Pehle wallet recharge karein.
            </Text>
          )}
        </View>

        {enough ? (
          <Input
            value={note}
            onChangeText={setNote}
            placeholder="Kis baare mein baat karni hai? (optional)"
            maxLength={500}
            multiline
            style={{ minHeight: 44, maxHeight: 90 }}
          />
        ) : null}

        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        {enough ? (
          <Button title={`${current.label} shuru karein`} icon={current.icon} loading={loading} onPress={start} />
        ) : (
          <Button
            title="Wallet recharge karein"
            icon="wallet-outline"
            onPress={() => {
              onClose();
              router.push('/wallet');
            }}
          />
        )}
      </View>
    </Modal>
  );
}
