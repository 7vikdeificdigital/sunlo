import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';
import { API_URL } from '@/lib/api';
import { initials } from '@/lib/format';
import type { Gender } from '@/lib/types';
import { avatarColor, colors, font } from '@/theme';
import { Text } from './ui';

/** Gender ke hisaab se alag avatar (photo na ho to): male neela, female gulabi */
const GENDER_AVATAR: Record<Gender, { bg: string; icon: 'man' | 'woman' | 'person' }> = {
  MALE: { bg: '#4C7DF0', icon: 'man' },
  FEMALE: { bg: '#E8559A', icon: 'woman' },
  OTHER: { bg: '#8A7BE8', icon: 'person' },
};

/** Photo ho to photo, warna gender ka avatar ya naam ke initials. Online/busy ka chhota dot. */
export function Avatar({
  name,
  uri,
  size = 56,
  status,
  ring,
  gender,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  status?: 'online' | 'busy' | 'offline';
  ring?: boolean;
  gender?: Gender | null;
}) {
  const g = gender ? GENDER_AVATAR[gender] : null;
  const bg = g ? g.bg : avatarColor(name);
  const dot = status === 'online' ? colors.online : status === 'busy' ? colors.busy : status === 'offline' ? colors.offline : null;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: ring ? 2.5 : 0,
          borderColor: colors.primary,
        }}
      >
        {uri ? (
          <Image source={{ uri: resolveFileUrl(uri) }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
        ) : g ? (
          <Ionicons name={g.icon} size={size * 0.58} color={colors.white} />
        ) : (
          <Text style={{ fontFamily: font.semibold, color: colors.white, fontSize: size * 0.36 }}>{initials(name)}</Text>
        )}
      </View>
      {dot ? (
        <View
          style={{
            position: 'absolute',
            right: size * 0.02,
            bottom: size * 0.02,
            width: Math.max(10, size * 0.22),
            height: Math.max(10, size * 0.22),
            borderRadius: size,
            backgroundColor: dot,
            borderWidth: 2,
            borderColor: colors.white,
          }}
        />
      ) : null}
    </View>
  );
}

/** Server "/files/<id>" jaisa relative path deta hai; use poora URL banao */
export const resolveFileUrl = (uri: string) => (uri.startsWith('/') ? `${API_URL}${uri}` : uri);
