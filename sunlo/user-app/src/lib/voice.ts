import { api, API_URL } from './api';

export const audioSrc = (p: string) => (p.startsWith('http') ? p : `${API_URL}${p}`);

/** Recorded file ko server par bhejo (base64). Server asli audio type khud jaanchta hai. */
export async function uploadClip(uri: string, durationSec: number): Promise<{ id: string }> {
  const blob = await (await fetch(uri)).blob();
  const b64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  if (!b64) throw new Error('Recording padh nahi paaye, dobara koshish karein');
  return api<{ id: string }>('/voice/clips', { method: 'POST', body: { dataBase64: b64, durationSec: Math.max(1, Math.round(durationSec)) } });
}

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
