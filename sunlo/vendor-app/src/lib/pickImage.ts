import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { api } from './api';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Android: 'unregistered ActivityResultLauncher' kabhi kabhi pehli baar aata hai (activity dobara bani ho). Thoda ruk ke dobara koshish. */
async function launchWithRetry(opts: ImagePicker.ImagePickerOptions) {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await ImagePicker.launchImageLibraryAsync(opts);
    } catch (e) {
      lastErr = e;
      if (!/unregistered|ActivityResultLauncher/i.test(String((e as { message?: string })?.message ?? e))) throw e;
      await wait(500 * (i + 1));
    }
  }
  throw lastErr;
}

/** Gallery se photo chunkar server par upload. Server file ka asli type khud jaanchta hai. */
export async function pickAndUpload(kind: 'AVATAR' | 'KYC'): Promise<{ id: string; url: string | null; previewUri: string } | null> {
  // Android ka system Photo Picker bina permission ke chalta hai; sirf iOS par poochna hai
  if (Platform.OS === 'ios') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Photo chunne ki anumati dein');
  }
  const r = await launchWithRetry({
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
