import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ApiError, auth } from '@/lib/api';
import { Dashboard } from '@/pages/Dashboard';
import { Gifts } from '@/pages/Gifts';
import { Login } from '@/pages/Login';
import { Payments, SessionDetail, Sessions, Withdrawals } from '@/pages/Money';
import { Reports, Reviews, TicketDetail, Tickets } from '@/pages/Safety';
import { Audit, Catalog, Settings } from '@/pages/Setup';
import { UserDetail, Users } from '@/pages/Users';
import { VendorDetail, Vendors } from '@/pages/Vendors';
import './styles.css';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2 } },
});

function App() {
  const loggedIn = useSyncExternalStore(auth.subscribe, auth.isLoggedIn);
  if (!loggedIn) {
    qc.clear();
    return <Login />;
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="vendors/:id" element={<VendorDetail />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="sessions/:id" element={<SessionDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="withdrawals" element={<Withdrawals />} />
        <Route path="reports" element={<Reports />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="gifts" element={<Gifts />} />
        <Route path="settings" element={<Settings />} />
        <Route path="audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
