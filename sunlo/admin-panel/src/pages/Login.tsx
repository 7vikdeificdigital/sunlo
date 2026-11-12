import { useState } from 'react';
import { api, ApiError, auth, errMsg } from '@/lib/api';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ accessToken: string; refreshToken: string }>('/auth/admin/login', { method: 'POST', body: { email, password, ...(totp ? { totp } : {}) } });
      auth.set(r.accessToken, r.refreshToken);
    } catch (e2) {
      if (e2 instanceof ApiError && (e2.code === 'TOTP_REQUIRED' || e2.code === 'TOTP_INVALID')) setNeedTotp(true);
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
            B
          </span>
          Bondty Admin
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {needTotp ? (
          <div className="field">
            <label htmlFor="totp">Authenticator code</label>
            <input id="totp" className="input mono" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} autoFocus required />
          </div>
        ) : null}
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
