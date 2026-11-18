import { describe, expect, it } from 'vitest';
import { creditPayment } from '../src/modules/wallet/payments';
import { balanceOf, ensurePack, loginViaOtp, api, bearer, P } from './helpers';

async function newPayment() {
  const u = await loginViaOtp();
  const pack = await ensurePack(20000, 5);
  const r = await api().post(`${P}/wallet/recharge`).set(bearer(u.accessToken)).send({ packId: pack.id });
  expect(r.status).toBe(201);
  return { userId: u.user.id as string, paymentId: r.body.paymentId as string, total: r.body.totalPayable as number, amount: r.body.amount as number, bonus: r.body.bonus as number };
}

describe('Razorpay customer-fee-bearer: fee ke saath ki raqam', () => {
  it('total + gateway fee (~2.4%) accept hoti hai aur poore coins milte hain', async () => {
    const p = await newPayment();
    const paid = Math.round(p.total * 1.0236);
    await creditPayment(p.paymentId, 'pay_fee_ok', paid);
    expect(await balanceOf(p.userId)).toBe(p.amount + p.bonus);
  });

  it('total se kam raqam reject + FAILED', async () => {
    const p = await newPayment();
    await expect(creditPayment(p.paymentId, 'pay_short', p.total - 1)).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' });
    expect(await balanceOf(p.userId)).toBe(0);
  });

  it('bahut zyada raqam (5% se upar) reject, coins nahi', async () => {
    const p = await newPayment();
    await expect(creditPayment(p.paymentId, 'pay_big', Math.round(p.total * 1.2))).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' });
    expect(await balanceOf(p.userId)).toBe(0);
  });
});
