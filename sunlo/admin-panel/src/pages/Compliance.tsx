import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, ErrorBox, Loading, Modal, PageHead, Tabs } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { dt, rupees } from '@/lib/format';

interface Overview {
  tickets: { open: number; overdue: number; dueSoon: number };
  reports: { open: number; overdue: number };
  vendorsWithoutPan: number;
  takedowns: { total: number; late: number };
  admins: { total: number; with2fa: number };
  lastPolicyNoticeAt: string | null;
  checks: { key: string; ok: boolean; label: string }[];
}

/**
 * Sarkari niyam ek jagah: IT Rules 2026 (shikayat 7 din / 36 ghante, takedown 3 ghante, har 3 mahine notice),
 * DPDP (data), TDS (Sec 393 / 194-O), admin 2FA.
 */
export function Compliance() {
  const [tab, setTab] = useState<'overview' | 'grievances' | 'takedowns' | 'tds' | 'security'>('overview');
  return (
    <>
      <PageHead title="Compliance" sub="IT Rules 2026, DPDP, CCPA aur TDS ke niyam: kya theek hai, kya baaki" />
      <div className="filters">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { v: 'overview', l: 'Overview' },
            { v: 'grievances', l: 'Shikayat SLA' },
            { v: 'takedowns', l: 'Takedown (3 ghante)' },
            { v: 'tds', l: 'TDS report' },
            { v: 'security', l: 'Admin 2FA' },
          ]}
        />
      </div>
      {tab === 'overview' ? <OverviewTab /> : tab === 'grievances' ? <GrievancesTab /> : tab === 'takedowns' ? <TakedownsTab /> : tab === 'tds' ? <TdsTab /> : <SecurityTab />}
    </>
  );
}

function OverviewTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['compliance'], queryFn: () => api<Overview>('/admin/compliance/overview') });
  const [msg, setMsg] = useState<string | null>(null);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox e={q.error} />;
  const o = q.data;
  return (
    <div className="stack">
      <div className="grid g4">
        <Stat label="Khuli shikayat" value={o.tickets.open} sub={`${o.tickets.overdue} der se · ${o.tickets.dueSoon} 24 ghante mein`} bad={o.tickets.overdue > 0} />
        <Stat label="Khuli reports" value={o.reports.open} sub={`${o.reports.overdue} 36 ghante se purani`} bad={o.reports.overdue > 0} />
        <Stat label="PAN ke bina listener" value={o.vendorsWithoutPan} sub="Inse 5% TDS katta hai" bad={o.vendorsWithoutPan > 0} />
        <Stat label="Takedowns" value={o.takedowns.total} sub={`${o.takedowns.late} 3 ghante se der`} bad={o.takedowns.late > 0} />
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Checklist</h3>
        <table>
          <tbody>
            {o.checks.map((c) => (
              <tr key={c.key}>
                <td style={{ width: 110 }}>{c.ok ? <span className="badge b-good">Theek</span> : <span className="badge b-bad">Baaki</span>}</td>
                <td>{c.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="faint" style={{ marginBottom: 0 }}>
          Grievance Officer, feature switches, chat retention aur TDS rate <Link to="/settings">Settings</Link> mein badlein.
        </p>
      </div>
      <div className="card">
        <div className="card-head">
          <h3>Users ko niyamon ka notice (har 3 mahine)</h3>
          <button
            className="btn sm"
            onClick={async () => {
              if (!confirm('Sab users aur listeners ko niyamon ka notice bhejein?')) return;
              try {
                const r = await api<{ sent: number }>('/admin/policy-notice', { method: 'POST', body: {} });
                setMsg(`${r.sent} logon ko bheja gaya`);
                qc.invalidateQueries({ queryKey: ['compliance'] });
              } catch (e) {
                setMsg(errMsg(e));
              }
            }}
          >
            Abhi bhejein
          </button>
        </div>
        <p className="faint" style={{ margin: 0 }}>
          Pichhla notice: <b>{dt(o.lastPolicyNoticeAt)}</b>. "Auto notice" chalu ho to server 90 din par khud bhejta hai.
        </p>
        {msg ? <div className="notice" style={{ marginTop: 10 }}>{msg}</div> : null}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: number; sub: string; bad?: boolean }) {
  return (
    <div className="card">
      <div className="faint">{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: bad ? 'var(--bad)' : undefined }} className="num">
        {value}
      </div>
      <div className="faint">{sub}</div>
    </div>
  );
}

const CAT_HI: Record<string, string> = {
  GENERAL: 'Aam',
  PAYMENT: 'Payment',
  SAFETY: 'Suraksha',
  DATA: 'Data / privacy',
  GRIEVANCE: 'Grievance',
  UNLAWFUL_CONTENT: 'Ghair-kanooni content (36 ghante)',
};

function GrievancesTab() {
  const [overdue, setOverdue] = useState<'all' | 'true'>('all');
  const q = useQuery({
    queryKey: ['grievances', overdue],
    queryFn: () =>
      api<{ items: { id: string; subject: string; category: string; userName: string | null; role: string; createdAt: string; dueAt: string | null; overdue: boolean; hoursLeft: number | null }[] }>('/admin/grievances', {
        query: { overdue: overdue === 'true' ? 'true' : undefined, limit: 100 },
      }),
  });
  return (
    <>
      <div className="filters">
        <Tabs value={overdue} onChange={setOverdue} options={[{ v: 'all', l: 'Sab khuli' }, { v: 'true', l: 'Der se' }]} />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Koi khuli shikayat nahi" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Deadline</th>
                <th>Vishay</th>
                <th>Type</th>
                <th>Kisne</th>
                <th>Aayi</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.overdue ? (
                      <span className="badge b-bad">{Math.abs(t.hoursLeft ?? 0)} ghante der</span>
                    ) : (
                      <span className={`badge ${(t.hoursLeft ?? 99) < 24 ? 'b-warn' : 'b-mute'}`}>{t.hoursLeft} ghante baaki</span>
                    )}
                  </td>
                  <td>
                    <Link to={`/tickets/${t.id}`}>{t.subject}</Link>
                  </td>
                  <td>{CAT_HI[t.category] ?? t.category}</td>
                  <td>
                    {t.userName ?? '—'} <span className="faint">({t.role === 'VENDOR' ? 'Listener' : 'User'})</span>
                  </td>
                  <td>{dt(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const TARGET_HI: Record<string, string> = { USER: 'User account', VENDOR: 'Listener profile', MESSAGE: 'Chat message', ROOM: 'Live room', VOICE_NOTE: 'Voice note', REVIEW: 'Review' };

function TakedownsTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['takedowns'],
    queryFn: () => api<{ items: { id: string; targetType: string; targetId: string; authority: string; orderRef: string; receivedAt: string; actionedAt: string; late: boolean; adminEmail: string }[] }>('/admin/takedowns', { query: { limit: 100 } }),
  });
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="notice" style={{ marginBottom: 12 }}>
        Court ya sarkari order (DIG / Joint Secretary ya usse upar) milte hi yahan darj karein. Content turant hat jaata hai aur 3 ghante ki deadline ka record banta hai.
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn danger" onClick={() => setOpen(true)}>
          + Order par content hatayein
        </button>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Abhi koi takedown nahi" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kya</th>
                <th>Order</th>
                <th>Mila</th>
                <th>Hataya</th>
                <th>3 ghante</th>
                <th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((t) => (
                <tr key={t.id}>
                  <td>
                    {TARGET_HI[t.targetType] ?? t.targetType} <span className="mono faint">{t.targetId.slice(0, 8)}</span>
                  </td>
                  <td>
                    <b>{t.authority}</b>
                    <div className="faint">{t.orderRef}</div>
                  </td>
                  <td>{dt(t.receivedAt)}</td>
                  <td>{dt(t.actionedAt)}</td>
                  <td>{t.late ? <span className="badge b-bad">Der hui</span> : <span className="badge b-good">Samay par</span>}</td>
                  <td className="faint">{t.adminEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open ? <TakedownForm onClose={() => setOpen(false)} onDone={() => qc.invalidateQueries({ queryKey: ['takedowns'] })} /> : null}
    </>
  );
}

function TakedownForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ targetType: 'MESSAGE', targetId: '', authority: '', orderRef: '', note: '', receivedAt: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Kanooni order par content hatana" onClose={onClose}>
      <div className="field">
        <label htmlFor="tt">Kya hatana hai</label>
        <select id="tt" className="input" value={f.targetType} onChange={set('targetType')}>
          {Object.entries(TARGET_HI).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="tid">ID (user / vendor / message / room / voice note / review ki poori ID)</label>
        <input id="tid" className="input mono" value={f.targetId} onChange={set('targetId')} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
      </div>
      <div className="grid g2">
        <div className="field">
          <label htmlFor="au">Order kisne diya</label>
          <input id="au" className="input" value={f.authority} onChange={set('authority')} placeholder="Delhi High Court / MeitY / UP Police (DIG)" />
        </div>
        <div className="field">
          <label htmlFor="or">Order number</label>
          <input id="or" className="input" value={f.orderRef} onChange={set('orderRef')} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ra">Order kab mila (khaali = abhi)</label>
        <input id="ra" className="input" type="datetime-local" value={f.receivedAt} onChange={set('receivedAt')} />
      </div>
      <div className="field">
        <label htmlFor="nt">Note (optional)</label>
        <textarea id="nt" className="input" value={f.note} onChange={set('note')} maxLength={500} />
      </div>
      {err ? <div className="error">{err}</div> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn danger"
          disabled={busy || f.targetId.length < 36 || f.authority.length < 3 || f.orderRef.length < 2}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await api('/admin/takedowns', {
                method: 'POST',
                body: {
                  targetType: f.targetType,
                  targetId: f.targetId.trim(),
                  authority: f.authority.trim(),
                  orderRef: f.orderRef.trim(),
                  ...(f.note.trim() ? { note: f.note.trim() } : {}),
                  ...(f.receivedAt ? { receivedAt: new Date(f.receivedAt).toISOString() } : {}),
                },
              });
              onDone();
              onClose();
            } catch (e) {
              setErr(errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Hata rahe hain…' : 'Turant hatayein'}
        </button>
      </div>
    </Modal>
  );
}

/** Indian financial year ke quarter (Apr-Jun = Q1) */
function quarters() {
  const out: { l: string; from: string; to: string }[] = [];
  const now = new Date();
  let y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  let q = Math.floor(((now.getMonth() + 9) % 12) / 3); // 0..3
  for (let i = 0; i < 6; i++) {
    const startMonth = 3 + q * 3; // 3=Apr
    const sy = y + Math.floor(startMonth / 12);
    const sm = (startMonth % 12) + 1;
    const ey = y + Math.floor((startMonth + 3) / 12);
    const em = ((startMonth + 3) % 12) + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    out.push({ l: `FY${String(y + 1).slice(2)} Q${q + 1}`, from: `${sy}-${pad(sm)}-01`, to: `${ey}-${pad(em)}-01` });
    q -= 1;
    if (q < 0) {
      q = 3;
      y -= 1;
    }
  }
  return out;
}

function TdsTab() {
  const qs = quarters();
  const [sel, setSel] = useState(0);
  const p = qs[sel];
  const q = useQuery({
    queryKey: ['tds', p.from, p.to],
    queryFn: () => api<{ items: { vendorId: string; displayName: string; panName: string | null; panLast4: string | null; gross: number; earning: number; tds: number }[]; totals: { gross: number; earning: number; tds: number } }>('/admin/tds-report', { query: { from: p.from, to: p.to } }),
  });
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 220 }} value={sel} onChange={(e) => setSel(Number(e.target.value))} aria-label="Quarter">
          {qs.map((x, i) => (
            <option key={x.l} value={i}>
              {x.l} ({x.from} se)
            </option>
          ))}
        </select>
        <button
          className="btn"
          onClick={async () => {
            setErr(null);
            try {
              const blob = await api<Blob>('/admin/tds-report', { query: { from: p.from, to: p.to, format: 'csv' }, raw: true });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `tds-${p.l.replace(/\s/g, '-')}.csv`;
              a.click();
              URL.revokeObjectURL(a.href);
            } catch (e) {
              setErr(errMsg(e));
            }
          }}
        >
          CSV download (poora PAN · audit mein darj)
        </button>
      </div>
      {err ? <div className="error">{err}</div> : null}
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Is quarter mein koi kamai nahi" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Listener</th>
                <th>PAN</th>
                <th className="right">Gross</th>
                <th className="right">Kamai (commission ke baad)</th>
                <th className="right">TDS</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.vendorId}>
                  <td>
                    <Link to={`/vendors/${r.vendorId}`}>{r.displayName}</Link>
                    {r.panName ? <div className="faint">{r.panName}</div> : null}
                  </td>
                  <td className="mono">{r.panLast4 ? `XXXXXX${r.panLast4}` : <span className="badge b-bad">PAN nahi (5%)</span>}</td>
                  <td className="right num">{rupees(r.gross, true)}</td>
                  <td className="right num">{rupees(r.earning, true)}</td>
                  <td className="right num">
                    <b>{rupees(r.tds, true)}</b>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <b>Kul</b>
                </td>
                <td className="right num">{rupees(q.data.totals.gross, true)}</td>
                <td className="right num">{rupees(q.data.totals.earning, true)}</td>
                <td className="right num">
                  <b>{rupees(q.data.totals.tds, true)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="faint">TDS har mahine ki 7 tareekh tak jama karein aur quarterly return file karein. Rs 5 lakh tak ki chhoot jaisi shartein apne CA se pakki karein.</p>
    </>
  );
}

function SecurityTab() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me-full'], queryFn: () => api<{ user: { totpEnabled: boolean; email: string } }>('/me') });
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  if (me.isLoading) return <Loading />;
  if (me.error || !me.data) return <ErrorBox e={me.error} />;
  const on = me.data.user.totpEnabled;
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <h3 style={{ marginTop: 0 }}>Admin login par 2-step verification</h3>
      <p className="faint">
        Password ke saath Google Authenticator / Microsoft Authenticator ka 6-ank code. Kisi ka password chori ho jaaye to bhi admin panel nahi khulega.
      </p>
      <p>
        Abhi: {on ? <span className="badge b-good">Chalu</span> : <span className="badge b-bad">Band</span>}
      </p>
      {!on && !setup ? (
        <button
          className="btn"
          onClick={async () => {
            try {
              setSetup(await api<{ secret: string; otpauthUrl: string }>('/admin/2fa/setup', { method: 'POST', body: {} }));
            } catch (e) {
              setMsg({ ok: false, t: errMsg(e) });
            }
          }}
        >
          2FA setup karein
        </button>
      ) : null}
      {setup ? (
        <div className="stack">
          <div>
            Authenticator app mein "Setup key" se yeh key daalein:
            <div className="mono" style={{ fontSize: 16, padding: '8px 0', wordBreak: 'break-all' }}>
              {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
            </div>
            <details>
              <summary className="faint">otpauth link (QR banane ke liye)</summary>
              <div className="mono faint" style={{ wordBreak: 'break-all' }}>{setup.otpauthUrl}</div>
            </details>
          </div>
        </div>
      ) : null}
      {setup || on ? (
        <div className="row" style={{ marginTop: 12 }}>
          <input className="input mono" style={{ maxWidth: 160 }} inputMode="numeric" maxLength={6} placeholder="6-ank code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Authenticator code" />
          <button
            className={`btn ${on ? 'danger' : ''}`}
            disabled={code.length !== 6}
            onClick={async () => {
              setMsg(null);
              try {
                await api(on ? '/admin/2fa/disable' : '/admin/2fa/enable', { method: 'POST', body: { code } });
                setSetup(null);
                setCode('');
                setMsg({ ok: true, t: on ? '2FA band kar diya' : '2FA chalu ho gaya. Agli baar login par code maanga jayega.' });
                qc.invalidateQueries({ queryKey: ['me-full'] });
                qc.invalidateQueries({ queryKey: ['compliance'] });
              } catch (e) {
                setMsg({ ok: false, t: errMsg(e) });
              }
            }}
          >
            {on ? '2FA band karein' : 'Verify karke chalu karein'}
          </button>
        </div>
      ) : null}
      {msg ? (
        <div className={msg.ok ? 'notice' : 'error'} style={{ marginTop: 12, ...(msg.ok ? { background: 'var(--good-soft)', color: 'var(--good)' } : {}) }}>
          {msg.t}
        </div>
      ) : null}
    </div>
  );
}
