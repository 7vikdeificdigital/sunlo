import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Dimensions, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { IconButton, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { VendorMiniCard } from '@/components/VendorCard';
import { WalletChip } from '@/components/WalletChip';
import { useAppConfig, useBanners, useMe, useNotifications, useVendors } from '@/lib/queries';
import { colors, font, gradient, radius, shadow, space } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const TINTS = ['#E3F4F1', '#FFEDE7', '#EEE8FF', '#E6F0FF', '#FFF6D6', '#E3F5EB', '#FDE7F0', '#E8F7F7', '#F1F1F1'];
const W = Dimensions.get('window').width;

export default function Home() {
  const me = useMe();
  const cfg = useAppConfig();
  const banners = useBanners();
  const notif = useNotifications();
  const listenerCat = cfg.data?.categories.find((c) => c.kind === 'LISTENER');
  const listeners = useVendors({ service: 'chat', categoryId: listenerCat?.id, limit: 10 });
  const top = useVendors({ service: 'chat', sort: 'rating', limit: 20 });
  const [refreshing, setRefreshing] = useState(false);
  const name = me.data?.user.name?.split(' ')[0] ?? '';
  const experts = (top.data?.pages[0]?.items ?? []).filter((v) => v.categories.some((c) => c.kind === 'EXPERT')).slice(0, 8);
  const listenerItems = listenerCat ? (listeners.data?.pages[0]?.items ?? []) : [];

  async function refresh() {
    setRefreshing(true);
    await Promise.all([me.refetch(), banners.refetch(), listeners.refetch(), top.refetch(), notif.refetch()]);
    setRefreshing(false);
  }

  const openCategory = (id?: string) => router.push({ pathname: '/chat', params: id ? { category: id } : {} });

  return (
    <Screen>
      {/* Top bar */}
      <Row style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }} gap={space.md}>
        <Pressable onPress={() => router.push('/account')} accessibilityLabel="Account">
          <Avatar name={me.data?.user.name ?? 'U'} size={42} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="small">Namaste</Text>
          <Text variant="title" numberOfLines={1}>
            {name || 'Swagat hai'}
          </Text>
        </View>
        <WalletChip />
        <IconButton name="notifications-outline" label="Notifications" badge={notif.data?.unread} onPress={() => router.push('/notifications')} />
      </Row>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />} contentContainerStyle={{ paddingBottom: space.xxl }}>
        {/* Search */}
        <Pressable
          onPress={() => router.push({ pathname: '/chat', params: { focus: '1' } })}
          style={{ marginHorizontal: space.lg, marginTop: space.sm, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, ...shadow.card }}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text variant="body" color={colors.textFaint}>
            Topic, naam ya skill khojein
          </Text>
        </Pressable>

        {/* Hero */}
        <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ margin: space.lg, marginBottom: 0, borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 21, color: colors.white, lineHeight: 28 }}>Mann halka karna hai?</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: 'rgba(255,255,255,0.92)', marginTop: 4, maxWidth: 240 }}>
            Trained listeners aapki baat bina judge kiye sunte hain. Poori tarah private.
          </Text>
          <Pressable
            onPress={() => openCategory(listenerCat?.id)}
            style={{ alignSelf: 'flex-start', marginTop: space.lg, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubbles" size={16} color={colors.primaryDark} />
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: colors.primaryDark }}>Listener se baat karein</Text>
          </Pressable>
          <Ionicons name="ear-outline" size={110} color="rgba(255,255,255,0.13)" style={{ position: 'absolute', right: -6, bottom: -10 }} />
        </LinearGradient>

        {/* Categories */}
        <SectionHeader title="Kis baare mein baat karni hai?" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.md }}>
          {(cfg.data?.categories ?? []).map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => openCategory(c.id)}
              style={{ width: '25%', alignItems: 'center', paddingVertical: space.sm, gap: 6 }}
              accessibilityRole="button"
              accessibilityLabel={c.name}
            >
              <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: TINTS[i % TINTS.length], alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={(c.icon as IconName) ?? 'chatbubbles-outline'} size={26} color={colors.primaryDark} />
              </View>
              <Text style={{ fontFamily: font.medium, fontSize: 11.5, textAlign: 'center', lineHeight: 15, color: colors.text }} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Banners */}
        {banners.data?.items.length ? (
          <FlatList
            horizontal
            data={banners.data.items}
            keyExtractor={(b) => b.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={W - space.lg * 2 + space.md}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md, marginTop: space.md }}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => {
                  if (item.link === 'wallet') router.push('/wallet');
                  else if (item.link === 'listeners') openCategory(listenerCat?.id);
                  else if (item.link === 'experts') openCategory();
                  else if (item.link === 'support') router.push('/support');
                }}
              >
                <View
                  style={{
                    width: W - space.lg * 2,
                    height: 104,
                    borderRadius: radius.lg,
                    padding: space.lg,
                    justifyContent: 'center',
                    backgroundColor: [colors.accentSoft, colors.primarySoft, '#EEE8FF'][index % 3],
                  }}
                >
                  <Text style={{ fontFamily: font.bold, fontSize: 17, color: colors.text }}>{item.title}</Text>
                  {item.subtitle ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginTop: 4, maxWidth: '80%' }}>{item.subtitle}</Text> : null}
                  <Ionicons name="sparkles" size={52} color="rgba(11,110,102,0.12)" style={{ position: 'absolute', right: 14, bottom: 10 }} />
                </View>
              </Pressable>
            )}
          />
        ) : null}

        {/* Listeners */}
        {listenerItems.length ? (
          <>
            <SectionHeader title="Listeners" action="Sab dekhein" onAction={() => openCategory(listenerCat?.id)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: 6 }}>
              {listenerItems.map((a) => (
                <VendorMiniCard key={a.id} a={a} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Experts */}
        {experts.length ? (
          <>
            <SectionHeader title="Top Experts" action="Sab dekhein" onAction={() => openCategory()} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: 6 }}>
              {experts.map((a) => (
                <VendorMiniCard key={a.id} a={a} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Madad */}
        <Pressable
          onPress={() => router.push('/help')}
          style={{ marginHorizontal: space.lg, marginTop: space.xl, borderRadius: radius.lg, padding: space.lg, backgroundColor: colors.surface, flexDirection: 'row', gap: space.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
          accessibilityRole="button"
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="medkit-outline" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title">Mushkil waqt mein hain?</Text>
            <Text variant="small">Tele-MANAS 14416 · 24x7 muft sarkari helpline</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        {/* Trust strip */}
        <Row style={{ marginTop: space.xxl, justifyContent: 'space-around', paddingHorizontal: space.lg }}>
          {[
            ['lock-closed-outline', '100%\nPrivate'],
            ['shield-checkmark-outline', 'Verified\nProfiles'],
            ['card-outline', 'Secure\nPayments'],
          ].map(([i, t]) => (
            <View key={t} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={i as IconName} size={22} color={colors.primaryDark} />
              </View>
              <Text variant="caption" style={{ textAlign: 'center', color: colors.textMuted }}>
                {t}
              </Text>
            </View>
          ))}
        </Row>
      </ScrollView>
    </Screen>
  );
}
