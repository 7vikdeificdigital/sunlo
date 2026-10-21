import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Empty, ErrorBox, Loading, Modal, PageHead, Pager } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { dt, rupees } from '@/lib/format';

// ======================= Catalog =======================

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  kind: 'LISTENER' | 'EXPERT';
  sortOrder: number;
  isActive: boolean;
  vendors: number;
}
interface Pack {
  id: string;
  amount: number;
  bonusPct: number;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}

export function Catalog() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<{ items: Category[] }>('/admin/categories') });
  const packs = useQuery({ queryKey: ['packs'], queryFn: () => api<{ items: Pack[] }>('/admin/recharge-packs') });
  const kws = useQuery({ queryKey: ['keywords'], queryFn: () => api<{ items: { id: string; word: string }[] }>('/admin/keywords') });
  const banners = useQuery({ queryKey: ['banners'], queryFn: () => api<{ items: { id: string; title: string; subtitle: string | null; link: string | null; isActive: boolean }[] }>('/admin/banners') });
  const [editCat, setEditCat] = useState<Partial<Category> | null>(null);
  const [editPack, setEditPack] = useState<Partial<Pack> | null>(null);
  const [kw, setKw] = useState('');
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <PageHead title="Categories & packs" sub="Topics, recharge packs, home banners aur chat mein band shabd" />
      {err ? <div className="error" style={{ marginBottom: 12 }}>{err}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Categories</h3>
          <button className="btn sm" onClick={() => setEditCat({ kind: 'EXPERT', icon: 'chatbubbles-outline', sortOrder: (cats.data?.items.length ?? 0) * 1, isActive: true, description: '' })}>
            + Nayi category
          </button>
        </div>
        {cats.isLoading ? (
          <Loading />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Naam</th>
                <th>Type</th>
                <th>Icon</th>
                <th className="right">Vendors</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cats.data?.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                    <div className="faint">{c.description}</div>
                  </td>
                  <td>
                    <span className={`badge ${c.kind === 'LISTENER' ? 'b-good' : 'b-info'}`}>{c.kind === 'LISTENER' ? 'Listener' : 'Expert'}</span>
                  </td>
                  <td className="mono faint">{c.icon}</td>
                  <td className="right num">{c.vendors}</td>
                  <td>{c.isActive ? <span className="badge b-good">Chalu</span> : <span className="badge b-mute">Band</span>}</td>
                  <td className="right">
                    <button className="btn ghost sm" onClick={() => setEditCat(c)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h3>Recharge packs</h3>
            <button className="btn sm" onClick={() => setEditPack({ bonusPct: 0, isPopular: false, isActive: true, sortOrder: packs.data?.items.length ?? 0 })}>
              + Naya pack
            </button>
          </div>
          <table>
            <tbody>
              {packs.data?.items.map((p) => (
                <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                  <td className="num">
                    <b>{rupees(p.amount)}</b> {p.isPopular ? <span className="badge b-warn">Popular</span> : null}
                  </td>
                  <td>{p.bonusPct ? `+${p.bonusPct}% bonus` : '—'}</td>
                  <td>{p.isActive ? '' : 'Band'}</td>
                  <td className="right">
                    <button className="btn ghost sm" onClick={() => setEditPack(p)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stack">
          <div className="card">
            <h3 style={{ marginBottom: 6 }}>Chat mein band shabd</h3>
            <p className="faint" style={{ marginTop: 0 }}>
              Yeh shabd chat mein apne aap *** ho jaate hain (phone number/email hamesha chhupte hain).
            </p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {kws.data?.items.map((k) => (
                <span key={k.id} className="badge b-mute" style={{ paddingRight: 4 }}>
                  {k.word}
                  <button
                    aria-label={`${k.word} hatayein`}
                    style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit', padding: '0 4px' }}
                    onClick={async () => {
                      await api(`/admin/keywords/${k.id}`, { method: 'DELETE' });
                      qc.invalidateQueries({ queryKey: ['keywords'] });
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (kw.trim().length < 2) return;
                try {
                  await api('/admin/keywords', { method: 'POST', body: { word: kw.trim() } });
                  setKw('');
                  qc.invalidateQueries({ queryKey: ['keywords'] });
                } catch (e2) {
                  setErr(errMsg(e2));
                }
              }}
            >
              <input className="input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Naya shabd" aria-label="Naya shabd" />
              <button className="btn" type="submit">
                Jodein
              </button>
            </form>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Home banners</h3>
            {banners.data?.items.length ? (
              <table>
                <tbody>
                  {banners.data.items.map((b) => (
                    <tr key={b.id} style={{ opacity: b.isActive ? 1 : 0.5 }}>
                      <td>
                        <b>{b.title}</b>
                        <div className="faint">{b.subtitle}</div>
                      </td>
                      <td className="faint">→ {b.link ?? '—'}</td>
                      <td className="right">
                        <button
                          className="btn ghost sm"
                          onClick={async () => {
                            await api(`/admin/banners/${b.id}`, { method: 'PATCH', body: { isActive: !b.isActive } });
                            qc.invalidateQueries({ queryKey: ['banners'] });
                          }}
                        >
                          {b.isActive ? 'Band karein' : 'Chalu karein'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty text="Koi banner nahi" />
            )}
          </div>
        </div>
      </div>

      {editCat ? <CategoryDialog c={editCat} onClose={() => setEditCat(null)} onDone={() => qc.invalidateQueries({ queryKey: ['categories'] })} /> : null}
      {editPack ? <PackDialog p={editPack} onClose={() => setEditPack(null)} onDone={() => qc.invalidateQueries({ queryKey: ['packs'] })} /> : null}
    </>
  );
}

function CategoryDialog({ c, onClose, onDone }: { c: Partial<Category>; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState(c);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<Category>) => setV({ ...v, ...p });
  return (
    <Modal title={c.id ? 'Category edit' : 'Nayi category'} onClose={onClose}>
      <div className="field">
        <label>Naam</label>
        <input className="input" value={v.name ?? ''} onChange={(e) => set({ name: e.target.value, ...(c.id ? {} : { slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }) })} />
      </div>
      <div className="field">
        <label>Slug (URL ke liye)</label>
        <input className="input mono" value={v.slug ?? ''} onChange={(e) => set({ slug: e.target.value })} />
      </div>
      <div className="field">
        <label>Vivaran</label>
        <input className="input" value={v.description ?? ''} onChange={(e) => set({ description: e.target.value })} maxLength={200} />
      </div>
      <div className="grid g2">
        <div className="field">
          <label>Type</label>
          <select className="input" value={v.kind} onChange={(e) => set({ kind: e.target.value as Category['kind'] })}>
            <option value="LISTENER">Listener</option>
            <option value="EXPERT">Expert</option>
          </select>
        </div>
        <div className="field">
          <label>Icon (Ionicons naam)</label>
          <input className="input mono" value={v.icon ?? ''} onChange={(e) => set({ icon: e.target.value })} />
        </div>
        <div className="field">
          <label>Kram (sort)</label>
          <input className="input" type="number" value={v.sortOrder ?? 0} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="input" value={v.isActive ? '1' : '0'} onChange={(e) => set({ isActive: e.target.value === '1' })}>
            <option value="1">Chalu</option>
            <option value="0">Band</option>
          </select>
        </div>
      </div>
      {err ? <div className="error">{err}</div> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn"
          onClick={async () => {
            setErr(null);
            try {
              const body = { name: v.name, slug: v.slug, description: v.description ?? '', icon: v.icon, kind: v.kind, sortOrder: v.sortOrder ?? 0, isActive: v.isActive ?? true };
              await api(c.id ? `/admin/categories/${c.id}` : '/admin/categories', { method: c.id ? 'PATCH' : 'POST', body });
              onDone();
              onClose();
            } catch (e) {
              setErr(errMsg(e));
            }
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

function PackDialog({ p, onClose, onDone }: { p: Partial<Pack>; onClose: () => void; onDone: () => void }) {
  const [amt, setAmt] = useState(p.amount ? String(p.amount / 100) : '');
  const [bonus, setBonus] = useState(String(p.bonusPct ?? 0));
  const [popular, setPopular] = useState(p.isPopular ?? false);
  const [active, setActive] = useState(p.isActive ?? true);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title={p.id ? 'Pack edit' : 'Naya pack'} onClose={onClose}>
      <div className="grid g2">
        <div className="field">
          <label>Raqam (₹)</label>
          <input className="input" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field">
          <label>Bonus %</label>
          <input className="input" inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>
      <label className="row">
        <input type="checkbox" checked={popular} onChange={(e) => setPopular(e.target.checked)} /> Popular dikhayein
      </label>
      <label className="row">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Chalu
      </label>
      {err ? <div className="error">{err}</div> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn"
          onClick={async () => {
            setErr(null);
            try {
              const body = { amount: Number(amt) * 100, bonusPct: Number(bonus) || 0, isPopular: popular, isActive: active, sortOrder: p.sortOrder ?? 0 };
              await api(p.id ? `/admin/recharge-packs/${p.id}` : '/admin/recharge-packs', { method: p.id ? 'PATCH' : 'POST', body });
              onDone();
              onClose();
            } catch (e) {
              setErr(errMsg(e));
            }
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

// ======================= Settings =======================

interface S {
  appName: string;
  gstPct: number;
  commissionPct: number;
  minSessionMinutes: number;
  requestTimeoutSec: number;
  minRechargePaise: number;
  maxRechargePaise: number;
  minRatePerMinPaise: number;
  maxRatePerMinPaise: number;
  minWithdrawalPaise: number;
  supportEmail: string;
  maskContactInfoInChat: boolean;
}
const FIELDS: { k: keyof S; l: string; help: string; money?: boolean; text?: boolean }[] = [
  { k: 'appName', l: 'App ka naam', help: 'Users ko dikhta hai', text: true },
  { k: 'commissionPct', l: 'Platform commission (%)', help: 'Har session ki raqam mein platform ka hissa' },
  { k: 'gstPct', l: 'GST (%)', help: 'Recharge par' },
  { k: 'minRatePerMinPaise', l: 'Vendor min rate (₹/min)', help: 'Isse kam rate vendor nahi rakh sakta', money: true },
  { k: 'maxRatePerMinPaise', l: 'Vendor max rate (₹/min)', help: 'Isse zyada nahi', money: true },
  { k: 'minSessionMinutes', l: 'Session ke liye min minute', help: 'Itne minute ka balance hone par hi request jaati hai' },
  { k: 'requestTimeoutSec', l: 'Request timeout (sec)', help: 'Vendor itne sec mein accept na kare to Miss' },
  { k: 'minRechargePaise', l: 'Min recharge (₹)', help: '', money: true },
  { k: 'maxRechargePaise', l: 'Max recharge (₹)', help: '', money: true },
  { k: 'minWithdrawalPaise', l: 'Min withdrawal (₹)', help: 'Vendor isse kam nahi nikal sakta', money: true },
  { k: 'supportEmail', l: 'Support email', help: '', text: true },
];

export function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api<{ settings: S }>('/admin/settings') });
  const [v, setV] = useState<Record<string, string | boolean>>({});
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const s = q.data.settings;
    const o: Record<string, string | boolean> = { maskContactInfoInChat: s.maskContactInfoInChat };
    for (const f of FIELDS) o[f.k] = f.money ? String((s[f.k] as number) / 100) : String(s[f.k]);
    setV(o);
  }, [q.data]);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox e={q.error} />;

  async function save() {
    setMsg(null);
    const body: Record<string, unknown> = { maskContactInfoInChat: v.maskContactInfoInChat };
    for (const f of FIELDS) {
      const raw = String(v[f.k] ?? '');
      body[f.k] = f.text ? raw.trim() : f.money ? Math.round(Number(raw) * 100) : Number(raw);
    }
    try {
      await api('/admin/settings', { method: 'PATCH', body });
      qc.invalidateQueries({ queryKey: ['settings'] });
      setMsg({ ok: true, t: 'Save ho gaya. Naye sessions par turant lagu.' });
    } catch (e) {
      setMsg({ ok: false, t: errMsg(e) });
    }
  }

  return (
    <>
      <PageHead title="Settings" sub="Har badlav audit log mein darj hota hai. API keys yahan nahi: woh sirf server ki .env mein." />
      <div className="card" style={{ maxWidth: 820 }}>
        <div className="grid g2">
          {FIELDS.map((f) => (
            <div className="field" key={f.k}>
              <label htmlFor={f.k}>{f.l}</label>
              <input id={f.k} className="input" value={String(v[f.k] ?? '')} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} inputMode={f.text ? 'text' : 'decimal'} />
              {f.help ? <span className="faint">{f.help}</span> : null}
            </div>
          ))}
        </div>
        <label className="row" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={Boolean(v.maskContactInfoInChat)} onChange={(e) => setV({ ...v, maskContactInfoInChat: e.target.checked })} />
          Chat mein phone number / email / band shabd chhupayein (suraksha ke liye chalu rakhein)
        </label>
        {msg ? (
          <div className={msg.ok ? 'notice' : 'error'} style={{ marginTop: 14, ...(msg.ok ? { background: 'var(--good-soft)', color: 'var(--good)' } : {}) }}>
            {msg.t}
          </div>
        ) : null}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={save}>
            Save karein
          </button>
        </div>
      </div>
    </>
  );
}

// ======================= Audit =======================

const ACTION_HI: Record<string, string> = {
  'vendor.approve': 'Vendor approve',
  'vendor.reject': 'Vendor reject',
  'vendor.suspend': 'Vendor suspend',
  'vendor.reinstate': 'Vendor phir chalu',
  'upload.view': 'KYC document dekha',
  'user.block': 'User block',
  'user.unblock': 'User unblock',
  'wallet.adjust': 'Wallet adjust',
  'session.transcript.view': 'Chat transcript dekha',
  'session.refund': 'Refund',
  'payout.view': 'Bank details dekhi',
  'withdrawal.paid': 'Withdrawal paid',
  'withdrawal.reject': 'Withdrawal reject',
  'settings.update': 'Settings badli',
  'report.resolve': 'Report resolve',
};

export function Audit() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['audit', page],
    queryFn: () => api<{ items: { id: string; action: string; targetType: string; targetId: string | null; meta: unknown; ip: string | null; createdAt: string; adminEmail: string }[] }>('/admin/audit-logs', { query: { page, limit: 50 } }),
  });
  return (
    <>
      <PageHead title="Audit log" sub="Har admin ne kya kiya aur kya dekha. Yeh record mitaya nahi ja sakta." />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Abhi koi entry nahi" />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Samay</th>
                  <th>Admin</th>
                  <th>Kaam</th>
                  <th>Kis par</th>
                  <th>Vivaran</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dt(a.createdAt)}</td>
                    <td>{a.adminEmail}</td>
                    <td>
                      <b>{ACTION_HI[a.action] ?? a.action}</b>
                    </td>
                    <td className="mono faint">
                      {a.targetType}
                      {a.targetId ? ` · ${a.targetId.slice(0, 8)}` : ''}
                    </td>
                    <td className="faint" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.meta ? JSON.stringify(a.meta) : ''}
                    </td>
                    <td className="mono faint">{a.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={setPage} hasMore={q.data.items.length === 50} />
        </>
      )}
    </>
  );
}
