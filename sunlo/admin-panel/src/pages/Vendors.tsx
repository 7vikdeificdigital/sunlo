import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Avatar, Empty, ErrorBox, Loading, PageHead, Pager, ReasonDialog, Status, Tabs } from '@/components/ui';
import { api } from '@/lib/api';
import { d, dt, mins, rupees } from '@/lib/format';

type VStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'DRAFT';
interface VRow {
  id: string;
  displayName: string;
  headline: string;
  avatarUrl: string | null;
  status: VStatus;
  isOnline: boolean;
  ratingAvg: number;
  ratingCount: number;
  totalMinutes: number;
  submittedAt: string | null;
  createdAt: string;
  phone: string;
}

export function Vendors() {
  const [sp, setSp] = useSearchParams();
  const status = (sp.get('status') as VStatus | null) ?? 'PENDING';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ['vendors', status, search, page],
    queryFn: () => api<{ items: VRow[]; total: number }>('/admin/vendors', { query: { status, search: search || undefined, page, limit: 20 } }),
  });
  useEffect(() => setPage(1), [status, search]);

  return (
    <>
      <PageHead title="Vendors" sub="Listeners aur experts: approval, suspend, profile jaanch" />
      <div className="filters">
        <Tabs
          value={status}
          onChange={(v) => setSp({ status: v })}
          options={[
            { v: 'PENDING', l: 'Review baaki' },
            { v: 'APPROVED', l: 'Approved' },
            { v: 'REJECTED', l: 'Rejected' },
            { v: 'SUSPENDED', l: 'Suspended' },
            { v: 'DRAFT', l: 'Adhoori' },
          ]}
        />
        <input className="input" placeholder="Naam ya phone khojein" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Khojein" />
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox e={q.error} />
      ) : !q.data?.items.length ? (
        <Empty text="Is list mein koi vendor nahi" />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th className="right">Rating</th>
                  <th className="right">Minutes</th>
                  <th>{status === 'PENDING' ? 'Bheja' : 'Joda'}</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((v) => (
                  <tr key={v.id} className="click" onClick={() => nav(`/vendors/${v.id}`)}>
                    <td>
                      <div className="row">
                        <Avatar name={v.displayName || 'V'} src={v.avatarUrl} />
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {v.displayName || '(naam nahi)'} {v.isOnline ? <span className="badge b-good">Online</span> : null}
                          </div>
                          <div className="faint">{v.headline}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{v.phone}</td>
                    <td>
                      <Status s={v.status} />
                    </td>
                    <td className="right num">{v.ratingCount ? `${v.ratingAvg.toFixed(1)} (${v.ratingCount})` : '—'}</td>
                    <td className="right num">{v.totalMinutes}</td>
                    <td>{d(status === 'PENDING' ? v.submittedAt : v.createdAt)}</td>
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

interface VDetail {
  id: string;
  userId: string;
  status: VStatus;
  displayName: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  gender: string | null;
  experienceYears: number;
  languages: string[];
  tags: string[];
  chatRatePerMin: number;
  callRatePerMin: number;
  videoRatePerMin: number;
  chatEnabled: boolean;
  callEnabled: boolean;
  videoEnabled: boolean;
  isOnline: boolean;
  kycDocType: string | null;
  kycUploadId: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  totalMinutes: number;
  totalSessions: number;
  phone: string;
  userStatus: string;
  categories: { id: string; name: string }[];
  walletBalance: number;
  payout: { method: string; upiId: string | null; accountHolder: string | null; accountLast4: string | null; ifsc: string | null } | null;
  recentSessions: { id: string; type: string; status: string; chargedAmount: number; billedSeconds: number; requestedAt: string }[];
}

export function VendorDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['vendor', id], queryFn: () => api<VDetail>(`/admin/vendors/${id}`) });
  const [dialog, setDialog] = useState<'reject' | 'suspend' | null>(null);
  const [kycUrl, setKycUrl] = useState<{ url: string; pdf: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(
    () => () => {
      if (kycUrl) URL.revokeObjectURL(kycUrl.url);
    },
    [kycUrl],
  );

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox e={q.error} />;
  const v = q.data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['vendor', id] });
    qc.invalidateQueries({ queryKey: ['vendors'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  async function act(path: string) {
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/vendors/${id}/${path}`, { method: 'POST' });
      refresh();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  async function viewKyc() {
    setErr(null);
    try {
      // KYC sirf admin token ke saath milta hai (aur server audit log banata hai)
      const blob = await api<Blob>(`/admin/uploads/${v.kycUploadId}`, { raw: true });
      setKycUrl({ url: URL.createObjectURL(blob), pdf: blob.type === 'application/pdf' });
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <PageHead title={v.displayName || 'Vendor'} sub={v.headline}>
        <Link to="/vendors" className="btn ghost">
          ← Vendors
        </Link>
        {v.status === 'PENDING' ? (
          <>
            <button className="btn danger" disabled={busy} onClick={() => setDialog('reject')}>
              Reject
            </button>
            <button className="btn good" disabled={busy} onClick={() => act('approve')}>
              Approve
            </button>
          </>
        ) : null}
        {v.status === 'APPROVED' ? (
          <button className="btn danger" disabled={busy} onClick={() => setDialog('suspend')}>
            Suspend
          </button>
        ) : null}
        {v.status === 'SUSPENDED' ? (
          <button className="btn" disabled={busy} onClick={() => act('reinstate')}>
            Phir se chalu karein
          </button>
        ) : null}
      </PageHead>
      {err ? <ErrorBox e={err} /> : null}

      <div className="grid g2" style={{ alignItems: 'start', marginTop: 12 }}>
        <div className="stack">
          <div className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              <span style={{ transform: 'scale(1.6)', margin: '0 14px 0 8px' }}>
                <Avatar name={v.displayName || 'V'} src={v.avatarUrl} />
              </span>
              <div>
                <Status s={v.status} /> {v.isOnline ? <span className="badge b-good">Online</span> : null}
                <div className="faint" style={{ marginTop: 4 }}>
                  Bheja: {dt(v.submittedAt)} {v.approvedAt ? `· Approved: ${d(v.approvedAt)}` : ''}
                </div>
              </div>
            </div>
            {v.rejectionReason ? <div className="notice" style={{ marginBottom: 12 }}>Pichhla sandesh: {v.rejectionReason}</div> : null}
            <dl className="kv">
              <dt>Phone</dt>
              <dd className="mono">{v.phone}</dd>
              <dt>Gender / Anubhav</dt>
              <dd>
                {v.gender ?? '—'} · {v.experienceYears} saal
              </dd>
              <dt>Categories</dt>
              <dd>{v.categories.map((c) => c.name).join(', ') || '—'}</dd>
              <dt>Bhashayein</dt>
              <dd>{v.languages.join(', ') || '—'}</dd>
              <dt>Skills</dt>
              <dd>{v.tags.join(', ') || '—'}</dd>
              <dt>Rate (per min)</dt>
              <dd>
                Chat {rupees(v.chatRatePerMin)}
                {v.chatEnabled ? '' : ' (band)'} · Call {rupees(v.callRatePerMin)}
                {v.callEnabled ? '' : ' (band)'} · Video {rupees(v.videoRatePerMin)}
                {v.videoEnabled ? '' : ' (band)'}
              </dd>
              <dt>Parichay</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{v.bio || '—'}</dd>
            </dl>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>ID verification</h3>
              {v.kycUploadId ? (
                <button className="btn ghost sm" onClick={viewKyc}>
                  Document dekhein
                </button>
              ) : null}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {v.kycDocType ? `Type: ${v.kycDocType}` : 'Document nahi diya'}
            </p>
            <p className="faint">Document dekhna audit log mein darj hota hai.</p>
            {kycUrl ? (
              kycUrl.pdf ? (
                <iframe title="KYC" src={kycUrl.url} style={{ width: '100%', height: 360, border: '1px solid var(--border)', borderRadius: 10 }} />
              ) : (
                <img src={kycUrl.url} alt="ID document" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
              )
            ) : null}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Kamai & payout</h3>
            <dl className="kv">
              <dt>Wallet balance</dt>
              <dd className="num">{rupees(v.walletBalance)}</dd>
              <dt>Rating</dt>
              <dd>{v.ratingCount ? `${v.ratingAvg.toFixed(1)} (${v.ratingCount} reviews)` : '—'}</dd>
              <dt>Sessions / Minutes</dt>
              <dd className="num">
                {v.totalSessions} / {v.totalMinutes}
              </dd>
              <dt>Payout</dt>
              <dd>{v.payout ? (v.payout.method === 'UPI' ? `UPI: ${v.payout.upiId}` : `${v.payout.accountHolder} · A/c ••••${v.payout.accountLast4} · ${v.payout.ifsc}`) : 'Nahi joda'}</dd>
            </dl>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>Haal ke sessions</h3>
              <Link to={`/sessions?vendorId=${v.id}`}>Sab →</Link>
            </div>
            {v.recentSessions.length ? (
              <table>
                <tbody>
                  {v.recentSessions.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link to={`/sessions/${s.id}`}>{s.type}</Link>
                      </td>
                      <td>
                        <Status s={s.status} />
                      </td>
                      <td className="num">{mins(s.billedSeconds)}</td>
                      <td className="right num">{rupees(s.chargedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="faint">Abhi koi session nahi</p>
            )}
          </div>
        </div>
      </div>

      {dialog === 'reject' ? (
        <ReasonDialog
          title="Profile reject karein"
          label="Vendor ko kya badalna hai? (unhe yahi sandesh dikhega)"
          confirm="Reject karein"
          danger
          onClose={() => setDialog(null)}
          onSubmit={async (reason) => {
            await api(`/admin/vendors/${id}/reject`, { method: 'POST', body: { reason } });
            refresh();
          }}
        />
      ) : null}
      {dialog === 'suspend' ? (
        <ReasonDialog
          title="Vendor suspend karein"
          label="Wajah (vendor ko dikhegi, audit log mein darj hogi)"
          confirm="Suspend karein"
          danger
          onClose={() => setDialog(null)}
          onSubmit={async (reason) => {
            await api(`/admin/vendors/${id}/suspend`, { method: 'POST', body: { reason } });
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
