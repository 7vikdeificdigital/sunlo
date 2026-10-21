/** Server se raqam PAISE mein aati hai */
export const rupees = (paise: number, opts: { decimals?: boolean } = {}) => {
  const r = paise / 100;
  const decimals = opts.decimals ?? !Number.isInteger(r);
  return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 })}`;
};

export const perMin = (paise: number) => `${rupees(paise)}/min`;

export const compact = (n: number) =>
  n >= 100000 ? `${(n / 100000).toFixed(1).replace(/\.0$/, '')}L` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);

export const initials = (name?: string | null) =>
  (name ?? '?')
    .replace(/^(Dr|Adv|CA|Mr|Mrs|Ms)\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const formatTime = (iso: string | Date) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const durationText = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min ${s ? `${s} sec` : ''}`.trim() : `${s} sec`;
};
