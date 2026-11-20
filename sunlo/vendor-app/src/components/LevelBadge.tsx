import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import type { Level } from '@/lib/types';
import { font, radius } from '@/theme';
import { Text } from './ui';

export const LEVEL_META: Record<Level, { label: string; color: string; bg: string; icon: 'leaf' | 'flash' | 'trophy' }> = {
  BEGINNER: { label: 'Beginner', color: '#2E7D63', bg: '#E3F5EB', icon: 'leaf' },
  INTERMEDIATE: { label: 'Intermediate', color: '#9A6400', bg: '#FFF4DB', icon: 'flash' },
  EXPERT: { label: 'Expert', color: '#5B3BD6', bg: '#EEE8FF', icon: 'trophy' },
};

/** Kitne minute baat hui uske hisaab se level */
export function levelFromMinutes(minutes: number, interMin = 500, expertMin = 1500): Level {
  if (minutes >= expertMin) return 'EXPERT';
  if (minutes >= interMin) return 'INTERMEDIATE';
  return 'BEGINNER';
}

export function LevelBadge({ level, size = 'md' }: { level: Level; size?: 'sm' | 'md' }) {
  const m = LEVEL_META[level];
  const sm = size === 'sm';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: sm ? 4 : 6,
        alignSelf: 'flex-start',
        backgroundColor: m.bg,
        borderRadius: radius.pill,
        paddingHorizontal: sm ? 8 : 10,
        paddingVertical: sm ? 2 : 4,
      }}
    >
      <Ionicons name={m.icon} size={sm ? 11 : 13} color={m.color} />
      <Text raw style={{ fontFamily: font.semibold, fontSize: sm ? 11 : 12.5, color: m.color, lineHeight: sm ? 16 : 18 }}>
        {m.label}
      </Text>
    </View>
  );
}
