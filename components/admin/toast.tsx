"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; kind: "success" | "error"; title: string; detail?: string; actions?: ToastAction[] };
type ToastApi = { success: (title: string, options?: { detail?: string; actions?: ToastAction[] }) => void; error: (title: string, detail?: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-3), { ...toast, id }]);
    // Toasts with buttons stay longer so there is time to use them.
    setTimeout(() => dismiss(id), toast.actions?.length ? 9000 : 4500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (title, options) => push({ kind: "success", title, ...options }),
    error: (title, detail) => push({ kind: "error", title, detail }),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="adm-toast" data-kind={t.kind}>
            {t.kind === "success" ? <CheckCircle2 className="adm-toast-icon mt-0.5 shrink-0" size={18} /> : <AlertCircle className="adm-toast-icon mt-0.5 shrink-0" size={18} />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.title}</p>
              {t.detail && <p className="mt-0.5 text-[var(--ink-muted)]">{t.detail}</p>}
              {t.actions && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.actions.map((a) => <button key={a.label} className="button button-small button-light" onClick={() => { a.onClick(); dismiss(t.id); }}>{a.label}</button>)}
                </div>
              )}
            </div>
            <button className="text-[var(--ink-muted)] hover:text-[var(--brand-dark)]" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
