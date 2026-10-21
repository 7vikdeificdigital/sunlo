import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, LineChart } from '@/components/Charts';
import { ErrorBox, Loading, PageHead } from '@/components/ui';
import { api } from '@/lib/api';
import { compact, rupees } from '@/lib/format';

interface Dash {
  users: { total: number; today: number };
  vendors: { approved: number; pending: number; online: number };
  sessions: { active: number; today: number };
  last30: { gross: number; commission: number; minutes: number; recharge: number; gst: number; payments: number };
  pending: { withdrawals: number; withdrawalAmount: number; tickets: number; reports: number; vendorApprovals: number };
  series: { day: string; recharge: number; gross: number; commission: number; sessions: number; newUsers: number }[];
}

export function Dashboard() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dash>('/admin/dashboard'), refetchInterval: 30_000 });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorBox e={q.error} />;
  const d = q.data;
  const todo = [
    { n: d.pending.vendorApprovals, t: 'vendor approval ke intezaar mein', to: '/vendors?status=PENDING' },
    { n: d.pending.withdrawals, t: `withdrawal pending (${rupees(d.pending.withdrawalAmount)})`, to: '/withdrawals' },
    { n: d.pending.reports, t: 'shikayat (report) khuli', to: '/reports' },
    { n: d.pending.tickets, t: 'support ticket khule', to: '/tickets' },
  ].filter((x) => x.n > 0);

  return (
    <>
      <PageHead title="Dashboard" sub="Pichhle 30 din ka hisaab · har 30 sec taaza" />

      {todo.length ? (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--accent)' }}>
          <h3 style={{ marginBottom: 8 }}>Aaj ke kaam</h3>
          <div className="row" style={{ flexWrap: 'wrap', gap: 18 }}>
            {todo.map((x) => (
              <Link key={x.to} to={x.to}>
                <b>{x.n}</b> {x.t} →
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <div className="label">Platform kamai (30 din)</div>
          <div className="value">{rupees(d.last30.commission)}</div>
          <div className="sub">Kul session raqam {rupees(d.last30.gross)}</div>
        </div>
        <div className="card stat">
          <div className="label">Recharge (30 din)</div>
          <div className="value">{rupees(d.last30.recharge)}</div>
          <div className="sub">
            {d.last30.payments} payments · GST {rupees(d.last30.gst)}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Sessions</div>
          <div className="value">{d.sessions.active} live</div>
          <div className="sub">
            Aaj {d.sessions.today} poore · 30 din mein {compact(d.last30.minutes)} min
          </div>
        </div>
        <div className="card stat">
          <div className="label">Log</div>
          <div className="value">{compact(d.users.total)} users</div>
          <div className="sub">
            Aaj +{d.users.today} · {d.vendors.approved} vendors ({d.vendors.online} online)
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-head">
            <h3>Roz ki session raqam (14 din)</h3>
          </div>
          <BarChart title="Roz ki session raqam" data={d.series.map((s) => ({ label: s.day, value: s.gross }))} fmt={(n) => rupees(n)} />
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Naye users (14 din)</h3>
          </div>
          <LineChart integer title="Roz naye users" data={d.series.map((s) => ({ label: s.day, value: s.newUsers }))} fmt={(n) => String(Math.round(n))} />
        </div>
      </div>
    </>
  );
}
