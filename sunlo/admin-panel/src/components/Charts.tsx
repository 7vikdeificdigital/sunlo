import { useState } from 'react';

/**
 * Halke, ek-series charts (dataviz method ke hisaab se):
 * - ek hi y-axis, saaf round ticks, recessive gridlines
 * - bar: max 24px mota, upar 4px gol kona, baseline se ugta hai
 * - line: 2px; har point par hover tooltip; crosshair
 * - har chart ke saath table view (rang par nirbhar nahi)
 */
interface Pt {
  label: string;
  value: number;
}

const W = 640;
const H = 220;
const PAD = { l: 52, r: 12, t: 12, b: 28 };

function niceMax(v: number, integer = false) {
  if (integer && v < 4) return 4; // poore ank: 0,1,2,3,4 (dohraye hue tick nahi)
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

function Axis({ max, fmt }: { max: number; fmt: (n: number) => string }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line className="gridline" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          <text className="tick" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

const shortDay = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function BarChart({ data, fmt, title }: { data: Pt[]; fmt: (n: number) => string; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const iw = W - PAD.l - PAD.r;
  const band = iw / data.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const base = H - PAD.b;

  return (
    <div className="chart">
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
        <button className="btn ghost sm" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {table ? (
        <DataTable data={data} fmt={fmt} />
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
            <Axis max={max} fmt={fmt} />
            {data.map((d, i) => {
              const cx = PAD.l + band * i + band / 2;
              const top = y(d.value);
              const h = Math.max(0, base - top);
              const r = Math.min(4, h);
              const x0 = cx - bw / 2;
              // Upar gol, baseline par seedha
              const path = h > 0 ? `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${base} Z` : '';
              return (
                <g key={d.label}>
                  {path ? <path d={path} className={`bar ${hover !== null && hover !== i ? 'dim' : ''}`} /> : null}
                  {/* Bada hover area: mark se zyada */}
                  <rect x={PAD.l + band * i} y={PAD.t} width={band} height={H - PAD.t - PAD.b} fill="transparent" onMouseEnter={() => setHover(i)} />
                  {i % 2 === 0 || data.length <= 8 ? (
                    <text className="tick" x={cx} y={H - 8} textAnchor="middle">
                      {shortDay(d.label)}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} stroke="var(--border)" />
          </svg>
          {hover !== null ? (
            <div className="tip" style={{ left: `${((PAD.l + band * hover + band / 2) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
              {shortDay(data[hover].label)} · <b>{fmt(data[hover].value)}</b>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function LineChart({ data, fmt, title, integer }: { data: Pt[]; fmt: (n: number) => string; title: string; integer?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0), integer);
  const iw = W - PAD.l - PAD.r;
  const x = (i: number) => PAD.l + (data.length > 1 ? (iw * i) / (data.length - 1) : iw / 2);
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const d = data.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');

  return (
    <div className="chart">
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
        <button className="btn ghost sm" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {table ? (
        <DataTable data={data} fmt={fmt} />
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={title}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              const i = Math.round(((px - PAD.l) / iw) * (data.length - 1));
              setHover(Math.max(0, Math.min(data.length - 1, i)));
            }}
          >
            <Axis max={max} fmt={fmt} />
            <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--border)" />
            {hover !== null ? <line className="cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} /> : null}
            <path d={d} className="line" />
            {hover !== null ? <circle className="dot" cx={x(hover)} cy={y(data[hover].value)} r={5} /> : null}
            {data.map((p, i) =>
              i % 2 === 0 ? (
                <text key={p.label} className="tick" x={x(i)} y={H - 8} textAnchor="middle">
                  {shortDay(p.label)}
                </text>
              ) : null,
            )}
          </svg>
          {hover !== null ? (
            <div className="tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
              {shortDay(data[hover].label)} · <b>{fmt(data[hover].value)}</b>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function DataTable({ data, fmt }: { data: Pt[]; fmt: (n: number) => string }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Din</th>
            <th className="right">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{shortDay(d.label)}</td>
              <td className="right num">{fmt(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
