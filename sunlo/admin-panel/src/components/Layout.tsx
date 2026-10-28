import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api, auth } from '@/lib/api';

interface Dash {
  pending: { withdrawals: number; tickets: number; reports: number; vendorApprovals: number };
}

const NAV: { group: string; items: { to: string; label: string; count?: keyof Dash['pending'] }[] }[] = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard' }] },
  {
    group: 'Log',
    items: [
      { to: '/vendors', label: 'Vendors', count: 'vendorApprovals' },
      { to: '/users', label: 'Users' },
    ],
  },
  {
    group: 'Kaam-kaaj',
    items: [
      { to: '/sessions', label: 'Sessions' },
      { to: '/payments', label: 'Payments' },
      { to: '/withdrawals', label: 'Withdrawals', count: 'withdrawals' },
    ],
  },
  {
    group: 'Suraksha & support',
    items: [
      { to: '/reports', label: 'Reports', count: 'reports' },
      { to: '/tickets', label: 'Support tickets', count: 'tickets' },
      { to: '/reviews', label: 'Reviews' },
    ],
  },
  {
    group: 'Setup',
    items: [
      { to: '/catalog', label: 'Categories & packs' },
      { to: '/gifts', label: 'Gifts' },
      { to: '/settings', label: 'Settings' },
      { to: '/audit', label: 'Audit log' },
    ],
  },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dash>('/admin/dashboard'), refetchInterval: 60_000 });
  const me = useQuery({ queryKey: ['admin-me'], queryFn: () => api<{ email: string }>('/admin/me') });

  return (
    <div className="shell">
      <div className="topbar">
        <button className="btn ghost sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => setOpen(!open)} aria-label="Menu">
          ☰
        </button>
        <b>Bondty Admin</b>
      </div>
      <aside className={`side ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand">
          <span className="brand-dot">B</span> Bondty Admin
        </div>
        <nav className="nav" aria-label="Admin menu">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map((it) => {
                const n = it.count ? dash.data?.pending[it.count] : 0;
                return (
                  <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => (isActive || (it.to !== '/' && loc.pathname.startsWith(it.to)) ? 'active' : '')}>
                    <span>{it.label}</span>
                    {n ? <span className="count">{n}</span> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '16px 10px 4px', fontSize: 12.5 }}>
          <div style={{ color: '#8fb5af', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.data?.email}</div>
          <button
            className="btn ghost sm"
            style={{ marginTop: 8, color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}
            onClick={async () => {
              await api('/auth/logout', { method: 'POST', body: { refreshToken: auth.refreshToken() } }).catch(() => undefined);
              auth.clear();
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
