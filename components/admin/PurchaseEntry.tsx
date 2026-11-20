"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { purchaseLine, purchaseTotals } from "@/lib/billing/calc";
import { billNumber, istToday, money, parseExpiry } from "@/lib/billing/format";
import { db, searchProducts } from "@/lib/billing/queries";
import { errorMessage, type Product, type Supplier } from "@/lib/billing/types";
import { Alert, Field, PageHeader } from "@/components/admin/ui";
import { DateField, Select } from "@/components/admin/controls";
import { ProductForm } from "@/components/admin/ProductForm";
import { SupplierForm } from "@/components/admin/SupplierForm";

type Item = { key: string; product: Product; batch: string; expiry: { month: number; year: number }; mrp: number; rate: number; qty: number; free: number; disc: number };
const emptyEntry = { batch: "", expiry: "", mrp: "", rate: "", qty: "", free: "", disc: "" };

export function PurchaseEntry() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(istToday());
  const [mode, setMode] = useState<"credit" | "cash">("credit");
  const [items, setItems] = useState<Item[]>([]);
  const [adjustment, setAdjustment] = useState("");
  const [narration, setNarration] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: Product[] }>({ q: "", items: [] });
  const [activeResult, setActiveResult] = useState(0);
  const [product, setProduct] = useState<Product | null>(null);
  const [entry, setEntry] = useState(emptyEntry);
  const [newProduct, setNewProduct] = useState(false);
  const [newSupplier, setNewSupplier] = useState(false);
  const [error, setError] = useState("");
  const [entryError, setEntryError] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db().from("suppliers").select("*").eq("active", true).order("name").then(({ data }) => setSuppliers((data ?? []) as Supplier[]));
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || product) return;
    const timer = setTimeout(async () => { try { setFound({ q, items: await searchProducts(q, 8) }); setActiveResult(0); } catch { /* shown on save */ } }, 180);
    return () => clearTimeout(timer);
  }, [query, product]);

  const searchDone = found.q === query.trim();
  const results = !product && searchDone ? found.items : [];

  async function pickProduct(p: Product) {
    setProduct(p); setQuery(p.name); setEntryError("");
    // Pre-fill MRP and rate from the last batch bought, to save typing.
    const { data } = await db().from("batches").select("mrp, purchase_rate").eq("product_id", p.id).order("created_at", { ascending: false }).limit(1);
    const last = data?.[0];
    setEntry({ ...emptyEntry, mrp: last ? String(last.mrp) : "", rate: last && Number(last.purchase_rate) > 0 ? String(last.purchase_rate) : "" });
    requestAnimationFrame(() => batchRef.current?.focus());
  }

  function addItem() {
    setEntryError("");
    if (!product) { setEntryError("Choose a medicine first."); searchRef.current?.focus(); return; }
    const expiry = parseExpiry(entry.expiry);
    const qty = Math.floor(Number(entry.qty) || 0), free = Math.floor(Number(entry.free) || 0);
    if (!entry.batch.trim()) { setEntryError("Enter the batch number."); return; }
    if (!expiry) { setEntryError("Enter expiry as MM/YY, e.g. 10/27."); return; }
    if (!(Number(entry.mrp) > 0)) { setEntryError("Enter the MRP per pack."); return; }
    if (qty + free <= 0) { setEntryError("Enter the quantity."); return; }
    if (Number(entry.rate) > Number(entry.mrp)) { setEntryError("Purchase rate is higher than MRP. Please check."); return; }
    setItems((all) => [...all, {
      key: crypto.randomUUID(), product, batch: entry.batch.trim().toUpperCase(), expiry,
      mrp: Number(entry.mrp), rate: Number(entry.rate) || 0, qty, free, disc: Math.min(100, Math.max(0, Number(entry.disc) || 0)),
    }]);
    setProduct(null); setQuery(""); setEntry(emptyEntry);
    searchRef.current?.focus();
  }

  const totals = purchaseTotals(items.map((i) => ({ rate: i.rate, qty: i.qty, discountPct: i.disc, gstRate: i.product.gst_rate })), Number(adjustment) || 0);

  async function save() {
    setError("");
    if (!supplierId) { setError("Choose the supplier."); return; }
    if (!billNo.trim()) { setError("Enter the supplier's bill number."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }
    setSaving(true);
    try {
      const { data, error: e } = await db().rpc("create_purchase", {
        p: {
          supplier_id: supplierId, supplier_bill_no: billNo, bill_date: billDate, payment_mode: mode,
          adjustment: Number(adjustment) || 0, narration,
          items: items.map((i) => ({ product_id: i.product.id, batch_no: i.batch, expiry_month: i.expiry.month, expiry_year: i.expiry.year, mrp: i.mrp, rate: i.rate, qty: i.qty, free_qty: i.free, discount_pct: i.disc })),
        },
      });
      if (e) throw e;
      const r = data as { id: string; entry_no: number; fy: string; net: number };
      router.push(`/admin/purchases?saved=${encodeURIComponent(`${billNumber(r.fy, r.entry_no)} · ${money(r.net)}`)}`);
    } catch (e) {
      setError(errorMessage(e, "Could not save the purchase."));
      setSaving(false);
    }
  }

  const onEnterNext = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const fields = Array.from(event.currentTarget.closest("[data-entry]")?.querySelectorAll<HTMLInputElement>("input") ?? []);
    const index = fields.indexOf(event.currentTarget);
    if (index === fields.length - 1) addItem(); else fields[index + 1]?.focus();
  };

  return (
    <div>
      <Link href="/admin/purchases" className="admin-back-link mb-4"><ArrowLeft size={16} /> Purchases</Link>
      <PageHeader title="Enter Purchase Bill" description="Copy the supplier's bill. Stock is added as soon as you save." />

      <div className="adm-card adm-card-pad mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Supplier">
          <div className="flex gap-2">
            <Select value={supplierId} onChange={setSupplierId} placeholder="Choose supplier…" searchable ariaLabel="Supplier" className="min-w-0 flex-1"
              options={suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.gstin || s.phone || undefined }))} />
            <button type="button" className="icon-button shrink-0" onClick={() => setNewSupplier(true)} aria-label="Add supplier" title="Add supplier"><Plus size={17} /></button>
          </div>
        </Field>
        <Field label="Supplier bill no"><input className="adm-input uppercase" value={billNo} onChange={(e) => setBillNo(e.target.value)} /></Field>
        <Field label="Bill date"><DateField value={billDate} max={istToday()} onChange={setBillDate} ariaLabel="Bill date" /></Field>
        <div>
          <span className="adm-label">Payment</span>
          <div className="flex gap-2">
            <button type="button" className="adm-mode-btn px-2" aria-pressed={mode === "credit"} onClick={() => setMode("credit")}>Credit</button>
            <button type="button" className="adm-mode-btn px-2" aria-pressed={mode === "cash"} onClick={() => setMode("cash")}>Cash paid</button>
          </div>
        </div>
      </div>

      <div className="adm-card adm-card-pad mb-4" data-entry>
        <p className="adm-label">Add item</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8 sm:items-end">
          <div className="relative col-span-2 sm:col-span-4 xl:col-span-8">
            <Field label="Medicine">
              <input
                ref={searchRef}
                className="adm-input"
                value={query}
                placeholder="Search medicine"
                onChange={(e) => { setQuery(e.target.value); setProduct(null); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActiveResult((i) => Math.min(i + 1, results.length)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActiveResult((i) => Math.max(i - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); if (product) batchRef.current?.focus(); else if (results[activeResult]) pickProduct(results[activeResult]); else if (searchDone && query.trim().length >= 2) setNewProduct(true); }
                }}
                autoComplete="off"
              />
            </Field>
            {!product && query.trim().length >= 2 && (
              <div className="adm-search-results">
                {results.map((p, i) => (
                  <button key={p.id} type="button" className="adm-search-item" data-active={i === activeResult} onClick={() => pickProduct(p)}>
                    <span className="flex-1"><b>{p.name}</b> <span className="text-xs text-[var(--ink-muted)]">{p.packing} · {p.company} · GST {Number(p.gst_rate)}%</span></span>
                  </button>
                ))}
                {searchDone
                  ? <button type="button" className="adm-search-item font-semibold text-[var(--brand-blue-strong)]" data-active={activeResult === results.length} onClick={() => setNewProduct(true)}><Plus size={16} /> New medicine “{query.trim()}”</button>
                  : <p className="px-4 py-3 text-sm text-[var(--ink-muted)]">Searching…</p>}
              </div>
            )}
          </div>
          <Field label="Batch"><input ref={batchRef} className="adm-input uppercase" value={entry.batch} onChange={(e) => setEntry({ ...entry, batch: e.target.value })} onKeyDown={onEnterNext} /></Field>
          <Field label="Exp MM/YY"><input className="adm-input" value={entry.expiry} onChange={(e) => setEntry({ ...entry, expiry: e.target.value })} onKeyDown={onEnterNext} placeholder="10/27" /></Field>
          <Field label="MRP"><input className="adm-input" type="number" step="0.01" min={0} value={entry.mrp} onChange={(e) => setEntry({ ...entry, mrp: e.target.value })} onKeyDown={onEnterNext} /></Field>
          <Field label="Rate"><input className="adm-input" type="number" step="0.01" min={0} value={entry.rate} onChange={(e) => setEntry({ ...entry, rate: e.target.value })} onKeyDown={onEnterNext} /></Field>
          <Field label="Qty"><input className="adm-input" type="number" min={0} value={entry.qty} onChange={(e) => setEntry({ ...entry, qty: e.target.value })} onKeyDown={onEnterNext} /></Field>
          <Field label="Free"><input className="adm-input" type="number" min={0} value={entry.free} onChange={(e) => setEntry({ ...entry, free: e.target.value })} onKeyDown={onEnterNext} /></Field>
          <Field label="Disc %"><input className="adm-input" type="number" min={0} max={100} step="0.01" value={entry.disc} onChange={(e) => setEntry({ ...entry, disc: e.target.value })} onKeyDown={onEnterNext} /></Field>
          <button type="button" className="button button-dark w-full" onClick={addItem}><Plus size={16} /> Add</button>
        </div>
        {product && <p className="mt-2 text-xs text-[var(--ink-muted)]">{product.packing} · {product.pack_size > 1 ? `${product.pack_size} units per pack · ` : ""}GST {Number(product.gst_rate)}% · Qty, MRP and rate are per pack</p>}
        {entryError && <p className="adm-error mt-3">{entryError}</p>}
      </div>

      <div className="adm-card overflow-hidden">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>#</th><th>Medicine</th><th>Batch</th><th>Exp</th><th className="num">MRP</th><th className="num">Rate</th><th className="num">Qty</th><th className="num">Free</th><th className="num">Disc</th><th className="num">GST</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={12} className="py-10 text-center text-[var(--ink-muted)]">Items you add will appear here.</td></tr>}
              {items.map((i, n) => (
                <tr key={i.key}>
                  <td>{n + 1}</td>
                  <td><b>{i.product.name}</b> <span className="text-xs text-[var(--ink-muted)]">{i.product.packing}</span></td>
                  <td>{i.batch}</td>
                  <td>{String(i.expiry.month).padStart(2, "0")}/{String(i.expiry.year).slice(2)}</td>
                  <td className="num">{money(i.mrp)}</td>
                  <td className="num">{money(i.rate)}</td>
                  <td className="num">{i.qty}</td>
                  <td className="num">{i.free || "—"}</td>
                  <td className="num">{i.disc ? `${i.disc}%` : "—"}</td>
                  <td className="num">{Number(i.product.gst_rate)}%</td>
                  <td className="num font-semibold">{money(purchaseLine({ rate: i.rate, qty: i.qty, discountPct: i.disc, gstRate: i.product.gst_rate }).amount)}</td>
                  <td><button className="icon-button" onClick={() => setItems((all) => all.filter((x) => x.key !== i.key))} aria-label={`Remove ${i.product.name}`}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-6 border-t border-[var(--line)] p-5 xl:grid-cols-[1fr_22rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Other charges / credit note (₹)" hint="Freight or TCS as +, credit note as −"><input className="adm-input" type="number" step="0.01" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} /></Field>
            <Field label="Narration (optional)"><input className="adm-input" value={narration} onChange={(e) => setNarration(e.target.value)} /></Field>
          </div>
          <dl className="grid gap-1.5 text-sm">
            <div className="flex justify-between"><dt>Gross</dt><dd className="tabular-nums">{money(totals.gross)}</dd></div>
            <div className="flex justify-between"><dt>Discount</dt><dd className="tabular-nums">− {money(totals.discount)}</dd></div>
            <div className="flex justify-between"><dt>GST</dt><dd className="tabular-nums">{money(totals.gst)}</dd></div>
            {Number(adjustment) !== 0 && <div className="flex justify-between"><dt>Other / credit note</dt><dd className="tabular-nums">{money(Number(adjustment) || 0)}</dd></div>}
            <div className="flex justify-between"><dt>Round off</dt><dd className="tabular-nums">{money(totals.roundOff)}</dd></div>
            <div className="flex justify-between border-t border-[var(--line)] pt-2 text-xl font-bold"><dt>Net amount</dt><dd className="tabular-nums">{money(totals.net)}</dd></div>
            <p className="text-xs text-[var(--ink-muted)]">Check this matches the total printed on the supplier&apos;s bill.</p>
            <div className="mt-2"><Alert error={error} /></div>
            <button className="button button-dark button-xl mt-2" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save purchase & add stock"}</button>
          </dl>
        </div>
      </div>

      {newProduct && <ProductForm initialName={query.trim()} onClose={() => setNewProduct(false)} onSaved={(p) => { setNewProduct(false); pickProduct(p); }} />}
      {newSupplier && <SupplierForm onClose={() => setNewSupplier(false)} onSaved={(s) => { setNewSupplier(false); setSuppliers((all) => [...all, s].sort((a, b) => a.name.localeCompare(b.name))); setSupplierId(s.id); }} />}
    </div>
  );
}
