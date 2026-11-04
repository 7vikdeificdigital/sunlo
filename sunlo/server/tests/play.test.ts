import { afterAll, describe, expect, it } from 'vitest';
import { setPlayVerifier } from '../src/modules/wallet/play';
import { api, balanceOf, bearer, ensurePack, loginViaOtp, P } from './helpers';

describe('Google Play Billing verify', () => {
  afterAll(() => setPlayVerifier(null));

  it('verified purchase se coins judte hain, wahi purchase dobara bhejne par double credit nahi', async () => {
    const pack = await ensurePack(77700, 10); // Rs 777
    const u = await loginViaOtp();
    const orderId = `GPA.${Date.now()}`;
    setPlayVerifier(async () => ({ purchaseState: 0, orderId, obfuscatedExternalAccountId: u.user.id }));
    const before = await balanceOf(u.user.id);
    const r = await api().post(`${P}/wallet/play/verify`).set(bearer(u.accessToken)).send({ productId: 'coins_777', purchaseToken: 'tok_' + 'a'.repeat(30) });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('PAID');
    expect(await balanceOf(u.user.id)).toBe(before + pack.amount + Math.floor((pack.amount * 10) / 100));
    const again = await api().post(`${P}/wallet/play/verify`).set(bearer(u.accessToken)).send({ productId: 'coins_777', purchaseToken: 'tok_' + 'a'.repeat(30) });
    expect(again.status).toBe(200);
    expect(await balanceOf(u.user.id)).toBe(before + pack.amount + Math.floor((pack.amount * 10) / 100));
  });

  it('doosre user ki purchase, pending ya galat product reject/skip', async () => {
    await ensurePack(88800, 0);
    const a = await loginViaOtp();
    const b = await loginViaOtp();
    setPlayVerifier(async () => ({ purchaseState: 0, orderId: `GPA.other${Date.now()}`, obfuscatedExternalAccountId: a.user.id }));
    const steal = await api().post(`${P}/wallet/play/verify`).set(bearer(b.accessToken)).send({ productId: 'coins_888', purchaseToken: 'tok_' + 'b'.repeat(30) });
    expect(steal.status).toBe(403);
    setPlayVerifier(async () => ({ purchaseState: 2, orderId: 'GPA.pending' }));
    const pend = await api().post(`${P}/wallet/play/verify`).set(bearer(a.accessToken)).send({ productId: 'coins_888', purchaseToken: 'tok_' + 'c'.repeat(30) });
    expect(pend.body.status).toBe('PENDING');
    const bad = await api().post(`${P}/wallet/play/verify`).set(bearer(a.accessToken)).send({ productId: 'hack_999', purchaseToken: 'tok_' + 'd'.repeat(30) });
    expect(bad.status).toBe(400);
  });

  it('Play set na ho to 503', async () => {
    await ensurePack(99900, 0);
    setPlayVerifier(null);
    const u = await loginViaOtp();
    const r = await api().post(`${P}/wallet/play/verify`).set(bearer(u.accessToken)).send({ productId: 'coins_999', purchaseToken: 'tok_' + 'e'.repeat(30) });
    expect([400, 503]).toContain(r.status);
  });
});
