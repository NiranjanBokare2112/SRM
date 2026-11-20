"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--brand-dark)] sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--ink-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="adm-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--ink-muted)]">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "green" | "red" | "amber" }) {
  const color = tone === "green" ? "adm-text-green" : tone === "red" ? "adm-text-red" : tone === "amber" ? "adm-text-amber" : "text-[var(--brand-dark)]";
  return (
    <div className="adm-card adm-card-pad">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-[-0.02em] tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--ink-muted)]">{sub}</p>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-semibold text-[var(--brand-dark)]">{title}</p>
      {children && <div className="mt-2 text-sm text-[var(--ink-muted)]">{children}</div>}
    </div>
  );
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return <p className="px-6 py-10 text-center text-sm text-[var(--ink-muted)]" role="status">{label}</p>;
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="adm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={ref} className={`adm-modal ${wide ? "adm-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" data-close className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Alert({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="adm-error" role="alert">{error}</p>;
  if (success) return <p className="adm-success" role="status">{success}</p>;
  return null;
}
