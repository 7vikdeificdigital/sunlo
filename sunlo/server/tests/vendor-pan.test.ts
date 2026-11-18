import { describe, expect, it } from 'vitest';
import { api, bearer, loginViaOtp, makeAdmin, makeVendor, P } from './helpers';

describe('Vendor PAN', () => {
  it('PAN ek baar juda to vendor badal nahi sakta', async () => {
    const { phone } = await makeVendor();
    const t = await loginViaOtp(phone, 'vendor');
    const r = await api().put(`${P}/vendor/pan`).set(bearer(t.accessToken)).send({ pan: 'ZZZZZ9999Z', name: 'Naya Naam' });
    expect(r.status).toBe(409);
    expect(r.body.error?.code ?? r.body.code).toBe('PAN_LOCKED');
  });

  it('PAN na ho to pehli baar daal sakta hai', async () => {
    const { phone } = await makeVendor({ pan: false });
    const t = await loginViaOtp(phone, 'vendor');
    const r = await api().put(`${P}/vendor/pan`).set(bearer(t.accessToken)).send({ pan: 'ABCDE1234F', name: 'Test Vendor' });
    expect(r.status).toBe(200);
    expect(r.body.pan.last4).toBe('234F');
  });

  it('admin poora PAN dekh sakta hai, doosra nahi', async () => {
    const { vendor, phone } = await makeVendor();
    const admin = await makeAdmin();
    const ok = await api().get(`${P}/admin/vendors/${vendor.id}/pan`).set(bearer(admin.accessToken));
    expect(ok.status).toBe(200);
    expect(ok.body.pan).toBe('ABCDE1234F');
    const t = await loginViaOtp(phone, 'vendor');
    const no = await api().get(`${P}/admin/vendors/${vendor.id}/pan`).set(bearer(t.accessToken));
    expect([401, 403]).toContain(no.status);
  });
});
