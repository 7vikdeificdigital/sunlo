import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

/** Gallery se photo chunkar server par upload. Server file ka asli type khud jaanchta hai. */
export async function pickAndUpload(kind: 'AVATAR' | 'KYC'): Promise<{ id: string; url: string | null; previewUri: string } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo chunne ki anumati dein');
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: kind === 'AVATAR',
    aspect: kind === 'AVATAR' ? [1, 1] : undefined,
    quality: 0.6,
    base64: true,
  });
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  const b64 = a.base64 ?? (a.uri.startsWith('data:') ? a.uri.split(',')[1] : null);
  if (!b64) throw new Error('Photo padh nahi paaye, dobara koshish karein');
  const up = await api<{ id: string; url: string | null }>('/uploads', { method: 'POST', body: { kind, dataBase64: b64 } });
  return { ...up, previewUri: a.uri };
}
