import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { env } from '../src/config/env';
import { db } from '../src/db/client';
import { users, vendors } from '../src/db/schema';
import { api, bearer, newPhone, P } from './helpers';

// Asli Firebase ko chhue bina: sirf firebase-admin ka verifyIdToken nakli hai.
// Hamara apna verify code (provider, phone, token ki umar) asli chalta hai.
const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('firebase-admin/app', () => ({ cert: (j: unknown) => j, getApps: () => [], initializeApp: () => ({}) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));

const mutableEnv = env as { AUTH_MODE: 'otp' | 'firebase' };
const FAKE_TOKEN = 'x'.repeat(200);
const now = () => Math.floor(Date.now() / 1000);

function firebaseSays(phone: string, extra: Record<string, unknown> = {}) {
  verifyIdToken.mockResolvedValueOnce({
    uid: `fb-${phone}`,
    phone_number: phone,
    auth_time: now(),
    firebase: { sign_in_provider: 'phone' },
    ...extra,
  });
}

const loginFirebase = (body: Record<string, unknown>) => api().post(`${P}/auth/firebase`).send({ idToken: FAKE_TOKEN, app: 'user', ...body });

describe('Firebase Phone Auth login', () => {
  beforeAll(() => {
    mutableEnv.AUTH_MODE = 'firebase';
  });
  afterAll(() => {
    mutableEnv.AUTH_MODE = 'otp';
  });
  beforeEach(() => verifyIdToken.mockReset());

  it('/auth/config app ko mode batata hai', async () => {
    expect((await api().get(`${P}/auth/config`)).body).toEqual({ mode: 'firebase' });
  });

  it('sahi token: naya user ban jaata hai, tokens milte hain, /me chalta hai', async () => {
    const phone = newPhone();
    firebaseSays(phone);
    const r = await loginFirebase({});
    expect(r.status).toBe(200);
    expect(r.body.isNewUser).toBe(true);
    expect(r.body.user.phone).toBe(phone);
    expect(r.body.user.role).toBe('USER');
    expect(r.body.accessToken).toBeTruthy();
    expect(r.body.refreshToken).toBeTruthy();
    expect((await api().get(`${P}/me`).set(bearer(r.body.accessToken))).status).toBe(200);
  });

  it('dobara login: wahi user, naya nahi', async () => {
    const phone = newPhone();
    firebaseSays(phone);
    const a = await loginFirebase({});
    firebaseSays(phone);
    const b = await loginFirebase({});
    expect(b.status).toBe(200);
    expect(b.body.isNewUser).toBe(false);
    expect(b.body.user.id).toBe(a.body.user.id);
  });

  it('vendor app: VENDOR role aur khaali profile banta hai; wahi number user app par mana', async () => {
    const phone = newPhone();
    firebaseSays(phone);
    const v = await loginFirebase({ app: 'vendor' });
    expect(v.status).toBe(200);
    expect(v.body.user.role).toBe('VENDOR');
    const [row] = await db.select().from(vendors).where(eq(vendors.userId, v.body.user.id));
    expect(row?.status).toBe('DRAFT');
    firebaseSays(phone);
    expect((await loginFirebase({ app: 'user' })).status).toBe(403);
  });

  it('Firebase token reject kare -> 401', async () => {
    verifyIdToken.mockRejectedValueOnce(Object.assign(new Error('bad'), { code: 'auth/argument-error' }));
    expect((await loginFirebase({})).status).toBe(401);
  });

  it('phone ke alawa kisi aur tareeke ka token (google/email) -> 401', async () => {
    firebaseSays(newPhone(), { firebase: { sign_in_provider: 'google.com' } });
    expect((await loginFirebase({})).status).toBe(401);
    firebaseSays(newPhone(), { phone_number: undefined, firebase: { sign_in_provider: 'password' } });
    expect((await loginFirebase({})).status).toBe(401);
  });

  it('purana token (5 minute se purani verification) -> 401', async () => {
    firebaseSays(newPhone(), { auth_time: now() - 10 * 60 });
    expect((await loginFirebase({})).status).toBe(401);
  });

  it('block kiya hua user login nahi kar sakta', async () => {
    const phone = newPhone();
    firebaseSays(phone);
    const a = await loginFirebase({});
    await db.update(users).set({ status: 'BLOCKED' }).where(eq(users.id, a.body.user.id));
    firebaseSays(phone);
    expect((await loginFirebase({})).status).toBe(403);
  });

  it('galat input -> 400 (Firebase tak baat pahunchti hi nahi)', async () => {
    expect((await api().post(`${P}/auth/firebase`).send({ idToken: 'short', app: 'user' })).status).toBe(400);
    expect((await api().post(`${P}/auth/firebase`).send({ idToken: FAKE_TOKEN, app: 'admin' })).status).toBe(400);
    expect((await api().post(`${P}/auth/firebase`).send({})).status).toBe(400);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('server ka apna OTP route band hai (koi OTP bhej/check nahi sakta)', async () => {
    expect((await api().post(`${P}/auth/otp/request`).send({ phone: newPhone() })).status).toBe(404);
    expect((await api().post(`${P}/auth/otp/verify`).send({ phone: newPhone(), code: '123456', app: 'user' })).status).toBe(404);
  });
});

describe('otp mode mein Firebase route band hai', () => {
  it('/auth/firebase -> 404 aur config "otp"', async () => {
    verifyIdToken.mockReset();
    expect(mutableEnv.AUTH_MODE).toBe('otp');
    expect((await api().get(`${P}/auth/config`)).body).toEqual({ mode: 'otp' });
    expect((await loginFirebase({})).status).toBe(404);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
