import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Empty, ErrorBox, Loading, Modal, PageHead, Pager, ReasonDialog, Status, Tabs } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { dt, mins, rupees } from '@/lib/format';
import { SessionGifts } from './SessionGifts';

// ======================= Sessions =======================

interface SRow {
  id: string;
  type: string;
  status: string;
  ratePerMin: number;
  billedSeconds: number;
  chargedAmount: number;
  vendorEarning: number;
  refundedAmount: number;
  requestedAt: string;
  endReason: string | null;
  userName: string | null;
  userId: string;
  vendorName: string;
  vendorId: string;
}

export function Sessions() {
  const [sp] = useSearchParams();
  const vendorId = sp.get('vendorId') ?? undefined;
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['sessions', status, vendorId, page],
    queryFn: () => api<{ items: SRow[]; total: number }>('/admin/sessions', { query: { status: status === 'ALL' ? undefined : status, vendorId, page, limit: 25 } }),
    refetchInterval: 15_000,
  });
  useEffect(() => setPage(1), [status]);
  return (
    <>
      <PageHead title="Sessions" sub={vendorId ? 'Ek vendor ke sessions' : 'Saare chat / call sessions'} />
      <div className="filters">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { v: 'ALL', l: 'Sab' },
            { v: 'ACTIVE', l: 'Live' },
            { v: 'COMPLETED', l: 'Poore' },
            { v: 'MISSED', l: 'Miss' },
            { v: 'REJECTED', l: 'Reject' },
          ]}
        />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Koi session nahi" />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Samay</th>
                  <th>User → Vendor</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th className="right">Avadhi</th>
                  <th className="right">Charge</th>
                  <th className="right">Platform</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((s) => (
                  <tr key={s.id} className="click" onClick={() => nav(`/sessions/${s.id}`)}>
                    <td>{dt(s.requestedAt)}</td>
                    <td>
                      {s.userName ?? 'User'} → <b>{s.vendorName}</b>
                    </td>
                    <td>{s.type}</td>
                    <td>
                      <Status s={s.status} /> {s.refundedAmount ? <span className="badge b-info">Refund</span> : null}
                    </td>
                    <td className="right num">{mins(s.billedSeconds)}</td>
                    <td className="right num">{rupees(s.chargedAmount)}</td>
                    <td className="right num">{rupees(s.chargedAmount - s.vendorEarning)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={setPage} hasMore={page * 25 < q.data.total} />
        </>
      )}
    </>
  );
}

interface SDetail extends SRow {
  commissionPct: number;
  intake: { topic?: string; note?: string } | null;
  acceptedAt: string | null;
  endedAt: string | null;
  vendorUserId: string;
  messages: { id: string; senderId: string; body: string; flagged: boolean; createdAt: string }[];
}

export function SessionDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['session', id], queryFn: () => api<SDetail>(`/admin/sessions/${id}`) });
  const [refund, setRefund] = useState(false);
  const [amt, setAmt] = useState('');
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox e={q.error} />;
  const s = q.data;
  const canRefund = s.status === 'COMPLETED' && s.chargedAmount > 0 && !s.refundedAmount;
  return (
    <>
      <PageHead title={`${s.type} session`} sub={`${s.userName ?? 'User'} → ${s.vendorName} · ${dt(s.requestedAt)}`}>
        <Link to="/sessions" className="btn ghost">
          ← Sessions
        </Link>
        {canRefund ? (
          <button className="btn danger" onClick={() => setRefund(true)}>
            Refund
          </button>
        ) : null}
      </PageHead>
      <SessionGifts id={s.id} />
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <Status s={s.status} /> {s.endReason ? <span className="faint">({s.endReason})</span> : null}
            </dd>
            <dt>User</dt>
            <dd>
              <Link to={`/users/${s.userId}`}>{s.userName ?? 'User'}</Link>
            </dd>
            <dt>Vendor</dt>
            <dd>
              <Link to={`/vendors/${s.vendorId}`}>{s.vendorName}</Link>
            </dd>
            <dt>Topic</dt>
            <dd>
              {s.intake?.topic ?? '—'}
              {s.intake?.note ? <div className="faint">“{s.intake.note}”</div> : null}
            </dd>
            <dt>Shuru / Khatam</dt>
            <dd>
              {dt(s.acceptedAt)} → {dt(s.endedAt)}
            </dd>
            <dt>Avadhi</dt>
            <dd>{mins(s.billedSeconds)}</dd>
            <dt>Rate</dt>
            <dd>{rupees(s.ratePerMin)}/min</dd>
            <dt>Charge</dt>
            <dd className="num">{rupees(s.chargedAmount)}</dd>
            <dt>Vendor ko</dt>
            <dd className="num">{rupees(s.vendorEarning)}</dd>
            <dt>Platform ({s.commissionPct}%)</dt>
            <dd className="num">{rupees(s.chargedAmount - s.vendorEarning)}</dd>
            {s.refundedAmount ? (
              <>
                <dt>Refund</dt>
                <dd className="num">{rupees(s.refundedAmount)}</dd>
              </>
            ) : null}
          </dl>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Chat transcript</h3>
            <span className="faint">Dekhna audit log mein darj hai</span>
          </div>
          {s.messages.length ? (
            <div className="chat">
              {s.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.senderId === s.vendorUserId ? 'v' : 'u'} ${m.flagged ? 'flag' : ''}`}>
                  {m.body}
                  <div className="t">
                    {m.senderId === s.vendorUserId ? s.vendorName : s.userName ?? 'User'} · {dt(m.createdAt)}
                    {m.flagged ? ' · ⚠ contact share ki koshish' : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="faint">{s.type === 'CHAT' ? 'Koi message nahi' : 'Call session: transcript nahi hota'}</p>
          )}
        </div>
      </div>
      {refund ? (
        <ReasonDialog
          title="Session refund"
          label="Refund ki wajah (user ko dikhegi)"
          confirm="Refund karein"
          danger
          extra={
            <div className="field">
              <label htmlFor="ramt">Raqam (₹) · khaali = poora {rupees(s.chargedAmount)}</label>
              <input id="ramt" className="input" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} />
              <span className="faint">Vendor ki us hisse ki kamai (jitni wallet mein ho) wapas li jayegi.</span>
            </div>
          }
          onClose={() => setRefund(false)}
          onSubmit={async (reason) => {
            await api(`/admin/sessions/${id}/refund`, { method: 'POST', body: { reason, ...(amt ? { amount: Math.round(Number(amt) * 100) } : {}) } });
            qc.invalidateQueries({ queryKey: ['session', id] });
          }}
        />
      ) : null}
    </>
  );
}

// ======================= Payments =======================

export function Payments() {
  const [status, setStatus] = useState('PAID');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['payments', status, page],
    queryFn: () =>
      api<{ items: { id: string; userName: string | null; phone: string | null; provider: string; providerPaymentId: string | null; amount: number; bonus: number; gstAmount: number; totalPayable: number; status: string; createdAt: string; userId: string }[]; total: number }>(
        '/admin/payments',
        { query: { status: status === 'ALL' ? undefined : status, page, limit: 25 } },
      ),
  });
  useEffect(() => setPage(1), [status]);
  return (
    <>
      <PageHead title="Payments" sub="Wallet recharge" />
      <div className="filters">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { v: 'PAID', l: 'Paid' },
            { v: 'CREATED', l: 'Adhoore' },
            { v: 'FAILED', l: 'Fail' },
            { v: 'ALL', l: 'Sab' },
          ]}
        />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Koi payment nahi" />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Samay</th>
                  <th>User</th>
                  <th>Status</th>
                  <th className="right">Wallet</th>
                  <th className="right">Bonus</th>
                  <th className="right">GST</th>
                  <th className="right">Kul</th>
                  <th>Ref</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{dt(p.createdAt)}</td>
                    <td>
                      <Link to={`/users/${p.userId}`}>{p.userName ?? p.phone}</Link>
                    </td>
                    <td>
                      <Status s={p.status} />
                    </td>
                    <td className="right num">{rupees(p.amount)}</td>
                    <td className="right num">{rupees(p.bonus)}</td>
                    <td className="right num">{rupees(p.gstAmount)}</td>
                    <td className="right num">
                      <b>{rupees(p.totalPayable)}</b>
                    </td>
                    <td className="mono faint">{p.providerPaymentId ?? p.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={setPage} hasMore={page * 25 < q.data.total} />
        </>
      )}
    </>
  );
}

// ======================= Withdrawals =======================

interface WRow {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  payoutSnapshot: { method: string; upiId?: string; accountHolder?: string; accountLast4?: string; ifsc?: string };
  reference: string | null;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}

export function Withdrawals() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'PENDING' | 'PAID' | 'REJECTED'>('PENDING');
  const [pay, setPay] = useState<WRow | null>(null);
  const [reject, setReject] = useState<WRow | null>(null);
  const q = useQuery({ queryKey: ['withdrawals', status], queryFn: () => api<{ items: WRow[] }>('/admin/withdrawals', { query: { status, limit: 50 } }) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['withdrawals'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  return (
    <>
      <PageHead title="Withdrawals" sub="Vendors ko payout. Paisa bhejne ke baad UTR/Ref darj karein." />
      <div className="filters">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { v: 'PENDING', l: 'Pending' },
            { v: 'PAID', l: 'Paid' },
            { v: 'REJECTED', l: 'Rejected' },
          ]}
        />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Is list mein kuch nahi" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Vendor</th>
                <th>Account</th>
                <th className="right">Raqam</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((w) => (
                <tr key={w.id}>
                  <td>{dt(w.createdAt)}</td>
                  <td>
                    <Link to={`/vendors/${w.vendorId}`}>{w.vendorName}</Link>
                  </td>
                  <td className="faint">{w.payoutSnapshot.method === 'UPI' ? `UPI ${w.payoutSnapshot.upiId}` : `${w.payoutSnapshot.accountHolder} ••••${w.payoutSnapshot.accountLast4}`}</td>
                  <td className="right num">
                    <b>{rupees(w.amount)}</b>
                  </td>
                  <td>
                    <Status s={w.status} /> {w.reference ? <span className="mono faint">{w.reference}</span> : null}
                    {w.note ? <div className="faint">{w.note}</div> : null}
                  </td>
                  <td className="right">
                    {w.status === 'PENDING' ? (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => setReject(w)}>
                          Reject
                        </button>
                        <button className="btn sm" onClick={() => setPay(w)}>
                          Pay karein
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pay ? <PayDialog w={pay} onClose={() => setPay(null)} onDone={refresh} /> : null}
      {reject ? (
        <ReasonDialog
          title="Withdrawal reject"
          label="Wajah (vendor ko dikhegi). Raqam vendor ke wallet mein wapas jayegi."
          confirm="Reject karein"
          danger
          onClose={() => setReject(null)}
          onSubmit={async (note) => {
            await api(`/admin/withdrawals/${reject.id}/reject`, { method: 'POST', body: { note } });
            refresh();
          }}
        />
      ) : null}
    </>
  );
}

function PayDialog({ w, onClose, onDone }: { w: WRow; onClose: () => void; onDone: () => void }) {
  const [details, setDetails] = useState<{ method: string; upiId?: string; accountHolder?: string; accountNumber?: string; ifsc?: string } | null>(null);
  const [ref, setRef] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Pay ${rupees(w.amount)} → ${w.vendorName}`} onClose={onClose}>
      {details ? (
        <dl className="kv" style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 10 }}>
          {details.method === 'UPI' ? (
            <>
              <dt>UPI ID</dt>
              <dd className="mono">{details.upiId}</dd>
            </>
          ) : (
            <>
              <dt>Naam</dt>
              <dd>{details.accountHolder}</dd>
              <dt>Account no.</dt>
              <dd className="mono">{details.accountNumber}</dd>
              <dt>IFSC</dt>
              <dd className="mono">{details.ifsc}</dd>
            </>
          )}
        </dl>
      ) : (
        <button
          className="btn ghost"
          onClick={async () => {
            try {
              setDetails(await api(`/admin/withdrawals/${w.id}/payout-details`));
            } catch (e) {
              setErr(errMsg(e));
            }
          }}
        >
          Poora account number dikhayein (audit log mein darj hoga)
        </button>
      )}
      <div className="field">
        <label htmlFor="ref">Bank UTR / UPI reference (paisa bhejne ke baad)</label>
        <input id="ref" className="input mono" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} />
      </div>
      {err ? <div className="error">{err}</div> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn good"
          disabled={busy || ref.trim().length < 4}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await api(`/admin/withdrawals/${w.id}/mark-paid`, { method: 'POST', body: { reference: ref.trim() } });
              onDone();
              onClose();
            } catch (e) {
              setErr(errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Paid mark karein
        </button>
      </div>
    </Modal>
  );
}
