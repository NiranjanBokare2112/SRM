"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { firstOfMonth, istToday, lastOfMonth } from "@/lib/billing/format";

/* Themed replacements for <select> and <input type="date">.
   Popovers use fixed positioning so they are never clipped by scrolling tables or dialogs. */

function usePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; above: boolean }>({ top: 0, left: 0, width: 0, above: false });

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popH = popRef.current?.offsetHeight ?? 320;
    const popW = popRef.current?.offsetWidth ?? 280;
    const above = r.bottom + popH + 8 > window.innerHeight && r.top - popH - 8 > 0;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - popW - 8));
    setPos({ top: above ? r.top - popH - 6 : r.bottom + 6, left, width: r.width, above });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Measure again once the popover has its real size.
    const frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return { open, setOpen, triggerRef, popRef, pos };
}

export type Option<T extends string | number> = { value: T; label: string; hint?: string };

export function Select<T extends string | number>({ value, onChange, options, placeholder = "Choose…", searchable = false, small = false, className = "", ariaLabel, id }: {
  value: T | ""; onChange: (value: T) => void; options: Option<T>[]; placeholder?: string; searchable?: boolean; small?: boolean; className?: string; ariaLabel?: string; id?: string;
}) {
  const { open, setOpen, triggerRef, popRef, pos } = usePopover();
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const shown = searchable && filter ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase())) : options;

  const openList = () => {
    setFilter("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (o: Option<T>) => { onChange(o.value); setOpen(false); triggerRef.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); openList(); return; }
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (e.key === "Tab") setOpen(false);
  };

  useEffect(() => {
    if (open) popRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, popRef]);

  return (
    <>
      <button ref={triggerRef} id={id} type="button" className={`adm-input adm-select ${small ? "adm-input-sm" : ""} ${className}`} onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKey}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-label={ariaLabel}>
        <span className={`min-w-0 flex-1 truncate text-left ${selected ? "" : "text-[var(--ink-muted)]"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--ink-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div ref={popRef} className="adm-popover" style={{ top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 180) }}>
          {searchable && (
            <input autoFocus className="adm-input adm-input-sm mb-1" placeholder="Type to search…" value={filter} onKeyDown={onKey}
              onChange={(e) => { setFilter(e.target.value); setActive(0); }} aria-label="Search options" />
          )}
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto">
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-[var(--ink-muted)]">Nothing matches</li>}
            {shown.map((o, i) => (
              <li key={String(o.value)} data-index={i} role="option" aria-selected={o.value === value}
                className="adm-option" data-active={i === active} onPointerEnter={() => setActive(i)} onClick={() => choose(o)}>
                <span className="w-4 shrink-0">{o.value === value && <Check size={16} strokeWidth={2.5} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-[var(--ink-muted)]">{o.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/* ---------------- dates ---------------- */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const prettyDate = (value: string) => { if (!value) return ""; const [y, m, d] = value.split("-").map(Number); return `${d} ${SHORT[m - 1]} ${y}`; };
const prettyRange = (from: string, to: string) => {
  if (from === to) return prettyDate(from);
  const [fy, fm] = from.split("-").map(Number); const [ty, tm] = to.split("-").map(Number);
  const [, , fd] = from.split("-").map(Number);
  if (fy === ty && fm === tm) return `${fd} – ${prettyDate(to)}`;
  if (fy === ty) return `${fd} ${SHORT[fm - 1]} – ${prettyDate(to)}`;
  return `${prettyDate(from)} – ${prettyDate(to)}`;
};

function Calendar({ month, onMonth, isSelected, inRange, onPick, min, max }: {
  month: { y: number; m: number }; onMonth: (m: { y: number; m: number }) => void;
  isSelected: (d: string) => boolean; inRange?: (d: string) => boolean; onPick: (d: string) => void; min?: string; max?: string;
}) {
  const first = new Date(Date.UTC(month.y, month.m, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const today = istToday();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => iso(month.y, month.m, i + 1))];
  const step = (n: number) => { const d = new Date(Date.UTC(month.y, month.m + n, 1)); onMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() }); };
  const next = new Date(Date.UTC(month.y, month.m + 1, 1));
  const canNext = !max || iso(next.getUTCFullYear(), next.getUTCMonth(), 1) <= max;

  return (
    <div className="w-[16.5rem]">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="adm-cal-nav" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold">{MONTHS[month.m]} {month.y}</span>
        <button type="button" className="adm-cal-nav" onClick={() => step(1)} disabled={!canNext} aria-label="Next month"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[0.68rem] font-semibold uppercase text-[var(--ink-muted)]">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5" role="grid">
        {cells.map((d, i) => d === null ? <span key={`x${i}`} /> : (
          <button key={d} type="button" className="adm-cal-day" disabled={(min && d < min) || (max && d > max) || false}
            data-selected={isSelected(d)} data-range={inRange?.(d) ?? false} data-today={d === today} onClick={() => onPick(d)} aria-label={prettyDate(d)} aria-pressed={isSelected(d)}>
            {Number(d.slice(8))}
          </button>
        ))}
      </div>
    </div>
  );
}

const monthOf = (value: string) => { const [y, m] = (value || istToday()).split("-").map(Number); return { y, m: m - 1 }; };

export function DateField({ value, onChange, min, max, ariaLabel, id }: { value: string; onChange: (v: string) => void; min?: string; max?: string; ariaLabel?: string; id?: string }) {
  const { open, setOpen, triggerRef, popRef, pos } = usePopover();
  const [month, setMonth] = useState(monthOf(value));
  const today = istToday();
  const todayAllowed = (!min || today >= min) && (!max || today <= max);
  return (
    <>
      <button ref={triggerRef} id={id} type="button" className="adm-input adm-select" onClick={() => { setMonth(monthOf(value)); setOpen(!open); }} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel}>
        <CalendarDays size={16} className="shrink-0 text-[var(--ink-muted)]" />
        <span className="flex-1 text-left">{prettyDate(value) || "Choose date"}</span>
        <ChevronDown size={16} className="shrink-0 text-[var(--ink-muted)]" />
      </button>
      {open && (
        <div ref={popRef} className="adm-popover p-3" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Choose date">
          <Calendar month={month} onMonth={setMonth} min={min} max={max} isSelected={(d) => d === value} onPick={(d) => { onChange(d); setOpen(false); triggerRef.current?.focus(); }} />
          {todayAllowed && (
            <div className="mt-2 flex justify-end border-t border-[var(--line)] pt-2">
              <button type="button" className="text-xs font-semibold text-[var(--brand-blue-strong)]" onClick={() => { onChange(today); setOpen(false); }}>Today</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export type RangePreset = { key: string; label: string; range: () => [string, string] };
export const defaultPresets: RangePreset[] = [
  { key: "today", label: "Today", range: () => [istToday(), istToday()] },
  { key: "yesterday", label: "Yesterday", range: () => [istToday(-1), istToday(-1)] },
  { key: "7d", label: "Last 7 days", range: () => [istToday(-6), istToday()] },
  { key: "30d", label: "Last 30 days", range: () => [istToday(-29), istToday()] },
  { key: "month", label: "This month", range: () => [firstOfMonth(), istToday()] },
  { key: "lastmonth", label: "Last month", range: () => [firstOfMonth(1), lastOfMonth(1)] },
];

/** Date range with presets as rows (the common case) and a calendar for a custom range. */
export function DateRangeField({ from, to, onChange, presets = defaultPresets, label }: { from: string; to: string; onChange: (from: string, to: string) => void; presets?: RangePreset[]; label?: ReactNode }) {
  const { open, setOpen, triggerRef, popRef, pos } = usePopover();
  const [month, setMonth] = useState(monthOf(to));
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const max = istToday();
  const current = presets.find((p) => { const [f, t] = p.range(); return f === from && t === to; });

  const pick = (d: string) => {
    if (!pending) { setPending(d); return; }
    const [a, b] = d < pending ? [d, pending] : [pending, d];
    setPending(null); onChange(a, b); setOpen(false);
  };
  const lo = pending ? (hover && hover < pending ? hover : pending) : from;
  const hi = pending ? (hover && hover > pending ? hover : pending) : to;

  return (
    <div>
      {label && <span className="adm-label">{label}</span>}
      <button ref={triggerRef} type="button" className="adm-input adm-select min-w-[15rem]" onClick={() => { setMonth(monthOf(to)); setPending(null); setOpen(!open); }} aria-haspopup="dialog" aria-expanded={open}>
        <CalendarDays size={16} className="shrink-0 text-[var(--ink-muted)]" />
        <span className="flex-1 truncate text-left">{current ? <><b className="font-semibold">{current.label}</b> <span className="text-[var(--ink-muted)]">· {prettyRange(from, to)}</span></> : prettyRange(from, to)}</span>
        <ChevronDown size={16} className="shrink-0 text-[var(--ink-muted)]" />
      </button>
      {open && (
        <div ref={popRef} className="adm-popover flex flex-col gap-3 p-3 sm:flex-row" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Choose date range">
          <ul className="min-w-[10rem] sm:border-r sm:border-[var(--line)] sm:pr-3">
            {presets.map((p) => {
              const isOn = current?.key === p.key;
              return (
                <li key={p.key}>
                  <button type="button" className="adm-option w-full" data-active={false} onClick={() => { const [f, t] = p.range(); onChange(f, t); setOpen(false); }}>
                    <span className="w-4 shrink-0">{isOn && <Check size={16} strokeWidth={2.5} />}</span>
                    <span className={isOn ? "font-semibold" : ""}>{p.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div onPointerLeave={() => setHover(null)}>
            <Calendar month={month} onMonth={setMonth} max={max}
              isSelected={(d) => d === lo || d === hi}
              inRange={(d) => d > lo && d < hi}
              onPick={pick} />
            <p className="mt-2 border-t border-[var(--line)] pt-2 text-xs text-[var(--ink-muted)]">{pending ? `From ${prettyDate(pending)} — now pick the end date` : "Custom range: pick a start and an end date"}</p>
            {/* hover preview while choosing the end date */}
            {pending && <HoverTracker onHover={setHover} popRef={popRef} />}
          </div>
        </div>
      )}
    </div>
  );
}

function HoverTracker({ onHover, popRef }: { onHover: (d: string | null) => void; popRef: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const el = popRef.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".adm-cal-day");
      const label = btn?.getAttribute("aria-label");
      if (!label) return;
      const [d, mon, y] = label.split(" ");
      onHover(iso(Number(y), SHORT.indexOf(mon), Number(d)));
    };
    el.addEventListener("pointerover", move);
    return () => el.removeEventListener("pointerover", move);
  }, [onHover, popRef]);
  return null;
}
