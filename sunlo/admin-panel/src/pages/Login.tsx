import { useState } from 'react';
import { api, auth, errMsg } from '@/lib/api';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ accessToken: string; refreshToken: string }>('/auth/admin/login', { method: 'POST', body: { email, password } });
      auth.set(r.accessToken, r.refreshToken);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand" style={{ color: 'var(--text)', padding: 0 }}>
          <span className="brand-dot" style={{ color: '#fff' }}>
            S
          </span>
          Sunlo Admin
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err ? <div className="error">{err}</div> : null}
        <button className="btn" disabled={busy} type="submit">
          {busy ? 'Login ho raha hai…' : 'Login'}
        </button>
        <p className="faint" style={{ margin: 0 }}>
          Admin account sirf server par <span className="mono">npm run create-admin</span> se banta hai.
        </p>
      </form>
    </div>
  );
}
