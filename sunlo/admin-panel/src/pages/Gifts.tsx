import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorBox, Loading, Modal, PageHead } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { rupees } from '@/lib/format';

interface Gift {
  id: string;
  name: string;
  icon: string;
  price: number;
  sortOrder: number;
  isActive: boolean;
  hasSvga: boolean;
}
interface Resp {
  items: Gift[];
  last30: { count: number; gross: number; commission: number };
  commissionPct: number;
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(new Error('File padh nahi paye'));
    r.readAsDataURL(f);
  });
}

export function Gifts() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['gifts-admin'], queryFn: () => api<Resp>('/admin/gifts') });
  const [edit, setEdit] = useState<{ id?: string; name: string; icon: string; price: string; sortOrder: string; isActive: boolean } | null>(null);
  const [pct, setPct] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox e={q.error} />;
  const d = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['gifts-admin'] });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, t: ok });
      await refresh();
    } catch (e) {
      setMsg({ ok: false, t: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Gifts" sub="User call/chat mein gift bhejte hain; platform ka commission kaat kar baaki vendor ke wallet mein jata hai" />
      {msg ? <div className={msg.ok ? 'notice' : 'error'} style={{ marginBottom: 12 }}>{msg.t}</div> : null}

      <div className="grid g2" style={{ marginBottom: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h3>Pichhle 30 din</h3></div>
          <p style={{ margin: 0 }}>
            <b>{d.last30.count}</b> gifts · Total <b>{rupees(d.last30.gross)}</b> · Platform commission <b>{rupees(d.last30.commission)}</b>
          </p>
        </div>
        <div className="card">
          <div className="card-head"><h3>Gift commission</h3></div>
          <div className="row">
            <input className="input" style={{ maxWidth: 100 }} inputMode="numeric" value={pct ?? String(d.commissionPct)} onChange={(e) => setPct(e.target.value)} />
            <span>% platform ka hissa (0–90)</span>
            <button
              className="btn sm"
              disabled={busy || pct === null}
              onClick={() => run(() => api('/admin/settings', { method: 'PATCH', body: { giftCommissionPct: Number(pct) } }).then(() => setPct(null)), 'Commission save ho gaya. Naye gifts par lagu.')}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Gift list</h3>
          <button className="btn sm" onClick={() => setEdit({ name: '', icon: '🎁', price: '10', sortOrder: String(d.items.length + 1), isActive: true })}>+ Naya gift</button>
        </div>
        <table>
          <thead>
            <tr><th>Gift</th><th className="right">Keemat</th><th>Animation (SVGA / WebM)</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {d.items.map((g) => (
              <tr key={g.id} style={{ opacity: g.isActive ? 1 : 0.5 }}>
                <td><span style={{ fontSize: 22 }}>{g.icon}</span> <b>{g.name}</b></td>
                <td className="right num">{rupees(g.price, true)}</td>
                <td>
                  {g.hasSvga ? <span className="badge b-good">Animation lagi hai</span> : <span className="badge b-mute">Emoji animation</span>}{' '}
                  <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
                    {g.hasSvga ? 'Badlein' : '.svga / .webm upload'}
                    <input
                      type="file"
                      accept=".svga,.webm"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (!f) return;
                        if (f.size > 6 * 1024 * 1024) return setMsg({ ok: false, t: 'File 6 MB se badi hai' });
                        void run(async () => api(`/admin/gifts/${g.id}/svga`, { method: 'POST', body: { dataBase64: await fileToBase64(f) } }), 'Animation upload ho gayi');
                      }}
                    />
                  </label>
                  {g.hasSvga ? <button className="btn ghost sm" disabled={busy} onClick={() => run(() => api(`/admin/gifts/${g.id}/svga`, { method: 'DELETE' }), 'Animation hata di')}>Hatayein</button> : null}
                </td>
                <td>{g.isActive ? <span className="badge b-good">Chalu</span> : <span className="badge b-mute">Band</span>}</td>
                <td className="right">
                  <button className="btn ghost sm" onClick={() => setEdit({ id: g.id, name: g.name, icon: g.icon, price: String(g.price / 100), sortOrder: String(g.sortOrder), isActive: g.isActive })}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit ? (
        <Modal title={edit.id ? 'Gift edit' : 'Naya gift'} onClose={() => setEdit(null)}>
          <div className="field"><label>Naam</label><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={30} /></div>
          <div className="field"><label>Emoji / icon</label><input className="input" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} maxLength={8} /></div>
          <div className="field"><label>Keemat (₹)</label><input className="input" inputMode="decimal" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></div>
          <div className="field"><label>Order</label><input className="input" inputMode="numeric" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: e.target.value })} /></div>
          <label className="row"><input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Chalu</label>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                const body = { name: edit.name.trim(), icon: edit.icon.trim(), price: Math.round(Number(edit.price) * 100), sortOrder: Number(edit.sortOrder) || 0, isActive: edit.isActive };
                void run(() => (edit.id ? api(`/admin/gifts/${edit.id}`, { method: 'PATCH', body }) : api('/admin/gifts', { method: 'POST', body })), 'Gift save ho gaya').then(() => setEdit(null));
              }}
            >
              Save karein
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
