"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* Small, dependency-free charts for the owner dashboard.
   Specs (dataviz skill): bars <= 24px with a 4px rounded data-end and a square baseline,
   hairline recessive grid, one direct label (the peak), hover + keyboard tooltips,
   text in text tokens (never the series colour). Colours come from CSS tokens
   validated for both light and dark surfaces. */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round an axis maximum up to 1/2/2.5/5 x 10^n so ticks land on clean numbers. */
function niceStep(max: number, ticks = 4) {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e7) return `${+(v / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${+(v / 1e5).toFixed(1)}L`;
  if (a >= 1e4) return `${+(v / 1e3).toFixed(0)}K`;
  return Math.round(v).toLocaleString("en-IN");
};

/** Column with a rounded data-end (top for positive, bottom for negative) and a square baseline. */
function columnPath(x: number, base: number, w: number, end: number, r = 4) {
  const h = Math.abs(base - end);
  const rr = Math.min(r, w / 2, h);
  if (end <= base) {
    return `M${x},${base}V${end + rr}Q${x},${end} ${x + rr},${end}H${x + w - rr}Q${x + w},${end} ${x + w},${end + rr}V${base}Z`;
  }
  return `M${x},${base}V${end - rr}Q${x},${end} ${x + rr},${end}H${x + w - rr}Q${x + w},${end} ${x + w},${end - rr}V${base}Z`;
}

export type Column = { key: string; label: string; value: number; tip: ReactNode; aria: string };

export function ColumnChart({ data, format, height = 230, peakLabel = true }: { data: Column[]; format: (v: number) => string; height?: number; peakLabel?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const margin = { top: 22, right: 6, bottom: 26, left: 46 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const values = data.map((d) => d.value);
  const maxV = Math.max(0, ...values), minV = Math.min(0, ...values);
  const step = niceStep(Math.max(maxV - minV, 1));
  const top = Math.ceil(maxV / step) * step || step;
  const bottom = Math.floor(minV / step) * step;
  const y = (v: number) => margin.top + ((top - v) / (top - bottom)) * plotH;
  const ticks: number[] = [];
  for (let t = bottom; t <= top + 1e-9; t += step) ticks.push(t);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const every = Math.max(1, Math.ceil((data.length * 44) / Math.max(plotW, 1)));
  const peak = values.length ? values.indexOf(Math.max(...values)) : -1;
  const hasData = values.some((v) => v !== 0);

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Column chart" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-muted)">{compact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = margin.left + band * i + band / 2;
            const base = y(0), end = y(d.value);
            return (
              <g key={d.key} className="adm-col" tabIndex={0} aria-label={d.aria}
                onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
                <rect className="adm-col-hit" x={margin.left + band * i} y={margin.top} width={band} height={plotH} fill="transparent" rx={4} />
                {d.value !== 0 && <path className="adm-col-bar" d={columnPath(cx - barW / 2, base, barW, end)} fill="var(--chart-1)" opacity={active === null || active === i ? 1 : 0.55} />}
                {i % every === 0 && <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">{d.label}</text>}
                {peakLabel && hasData && i === peak && d.value > 0 && <text x={cx} y={end - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--brand-dark)">{format(d.value)}</text>}
              </g>
            );
          })}
          <line x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} stroke="var(--ink-muted)" strokeOpacity={0.5} strokeWidth={1} />
        </svg>
      )}
      {!hasData && width > 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-[var(--ink-muted)]">No sales in this period yet.</p>}
      {active !== null && data[active] && (
        <div className="adm-chart-tip" style={{ left: Math.min(Math.max(margin.left + band * active + band / 2, 80), width - 80), top: Math.min(y(Math.max(data[active].value, 0)), y(0)) }}>
          {data[active].tip}
        </div>
      )}
    </div>
  );
}

export type Segment = { key: string; label: string; value: number; color: string };

/** One whole split into parts (payment modes). The legend carries name, amount and share, so colour is never the only cue. */
export function SegmentBar({ segments, format }: { segments: Segment[]; format: (v: number) => string }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const [active, setActive] = useState<string | null>(null);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
  return (
    <div>
      <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={segments.map((s) => `${s.label} ${format(s.value)}`).join(", ")}>
        {total === 0 ? <div className="h-full w-full rounded bg-[var(--chart-grid)]" /> : segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.key} className="h-full transition-opacity first:rounded-l last:rounded-r" title={`${s.label}: ${format(s.value)} (${pct(s.value)}%)`}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: active && active !== s.key ? 0.45 : 1 }}
            onPointerEnter={() => setActive(s.key)} onPointerLeave={() => setActive(null)} />
        ))}
      </div>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm" onPointerEnter={() => setActive(s.key)} onPointerLeave={() => setActive(null)}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            <span className="text-[var(--ink-muted)]">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{format(s.value)}</span>
            <span className="w-12 text-right text-xs tabular-nums text-[var(--ink-muted)]">{pct(s.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type BarRow = { key: string; label: string; sub?: string; value: number; valueLabel: string; tip: string };

/** Ranked horizontal bars (top medicines). Value sits at the bar tip; the row itself is the hover target. */
export function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.key} className="group" title={r.tip}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.label} {r.sub && <span className="text-xs font-normal text-[var(--ink-muted)]">{r.sub}</span>}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2.5 rounded-r transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(2, (r.value / max) * 82)}%`, background: "var(--chart-1)" }} />
            <span className="shrink-0 text-xs font-semibold tabular-nums">{r.valueLabel}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
