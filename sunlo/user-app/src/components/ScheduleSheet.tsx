import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorMessage } from '@/lib/api';
import { perMin, rupees } from '@/lib/format';
import { useFeatures } from '@/lib/queries';
import type { SessionType, VendorCard } from '@/lib/types';
import { colors, radius, space } from '@/theme';
import { Avatar } from './Avatar';
import { Button, Chip, Input, Row, Text } from './ui';

const DURATIONS = [15, 30, 45, 60] as const;

/** Aage ke 7 din, aur har din 30-30 minute ke slot (kam se kam 30 minute baad se) */
function useSlots() {
  return useMemo(() => {
    const now = Date.now();
    const days: { key: string; label: string; slots: Date[] }[] = [];
    for (let d = 0; d < 7; d++) {
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      base.setDate(base.getDate() + d);
      const slots: Date[] = [];
      for (let m = 8 * 60; m <= 23 * 60 + 30; m += 30) {
        const t = new Date(base.getTime() + m * 60_000);
        if (t.getTime() >= now + 30 * 60_000) slots.push(t);
      }
      if (slots.length)
        days.push({
          key: base.toDateString(),
          label: d === 0 ? 'Aaj' : d === 1 ? 'Kal' : base.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
          slots,
        });
    }
    return days;
  }, []);
}

/** Apne listener ke saath baad ka time book karna. Listener confirm karta hai; 10 minute pehle dono ko yaad. */
export function ScheduleSheet({ vendor, initialType, onClose }: { vendor: VendorCard; initialType: SessionType; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const features = useFeatures();
  const days = useSlots();
  const types = (
    [
      ['CHAT', 'Chat', vendor.chatEnabled, vendor.chatRatePerMin],
      ['AUDIO', 'Voice', vendor.callEnabled, vendor.callRatePerMin],
      ['VIDEO', 'Video', vendor.videoEnabled && features.videoCalls, vendor.videoRatePerMin],
    ] as const
  ).filter((t) => t[2]);
  const [type, setType] = useState<SessionType>(types.some((t) => t[0] === initialType) ? initialType : (types[0]?.[0] ?? 'CHAT'));
  const [dayKey, setDayKey] = useState(days[0]?.key ?? '');
  const [slot, setSlot] = useState<Date | null>(null);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(30);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rate = types.find((t) => t[0] === type)?.[3] ?? vendor.chatRatePerMin;
  const day = days.find((d) => d.key === dayKey) ?? days[0];

  async function book() {
    if (!slot) return setError('Samay chunein');
    setSaving(true);
    setError(null);
    try {
      await api('/scheduled-calls', { method: 'POST', body: { vendorId: vendor.id, type, scheduledAt: slot.toISOString(), durationMin: duration, ...(note.trim() ? { note: note.trim() } : {}) } });
      qc.invalidateQueries({ queryKey: ['scheduled-calls'] });
      onClose();
      router.push('/bookings');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Band karein" />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: space.xl + insets.bottom, gap: space.md, maxHeight: '88%' }}>
        <Row gap={space.md}>
          <Avatar name={vendor.displayName} uri={vendor.avatarUrl} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="h3">Time book karein</Text>
            <Text variant="small" numberOfLines={1}>
              {vendor.displayName} ke saath
            </Text>
          </View>
        </Row>
        <ScrollView contentContainerStyle={{ gap: space.md }} keyboardShouldPersistTaps="handled">
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {types.map(([t, l]) => (
              <Chip key={t} label={l} active={type === t} onPress={() => setType(t)} />
            ))}
          </Row>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {days.map((d) => (
              <Chip key={d.key} label={d.label} active={d.key === day?.key} onPress={() => { setDayKey(d.key); setSlot(null); }} />
            ))}
          </ScrollView>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {day?.slots.map((t) => {
              const on = slot?.getTime() === t.getTime();
              return (
                <Pressable
                  key={t.toISOString()}
                  onPress={() => setSlot(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1.5, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.surface }}
                >
                  <Text variant="label" color={on ? colors.primaryDark : colors.text}>
                    {t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
          <View style={{ gap: 6 }}>
            <Text variant="label">Kitni der</Text>
            <Row gap={space.sm}>
              {DURATIONS.map((m) => (
                <Chip key={m} label={`${m} min`} active={duration === m} onPress={() => setDuration(m)} />
              ))}
            </Row>
          </View>
          <Input value={note} onChangeText={setNote} placeholder="Kis baare mein baat karni hai? (optional)" maxLength={200} />
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: space.md, gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small">Rate</Text>
              <Text variant="bodyStrong">{perMin(rate)}</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small">{duration} min ka andaaza</Text>
              <Text variant="bodyStrong">{rupees(rate * duration)}</Text>
            </Row>
            <Text variant="caption">Abhi koi paisa nahi katega. Call ke waqt sirf baat hue minuton ka katega.</Text>
          </View>
          {error ? (
            <Text variant="small" color={colors.danger}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
        <Button title={slot ? `Book karein · ${slot.toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Samay chunein'} icon="calendar" disabled={!slot} loading={saving} onPress={book} />
        <Row gap={6} style={{ justifyContent: 'center' }}>
          <Ionicons name="notifications-outline" size={14} color={colors.textFaint} />
          <Text variant="caption">Listener confirm karenge. 10 minute pehle aapko yaad dilayenge.</Text>
        </Row>
      </View>
    </Modal>
  );
}
