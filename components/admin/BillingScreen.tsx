"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, History, PauseCircle, Printer, RotateCcw, ScanBarcode, Search, Stethoscope, Trash2, UserRound, X } from "lucide-react";
import { saleLine, saleTotals } from "@/lib/billing/calc";
import { billNumber, dateLabel, expiryLabel, money, qtyLabel } from "@/lib/billing/format";
import { PRODUCT_COLUMNS, db, printSale, productByBarcode, searchProducts, sellableBatches, substitutesFor } from "@/lib/billing/queries";
import { errorMessage, paymentModes, type Batch, type PaymentMode, type Product } from "@/lib/billing/types";
import { Alert, Field, Modal } from "@/components/admin/ui";
import { Select } from "@/components/admin/controls";
import { useToast } from "@/components/admin/toast";
import { ReturnsScreen } from "@/components/admin/ReturnsScreen";
import type { CustomerBalance } from "@/components/admin/CustomersScreen";

type Line = { key: string; product: Product; batches: Batch[]; batchId: string; packs: number; loose: number };
type Result = { product: Product; batches: Batch[] };
type HeldBill = { id: string; at: string; lines: Line[]; patient: string; phone: string; doctor: string; discount: number; mode: PaymentMode; customer?: CustomerBalance | null };

const HOLD_KEY = "srm-held-bills";
const unitsOf = (line: Line) => line.packs * line.product.pack_size + line.loose;
const batchOf = (line: Line) => line.batches.find((b) => b.id === line.batchId)!;
const looksLikeBarcode = (q: string) => /^\d{6,14}$/.test(q.trim());
const splitUnits = (units: number, packSize: number) => ({ packs: Math.floor(units / packSize), loose: units % packSize });

function readHeld(): HeldBill[] {
  try { return JSON.parse(localStorage.getItem(HOLD_KEY) ?? "[]"); } catch { return []; }
}
function writeHeld(bills: HeldBill[]) {
  try { localStorage.setItem(HOLD_KEY, JSON.stringify(bills)); } catch { /* storage unavailable */ }
}

export function BillingScreen() {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: Result[] }>({ q: "", items: [] });
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<CustomerBalance | null>(null);
  const [patient, setPatient] = useState("");
  const [phone, setPhone] = useState("");
  const [doctor, setDoctor] = useState("");
  const [discount, setDiscount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [pin, setPin] = useState("");
  const [pinNeeded, setPinNeeded] = useState(false);
  const [printAfterSave, setPrintAfterSave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [held, setHeld] = useState<HeldBill[]>([]);
  const [subsFor, setSubsFor] = useState<{ product: Product; lineKey?: string } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());
  const searchSeq = useRef(0);

  useEffect(() => {
    (async () => {
      const [{ data: settings }, { count }, { data: role }] = await Promise.all([
        db().from("shop_settings").select("require_staff_pin").single(),
        db().from("staff").select("id", { count: "exact", head: true }).eq("active", true),
        db().rpc("my_role"),
      ]);
      setIsOwner(role === "owner");
      setPinNeeded(Boolean(settings?.require_staff_pin) && (count ?? 0) > 0);
      setHeld(readHeld());
    })();
    searchRef.current?.focus();
  }, []);

  // Debounced product search; ignores out-of-order responses. Scanner input is handled on Enter instead.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || looksLikeBarcode(q)) return;
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const products = await searchProducts(q);
        const batches = await sellableBatches(products.map((p) => p.id));
        if (seq !== searchSeq.current) return;
        setFound({ q, items: products.map((product) => ({ product, batches: batches.filter((b) => b.product_id === product.id) })) });
        setActive(0);
      } catch (e) {
        if (seq === searchSeq.current) setError(errorMessage(e, "Could not search medicines."));
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const results = found.q === query.trim() ? found.items : [];
  const focusQty = (key: string) => requestAnimationFrame(() => { const el = qtyRefs.current.get(key); el?.focus(); el?.select(); });

  function addResult(result: Result, units?: number, focus = true) {
    if (result.batches.length === 0) {
      if (result.product.composition) { setSubsFor({ product: result.product }); setError(""); }
      else setError(`${result.product.name} is out of stock.`);
      return;
    }
    setError("");
    const first = result.batches[0];
    const existing = lines.find((l) => l.product.id === result.product.id && l.batchId === first.id);
    if (existing) {
      setLines((all) => all.map((l) => (l.key === existing.key ? { ...l, packs: l.packs + 1 } : l)));
      if (focus) focusQty(existing.key);
    } else {
      const key = crypto.randomUUID();
      const qty = units ? splitUnits(units, result.product.pack_size) : { packs: 1, loose: 0 };
      setLines((all) => [...all, { key, product: result.product, batches: result.batches, batchId: first.id, ...qty }]);
      if (focus) focusQty(key);
    }
    setQuery("");
  }

  /** Barcode scanners type the code and press Enter within milliseconds: add the item straight away. */
  async function scan(code: string) {
    const product = await productByBarcode(code);
    if (!product) { setError(`No medicine has barcode ${code}. Add it in Medicines & Stock.`); setQuery(""); return; }
    const batches = await sellableBatches([product.id]);
    addResult({ product, batches }, undefined, false);
    setQuery("");
    searchRef.current?.focus();
  }

  const updateLine = (key: string, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => { setLines((all) => all.filter((l) => l.key !== key)); searchRef.current?.focus(); };

  function applySubstitute(original: { product: Product; lineKey?: string }, pick: Result) {
    const oldLine = original.lineKey ? lines.find((l) => l.key === original.lineKey) : undefined;
    const units = oldLine ? unitsOf(oldLine) : pick.product.pack_size;
    const key = crypto.randomUUID();
    const line: Line = { key, product: pick.product, batches: pick.batches, batchId: pick.batches[0].id, ...splitUnits(units, pick.product.pack_size) };
    setLines((all) => (oldLine ? all.map((l) => (l.key === oldLine.key ? line : l)) : [...all, line]));
    setSubsFor(null);
    focusQty(key);
  }

  async function repeatLastBill() {
    if (!customer) return;
    const { data: last } = await db().from("sales_public").select("id, fy, bill_no, bill_date").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(1);
    const sale = (last ?? [])[0] as { id: string; fy: string; bill_no: number; bill_date: string } | undefined;
    if (!sale) { toast.error(`${customer.name} has no earlier bills`); return; }
    const { data: items } = await db().from("sale_items_public").select("product_id, units, returned_units").eq("sale_id", sale.id);
    const wanted = ((items ?? []) as { product_id: string; units: number; returned_units: number }[]).filter((i) => i.units - i.returned_units > 0);
    const ids = [...new Set(wanted.map((i) => i.product_id))];
    const [{ data: products }, batches] = await Promise.all([db().from("products").select(PRODUCT_COLUMNS).in("id", ids), sellableBatches(ids)]);
    const skipped: string[] = [];
    const next: Line[] = [];
    for (const item of wanted) {
      const product = ((products ?? []) as Product[]).find((p) => p.id === item.product_id);
      const pb = batches.filter((b) => b.product_id === item.product_id);
      if (!product) continue;
      if (pb.length === 0) { skipped.push(product.name); continue; }
      next.push({ key: crypto.randomUUID(), product, batches: pb, batchId: pb[0].id, ...splitUnits(item.units - item.returned_units, product.pack_size) });
    }
    setLines((all) => [...all, ...next]);
    if (skipped.length) toast.error(`Not in stock: ${skipped.join(", ")}`, "Use the substitutes button to pick another brand.");
    else toast.success(`Copied ${next.length} items from bill ${billNumber(sale.fy, sale.bill_no)}`, { detail: dateLabel(sale.bill_date) });
  }

  const totals = useMemo(() => saleTotals(
    lines.filter((l) => unitsOf(l) > 0).map((l) => ({ mrp: batchOf(l).mrp, packSize: l.product.pack_size, units: unitsOf(l), gstRate: l.product.gst_rate })),
    discount,
  ), [lines, discount]);

  const problems = lines.filter((l) => unitsOf(l) <= 0 || unitsOf(l) > batchOf(l).stock_units);

  function resetBill() {
    setLines([]); setCustomer(null); setPatient(""); setPhone(""); setDoctor("");
    setDiscount(0); setMode("cash"); setPin(""); setError("");
    searchRef.current?.focus();
  }

  const save = useCallback(async () => {
    if (saving) return;
    setError("");
    if (lines.length === 0) { setError("Add at least one medicine to the bill."); searchRef.current?.focus(); return; }
    if (problems.length) { setError(`Check the quantity of ${problems[0].product.name}.`); focusQty(problems[0].key); return; }
    if (mode === "credit" && !customer && !patient.trim()) { setError("Choose the customer (or type name and mobile) for a credit bill."); return; }
    if (pinNeeded && !pin.trim()) { setError("Enter your staff PIN to save the bill."); document.getElementById("staff-pin")?.focus(); return; }
    setSaving(true);
    try {
      const { data, error: rpcError } = await db().rpc("create_sale", {
        p: {
          pin: pin.trim() || null, customer_id: customer?.id ?? null,
          patient_name: customer ? customer.name : patient, patient_phone: customer ? customer.phone : phone, doctor_name: doctor,
          payment_mode: mode, discount_pct: discount,
          items: lines.map((l) => ({ batch_id: l.batchId, units: unitsOf(l) })),
        },
      });
      if (rpcError) throw rpcError;
      const result = data as { id: string; bill_no: number; fy: string; net: number };
      if (printAfterSave) printSale(result.id);
      toast.success(`Bill ${billNumber(result.fy, result.bill_no)} saved · ${money(result.net)}`, {
        detail: mode === "credit" ? "Added to the customer's udhaar." : undefined,
        actions: [
          { label: "Print again", onClick: () => printSale(result.id) },
          ...(isOwner ? [{ label: "View bill", onClick: () => router.push(`/admin/sales/${result.id}`) }] : []),
        ],
      });
      resetBill();
    } catch (e) {
      setError(errorMessage(e, "Could not save the bill. Nothing was charged; please try again."));
    } finally {
      setSaving(false);
    }
  }, [saving, lines, problems, pinNeeded, pin, customer, patient, phone, doctor, mode, discount, printAfterSave, toast, router, isOwner]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F10" || (event.ctrlKey && event.key === "Enter")) { event.preventDefault(); save(); }
      if (event.key === "F7") { event.preventDefault(); setReturnOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  function holdBill() {
    if (lines.length === 0) return;
    const next = [{ id: crypto.randomUUID(), at: new Date().toISOString(), lines, patient, phone, doctor, discount, mode, customer }, ...held].slice(0, 10);
    setHeld(next); writeHeld(next); resetBill();
    toast.success("Bill put on hold", { detail: "Resume it from Held bills below." });
  }
  function resumeBill(bill: HeldBill) {
    if (lines.length > 0 && !confirm("Replace the current bill with the held bill?")) return;
    setLines(bill.lines); setPatient(bill.patient); setPhone(bill.phone); setDoctor(bill.doctor);
    setCustomer(bill.customer ?? null); setDiscount(bill.discount); setMode(bill.mode);
    const next = held.filter((h) => h.id !== bill.id);
    setHeld(next); writeHeld(next);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">New Bill</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)]">
            <span className="hidden items-center gap-1 sm:inline-flex"><ScanBarcode size={14} /> Scanner ready</span>
            <span><kbd className="adm-kbd">F10</kbd> save &amp; print</span>
            <button className="button button-small button-light" onClick={() => setReturnOpen(true)}><RotateCcw size={14} /> Return <kbd className="adm-kbd">F7</kbd></button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" size={20} />
          <input
            ref={searchRef}
            className="adm-input adm-input-lg pl-12"
            placeholder="Type medicine, salt or scan barcode…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter" && looksLikeBarcode(query)) { e.preventDefault(); scan(query.trim()); }
              else if (e.key === "Enter" && results[active]) { e.preventDefault(); addResult(results[active]); }
              else if (e.key === "Escape") setQuery("");
            }}
            aria-label="Search medicine"
            autoComplete="off"
          />
          {query.trim().length >= 2 && !looksLikeBarcode(query) && (
            <div className="adm-search-results" role="listbox">
              {(searching || found.q !== query.trim()) && results.length === 0 && <p className="px-4 py-3 text-sm text-[var(--ink-muted)]">Searching…</p>}
              {!searching && found.q === query.trim() && results.length === 0 && (
                <p className="px-4 py-3 text-sm text-[var(--ink-muted)]">No medicine found. <Link className="font-semibold text-[var(--brand-blue-strong)]" href="/admin/products">Add it in Medicines &amp; Stock</Link></p>
              )}
              {results.map((r, i) => {
                const stock = r.batches.reduce((sum, b) => sum + b.stock_units, 0);
                return (
                  <button key={r.product.id} type="button" className="adm-search-item" data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => addResult(r)} role="option" aria-selected={i === active}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.product.name}</span>
                      <span className="block truncate text-xs text-[var(--ink-muted)]">{[r.product.packing, r.product.composition, r.product.company].filter(Boolean).join(" · ")}</span>
                    </span>
                    {stock > 0 ? (
                      <span className="text-right text-xs">
                        <span className="block font-semibold text-[var(--brand-dark)]">{money(r.batches[0].mrp)}</span>
                        <span className="block text-[var(--ink-muted)]">Stock {qtyLabel(stock, r.product.pack_size)} · Exp {expiryLabel(r.batches[0].expiry)}</span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-end gap-1">
                        <span className="adm-badge adm-badge-red">Out of stock</span>
                        {r.product.composition && <span className="text-xs font-semibold text-[var(--brand-blue-strong)]">See substitutes</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {error && <div className="mt-3"><Alert error={error} /></div>}

        <div className="adm-card mt-4 overflow-hidden">
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>#</th><th>Medicine</th><th>Batch / Exp</th><th className="num">MRP</th><th>Qty {lines.some((l) => l.product.pack_size > 1) && <span className="font-normal normal-case tracking-normal">(packs + loose)</span>}</th><th className="num">Amount</th><th /></tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-[var(--ink-muted)]">Search or scan a medicine to start the bill.</td></tr>
                )}
                {lines.map((line, index) => {
                  const batch = batchOf(line);
                  const units = unitsOf(line);
                  const over = units > batch.stock_units;
                  const loose = line.product.pack_size > 1;
                  return (
                    <tr key={line.key}>
                      <td className="text-[var(--ink-muted)]">{index + 1}</td>
                      <td className="min-w-[11rem]">
                        <p className="font-semibold">{line.product.name}</p>
                        <p className="text-xs text-[var(--ink-muted)]">{line.product.packing}{loose && ` · ${line.product.pack_size} per pack`}{line.product.composition && ` · ${line.product.composition}`}</p>
                      </td>
                      <td>
                        {line.batches.length > 1 ? (
                          <Select small className="w-[10rem]" value={line.batchId} onChange={(v) => updateLine(line.key, { batchId: v })} ariaLabel="Batch"
                            options={line.batches.map((b) => ({ value: b.id, label: `${b.batch_no} · ${expiryLabel(b.expiry)}`, hint: `MRP ${money(b.mrp)} · stock ${qtyLabel(b.stock_units, line.product.pack_size)}` }))} />
                        ) : (
                          <span className="text-sm">{batch.batch_no} · {expiryLabel(batch.expiry)}</span>
                        )}
                      </td>
                      <td className="num">{money(batch.mrp)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={(el) => { if (el) qtyRefs.current.set(line.key, el); else qtyRefs.current.delete(line.key); }}
                            className="adm-input adm-input-sm w-14 text-center"
                            type="number" min={0} inputMode="numeric"
                            value={line.packs}
                            onChange={(e) => updateLine(line.key, { packs: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchRef.current?.focus(); } }}
                            aria-label={loose ? "Packs" : "Quantity"}
                          />
                          {loose && (
                            <>
                              <span className="text-xs text-[var(--ink-muted)]">+</span>
                              <input
                                className="adm-input adm-input-sm w-12 text-center"
                                type="number" min={0} max={line.product.pack_size - 1} inputMode="numeric"
                                value={line.loose}
                                onChange={(e) => updateLine(line.key, { loose: Math.min(line.product.pack_size - 1, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchRef.current?.focus(); } }}
                                aria-label="Loose units"
                                title="Loose tablets/units"
                              />
                            </>
                          )}
                        </div>
                        {over && <p className="mt-1 text-xs font-semibold adm-text-red">Only {qtyLabel(batch.stock_units, line.product.pack_size)} in stock</p>}
                      </td>
                      <td className="num font-semibold">{money(units > 0 ? saleLine({ mrp: batch.mrp, packSize: line.product.pack_size, units, gstRate: line.product.gst_rate }, 0).amount : 0)}</td>
                      <td>
                        <span className="flex gap-1.5">
                          {line.product.composition && <button className="icon-button" onClick={() => setSubsFor({ product: line.product, lineKey: line.key })} aria-label={`Substitutes for ${line.product.name}`} title="Substitutes (same salt)"><ArrowLeftRight size={15} /></button>}
                          <button className="icon-button" onClick={() => removeLine(line.key)} aria-label={`Remove ${line.product.name}`}><Trash2 size={15} /></button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {held.length > 0 && (
          <div className="mt-4">
            <p className="adm-label">Held bills</p>
            <div className="flex flex-wrap gap-2">
              {held.map((h) => (
                <button key={h.id} className="button button-small button-light" onClick={() => resumeBill(h)}>
                  <PauseCircle size={15} /> {h.customer?.name || h.patient || "Customer"} · {h.lines.length} items
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4">
        <CustomerCard customer={customer} onPick={(c) => { setCustomer(c); setPatient(""); setPhone(""); }} onClear={() => setCustomer(null)} onRepeat={repeatLastBill}
          patient={patient} phone={phone} doctor={doctor} setPatient={setPatient} setPhone={setPhone} setDoctor={setDoctor} />

        <div className="adm-card adm-card-pad grid gap-4">
          <div>
            <span className="adm-label">Payment</span>
            <div className="grid grid-cols-2 gap-2">
              {paymentModes.map((m) => (
                <button key={m.value} type="button" className="adm-mode-btn" aria-pressed={mode === m.value} onClick={() => setMode(m.value)}>{m.label}</button>
              ))}
            </div>
            {mode === "credit" && !customer && <p className="mt-2 text-xs adm-text-amber">Choose the customer above, or type a name and mobile, so the udhaar is recorded.</p>}
          </div>
          <Field label="Discount %">
            <input className="adm-input" type="number" min={0} max={100} step="0.5" value={discount} onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
          </Field>

          <dl className="grid gap-1.5 border-t border-[var(--line)] pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-[var(--ink-muted)]">Items total (MRP)</dt><dd className="tabular-nums">{money(totals.gross)}</dd></div>
            {totals.discount > 0 && <div className="flex justify-between"><dt className="text-[var(--ink-muted)]">Discount</dt><dd className="tabular-nums">− {money(totals.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-[var(--ink-muted)]">GST included</dt><dd className="tabular-nums">{money(totals.gst)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--ink-muted)]">Round off</dt><dd className="tabular-nums">{totals.roundOff >= 0 ? "+" : "−"} {money(Math.abs(totals.roundOff))}</dd></div>
            <div className="mt-2 flex items-end justify-between border-t border-[var(--line)] pt-3">
              <dt className="font-semibold">To collect</dt>
              <dd className="text-3xl font-bold tracking-[-0.02em] text-[var(--brand-blue-deeper)] tabular-nums">{money(totals.net)}</dd>
            </div>
          </dl>

          {pinNeeded && (
            <Field label="Staff PIN">
              <input id="staff-pin" className="adm-input text-center tracking-[0.4em]" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") save(); }} autoComplete="off" />
            </Field>
          )}

          <button className="button button-dark button-xl button-block" onClick={save} disabled={saving}>
            <Printer size={19} /> {saving ? "Saving…" : printAfterSave ? "Save & Print (F10)" : "Save Bill (F10)"}
          </button>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]"><input type="checkbox" checked={printAfterSave} onChange={(e) => setPrintAfterSave(e.target.checked)} /> Print after saving</label>
            <button className="text-sm font-semibold text-[var(--brand-blue-strong)] disabled:opacity-40" onClick={holdBill} disabled={lines.length === 0}>Hold bill</button>
          </div>
          {lines.length > 0 && <button className="button button-small button-danger" onClick={() => { if (confirm("Clear this bill?")) resetBill(); }}>Clear bill</button>}
        </div>
      </aside>

      {subsFor && <SubstitutesModal original={subsFor.product} onClose={() => setSubsFor(null)} onPick={(pick) => applySubstitute(subsFor, pick)} />}
      {returnOpen && (
        <Modal title="Sales return" wide onClose={() => setReturnOpen(false)}>
          <ReturnsScreen embedded />
        </Modal>
      )}
    </div>
  );
}

function CustomerCard({ customer, onPick, onClear, onRepeat, patient, phone, doctor, setPatient, setPhone, setDoctor }: {
  customer: CustomerBalance | null; onPick: (c: CustomerBalance) => void; onClear: () => void; onRepeat: () => void;
  patient: string; phone: string; doctor: string; setPatient: (v: string) => void; setPhone: (v: string) => void; setDoctor: (v: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: CustomerBalance[] }>({ q: "", items: [] });
  const [active, setActive] = useState(0);

  useEffect(() => {
    const q = query.replace(/[,()%*\\]/g, " ").trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      const { data } = await db().from("customer_balances").select("*").or(`name.ilike.%${q}%,phone.ilike.%${q}%`).order("name").limit(6);
      setFound({ q, items: (data ?? []) as CustomerBalance[] });
      setActive(0);
    }, 160);
    return () => clearTimeout(timer);
  }, [query]);

  const q = query.replace(/[,()%*\\]/g, " ").trim();
  const matches = found.q === q ? found.items : [];
  const pick = (c: CustomerBalance) => { onPick(c); setQuery(""); };
  const applyTyped = () => { if (/^\d[\d\s+-]{5,}$/.test(q)) setPhone(q); else setPatient(q); setQuery(""); };

  if (customer) {
    return (
      <div className="adm-card adm-card-pad">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold"><UserRound size={16} /> {customer.name}</p>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{customer.phone || "No mobile"}{customer.bills ? ` · ${customer.bills} earlier bills` : ""}</p>
          </div>
          <button className="icon-button h-8 w-8" onClick={onClear} aria-label="Remove customer"><X size={15} /></button>
        </div>
        {Number(customer.balance) > 0 && <p className="mt-3 rounded-lg px-3 py-2 text-sm adm-badge-amber">Udhaar due: <b className="tabular-nums">{money(customer.balance)}</b></p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {customer.bills > 0 && <button className="button button-small button-light" onClick={onRepeat}><History size={14} /> Repeat last bill</button>}
        </div>
        <div className="mt-3"><Field label="Doctor (optional)"><input className="adm-input" value={doctor} onChange={(e) => setDoctor(e.target.value)} /></Field></div>
      </div>
    );
  }

  return (
    <div className="adm-card adm-card-pad grid gap-3">
      <div className="relative">
        <Field label="Customer (mobile or name)">
          <input className="adm-input" placeholder="Search regular customers…" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (matches[active]) pick(matches[active]); else if (q.length >= 2) applyTyped(); }
            }} autoComplete="off" />
        </Field>
        {q.length >= 2 && (
          <div className="adm-search-results">
            {matches.map((c, i) => (
              <button key={c.id} type="button" className="adm-search-item" data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => pick(c)}>
                <span className="min-w-0 flex-1"><b className="block truncate">{c.name}</b><span className="text-xs text-[var(--ink-muted)]">{c.phone || "no mobile"}</span></span>
                {Number(c.balance) > 0 && <span className="adm-badge adm-badge-amber">owes {money(c.balance)}</span>}
              </button>
            ))}
            {found.q === q && <button type="button" className="adm-search-item text-sm font-semibold text-[var(--brand-blue-strong)]" onClick={applyTyped}>Use “{q}” as a new customer</button>}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input className="adm-input" value={patient} onChange={(e) => setPatient(e.target.value)} /></Field>
        <Field label="Mobile"><input className="adm-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Doctor (optional)"><input className="adm-input" value={doctor} onChange={(e) => setDoctor(e.target.value)} /></Field>
      <p className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]"><Stethoscope size={13} /> All optional for cash bills. A mobile number links the bill to the customer.</p>
    </div>
  );
}

function SubstitutesModal({ original, onClose, onPick }: { original: Product; onClose: () => void; onPick: (r: Result) => void }) {
  const [rows, setRows] = useState<Result[] | null>(null);
  const [originalMrp, setOriginalMrp] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const subs = await substitutesFor(original);
      const batches = await sellableBatches([original.id, ...subs.map((s) => s.id)]);
      const own = batches.find((b) => b.product_id === original.id);
      setOriginalMrp(own ? own.mrp / original.pack_size : null);
      setRows(subs.map((product) => ({ product, batches: batches.filter((b) => b.product_id === product.id) }))
        .sort((a, b) => Number(b.batches.length > 0) - Number(a.batches.length > 0) || (a.batches[0]?.mrp ?? 0) / a.product.pack_size - (b.batches[0]?.mrp ?? 0) / b.product.pack_size));
    })();
  }, [original]);

  return (
    <Modal title={`Substitutes for ${original.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-[var(--ink-muted)]">Same salt: <b className="text-[var(--brand-dark)]">{original.composition}</b>. Confirm with the customer or doctor before changing the brand.</p>
      {rows === null ? <p className="py-6 text-center text-sm text-[var(--ink-muted)]">Looking for substitutes…</p> : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--ink-muted)]">No other medicine with this salt is in the system. Add the salt to other medicines in Medicines &amp; Stock to see them here.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => {
            const stock = r.batches.reduce((s, b) => s + b.stock_units, 0);
            const perUnit = r.batches[0] ? r.batches[0].mrp / r.product.pack_size : null;
            const diff = perUnit !== null && originalMrp !== null ? (perUnit - originalMrp) * r.product.pack_size : null;
            return (
              <li key={r.product.id}>
                <button className="adm-card flex w-full items-center gap-3 p-3 text-left transition hover:border-[var(--brand-blue)] disabled:opacity-50" disabled={stock === 0} onClick={() => onPick(r)}>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{r.product.name}</b>
                    <span className="text-xs text-[var(--ink-muted)]">{r.product.packing} · {r.product.company} · {stock ? `stock ${qtyLabel(stock, r.product.pack_size)}` : "out of stock"}</span>
                  </span>
                  {r.batches[0] && (
                    <span className="text-right text-sm">
                      <b className="block tabular-nums">{money(r.batches[0].mrp)}</b>
                      {diff !== null && Math.abs(diff) >= 0.01 && <span className={`text-xs ${diff < 0 ? "adm-text-green" : "text-[var(--ink-muted)]"}`}>{diff < 0 ? `${money(-diff)} cheaper` : `${money(diff)} more`} per pack</span>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
