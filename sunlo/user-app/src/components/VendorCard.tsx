import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { compact, perMin } from '@/lib/format';
import type { VendorCard as A } from '@/lib/types';
import { colors, font, radius, shadow, space } from '@/theme';
import { Avatar } from './Avatar';
import { Button, Row, Text } from './ui';

export const vendorStatus = (a: Pick<A, 'isOnline' | 'isBusy'>) => (a.isBusy ? 'busy' : a.isOnline ? 'online' : 'offline');

/** List card: baayein photo + rating, beech mein jaankari, neeche rate + Chat/Call button */
export function VendorListCard({ a, service, onStart }: { a: A; service: 'chat' | 'call'; onStart: (a: A) => void }) {
  const status = vendorStatus(a);
  const rate = service === 'chat' ? a.chatRatePerMin : a.callRatePerMin;
  const cta = status === 'busy' ? 'Busy' : status === 'offline' ? 'Offline' : service === 'chat' ? 'Chat' : 'Call';
  return (
    <Pressable
      onPress={() => router.push(`/vendor/${a.id}`)}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: space.md,
        marginHorizontal: space.lg,
        marginBottom: space.md,
        flexDirection: 'row',
        gap: space.md,
        opacity: pressed ? 0.95 : 1,
        ...shadow.card,
      })}
    >
      <View style={{ alignItems: 'center', gap: 6, width: 72 }}>
        <Avatar name={a.displayName} uri={a.avatarUrl} size={68} status={status} ring={a.isOnline} />
        <Row gap={2}>
          <Ionicons name="star" size={12} color={colors.primary} />
          <Text variant="label" color={colors.text}>
            {a.ratingCount ? a.ratingAvg.toFixed(1) : 'Naya'}
          </Text>
        </Row>
        <Text variant="caption">{compact(a.totalSessions)} sessions</Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Row gap={4}>
          <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {a.displayName}
          </Text>
          <Ionicons name="checkmark-circle" size={15} color={colors.info} accessibilityLabel="Verified" />
        </Row>
        <Text variant="small" numberOfLines={1} color={colors.text}>
          {a.headline}
        </Text>
        <Text variant="small" numberOfLines={1}>
          {(a.tags.length ? a.tags : a.categories.map((c) => c.name)).join(' · ')}
        </Text>
        <Text variant="small" numberOfLines={1}>
          {a.languages.join(', ')} · {a.experienceYears} saal
        </Text>
        <Row style={{ marginTop: 6, justifyContent: 'space-between' }} gap={6}>
          <View>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: colors.text }}>{perMin(rate)}</Text>
            {a.categories[0] ? (
              <Text variant="caption" color={a.categories[0].kind === 'LISTENER' ? colors.primaryDark : colors.info}>
                {a.categories[0].kind === 'LISTENER' ? 'Listener' : 'Expert'}
              </Text>
            ) : null}
          </View>
          <Button
            title={cta}
            size="sm"
            kind={status === 'online' ? 'success' : 'ghost'}
            disabled={status !== 'online'}
            icon={service === 'chat' ? 'chatbubble-ellipses' : 'call'}
            onPress={() => onStart(a)}
            accessibilityLabel={`${a.displayName} se ${service === 'chat' ? 'chat' : 'call'} karein`}
          />
        </Row>
      </View>
    </Pressable>
  );
}

/** Home screen ka chhota horizontal card */
export function VendorMiniCard({ a }: { a: A }) {
  const status = vendorStatus(a);
  return (
    <Pressable
      onPress={() => router.push(`/vendor/${a.id}`)}
      style={{ width: 128, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, alignItems: 'center', gap: 4, ...shadow.card }}
    >
      <Avatar name={a.displayName} uri={a.avatarUrl} size={60} status={status} ring={a.isOnline} />
      <Text variant="label" color={colors.text} numberOfLines={1} style={{ marginTop: 4 }}>
        {a.displayName}
      </Text>
      <Text variant="caption" numberOfLines={1}>
        {a.categories[0]?.name ?? ''}
      </Text>
      <Text variant="caption">{perMin(a.chatRatePerMin)}</Text>
      <View
        style={{
          marginTop: 4,
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: radius.pill,
          backgroundColor: status === 'online' ? colors.successSoft : colors.surfaceAlt,
        }}
      >
        <Text style={{ fontFamily: font.medium, fontSize: 11, color: status === 'online' ? colors.success : colors.textMuted }}>
          {status === 'online' ? 'Online' : status === 'busy' ? 'Busy' : 'Offline'}
        </Text>
      </View>
    </Pressable>
  );
}
