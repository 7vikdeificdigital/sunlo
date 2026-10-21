import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useAppConfig, useVendors } from '@/lib/queries';
import type { VendorCard } from '@/lib/types';
import { colors, font, radius, shadow, space } from '@/theme';
import { VendorListCard } from './VendorCard';
import { StartSessionSheet } from './StartSessionSheet';
import { Button, Chip, Empty, ErrorBox, Loader, Row, Screen, Text } from './ui';
import { WalletChip } from './WalletChip';
import { errorMessage } from '@/lib/api';

const SORTS = [
  { v: 'recommended', l: 'Recommended' },
  { v: 'rating', l: 'Rating: sabse zyada' },
  { v: 'experience', l: 'Experience: sabse zyada' },
  { v: 'price_low', l: 'Price: kam se zyada' },
  { v: 'price_high', l: 'Price: zyada se kam' },
];

export function VendorListScreen({ service }: { service: 'chat' | 'call' }) {
  const { focus, category } = useLocalSearchParams<{ focus?: string; category?: string }>();
  const cfg = useAppConfig();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(category);
  const [sort, setSort] = useState('recommended');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [starting, setStarting] = useState<VendorCard | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (focus) setTimeout(() => inputRef.current?.focus(), 300);
  }, [focus]);
  useEffect(() => {
    if (category) setCategoryId(category);
  }, [category]);

  const q = useVendors({ service, search: debounced || undefined, categoryId, sort, online: onlineOnly });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <Row style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md }} gap={space.md}>
        <Text variant="h2" style={{ flex: 1 }}>
          {service === 'chat' ? 'Chat karein' : 'Call karein'}
        </Text>
        <WalletChip />
      </Row>

      <Row style={{ paddingHorizontal: space.lg }} gap={space.sm}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: 14, ...shadow.card }}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            value={search}
            onChangeText={setSearch}
            placeholder="Naam, topic ya skill khojein"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.text }}
            returnKeyType="search"
            accessibilityLabel="Khojein"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Search saaf karein">
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setFilterOpen(true)}
          accessibilityLabel="Filter aur sort"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: sort !== 'recommended' || onlineOnly ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}
        >
          <Ionicons name="options-outline" size={20} color={sort !== 'recommended' || onlineOnly ? colors.white : colors.text} />
        </Pressable>
      </Row>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm }}>
          <Chip label="Sab" icon="apps-outline" active={!categoryId} onPress={() => setCategoryId(undefined)} />
          {cfg.data?.categories.map((c) => (
            <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)} />
          ))}
        </ScrollView>
      </View>

      {q.isLoading ? (
        <Loader />
      ) : q.isError ? (
        <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <VendorListCard a={item} service={service} onStart={setStarting} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<Empty icon="search-outline" title="Koi nahi mila" text="Filter badal kar ya doosra topic khoj kar dekhein" />}
          ListFooterComponent={q.isFetchingNextPage ? <Loader /> : <View style={{ height: space.xl }} />}
          contentContainerStyle={{ paddingTop: 2 }}
        />
      )}

      {starting ? <StartSessionSheet vendor={starting} topic={cfg.data?.categories.find((c) => c.id === categoryId)?.name} initialType={service === 'chat' ? 'CHAT' : 'AUDIO'} onClose={() => setStarting(null)} /> : null}

      <Modal transparent visible={filterOpen} animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={() => setFilterOpen(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, gap: space.md }}>
            <Text variant="h3">Sort aur filter</Text>
            {SORTS.map((o) => (
              <Pressable key={o.v} onPress={() => setSort(o.v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }} accessibilityRole="radio" accessibilityState={{ checked: sort === o.v }}>
                <Ionicons name={sort === o.v ? 'radio-button-on' : 'radio-button-off'} size={20} color={sort === o.v ? colors.primary : colors.textFaint} />
                <Text variant="body">{o.l}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setOnlineOnly((x) => !x)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }} accessibilityRole="checkbox" accessibilityState={{ checked: onlineOnly }}>
              <Ionicons name={onlineOnly ? 'checkbox' : 'square-outline'} size={20} color={onlineOnly ? colors.primary : colors.textFaint} />
              <Text variant="body">Sirf online</Text>
            </Pressable>
            <Row gap={space.md} style={{ marginTop: space.sm }}>
              <Button
                title="Reset"
                kind="ghost"
                style={{ flex: 1 }}
                onPress={() => {
                  setSort('recommended');
                  setOnlineOnly(false);
                }}
              />
              <Button title="Lagu karein" style={{ flex: 1 }} onPress={() => setFilterOpen(false)} />
            </Row>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
