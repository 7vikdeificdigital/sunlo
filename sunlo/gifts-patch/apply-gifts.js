// Usage: node apply-gifts.js <repo-root>   (idempotent)
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const P = (r) => path.join(root, r);
function edit(rel, pairs) {
  const f = P(rel);
  if (!fs.existsSync(f)) { console.log('SKIP (file nahi hai is folder mein):', rel); return; }
  let s = fs.readFileSync(f, 'utf8'); const orig = s;
  for (const [marker, from, to] of pairs) {
    if (s.includes(marker)) continue;
    if (!s.includes(from)) { console.log('  !! anchor nahi mila:', rel, '->', from.slice(0, 50)); continue; }
    s = s.replace(from, to);
  }
  if (s !== orig) { fs.writeFileSync(f, s); console.log('PATCHED:', rel); } else console.log('SKIP:', rel);
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}
// 1) naye files (zip ke andar 'files' folder)
const files = path.join(__dirname, 'files');
if (fs.existsSync(files)) {
  for (const top of fs.readdirSync(files)) {
    if (!fs.existsSync(path.join(root, top))) { console.log('SKIP copy (folder nahi hai):', top); continue; }
    copyDir(path.join(files, top), path.join(root, top));
    console.log('COPIED:', top);
  }
}

// 2) server wiring
edit('server/src/app.ts', [
  ['giftsPublic', "import { miscPrivate, miscPublic } from './modules/misc/routes';", "import { giftsPrivate, giftsPublic } from './modules/gifts/routes';\nimport { miscPrivate, miscPublic } from './modules/misc/routes';"],
  ['giftsPublic]', 'filesPublic];', 'filesPublic, giftsPublic];'],
  ['  giftsPrivate,\n];', '  adminRouter,\n];', '  adminRouter,\n  giftsPrivate,\n];'],
  ['admin\\/gifts', "req.path === `${API_PREFIX}/uploads` ?", "req.path === `${API_PREFIX}/uploads` || /\\/admin\\/gifts\\/[^/]+\\/(svga|thumb)$/.test(req.path) ?"],
  ['(svga|thumb)', '/svga$/.test(req.path)', '/(svga|thumb)$/.test(req.path)'],
]);
edit('server/src/lib/settings.ts', [['giftCommissionPct', '  commissionPct: 30,', '  giftCommissionPct: 30, // har gift mein platform ka hissa (%)\n  commissionPct: 30,']]);
edit('server/src/modules/admin/routes.ts', [['giftCommissionPct', '    commissionPct: z.number().int().min(0).max(90),', '    commissionPct: z.number().int().min(0).max(90),\n    giftCommissionPct: z.number().int().min(0).max(90),']]);

// 3) migration journal
const jf = P('server/drizzle/meta/_journal.json');
if (!fs.existsSync(jf)) console.log('SKIP: journal (server nahi hai)');
else {
  const j = JSON.parse(fs.readFileSync(jf, 'utf8'));
  let changed = false;
  for (const tag of ['0002_gifts', '0003_gift_media']) {
    if (j.entries.some((e) => e.tag === tag)) continue;
    const last = Math.max(...j.entries.map((e) => e.when));
    j.entries.push({ idx: j.entries.length, version: '7', when: Math.max(Date.now(), last + 1000), tag, breakpoints: true });
    changed = true;
  }
  if (changed) { fs.writeFileSync(jf, JSON.stringify(j, null, 2)); console.log('PATCHED: drizzle journal'); } else console.log('SKIP: journal');
}

// 4) apps: GiftLayer ko (app)/_layout.tsx mein lagao
const IMP = "import { GiftLayer } from '@/components/GiftLayer';\n";
edit('user-app/src/app/(app)/_layout.tsx', [
  ['GiftLayer', "import { useQueryClient } from '@tanstack/react-query';\n", "import { useQueryClient } from '@tanstack/react-query';\n" + IMP],
  ['<GiftLayer', "  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;",
    "  return (\n    <>\n      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />\n      <GiftLayer role=\"user\" />\n    </>\n  );"],
]);
edit('vendor-app/src/app/(app)/_layout.tsx', [
  ['GiftLayer', "import { useQueryClient } from '@tanstack/react-query';\n", "import { useQueryClient } from '@tanstack/react-query';\n" + IMP],
  ['<GiftLayer', "      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />\n      {approved",
    "      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />\n      <GiftLayer role=\"vendor\" />\n      {approved"],
]);

// 5) admin panel: Gifts page
edit('admin-panel/src/components/Layout.tsx', [["'/gifts'", "      { to: '/catalog', label: 'Categories & packs' },", "      { to: '/catalog', label: 'Categories & packs' },\n      { to: '/gifts', label: 'Gifts' },"]]);
edit('admin-panel/src/main.tsx', [
  ['Gifts }', "import { Login } from '@/pages/Login';", "import { Gifts } from '@/pages/Gifts';\nimport { Login } from '@/pages/Login';"],
  ['path="gifts"', '        <Route path="catalog" element={<Catalog />} />', '        <Route path="catalog" element={<Catalog />} />\n        <Route path="gifts" element={<Gifts />} />'],
]);

// 6) gifts ki kamai: admin dashboard + vendor earnings mein jodo
edit('server/src/modules/admin/routes.ts', [
  ['giftTotals', "import { postTxn } from '../wallet/ledger';", "import { giftSeries, giftTotals } from '../gifts/stats';\nimport { postTxn } from '../wallet/ledger';"],
  ['giftDays', "    const nu = userSeries.find((x) => x.day === d);", "    const nu = userSeries.find((x) => x.day === d);\n    const g = giftDays.find((x) => x.day === d);"],
  ['(g?.gross', "return { day: d, recharge: r?.amount ?? 0, gross: s?.gross ?? 0, commission: s?.commission ?? 0,", "return { day: d, recharge: r?.amount ?? 0, gross: (s?.gross ?? 0) + (g?.gross ?? 0), commission: (s?.commission ?? 0) + (g?.commission ?? 0),"],
  ['gift30', "  const series = Array.from({ length: 14 }", "  const gift30 = await giftTotals(d30);\n  const giftDays = await giftSeries(d14);\n  const series = Array.from({ length: 14 }"],
  ['gift30.gross', "last30: { gross: rev30.gross, commission: rev30.gross - rev30.vendorShare,", "last30: { gross: rev30.gross + gift30.gross, commission: rev30.gross + gift30.gross - rev30.vendorShare - (gift30.gross - gift30.commission), gifts: gift30,"],
]);
edit('server/src/modules/vendor/routes.ts', [
  ['giftVendorEarning', "import { postTxn } from '../wallet/ledger';", "import { giftVendorEarning } from '../gifts/stats';\nimport { postTxn } from '../wallet/ledger';"],
  ['gT', "  const [today, week, month] = await Promise.all([stat(startToday), stat(since(7)), stat(since(30))]);",
   "  const [today, week, month] = await Promise.all([stat(startToday), stat(since(7)), stat(since(30))]);\n  const [gT, gW, gM] = await Promise.all([startToday, since(7), since(30)].map((d) => giftVendorEarning(v.id, d)));\n  today.earning += gT;\n  week.earning += gW;\n  month.earning += gM;"],
]);

// 7) vendor app: gifts mile card + history, user app: history label
edit('vendor-app/src/app/(app)/(tabs)/earnings.tsx', [
  ['GiftsReceivedCard', "import { colors, font, gradient, radius, space } from '@/theme';", "import { GiftsReceivedCard } from '@/components/GiftsReceivedCard';\nimport { colors, font, gradient, radius, space } from '@/theme';"],
  ['<GiftsReceivedCard />', '        <Text variant="h3">Hisaab</Text>', '        <GiftsReceivedCard />\n\n        <Text variant="h3">Hisaab</Text>'],
  ["'Gift mila'", '<Text variant="bodyStrong">{TXN[t.type]}</Text>', "<Text variant=\"bodyStrong\">{t.note?.startsWith('Gift') ? 'Gift mila' : TXN[t.type]}</Text>"],
]);
edit('vendor-app/src/app/(app)/(tabs)/sessions.tsx', [
  ['GiftsReceivedCard', "import { colors, font, radius, shadow, space } from '@/theme';", "import { GiftsReceivedCard } from '@/components/GiftsReceivedCard';\nimport { colors, font, radius, shadow, space } from '@/theme';"],
  ['<GiftsReceivedCard />', '          ListEmptyComponent={<Empty icon="chatbubbles-outline"', '          ListHeaderComponent={<View style={{ marginBottom: space.sm }}><GiftsReceivedCard /></View>}\n          ListEmptyComponent={<Empty icon="chatbubbles-outline"'],
]);
edit('user-app/src/app/(app)/(tabs)/history.tsx', [
  ["'Gift bheja'", '<Text variant="bodyStrong">{TXN_LABEL[item.type]}</Text>', "<Text variant=\"bodyStrong\">{item.note?.startsWith('Gift') ? 'Gift bheja' : TXN_LABEL[item.type]}</Text>"],
]);

// 8) admin: session detail mein gifts
edit('admin-panel/src/pages/Money.tsx', [
  ['SessionGifts', "import { dt, mins, rupees } from '@/lib/format';", "import { dt, mins, rupees } from '@/lib/format';\nimport { SessionGifts } from './SessionGifts';"],
  ['<SessionGifts', "      </PageHead>\n      <div className=\"grid g2\" style={{ alignItems: 'start' }}>\n        <div className=\"card\">\n          <dl className=\"kv\">\n            <dt>Status</dt>", "      </PageHead>\n      <SessionGifts id={s.id} />\n      <div className=\"grid g2\" style={{ alignItems: 'start' }}>\n        <div className=\"card\">\n          <dl className=\"kv\">\n            <dt>Status</dt>"],
]);
