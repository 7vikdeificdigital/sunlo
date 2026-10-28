// Usage: node apply-resolve-notify.js <repo-root>   (idempotent)
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
function edit(rel, fn) {
  const f = path.join(root, rel);
  const s = fs.readFileSync(f, 'utf8');
  const out = fn(s);
  if (out === s) { console.log('SKIP (already patched or not matched):', rel); return; }
  fs.writeFileSync(f, out); console.log('PATCHED:', rel);
}
edit('server/src/modules/admin/routes.ts', (s) => {
  if (s.includes('warnVendor')) return s;
  s = s.replace(
    "const { resolution } = body(req, z.object({ resolution: z.string().trim().min(5).max(500) }));\n  const [r] = await db\n    .update(reports)",
    "const { resolution, warnVendor } = body(req, z.object({ resolution: z.string().trim().min(5).max(500), warnVendor: z.boolean().default(true) }));\n  const [r] = await db\n    .update(reports)");
  s = s.replace(
    "  await audit(req, 'report.resolve', 'report', id, { resolution });\n  res.json(r);",
    `  await audit(req, 'report.resolve', 'report', id, { resolution, warnVendor });
  // Reporter (user) ko batao ki shikayat par kaarvai ho gayi
  await notify(r.reporterId, 'Aapki shikayat par kaarvai hui ✅', resolution, { type: 'report_resolved', reportId: id });
  // Vendor ko chetavani
  if (warnVendor) {
    const [v] = await db.select({ userId: vendors.userId }).from(vendors).where(eq(vendors.id, r.vendorId));
    if (v) await notify(v.userId, 'Aapke khilaaf shikayat par chetavani ⚠️', resolution, { type: 'warning', reportId: id });
  }
  res.json(r);`);
  return s;
});
edit('admin-panel/src/pages/Safety.tsx', (s) => {
  if (s.includes('warnVendor')) return s;
  s = s.replace("const [resolving, setResolving] = useState", "const [warnVendor, setWarnVendor] = useState(true);\n  const [resolving, setResolving] = useState");
  s = s.replace("          confirm=\"Resolve karein\"\n", "          confirm=\"Resolve karein\"\n          extra={\n            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>\n              <input type=\"checkbox\" checked={warnVendor} onChange={(e) => setWarnVendor(e.target.checked)} />\n              Vendor ko warning notification bhejein\n            </label>\n          }\n");
  s = s.replace("body: { resolution } });", "body: { resolution, warnVendor } });");
  return s;
});
