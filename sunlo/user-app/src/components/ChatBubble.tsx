import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useSegments } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Session } from '@/lib/types';
import { colors, font, radius, shadow } from '@/theme';
import { Text } from './ui';

/**
 * Chal rahi chat/call se bahar aane par screen ke kone mein chhota bubble.
 * Dabate hi wapas usi chat par. Chat/call screen par khud chhup jata hai.
 */
export function ChatBubble() {
  const token = useAuth((s) => s.accessToken);
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const q = useQuery({
    queryKey: ['session', 'open'],
    queryFn: () => api<{ session: Session | null }>('/sessions/open'),
    enabled: !!token,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const s = q.data?.session;
  const onSessionScreen = segments.includes('session') || segments.includes('call') || segments.includes('connecting') || segments.includes('room');
  if (!s || s.status !== 'ACTIVE' || onSessionScreen) return null;

  const isChat = s.type === 'CHAT';
  const open = () => router.push(isChat ? `/session/${s.id}` : `/call/${s.id}`);

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={isChat ? 'Chat par wapas jaayein' : 'Call par wapas jaayein'}
      style={{
        position: 'absolute',
        right: 14,
        bottom: 86 + insets.bottom,
        zIndex: 900,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 14,
        height: 52,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        ...shadow.raised,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={isChat ? 'chatbubble-ellipses' : 'call'} size={19} color={colors.white} />
      </View>
      <View>
        <Text raw style={{ fontFamily: font.semibold, fontSize: 13, color: colors.white, lineHeight: 18 }}>
          {isChat ? 'Chat chalu hai' : 'Call chalu hai'}
        </Text>
        <Text raw style={{ fontFamily: font.regular, fontSize: 11, color: 'rgba(255,255,255,0.88)', lineHeight: 15 }}>
          Wapas jaane ke liye dabayein
        </Text>
      </View>
    </Pressable>
  );
}
