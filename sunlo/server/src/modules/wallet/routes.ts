import crypto from 'node:crypto';
import express, { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { env, isProd } from '../../config/env';
import { db } from '../../db/client';
import { walletTransactions, wallets } from '../../db/schema';
import { forbidden } from '../../lib/errors';
import { body, pagination, params, query } from '../../lib/validate';
import { authId } from '../../middleware/auth';
import * as pay from './payments';

// ----- Login zaroori -----
export const walletRouter = Router();

walletRouter.get('/wallet', async (req, res) => {
  const userId = authId(req);
  const [w] = await db.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
  res.json({ balance: w?.balance ?? 0, packs: await pay.listPacks(), provider: env.PAYMENT_PROVIDER });
});

walletRouter.get('/wallet/transactions', async (req, res) => {
  const userId = authId(req);
  const { page, limit } = query(req, pagination);
  const [w] = await db.select({ id: wallets.id }).from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (!w) return void res.json({ items: [], page, limit, total: 0 });
  const items = await db
    .select({
      id: walletTransactions.id,
      type: walletTransactions.type,
      amount: walletTransactions.amount,
      balanceAfter: walletTransactions.balanceAfter,
      note: walletTransactions.note,
      referenceType: walletTransactions.referenceType,
      referenceId: walletTransactions.referenceId,
      createdAt: walletTransactions.createdAt,
    })
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, w.id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, w.id));
  res.json({ items, page, limit, total });
});

walletRouter.get('/wallet/payments', async (req, res) => {
  res.json({ items: await pay.paymentHistory(authId(req)) });
});

walletRouter.post('/wallet/recharge', async (req, res) => {
  const input = body(
    req,
    z.union([
      z.object({ packId: z.string().uuid() }).strict(),
      z.object({ amount: z.number().int().positive() }).strict(), // paise
    ]),
  );
  res.status(201).json(await pay.createRecharge(authId(req), input));
});

walletRouter.post('/wallet/recharge/verify', async (req, res) => {
  const input = body(
    req,
    z.object({
      paymentId: z.string().uuid(),
      providerPaymentId: z.string().max(100).optional(),
      signature: z.string().max(200).optional(),
      mockResult: z.enum(['success', 'failure']).optional(),
    }),
  );
  res.json(await pay.verifyFromApp(authId(req), input));
});

// ----- Public: Razorpay webhook + checkout page -----
export const paymentsPublic = Router();

paymentsPublic.post('/webhooks/razorpay', express.raw({ type: 'application/json', limit: '200kb' }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  res.json(await pay.handleRazorpayWebhook(raw, req.get('x-razorpay-signature')));
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * App ke WebView mein khulne wala payment page.
 * Is page par koi secret nahi: Razorpay ka key_id public hota hai. Paisa jodna sirf server-side verify ke baad.
 */
paymentsPublic.get('/pay/:id', async (req, res) => {
  const { id } = params(req, z.object({ id: z.string().uuid() }));
  const { t } = query(req, z.object({ t: z.string().min(10).max(1000) }));
  const claims = pay.verifyCheckoutToken(id, t);
  const p = await pay.getPaymentForCheckout(id);
  if (p.userId !== claims.uid) throw forbidden('Yeh payment link aapka nahi hai');
  const nonce = crypto.randomBytes(16).toString('base64');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      `script-src 'nonce-${nonce}' https://checkout.razorpay.com`,
      "style-src 'unsafe-inline'",
      'img-src https: data:',
      'connect-src https://*.razorpay.com',
      'frame-src https://*.razorpay.com',
      "base-uri 'none'",
      "form-action 'none'",
      // Production: kisi bhi site mein iframe ke andar nahi khulega (clickjacking se bachav).
      // Development: Expo web preview iframe mein khol sake.
      isProd ? "frame-ancestors 'none'" : 'frame-ancestors *',
    ].join('; '),
  );
  if (!isProd) res.removeHeader('X-Frame-Options');
  const rupees = (p.totalPayable / 100).toFixed(2);
  const data = JSON.stringify({
    paymentId: p.id,
    provider: p.provider,
    key: env.RAZORPAY_KEY_ID ?? '',
    orderId: p.providerOrderId,
    amount: p.totalPayable,
    status: p.status,
  }).replace(/</g, '\\u003c');
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment</title>
<style>body{font-family:system-ui,sans-serif;background:#FFF8EE;color:#2B2118;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border-radius:20px;padding:28px 24px;width:min(360px,90vw);box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center}
h1{font-size:18px;margin:0 0 6px}.amt{font-size:32px;font-weight:700;margin:12px 0 20px}
button{width:100%;padding:14px;border:0;border-radius:12px;font-size:16px;font-weight:600;margin-top:10px;cursor:pointer}
.pay{background:#F28C00;color:#fff}.fail{background:#F1E7DA;color:#6B5B4B}.note{font-size:12px;color:#8A7A6A;margin-top:14px}</style></head>
<body><div class="card"><h1>Wallet Recharge</h1><div class="amt">&#8377; ${esc(rupees)}</div>
<div id="actions"></div><p class="note" id="note">GST sahit. Payment ke baad aap app par wapas pahunch jayenge.</p></div>
<script nonce="${nonce}">window.__PAY=${data};</script>
${p.provider === 'razorpay' ? `<script nonce="${nonce}" src="https://checkout.razorpay.com/v1/checkout.js"></script>` : ''}
<script nonce="${nonce}">
(function(){var P=window.__PAY;function send(m){var s=JSON.stringify(Object.assign({type:'sunlo-payment',paymentId:P.paymentId},m));
if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s)}else if(window.opener){window.opener.postMessage(s,'*')}else if(window.parent!==window){window.parent.postMessage(s,'*')}}
var a=document.getElementById('actions');
if(P.status!=='CREATED'){document.getElementById('note').textContent='Yeh payment pehle hi process ho chuka hai.';send({result:'closed'});return}
if(P.provider==='mock'){a.innerHTML='<button class="pay" id="ok">Demo: Payment Safal</button><button class="fail" id="no">Demo: Payment Fail</button>';
document.getElementById('note').textContent='DEMO MODE: asli paisa nahi katega. Production mein Razorpay khulega.';
document.getElementById('ok').onclick=function(){send({result:'success',mockResult:'success'})};
document.getElementById('no').onclick=function(){send({result:'failure',mockResult:'failure'})};return}
var b=document.createElement('button');b.className='pay';b.textContent='Pay Now';a.appendChild(b);
function open(){var r=new Razorpay({key:P.key,order_id:P.orderId,amount:P.amount,currency:'INR',name:'Wallet Recharge',theme:{color:'#F28C00'},
handler:function(x){send({result:'success',providerPaymentId:x.razorpay_payment_id,signature:x.razorpay_signature})},
modal:{ondismiss:function(){send({result:'dismissed'})}}});r.on('payment.failed',function(){send({result:'failure'})});r.open()}
b.onclick=open;open()})();
</script></body></html>`);
});
