import { Router } from 'express';
import { getSettings } from '../../lib/settings';
import { grievanceInfo } from '../misc/routes';
import { LAST_UPDATED, TERMS_INTRO, TERMS_SECTIONS, type LegalSection } from '../../content/legalText';

/**
 * Public web pages (bina login) jo Play Store / App Store listing mein link karne zaroori hain:
 *  - /legal/privacy        Privacy Policy URL
 *  - /legal/terms          Terms of Use
 *  - /legal/delete-account Play Console ka "Delete account URL"
 */
export const legalPublic = Router();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function page(title: string, body: string) {
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Bondty</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:24px 18px 60px;line-height:1.6;color:#1d1d1f}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 6px}.muted{color:#6e6e73;font-size:14px}li{margin:4px 0}
.box{background:#f5f5f7;border-radius:12px;padding:14px 16px;margin:16px 0}a{color:#6b4eff}</style></head>
<body><h1>${esc(title)}</h1><p class="muted">Bondty · Last updated: ${esc(LAST_UPDATED)}</p>${body}
<p class="muted" style="margin-top:40px"><a href="privacy">Privacy Policy</a> · <a href="terms">Terms of Use</a> · <a href="delete-account">Delete account</a></p></body></html>`;
}

const section = (s: LegalSection) => `<h2>${esc(s.title)}</h2><ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;

async function contactBox() {
  const g = grievanceInfo(await getSettings());
  const rows = [
    g.officerName && `Grievance Officer: ${esc(g.officerName)}`,
    g.email && `Email: <a href="mailto:${esc(g.email)}">${esc(g.email)}</a>`,
    g.phone && `Phone: ${esc(g.phone)}`,
    g.address && `Address: ${esc(g.address)}`,
  ].filter(Boolean);
  return `<div class="box"><b>Sampark / Contact</b><br>${rows.length ? rows.join('<br>') : 'Admin panel &gt; Setup mein Grievance Officer ki jaankari bharein.'}
<br><span class="muted">Shikayat ki pavti ${g.acknowledgeWithinHours} ghante mein, samadhan ${g.resolveWithinDays} din mein. ${esc(g.appealNote)}</span></div>`;
}

legalPublic.get('/legal/terms', async (_req, res) => {
  res.type('html').send(page('Terms of Use', `<p>${esc(TERMS_INTRO)}</p>${TERMS_SECTIONS.map(section).join('')}${await contactBox()}`));
});

legalPublic.get('/legal/privacy', async (_req, res) => {
  const privacy = TERMS_SECTIONS.filter((s) => /privacy|nigrani|Account band/i.test(s.title));
  const en = `<div class="box"><b>Summary (English)</b><ul>
<li>We collect: mobile number, name, date of birth (18+ check), profile details, wallet transactions, session records (time, duration, chat messages) and basic device information. Listeners additionally share PAN and bank details for payouts (stored encrypted).</li>
<li>Audio and video calls are not recorded. Chat messages are deleted automatically after about 90 days, except where a complaint is under review.</li>
<li>Data is used to run the service, send OTPs, process payments, connect calls, keep users safe and prevent fraud. We do not sell personal data.</li>
<li>Service providers: login/OTP (Firebase or MSG91), payments (Razorpay, Google Play), calls (Agora), push notifications. They receive only what they need.</li>
<li>You can view, download, correct, withdraw consent and delete your account in the app (Account &gt; Data aur privacy), under India's DPDP Act 2023 and Rules 2025.</li>
<li>The service is only for people aged 18 and above.</li></ul></div>`;
  res.type('html').send(page('Privacy Policy', `${en}${privacy.map(section).join('')}${await contactBox()}`));
});

legalPublic.get('/legal/delete-account', async (_req, res) => {
  const body = `<p>Bondty aur Bondty Partner app ka account aur uska data hatane ka tareeka. / How to delete your Bondty or Bondty Partner account and data.</p>
<h2>App se (sabse tez) / In the app</h2><ol>
<li>App kholein aur login karein. / Open the app and sign in.</li>
<li>Neeche <b>Account</b> tab mein <b>Account delete karein</b> dabayein. / Open the Account tab and tap Delete account.</li>
<li>Confirm karein. Account turant band ho jaata hai. / Confirm. The account is closed immediately.</li></ol>
<h2>App ke bina / Without the app</h2>
<p>Apne registered mobile number se neeche diye email par "Delete my Bondty account" likh kar bhejein. Hum number verify karke 7 din mein account hata denge. / Email us from the contact below with your registered mobile number and the subject "Delete my Bondty account". We will verify and delete it within 7 days.</p>
<h2>Kya hatta hai, kya rehta hai / What is deleted and kept</h2><ul>
<li>Turant hatta hai: mobile number, naam, photo, janm-tithi, mood check-in, push token; listener profile band. Chat sandesh lagbhag 90 din mein apne aap mit jaate hain. / Deleted immediately: phone number, name, photo, date of birth, mood check-ins, push tokens; listener profile closed. Chat messages are erased automatically within about 90 days.</li>
<li>Rehta hai (kaanoon ke liye, bina naam ke): payment aur tax (TDS) ke len-den ka record, jitne samay tak kaanoon kahe. / Kept as legally required, de-identified: payment and tax (TDS) records, for the period the law requires.</li>
<li>Bacha hua wallet balance account hatne par khatam ho jaata hai; listener pehle apni kamai withdraw kar lein. / Remaining wallet balance is lost on deletion; listeners should withdraw earnings first.</li></ul>
${await contactBox()}`;
  res.type('html').send(page('Delete your account', body));
});
