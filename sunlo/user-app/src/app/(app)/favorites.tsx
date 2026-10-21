import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList } from 'react-native';
import { VendorListCard } from '@/components/VendorCard';
import { StartSessionSheet } from '@/components/StartSessionSheet';
import { Empty, Header, Loader, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import type { VendorCard } from '@/lib/types';
import { space } from '@/theme';

export default function Favorites() {
  const q = useQuery({ queryKey: ['favorites'], queryFn: () => api<{ items: VendorCard[] }>('/me/favorites') });
  const [starting, setStarting] = useState<VendorCard | null>(null);
  return (
    <Screen edges={['top']}>
      <Header title="Favorites" />
      {q.isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={q.data?.items ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingTop: space.sm }}
          ListEmptyComponent={<Empty icon="heart-outline" title="Abhi koi favorite nahi" text="Profile par ♥ dabakar jodein" />}
          renderItem={({ item }) => <VendorListCard a={item} service="chat" onStart={setStarting} />}
        />
      )}
      {starting ? <StartSessionSheet vendor={starting} initialType="CHAT" onClose={() => setStarting(null)} /> : null}
    </Screen>
  );
}
