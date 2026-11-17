import { afterAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { clearSettingsCache } from '../src/lib/settings';
import { api, bearer, loginViaOtp, P } from './helpers';

const FAKE = '00000000-0000-4000-8000-000000000001';

describe('GIFTING_ENABLED (.env master switch)', () => {
  afterAll(() => {
    (env as { GIFTING_ENABLED: boolean }).GIFTING_ENABLED = true;
    clearSettingsCache();
  });

  it('false karne par app config mein gifts band dikhte hain aur gift bhejna 403 FEATURE_OFF deta hai', async () => {
    const u = await loginViaOtp();
    (env as { GIFTING_ENABLED: boolean }).GIFTING_ENABLED = false;
    clearSettingsCache();

    const cfg = await api().get(`${P}/app/config`);
    expect(cfg.body.settings.giftsEnabled).toBe(false);

    const s = await api().post(`${P}/sessions/${FAKE}/gifts`).set(bearer(u.accessToken)).send({ giftId: FAKE });
    expect(s.status).toBe(403);
    expect(s.body.error?.code ?? s.body.code).toBe('FEATURE_OFF');

    const r = await api().post(`${P}/rooms/${FAKE}/gifts`).set(bearer(u.accessToken)).send({ giftId: FAKE });
    expect(r.status).toBe(403);
  });

  it('true (ya set na ho) to gifts chalte hain', async () => {
    (env as { GIFTING_ENABLED: boolean }).GIFTING_ENABLED = true;
    clearSettingsCache();
    const cfg = await api().get(`${P}/app/config`);
    expect(cfg.body.settings.giftsEnabled).toBe(true);
  });
});
