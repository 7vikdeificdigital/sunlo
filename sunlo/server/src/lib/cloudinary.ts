import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { logger } from './logger';

/** Cloudinary tabhi chalu hota hai jab teeno env set hon. Nahi to sab kuch pehle ki tarah database se chalta hai. */
export const cloudinaryOn = () => Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

/**
 * Photo Cloudinary par daalo (signed upload, SDK ki zaroorat nahi). Fail ho to null: caller database wali copy se kaam chalata hai.
 * KYC/ID documents yahan KABHI nahi bhejte (woh private rehte hain).
 */
export async function uploadAvatarToCloudinary(buf: Buffer, mime: string, publicId: string): Promise<string | null> {
  if (!cloudinaryOn()) return null;
  try {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const folder = 'bondty/avatars';
    // Signature: parameters alphabetically, "key=value&key=value" + api_secret, SHA-1
    const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = createHash('sha1').update(toSign + env.CLOUDINARY_API_SECRET).digest('hex');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buf)], { type: mime }), `${publicId}`);
    form.append('api_key', env.CLOUDINARY_API_KEY!);
    form.append('timestamp', timestamp);
    form.append('folder', folder);
    form.append('public_id', publicId);
    form.append('signature', signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.error({ status: res.status }, 'Cloudinary upload failed');
      return null;
    }
    const json = (await res.json()) as { secure_url?: string };
    return typeof json.secure_url === 'string' && json.secure_url.startsWith('https://') ? json.secure_url : null;
  } catch (err) {
    logger.error({ err }, 'Cloudinary request failed');
    return null;
  }
}
