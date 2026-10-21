import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, Empty, ErrorBox, Loading, Modal, PageHead, Pager, ReasonDialog, Status, Tabs } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import { d, dt, rupees } from '@/lib/format';

interface URow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: string;
  balance: number | null;
}

export function Users() {
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'BLOCKED'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['users', status, search, page],
    queryFn: () => api<{ items: URow[]; total: number }>('/admin/users', { query: { status: status === 'ALL' ? undefined : status, search: search || undefined, page, limit: 20 } }),
  });
  useEffect(() => setPage(1), [status, search]);
  return (
    <>
      <PageHead title="Users" sub={q.data ? `${q.data.total} users` : undefined} />
      <div className="filters">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { v: 'ALL', l: 'Sab' },
            { v: 'ACTIVE', l: 'Active' },
            { v: 'BLOCKED', l: 'Blocked' },
          ]}
        />
        <input className="input" placeholder="Naam, phone ya email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Khojein" />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Koi user nahi mila" />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th className="right">Wallet</th>
                  <th>Joda</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((u) => (
                  <tr key={u.id} className="click" onClick={() => nav(`/users/${u.id}`)}>
                    <td>
                      <div className="row">
                        <Avatar name={u.name ?? 'U'} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name ?? '(naam nahi)'}</div>
                          <div className="faint">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{u.phone}</td>
                    <td>
                      <Status s={u.status} />
                    </td>
                    <td className="right num">{rupees(u.balance)}</td>
                    <td>{d(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={setPage} hasMore={page * 20 < q.data.total} />
        </>
      )}
    </>
  );
}

interface UDetail {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: string;
  referralCode: string;
  walletBalance: number;
  transactions: { id: string; type: string; amount: number; balanceAfter: number; note: string | null; createdAt: string }[];
  sessions: { id: string; type: string; status: string; chargedAmount: number; requestedAt: string; vendorName: string }[];
}

export function UserDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api<UDetail>(`/admin/users/${id}`) });
  const [dialog, setDialog] = useState<'block' | 'adjust' | null>(null);
  const [err, setErr] = useState<unknown>(null);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox e={q.error} />;
  const u = q.data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['user', id] });
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  return (
    <>
      <PageHead title={u.name ?? 'User'} sub={`${u.phone ?? ''} · joda ${d(u.createdAt)}`}>
        <Link to="/users" className="btn ghost">
          ← Users
        </Link>
        <button className="btn ghost" onClick={() => setDialog('adjust')}>
          Wallet adjust
        </button>
        {u.status === 'ACTIVE' ? (
          <button className="btn danger" onClick={() => setDialog('block')}>
            Block
          </button>
        ) : (
          <button
            className="btn"
            onClick={async () => {
              try {
                await api(`/admin/users/${id}/unblock`, { method: 'POST' });
                refresh();
              } catch (e) {
                setErr(e);
              }
            }}
          >
            Unblock
          </button>
        )}
      </PageHead>
      {err ? <ErrorBox e={err} /> : null}
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="label">Wallet</div>
          <div className="value">{rupees(u.walletBalance)}</div>
        </div>
        <div className="card stat">
          <div className="label">Status</div>
          <div className="value" style={{ fontSize: 18, marginTop: 8 }}>
            <Status s={u.status} />
          </div>
        </div>
        <div className="card stat">
          <div className="label">Referral code</div>
          <div className="value mono" style={{ fontSize: 18, marginTop: 6 }}>
            {u.referralCode}
          </div>
        </div>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Sessions</h3>
          {u.sessions.length ? (
            <table>
              <tbody>
                {u.sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/sessions/${s.id}`}>{s.vendorName}</Link>
                      <div className="faint">
                        {s.type} · {dt(s.requestedAt)}
                      </div>
                    </td>
                    <td>
                      <Status s={s.status} />
                    </td>
                    <td className="right num">{rupees(s.chargedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="faint">Koi session nahi</p>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Wallet hisaab</h3>
          {u.transactions.length ? (
            <table>
              <tbody>
                {u.transactions.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.type}
                      <div className="faint">
                        {t.note} · {dt(t.createdAt)}
                      </div>
                    </td>
                    <td className="right num" style={{ color: t.amount > 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {t.amount > 0 ? '+' : '−'}
                      {rupees(Math.abs(t.amount))}
                    </td>
                    <td className="right num faint">{rupees(t.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="faint">Koi entry nahi</p>
          )}
        </div>
      </div>

      {dialog === 'block' ? (
        <ReasonDialog
          title="User block karein"
          label="Wajah (audit log mein darj hogi). User turant logout ho jayega."
          confirm="Block karein"
          danger
          min={3}
          onClose={() => setDialog(null)}
          onSubmit={async (reason) => {
            await api(`/admin/users/${id}/block`, { method: 'POST', body: { reason } });
            refresh();
          }}
        />
      ) : null}
      {dialog === 'adjust' ? <AdjustDialog userId={id!} onClose={() => setDialog(null)} onDone={refresh} /> : null}
    </>
  );
}

function AdjustDialog({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<'credit' | 'debit'>('credit');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Wallet adjust" onClose={onClose}>
      <Tabs
        value={kind}
        onChange={setKind}
        options={[
          { v: 'credit', l: 'Paise jodein' },
          { v: 'debit', l: 'Paise kaatein' },
        ]}
      />
      <div className="field">
        <label htmlFor="amt">Raqam (₹)</label>
        <input id="amt" className="input" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} />
      </div>
      <div className="field">
        <label htmlFor="note">Wajah (user ko dikhegi)</label>
        <textarea id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </div>
      {err ? <div className="error">{err}</div> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn"
          disabled={busy || !(Number(amt) > 0) || note.trim().length < 5}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const paise = Math.round(Number(amt) * 100) * (kind === 'debit' ? -1 : 1);
              await api(`/admin/users/${userId}/wallet-adjust`, { method: 'POST', body: { amount: paise, note: note.trim() } });
              onDone();
              onClose();
            } catch (e) {
              setErr(errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Lagu karein
        </button>
      </div>
    </Modal>
  );
}
