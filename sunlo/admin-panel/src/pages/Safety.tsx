import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Empty, ErrorBox, Loading, PageHead, ReasonDialog, Status, Tabs } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { dt } from '@/lib/format';

const REASON_HI: Record<string, string> = {
  INAPPROPRIATE_BEHAVIOUR: 'Galat vyavhar',
  ASKED_FOR_MONEY_OR_CONTACT: 'Alag se paise/number maanga',
  HARASSMENT: 'Pareshaan / dhamki',
  SPAM_OR_FAKE: 'Fake / spam',
  OTHER: 'Anya',
};

// ======================= Reports =======================

interface Report {
  id: string;
  reporterId: string;
  reporterName: string | null;
  vendorId: string;
  vendorName: string;
  sessionId: string | null;
  reason: string;
  details: string | null;
  status: 'OPEN' | 'RESOLVED';
  resolution: string | null;
  createdAt: string;
}

export function Reports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [warnVendor, setWarnVendor] = useState(true);
  const [resolving, setResolving] = useState<Report | null>(null);
  const q = useQuery({ queryKey: ['reports', status], queryFn: () => api<{ items: Report[] }>('/admin/reports', { query: { status, limit: 50 } }) });
  return (
    <>
      <PageHead title="Reports" sub="Users ki vendors ke khilaaf shikayatein. 24 ghante mein jawab dein." />
      <div className="filters">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { v: 'OPEN', l: 'Khuli' },
            { v: 'RESOLVED', l: 'Resolved' },
          ]}
        />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Koi report nahi 🎉" />
      ) : (
        <div className="stack">
          {q.data.items.map((r) => (
            <div className="card" key={r.id}>
              <div className="card-head">
                <div>
                  <b>{REASON_HI[r.reason] ?? r.reason}</b> · <Link to={`/vendors/${r.vendorId}`}>{r.vendorName}</Link>
                  <div className="faint">
                    {r.reporterName ?? 'User'} ne · {dt(r.createdAt)}
                  </div>
                </div>
                <Status s={r.status} />
              </div>
              {r.details ? <p style={{ margin: '0 0 10px' }}>“{r.details}”</p> : null}
              {r.resolution ? <div className="notice">Faisla: {r.resolution}</div> : null}
              <div className="row">
                {r.sessionId ? (
                  <Link className="btn ghost sm" to={`/sessions/${r.sessionId}`}>
                    Session / transcript
                  </Link>
                ) : null}
                <Link className="btn ghost sm" to={`/vendors/${r.vendorId}`}>
                  Vendor profile
                </Link>
                {r.status === 'OPEN' ? (
                  <button className="btn sm" onClick={() => setResolving(r)}>
                    Resolve karein
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {resolving ? (
        <ReasonDialog
          title="Report resolve"
          label="Kya kaarvai ki? (jaise: vendor ko chetavni, suspend, refund)"
          confirm="Resolve karein"
          extra={
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input type="checkbox" checked={warnVendor} onChange={(e) => setWarnVendor(e.target.checked)} />
              Vendor ko warning notification bhejein
            </label>
          }
          onClose={() => setResolving(null)}
          onSubmit={async (resolution) => {
            await api(`/admin/reports/${resolving.id}/resolve`, { method: 'POST', body: { resolution, warnVendor } });
            qc.invalidateQueries({ queryKey: ['reports'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
          }}
        />
      ) : null}
    </>
  );
}

// ======================= Tickets =======================

interface Ticket {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  updatedAt: string;
  userName: string | null;
  phone: string | null;
  role: string;
}

export function Tickets() {
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['tickets', status], queryFn: () => api<{ items: Ticket[] }>('/admin/tickets', { query: { status, limit: 50 } }) });
  return (
    <>
      <PageHead title="Support tickets" />
      <div className="filters">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { v: 'OPEN', l: 'Khule' },
            { v: 'CLOSED', l: 'Band' },
          ]}
        />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Koi ticket nahi" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vishay</th>
                <th>Kaun</th>
                <th>Status</th>
                <th>Aakhri update</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((t) => (
                <tr key={t.id} className="click" onClick={() => nav(`/tickets/${t.id}`)}>
                  <td style={{ fontWeight: 600 }}>{t.subject}</td>
                  <td>
                    {t.userName ?? t.phone} <span className="badge b-mute">{t.role === 'VENDOR' ? 'Vendor' : 'User'}</span>
                  </td>
                  <td>
                    <Status s={t.status} />
                  </td>
                  <td>{dt(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function TicketDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['ticket', id],
    queryFn: () =>
      api<Ticket & { userId: string; messages: { id: string; body: string; isStaff: boolean; createdAt: string }[] }>(`/admin/tickets/${id}`),
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox e={q.error} />;
  const t = q.data;
  return (
    <>
      <PageHead title={t.subject} sub={`${t.userName ?? t.phone} · ${t.role === 'VENDOR' ? 'Vendor' : 'User'}`}>
        <Link to="/tickets" className="btn ghost">
          ← Tickets
        </Link>
        {t.status === 'OPEN' ? (
          <button
            className="btn ghost"
            onClick={async () => {
              await api(`/admin/tickets/${id}/close`, { method: 'POST' });
              qc.invalidateQueries({ queryKey: ['ticket', id] });
              qc.invalidateQueries({ queryKey: ['tickets'] });
            }}
          >
            Band karein
          </button>
        ) : null}
      </PageHead>
      <div className="card stack" style={{ maxWidth: 760 }}>
        <div className="chat" style={{ maxHeight: 520 }}>
          {t.messages.map((m) => (
            <div key={m.id} className={`bubble ${m.isStaff ? 'u' : 'v'}`}>
              {m.body}
              <div className="t">
                {m.isStaff ? 'Support team' : t.userName ?? 'User'} · {dt(m.createdAt)}
              </div>
            </div>
          ))}
        </div>
        {t.status === 'OPEN' ? (
          <>
            <textarea className="input" placeholder="Jawab likhein…" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} aria-label="Jawab" />
            {err ? <div className="error">{err}</div> : null}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn"
                disabled={busy || !msg.trim()}
                onClick={async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    await api(`/admin/tickets/${id}/reply`, { method: 'POST', body: { message: msg.trim() } });
                    setMsg('');
                    qc.invalidateQueries({ queryKey: ['ticket', id] });
                  } catch (e) {
                    setErr(errMsg(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Jawab bhejein
              </button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// ======================= Reviews =======================

export function Reviews() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['reviews'],
    queryFn: () =>
      api<{ items: { id: string; rating: number; comment: string | null; reply: string | null; isHidden: boolean; createdAt: string; userName: string | null; vendorName: string; vendorId: string }[] }>(
        '/admin/reviews',
        { query: { limit: 50 } },
      ),
  });
  return (
    <>
      <PageHead title="Reviews" sub="Galat/apmaanjanak review chhupa sakte hain (delete nahi hota)" />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Abhi koi review nahi" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rating</th>
                <th>Review</th>
                <th>Vendor</th>
                <th>Kab</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id} style={{ opacity: r.isHidden ? 0.55 : 1 }}>
                  <td className="num" aria-label={`${r.rating} star`}>
                    {'★'.repeat(r.rating)}
                    <span className="faint">{'★'.repeat(5 - r.rating)}</span>
                  </td>
                  <td>
                    {r.comment ?? <span className="faint">(bina comment)</span>}
                    <div className="faint">— {r.userName ?? 'User'}</div>
                  </td>
                  <td>
                    <Link to={`/vendors/${r.vendorId}`}>{r.vendorName}</Link>
                  </td>
                  <td>{dt(r.createdAt)}</td>
                  <td className="right">
                    <button
                      className="btn ghost sm"
                      onClick={async () => {
                        await api(`/admin/reviews/${r.id}/visibility`, { method: 'POST', body: { hidden: !r.isHidden } });
                        qc.invalidateQueries({ queryKey: ['reviews'] });
                      }}
                    >
                      {r.isHidden ? 'Dikhayein' : 'Chhupayein'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
