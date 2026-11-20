"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { billNumber, dateLabel, expiryLabel, money, qtyLabel } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { errorMessage, modeLabel, paymentModes, type PaymentMode, type Sale, type SaleItem } from "@/lib/billing/types";
import { Alert, Empty, Field, PageHeader } from "@/components/admin/ui";
import { Select } from "@/components/admin/controls";
import { useToast } from "@/components/admin/toast";

type ReturnRow = { id: string; fy: string; return_no: number; return_date: string; amount: number; refund_mode: string; sales: { fy: string; bill_no: number; patient_name: string } | null };

export function ReturnsScreen({ initialBillId, embedded = false }: { initialBillId?: string; embedded?: boolean }) {
  const toast = useToast();
  const [billQuery, setBillQuery] = useState("");
  const [matches, setMatches] = useState<Sale[] | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [qty, setQty] = useState<Record<string, { packs: number; loose: number }>>({});
  const [refundMode, setRefundMode] = useState<PaymentMode>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<ReturnRow[]>([]);

  const [recentVersion, setRecentVersion] = useState(0);
  const loadRecent = () => setRecentVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await db().from("sales_returns_public").select("id, fy, return_no, return_date, amount, refund_mode, sale_id").order("created_at", { ascending: false }).limit(15);
      const rows = (data ?? []) as (Omit<ReturnRow, "sales"> & { sale_id: string })[];
      const ids = [...new Set(rows.map((r) => r.sale_id))];
      const bills = ids.length ? ((await db().from("sales_public").select("id, fy, bill_no, patient_name").in("id", ids)).data ?? []) as { id: string; fy: string; bill_no: number; patient_name: string }[] : [];
      if (!cancelled) setRecent(rows.map((r) => ({ ...r, sales: bills.find((b) => b.id === r.sale_id) ?? null })));
    })();
    return () => { cancelled = true; };
  }, [recentVersion]);

  const openBill = useCallback(async (id: string) => {
    const [s, i] = await Promise.all([
      db().from("sales_public").select("*").eq("id", id).maybeSingle(),
      db().from("sale_items_public").select("*").eq("sale_id", id).order("product_name"),
    ]);
    setMatches(null);
    if (!s.data) { setError("Bill not found."); return; }
    const bill = s.data as Sale;
    setError(""); setSale(bill); setItems((i.data ?? []) as SaleItem[]); setQty({});
    setRefundMode(bill.payment_mode);
  }, []);

  useEffect(() => {
    if (!initialBillId) return;
    const timer = setTimeout(() => openBill(initialBillId), 0);
    return () => clearTimeout(timer);
  }, [initialBillId, openBill]);

  async function findBill() {
    setError(""); setSuccess(""); setSale(null);
    const digits = billQuery.split("/").pop()?.replace(/\D/g, "");
    if (!digits) { setError("Enter the bill number printed on the bill."); return; }
    const { data } = await db().from("sales_public").select("*").eq("bill_no", Number(digits)).order("created_at", { ascending: false }).limit(5);
    const found = (data ?? []) as Sale[];
    if (found.length === 0) setError(`No bill with number ${digits}.`);
    else if (found.length === 1) openBill(found[0].id);
    else setMatches(found);
  }

  const unitsFor = (item: SaleItem) => { const q = qty[item.id]; return q ? q.packs * item.pack_size + q.loose : 0; };
  const refund = items.reduce((sum, item) => {
    const units = unitsFor(item);
    return sum + (units > 0 ? Math.round((Math.round(Number(item.net_amount) * 100) * units) / item.units) / 100 : 0);
  }, 0);

  async function submit() {
    if (!sale) return;
    setError(""); setSuccess("");
    const lines = items.map((item) => ({ sale_item_id: item.id, units: unitsFor(item) })).filter((l) => l.units > 0);
    const over = items.find((item) => unitsFor(item) > item.units - item.returned_units);
    if (over) { setError(`Only ${qtyLabel(over.units - over.returned_units, over.pack_size)} of ${over.product_name} can be returned.`); return; }
    if (lines.length === 0) { setError("Enter the quantity being returned."); return; }
    setSaving(true);
    try {
      const { data, error: e } = await db().rpc("create_sales_return", { p: { sale_id: sale.id, refund_mode: refundMode, note, items: lines } });
      if (e) throw e;
      const r = data as { return_no: number; fy: string; amount: number };
      setSuccess(`Return ${billNumber(r.fy, r.return_no)} saved. Give back ${money(r.amount)}. Stock has been added back.`);
      toast.success(`Return ${billNumber(r.fy, r.return_no)} saved`, { detail: `Give back ${money(r.amount)}. Stock has been added back.` });
      setNote("");
      await openBill(sale.id);
      loadRecent();
    } catch (e) {
      setError(errorMessage(e, "Could not save the return."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {!embedded && <PageHeader title="Sales Return" description="Customer brought medicines back? Find the bill, enter what is returned, and stock is added back automatically." />}

      <div className="adm-card adm-card-pad mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Bill number" className="flex-1">
          <input className="adm-input adm-input-lg" placeholder="e.g. 152 or 26-27/0152" value={billQuery} onChange={(e) => setBillQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") findBill(); }} autoFocus={!initialBillId} />
        </Field>
        <button className="button button-dark" onClick={findBill}><Search size={16} /> Find bill</button>
      </div>

      {matches && (
        <div className="adm-card adm-card-pad mb-4">
          <p className="adm-label">More than one bill has this number. Choose one:</p>
          <div className="flex flex-wrap gap-2">
            {matches.map((m) => <button key={m.id} className="button button-light button-small" onClick={() => openBill(m.id)}>{billNumber(m.fy, m.bill_no)} · {dateLabel(m.bill_date)} · {money(m.net)}</button>)}
          </div>
        </div>
      )}

      <div className="mb-4"><Alert error={error} success={success} /></div>

      {sale && (
        <div className="adm-card overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-3">
            <p className="font-semibold">Bill <Link className="text-[var(--brand-blue-strong)]" href={`/admin/sales/${sale.id}`}>{billNumber(sale.fy, sale.bill_no)}</Link> · {dateLabel(sale.bill_date)} · {money(sale.net)}</p>
            <p className="text-sm text-[var(--ink-muted)]">{sale.patient_name || "Walk-in customer"} · paid by {modeLabel(sale.payment_mode)}{Number(sale.discount_pct) > 0 && ` · ${Number(sale.discount_pct)}% discount was given, so the refund is reduced to match`}</p>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Medicine</th><th>Batch</th><th className="num">Sold</th><th className="num">Can return</th><th>Returning now</th></tr></thead>
              <tbody>
                {items.map((item) => {
                  const left = item.units - item.returned_units;
                  const q = qty[item.id] ?? { packs: 0, loose: 0 };
                  const set = (patch: Partial<typeof q>) => setQty((all) => ({ ...all, [item.id]: { ...q, ...patch } }));
                  return (
                    <tr key={item.id}>
                      <td><b>{item.product_name}</b> <span className="text-xs text-[var(--ink-muted)]">{item.packing}</span></td>
                      <td>{item.batch_no} · {expiryLabel(item.expiry)}</td>
                      <td className="num">{qtyLabel(item.units, item.pack_size)}</td>
                      <td className="num">{left > 0 ? qtyLabel(left, item.pack_size) : <span className="adm-badge adm-badge-gray">All returned</span>}</td>
                      <td>
                        {left > 0 && (
                          <div className="flex items-center gap-1.5">
                            <input className="adm-input adm-input-sm w-16 text-center" type="number" min={0} value={q.packs} onChange={(e) => set({ packs: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} aria-label="Packs returned" />
                            {item.pack_size > 1 && <><span className="text-xs">+</span><input className="adm-input adm-input-sm w-14 text-center" type="number" min={0} max={item.pack_size - 1} value={q.loose} onChange={(e) => set({ loose: Math.min(item.pack_size - 1, Math.max(0, Math.floor(Number(e.target.value) || 0))) })} aria-label="Loose returned" /><span className="text-xs text-[var(--ink-muted)]">loose</span></>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 border-t border-[var(--line)] p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Refund by">
              <Select value={refundMode} onChange={(v) => setRefundMode(v as PaymentMode)} ariaLabel="Refund by"
                options={paymentModes.map((m) => ({ value: m.value, label: m.value === "credit" ? "Reduce udhaar (credit)" : m.label }))} />
            </Field>
            <Field label="Reason (optional)"><input className="adm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. doctor changed medicine" /></Field>
            <div className="text-right">
              <p className="text-sm text-[var(--ink-muted)]">Refund</p>
              <p className="text-2xl font-bold tabular-nums">{money(refund)}</p>
              <button className="button button-dark mt-2" onClick={submit} disabled={saving || refund === 0}>{saving ? "Saving…" : "Save return"}</button>
            </div>
          </div>
        </div>
      )}

      {!embedded && <div className="adm-card mt-6 overflow-hidden">
        <h2 className="border-b border-[var(--line)] px-5 py-3 font-semibold">Recent returns</h2>
        {recent.length === 0 ? <Empty title="No returns yet" /> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Return</th><th>Date</th><th>Against bill</th><th>Refund by</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{billNumber(r.fy, r.return_no)}</td>
                    <td>{dateLabel(r.return_date)}</td>
                    <td>{r.sales ? `${billNumber(r.sales.fy, r.sales.bill_no)} ${r.sales.patient_name ? "· " + r.sales.patient_name : ""}` : "—"}</td>
                    <td>{modeLabel(r.refund_mode)}</td>
                    <td className="num font-semibold">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </div>
  );
}
