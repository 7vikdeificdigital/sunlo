import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../config/env';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export const hmac = (secret: string, v: string) => crypto.createHmac('sha256', secret).update(v).digest('hex');

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');
export const randomOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

export function randomReferralCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

/** Admin password: scrypt (N=16384) + random salt */
export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, saltHex, keyHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64);
  return safeEqualHex(key.toString('hex'), keyHex);
}

/** Agora jaise SDK ko 32-bit number UID chahiye; user id se pakka (deterministic) number */
export function numericUid(id: string): number {
  return crypto.createHash('sha256').update(id).digest().readUInt32BE(0) & 0x7fffffff || 1;
}

/**
 * Sensitive field encryption (AES-256-GCM): vendor ka bank account number DB mein encrypted.
 * Key: PAYOUT_ENC_KEY (32 bytes base64). Development mein na ho to JWT secret se nikali key (sirf dev).
 */
function fieldKey(): Buffer {
  if (env.PAYOUT_ENC_KEY) return Buffer.from(env.PAYOUT_ENC_KEY, 'base64');
  return crypto.createHash('sha256').update(`dev-field-key:${env.JWT_ACCESS_SECRET}`).digest();
}

export function encryptField(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', fieldKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export function decryptField(stored: string): string {
  const [v, ivB, tagB, encB] = stored.split('.');
  if (v !== 'v1') throw new Error('Unknown encryption version');
  const d = crypto.createDecipheriv('aes-256-gcm', fieldKey(), Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([d.update(Buffer.from(encB, 'base64')), d.final()]).toString('utf8');
}
