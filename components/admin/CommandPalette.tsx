"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileText, Package, Search, UserRound } from "lucide-react";
import { billNumber, dateLabel, money } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import type { Sale } from "@/lib/billing/types";

export type PaletteLink = { href: string; label: string; icon: React.ComponentType<{ size?: number }> };
type Item = { key: string; group: string; label: string; detail?: string; icon: React.ComponentType<{ size?: number }>; href: string };
type CustomerRow = { id: string; name: string; phone: string; balance: number };

const clean = (q: string) => q.replace(/[,()%*\\]/g, " ").trim();

/** Ctrl+K: jump to any page, medicine, bill or customer. */
export function CommandPalette({ links, onClose, productHref, medicinesOnly = false }: { links: PaletteLink[]; onClose: () => void; productHref: (name: string) => string; medicinesOnly?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: Item[] }>({ q: "", items: [] });
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const q = clean(query);
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      // "152" or "26-27/0152" looks up a bill number.
      const billNo = q.match(/^(?:\d{2}-\d{2}\/)?(\d{1,6})$/)?.[1];
      const [products, sales, byBill, customers] = await Promise.all([
        db().from("products").select("id, name, packing, composition").eq("active", true).or(`name.ilike.%${q}%,barcode.eq.${q},composition.ilike.%${q}%`).order("name").limit(6),
        db().from("sales_public").select("*").or(`patient_name.ilike.%${q}%,patient_phone.ilike.%${q}%`).order("created_at", { ascending: false }).limit(5),
        billNo
          ? db().from("sales_public").select("*").eq("bill_no", Number(billNo)).order("created_at", { ascending: false }).limit(3)
          : Promise.resolve({ data: [] }),
        db().from("customer_balances").select("id, name, phone, balance").or(`name.ilike.%${q}%,phone.ilike.%${q}%`).order("name").limit(4),
      ]);
      const bills = [...((byBill.data ?? []) as Sale[]), ...((sales.data ?? []) as Sale[])].filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i);
      const items: Item[] = [
        ...((products.data ?? []) as { id: string; name: string; packing: string; composition?: string }[]).map((p) => ({ key: `p${p.id}`, group: "Medicines", label: p.name, detail: [p.packing, p.composition].filter(Boolean).join(" · "), icon: Package, href: productHref(p.name) })),
        ...(medicinesOnly ? [] : bills).slice(0, 6).map((s) => ({ key: `s${s.id}`, group: "Bills", label: `Bill ${billNumber(s.fy, s.bill_no)}`, detail: `${dateLabel(s.bill_date)} · ${s.patient_name || "Walk-in"} · ${money(s.net)}`, icon: FileText, href: `/admin/sales/${s.id}` })),
        ...(medicinesOnly ? [] : (customers.data ?? []) as CustomerRow[]).map((c) => ({ key: `c${c.id}`, group: "Customers", label: c.name, detail: `${c.phone || "no mobile"} · owes ${money(c.balance)}`, icon: UserRound, href: `/admin/customers?q=${encodeURIComponent(c.phone || c.name)}` })),
      ];
      setFound({ q, items });
      setActive(0);
    }, 160);
    return () => clearTimeout(timer);
  }, [query, productHref, medicinesOnly]);

  const q = clean(query).toLowerCase();
  const pages: Item[] = links.filter((l) => !q || l.label.toLowerCase().includes(q)).map((l) => ({ key: l.href, group: "Go to", label: l.label, icon: l.icon, href: l.href }));
  const items = [...pages, ...(found.q === clean(query) ? found.items : [])];
  const go = (item: Item | undefined) => { if (!item) return; onClose(); router.push(item.href); };

  return (
    <div className="adm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adm-palette" role="dialog" aria-modal="true" aria-label="Quick search">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
          <Search size={18} className="text-[var(--ink-muted)]" />
          <input
            ref={inputRef}
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--ink-muted)]"
            placeholder={medicinesOnly ? "Search medicines…" : "Search medicines, bills, customers or pages…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
              else if (e.key === "Escape") onClose();
            }}
            aria-label="Quick search"
          />
          <kbd className="adm-kbd">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]">{q.length >= 2 && found.q !== clean(query) ? "Searching…" : "Nothing found."}</p>}
          {items.map((item, i) => (
            <div key={item.key}>
              {(i === 0 || items[i - 1].group !== item.group) && <p className="px-4 pb-1 pt-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">{item.group}</p>}
              <button type="button" className="adm-palette-item" data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(item)}>
                <item.icon size={17} />
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.detail && <span className="truncate text-xs text-[var(--ink-muted)]">{item.detail}</span>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
