import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { dt, rupees } from '@/lib/format';

interface Resp {
  items: { id: string; giftName: string; price: number; commissionPct: number; vendorEarning: number; createdAt: string }[];
  total: { count: number; gross: number; vendor: number; commission: number };
}

/** Session detail mein: is session mein user ne kaun kaun se gifts diye */
export function SessionGifts({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['session-gifts', id], queryFn: () => api<Resp>(`/admin/sessions/${id}/gifts`) });
  if (!q.data || q.data.items.length === 0) return null;
  const t = q.data.total;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3>Gifts diye gaye ({t.count})</h3>
        <span className="faint">
          Total {rupees(t.gross)} coins · Vendor ko {rupees(t.vendor)} · Platform {rupees(t.commission)}
        </span>
      </div>
      <table>
        <thead>
          <tr><th>Kab</th><th>Gift</th><th className="right">Coins</th><th className="right">Vendor ko</th><th className="right">Platform</th></tr>
        </thead>
        <tbody>
          {q.data.items.map((g) => (
            <tr key={g.id}>
              <td className="faint">{dt(g.createdAt)}</td>
              <td><b>{g.giftName}</b></td>
              <td className="right num">{rupees(g.price).replace('₹', '')}</td>
              <td className="right num">{rupees(g.vendorEarning)}</td>
              <td className="right num">{rupees(g.price - g.vendorEarning)} <span className="faint">({g.commissionPct}%)</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
