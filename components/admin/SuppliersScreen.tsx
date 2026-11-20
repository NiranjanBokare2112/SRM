"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, IndianRupee, Pencil, Plus } from "lucide-react";
import { billNumber, dateLabel, istToday, money } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { errorMessage, type Supplier } from "@/lib/billing/types";
import { Alert, Empty, Field, Loading, Modal, PageHeader } from "@/components/admin/ui";
import { DateField, Select } from "@/components/admin/controls";
import { useToast } from "@/components/admin/toast";
import { SupplierForm } from "@/components/admin/SupplierForm";

type Balance = { id: string; name: string; phone: string; balance: number };
type LedgerRow = { date: string; label: string; debit: number; credit: number };

export function SuppliersScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<Balance[] | null>(null);
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [paying, setPaying] = useState<Balance | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [error, setError] = useState("");

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await db().from("supplier_balances").select("*").order("name");
      if (cancelled) return;
      if (e) { setError(errorMessage(e, "Could not load suppliers.")); setRows([]); return; }
      setRows(data as Balance[]);
    })();
    return () => { cancelled = true; };
  }, [version]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const entries = await fetchLedger(open);
      if (!cancelled) setLedger(entries);
    })();
    return () => { cancelled = true; };
  }, [open, version]);

  function toggle(id: string) {
    setLedger([]);
    setOpen(open === id ? null : id);
  }

  async function edit(id: string) {
    const { data } = await db().from("suppliers").select("*").eq("id", id).single();
    if (data) setEditing(data as Supplier);
  }

  const totalDue = (rows ?? []).reduce((s, r) => s + Math.max(0, Number(r.balance)), 0);

  return (
    <div>
      <PageHeader title="Suppliers" description={`You owe suppliers ${money(totalDue)} in total.`} actions={<button className="button button-dark button-small" onClick={() => setEditing("new")}><Plus size={16} /> Add supplier</button>} />
      <Alert error={error} />
      <div className="adm-card overflow-hidden">
        {rows === null ? <Loading /> : rows.length === 0 ? <Empty title="No suppliers yet">Add the distributors you buy from.</Empty> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th /><th>Supplier</th><th>Phone</th><th className="num">You owe</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer" onClick={() => toggle(r.id)}>
                      <td className="w-8">{open === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td className="font-semibold">{r.name}</td>
                      <td>{r.phone || "—"}</td>
                      <td className={`num font-semibold ${Number(r.balance) > 0 ? "adm-text-amber" : ""}`}>{money(r.balance)}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex gap-2">
                          <button className="button button-light button-small" onClick={() => setPaying(r)}><IndianRupee size={14} /> Pay</button>
                          <button className="icon-button" onClick={() => edit(r.id)} aria-label={`Edit ${r.name}`}><Pencil size={15} /></button>
                        </span>
                      </td>
                    </tr>
                    {open === r.id && (
                      <tr><td /><td colSpan={4} className="adm-subrow">
                        {ledger.length === 0 ? <p className="py-2 text-sm text-[var(--ink-muted)]">No purchases or payments yet.</p> : (
                          <table className="adm-table">
                            <thead><tr><th>Date</th><th>Details</th><th className="num">Bill (owed)</th><th className="num">Paid</th></tr></thead>
                            <tbody>{ledger.map((l, i) => (
                              <tr key={i}><td>{l.date ? dateLabel(l.date) : "—"}</td><td>{l.label}</td><td className="num">{l.debit ? money(l.debit) : ""}</td><td className="num">{l.credit ? money(l.credit) : ""}</td></tr>
                            ))}</tbody>
                          </table>
                        )}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <SupplierForm supplier={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={(s) => { setEditing(null); load(); toast.success(`${s.name} saved`); }} />}
      {paying && <PaymentForm supplier={paying} onClose={() => setPaying(null)} onSaved={(amt) => { const s = paying; setPaying(null); toast.success(`Paid ${money(amt)} to ${s.name}`); load(); }} />}
    </div>
  );
}

async function fetchLedger(id: string): Promise<LedgerRow[]> {
  const [sup, pur, pay] = await Promise.all([
    db().from("suppliers").select("opening_balance").eq("id", id).single(),
    db().from("purchases").select("fy, entry_no, bill_date, supplier_bill_no, payment_mode, net").eq("supplier_id", id).order("bill_date", { ascending: false }).limit(50),
    db().from("supplier_payments").select("payment_date, amount, mode, note").eq("supplier_id", id).order("payment_date", { ascending: false }).limit(50),
  ]);
  const entries: LedgerRow[] = [
    ...(pur.data ?? []).map((p) => ({ date: p.bill_date, label: `Purchase ${billNumber(p.fy, p.entry_no)} (their bill ${p.supplier_bill_no})${p.payment_mode === "cash" ? " · paid in cash" : ""}`, debit: p.payment_mode === "credit" ? Number(p.net) : 0, credit: 0 })),
    ...(pay.data ?? []).map((p) => ({ date: p.payment_date, label: `Payment by ${p.mode.toUpperCase()}${p.note ? " · " + p.note : ""}`, debit: 0, credit: Number(p.amount) })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const opening = Number(sup.data?.opening_balance ?? 0);
  if (opening) entries.push({ date: "", label: "Opening balance", debit: opening, credit: 0 });
  return entries;
}

function PaymentForm({ supplier, onClose, onSaved }: { supplier: Balance; onClose: () => void; onSaved: (amount: number) => void }) {
  const [amount, setAmount] = useState(Number(supplier.balance) > 0 ? String(supplier.balance) : "");
  const [mode, setMode] = useState("cash");
  const [date, setDate] = useState(istToday());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    const { error: e } = await db().rpc("record_supplier_payment", { p_supplier_id: supplier.id, p_amount: Number(amount), p_mode: mode, p_note: note, p_date: date });
    setSaving(false);
    if (e) { setError(errorMessage(e, "Could not save the payment.")); return; }
    onSaved(Number(amount));
  }

  return (
    <Modal title={`Pay ${supplier.name}`} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm">Currently owed: <b>{money(supplier.balance)}</b></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)"><input className="adm-input" type="number" step="0.01" min={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label="Date"><DateField value={date} max={istToday()} onChange={setDate} ariaLabel="Payment date" /></Field>
        </div>
        <Field label="Paid by">
          <Select value={mode} onChange={setMode} ariaLabel="Paid by" options={[
            { value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "cheque", label: "Cheque" }, { value: "bank", label: "Bank transfer" },
          ]} />
        </Field>
        <Field label="Note (optional)"><input className="adm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cheque no, bill numbers…" /></Field>
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save payment"}</button>
        </div>
      </form>
    </Modal>
  );
}
