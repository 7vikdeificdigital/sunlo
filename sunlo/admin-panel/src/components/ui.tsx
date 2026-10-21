import { useState, type ReactNode } from 'react';
import { errMsg, fileUrl } from '@/lib/api';
import { initials } from '@/lib/format';

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="muted">{sub}</p> : null}
      </div>
      {children ? <div className="row">{children}</div> : null}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: 'b-good',
  ACTIVE: 'b-good',
  COMPLETED: 'b-good',
  PAID: 'b-good',
  RESOLVED: 'b-good',
  OPEN: 'b-warn',
  PENDING: 'b-warn',
  REQUESTED: 'b-warn',
  CREATED: 'b-mute',
  DRAFT: 'b-mute',
  CLOSED: 'b-mute',
  CANCELLED: 'b-mute',
  MISSED: 'b-mute',
  REJECTED: 'b-bad',
  SUSPENDED: 'b-bad',
  BLOCKED: 'b-bad',
  FAILED: 'b-bad',
};
const STATUS_HI: Record<string, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  DRAFT: 'Adhoori profile',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  ACTIVE: 'Active',
  BLOCKED: 'Blocked',
  COMPLETED: 'Poora',
  REQUESTED: 'Request',
  CANCELLED: 'Cancel',
  MISSED: 'Miss',
  PAID: 'Paid',
  CREATED: 'Shuru',
  FAILED: 'Fail',
  OPEN: 'Khula',
  CLOSED: 'Band',
  RESOLVED: 'Resolved',
};

/** Status hamesha rang + likhit naam ke saath (sirf rang par nirbhar nahi) */
export function Status({ s }: { s: string }) {
  return <span className={`badge ${STATUS_TONE[s] ?? 'b-mute'}`}>{STATUS_HI[s] ?? s}</span>;
}

export function Avatar({ name, src }: { name: string; src?: string | null }) {
  const u = fileUrl(src);
  return <span className="avatar">{u ? <img src={u} alt="" /> : initials(name)}</span>;
}

export function ErrorBox({ e }: { e: unknown }) {
  return <div className="error">{errMsg(e)}</div>;
}

export function Loading() {
  return <div className="empty">Load ho raha hai…</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function Pager({ page, setPage, hasMore }: { page: number; setPage: (p: number) => void; hasMore: boolean }) {
  return (
    <div className="pager">
      <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        ← Pichhla
      </button>
      <span className="faint">Page {page}</span>
      <button className="btn ghost sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
        Agla →
      </button>
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Band karein">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Sensitive kaam (reject, refund, block...) ke liye: wajah likhwa kar confirm.
 * Wajah audit log mein jaati hai.
 */
export function ReasonDialog({
  title,
  label,
  confirm,
  danger,
  min = 5,
  extra,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  confirm: string;
  danger?: boolean;
  min?: number;
  extra?: ReactNode;
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  return (
    <Modal title={title} onClose={onClose}>
      {extra}
      <div className="field">
        <label htmlFor="reason">{label}</label>
        <textarea id="reason" className="input" value={v} onChange={(e) => setV(e.target.value)} maxLength={500} autoFocus />
      </div>
      {err ? <ErrorBox e={err} /> : null}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn ${danger ? 'danger' : ''}`}
          disabled={v.trim().length < min || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await onSubmit(v.trim());
              onClose();
            } catch (e) {
              setErr(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Ho raha hai…' : confirm}
        </button>
      </div>
    </Modal>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.v} role="tab" aria-selected={o.v === value} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
