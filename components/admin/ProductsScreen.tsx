"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { daysUntil, expiryLabel, istToday, money, parseExpiry, qtyLabel } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { errorMessage, type Batch, type Product, type ProductStock } from "@/lib/billing/types";
import { Alert, Empty, Field, Loading, Modal, PageHeader } from "@/components/admin/ui";
import { Select } from "@/components/admin/controls";
import { ProductForm } from "@/components/admin/ProductForm";

type Filter = "all" | "low" | "expiring" | "expired" | "out";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Running low" },
  { value: "expiring", label: "Expiring in 90 days" },
  { value: "expired", label: "Expired stock" },
  { value: "out", label: "Out of stock" },
];

export function ProductsScreen({ initialFilter = "all", initialQuery = "" }: { initialFilter?: string; initialQuery?: string }) {
  const [rows, setRows] = useState<ProductStock[] | null>(null);
  const [filter, setFilter] = useState<Filter>(filters.some((f) => f.value === initialFilter) ? (initialFilter as Filter) : "all");
  const [search, setSearch] = useState(initialQuery);
  const [open, setOpen] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [opening, setOpening] = useState<ProductStock | null>(null);
  const [removing, setRemoving] = useState<{ batch: Batch; product: ProductStock } | null>(null);
  const [error, setError] = useState("");

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await db().from("product_stock").select("*").order("name").limit(5000);
      if (cancelled) return;
      if (e) { setError(errorMessage(e, "Could not load medicines.")); setRows([]); return; }
      setRows(data as ProductStock[]);
    })();
    return () => { cancelled = true; };
  }, [version]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data } = await db().from("batches").select("*").eq("product_id", open).order("expiry");
      if (!cancelled) setBatches((data ?? []) as Batch[]);
    })();
    return () => { cancelled = true; };
  }, [open, version]);

  function toggle(id: string) {
    setBatches([]);
    setOpen(open === id ? null : id);
  }

  const term = search.trim().toLowerCase();
  const soon = istToday(90);
  const visible = (rows ?? []).filter((r) => {
    if (term && !r.name.toLowerCase().includes(term) && !r.company.toLowerCase().includes(term) && r.barcode !== search.trim()) return false;
    if (filter === "low") return r.active && r.reorder_level > 0 && r.stock_units < r.reorder_level * r.pack_size;
    if (filter === "expiring") return r.next_expiry !== null && r.next_expiry <= soon;
    if (filter === "expired") return r.expired_units > 0;
    if (filter === "out") return r.active && r.stock_units === 0;
    return true;
  });
  const stockValue = visible.reduce((sum, r) => sum + Number(r.stock_value), 0);

  async function editProduct(id: string) {
    const { data } = await db().from("products").select("id, name, company, packing, pack_size, hsn, gst_rate, barcode, reorder_level, active, composition").eq("id", id).single();
    if (data) setEditing(data as Product);
  }

  return (
    <div>
      <PageHeader title="Medicines & Stock" description="Every medicine with its live stock, batches and expiry." actions={<button className="button button-dark button-small" onClick={() => setEditing("new")}><Plus size={16} /> Add medicine</button>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input className="adm-input lg:max-w-sm" placeholder="Search name, company or barcode" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => <button key={f.value} className="adm-mode-btn flex-none px-3" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>)}
        </div>
      </div>
      <Alert error={error} />

      <div className="adm-card overflow-hidden">
        {rows === null ? <Loading /> : visible.length === 0 ? (
          <Empty title={rows.length === 0 ? "No medicines yet" : "Nothing matches"}>{rows.length === 0 && "Add medicines here, or enter a purchase bill and they are added with their stock."}</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th /><th>Medicine</th><th>Company</th><th className="num">GST</th><th className="num">In stock</th><th>Next expiry</th><th className="num">Stock value</th><th /></tr></thead>
              <tbody>
                {visible.map((r) => {
                  const low = r.reorder_level > 0 && r.stock_units < r.reorder_level * r.pack_size;
                  const days = r.next_expiry ? daysUntil(r.next_expiry) : null;
                  return (
                    <Fragment key={r.id}>
                      <tr className="cursor-pointer" onClick={() => toggle(r.id)}>
                        <td className="w-8">{open === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td><b>{r.name}</b> <span className="text-xs text-[var(--ink-muted)]">{r.packing}</span>{!r.active && <span className="adm-badge adm-badge-gray ml-2">Hidden</span>}</td>
                        <td>{r.company || "—"}</td>
                        <td className="num">{Number(r.gst_rate)}%</td>
                        <td className="num">
                          <span className={r.stock_units === 0 ? "font-semibold adm-text-red" : low ? "font-semibold adm-text-amber" : "font-semibold"}>{qtyLabel(r.stock_units, r.pack_size)}</span>
                          {r.expired_units > 0 && <span className="adm-badge adm-badge-red ml-2">{qtyLabel(r.expired_units, r.pack_size)} expired</span>}
                        </td>
                        <td>{r.next_expiry ? <span className={days !== null && days <= 90 ? "adm-badge adm-badge-amber" : ""}>{expiryLabel(r.next_expiry)}</span> : "—"}</td>
                        <td className="num">{money(r.stock_value)}</td>
                        <td><button className="icon-button" onClick={(e) => { e.stopPropagation(); editProduct(r.id); }} aria-label={`Edit ${r.name}`}><Pencil size={15} /></button></td>
                      </tr>
                      {open === r.id && (
                        <tr>
                          <td />
                          <td colSpan={7} className="adm-subrow">
                            <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">Batches</p>
                              <button className="button button-light button-small" onClick={() => setOpening(r)}><Plus size={15} /> Add opening stock</button>
                            </div>
                            {batches.length === 0 ? <p className="py-2 text-sm text-[var(--ink-muted)]">No batches yet. Enter a purchase bill or add opening stock.</p> : (
                              <table className="adm-table mt-2">
                                <thead><tr><th>Batch</th><th>Expiry</th><th className="num">MRP</th><th className="num">Cost</th><th className="num">Stock</th><th /></tr></thead>
                                <tbody>
                                  {batches.map((b) => (
                                    <tr key={b.id}>
                                      <td>{b.batch_no}</td>
                                      <td>{expiryLabel(b.expiry)} {daysUntil(b.expiry) < 0 ? <span className="adm-badge adm-badge-red">Expired</span> : daysUntil(b.expiry) <= 90 ? <span className="adm-badge adm-badge-amber">Soon</span> : null}</td>
                                      <td className="num">{money(b.mrp)}</td>
                                      <td className="num">{money(b.purchase_rate)}</td>
                                      <td className="num">{qtyLabel(b.stock_units, r.pack_size)}</td>
                                      <td className="text-right">{b.stock_units > 0 && <button className="button button-danger button-small" onClick={() => setRemoving({ batch: b, product: r })}>Remove stock</button>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot><tr><td /><td colSpan={5} className="font-semibold">{visible.length} medicines</td><td className="num font-bold">{money(stockValue)}</td><td /></tr></tfoot>
            </table>
          </div>
        )}
      </div>

      {editing && <ProductForm product={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {opening && <OpeningStockForm product={opening} onClose={() => setOpening(null)} onSaved={() => { setOpening(null); load(); }} />}
      {removing && <RemoveStockForm {...removing} onClose={() => setRemoving(null)} onSaved={() => { setRemoving(null); load(); }} />}
    </div>
  );
}

function OpeningStockForm({ product, onClose, onSaved }: { product: ProductStock; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ batch: "", expiry: "", mrp: "", rate: "", packs: "", loose: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const exp = parseExpiry(form.expiry);
    if (!exp) { setError("Enter expiry as MM/YY, e.g. 10/27."); return; }
    setSaving(true); setError("");
    const { error: e } = await db().rpc("add_opening_stock", {
      p_product_id: product.id, p_batch_no: form.batch, p_expiry_month: exp.month, p_expiry_year: exp.year,
      p_mrp: Number(form.mrp), p_purchase_rate: Number(form.rate) || 0, p_packs: Number(form.packs) || 0, p_loose: Number(form.loose) || 0,
    });
    setSaving(false);
    if (e) { setError(errorMessage(e, "Could not add stock.")); return; }
    onSaved();
  }

  return (
    <Modal title={`Opening stock · ${product.name}`} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm text-[var(--ink-muted)]">Use this once for stock already on the shelf. New stock from suppliers should be entered as a purchase bill.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batch no"><input className="adm-input uppercase" value={form.batch} onChange={(e) => set({ batch: e.target.value })} required /></Field>
          <Field label="Expiry (MM/YY)"><input className="adm-input" value={form.expiry} onChange={(e) => set({ expiry: e.target.value })} placeholder="10/27" required /></Field>
          <Field label="MRP per pack (₹)"><input className="adm-input" type="number" step="0.01" min={0} value={form.mrp} onChange={(e) => set({ mrp: e.target.value })} required /></Field>
          <Field label="Purchase rate per pack (₹)" hint="Optional, used for profit"><input className="adm-input" type="number" step="0.01" min={0} value={form.rate} onChange={(e) => set({ rate: e.target.value })} /></Field>
          <Field label={product.pack_size > 1 ? "Packs / strips" : "Quantity"}><input className="adm-input" type="number" min={0} value={form.packs} onChange={(e) => set({ packs: e.target.value })} /></Field>
          {product.pack_size > 1 && <Field label={`Loose (of ${product.pack_size})`}><input className="adm-input" type="number" min={0} max={product.pack_size - 1} value={form.loose} onChange={(e) => set({ loose: e.target.value })} /></Field>}
        </div>
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Add stock"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveStockForm({ batch, product, onClose, onSaved }: { batch: Batch; product: ProductStock; onClose: () => void; onSaved: () => void }) {
  const expired = daysUntil(batch.expiry) < 0;
  const [reason, setReason] = useState(expired ? "expired" : "damaged");
  const [packs, setPacks] = useState(String(Math.floor(batch.stock_units / product.pack_size)));
  const [loose, setLoose] = useState(String(batch.stock_units % product.pack_size));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const units = (Number(packs) || 0) * product.pack_size + (Number(loose) || 0);
    if (units <= 0 || units > batch.stock_units) { setError(`Enter a quantity up to ${qtyLabel(batch.stock_units, product.pack_size)}.`); return; }
    setSaving(true); setError("");
    const { error: e } = await db().rpc("adjust_stock", { p_batch_id: batch.id, p_units: -units, p_reason: reason, p_note: note });
    setSaving(false);
    if (e) { setError(errorMessage(e, "Could not update stock.")); return; }
    onSaved();
  }

  return (
    <Modal title={`Remove stock · ${product.name}`} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm">Batch <b>{batch.batch_no}</b>, expiry {expiryLabel(batch.expiry)}, in stock <b>{qtyLabel(batch.stock_units, product.pack_size)}</b></p>
        <Field label="Reason">
          <Select value={reason} onChange={setReason} ariaLabel="Reason" options={[
            { value: "expired", label: "Expired" },
            { value: "damaged", label: "Damaged / broken" },
            { value: "returned_to_supplier", label: "Returned to supplier" },
            { value: "count_correction", label: "Stock count correction" },
          ]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={product.pack_size > 1 ? "Packs / strips" : "Quantity"}><input className="adm-input" type="number" min={0} value={packs} onChange={(e) => setPacks(e.target.value)} /></Field>
          {product.pack_size > 1 && <Field label="Loose"><input className="adm-input" type="number" min={0} value={loose} onChange={(e) => setLoose(e.target.value)} /></Field>}
        </div>
        <Field label="Note (optional)"><input className="adm-input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Remove from stock"}</button>
        </div>
      </form>
    </Modal>
  );
}
