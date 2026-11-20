"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, IndianRupee, Pencil, Plus } from "lucide-react";
import { billNumber, dateLabel, istToday, money } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { errorMessage, modeLabel } from "@/lib/billing/types";
import { Alert, Empty, Field, Loading, Modal, PageHeader } from "@/components/admin/ui";
import { DateField } from "@/components/admin/controls";
import { useToast } from "@/components/admin/toast";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export type CustomerBalance = { id: string; name: string; phone: string; address: string; opening_balance: number; balance: number; last_bill_at: string | null; bills: number };
type LedgerRow = { date: string; label: string; href?: string; owed: number; paid: number };

const reminderLink = (c: CustomerBalance, shopName = "Shreeram Medical") =>
  `https://wa.me/91${c.phone}?text=${encodeURIComponent(`Namaste ${c.name}, your pending amount at ${shopName} is ${money(c.balance)}. Please pay at your convenience. Thank you.`)}`;

export function CustomersScreen({ initialQuery = "" }: { initialQuery?: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<CustomerBalance[] | null>(null);
  const [search, setSearch] = useState(initialQuery);
  const [onlyOwing, setOnlyOwing] = useState(!initialQuery);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [editing, setEditing] = useState<CustomerBalance | "new" | null>(null);
  const [collecting, setCollecting] = useState<CustomerBalance | null>(null);
  const [error, setError] = useState("");
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await db().from("customer_balances").select("*").order("name").limit(5000);
      if (cancelled) return;
      if (e) { setError(errorMessage(e, "Could not load customers.")); setRows([]); return; }
      setRows(data as CustomerBalance[]);
    })();
    return () => { cancelled = true; };
  }, [version]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const entries = await fetchLedger(open, rows?.find((r) => r.id === open)?.opening_balance ?? 0);
      if (!cancelled) setLedger(entries);
    })();
    return () => { cancelled = true; };
  }, [open, version, rows]);

  const term = search.trim().toLowerCase();
  const visible = (rows ?? []).filter((r) => (!onlyOwing || Number(r.balance) > 0) && (!term || r.name.toLowerCase().includes(term) || r.phone.includes(term)))
    .sort((a, b) => (onlyOwing ? Number(b.balance) - Number(a.balance) : a.name.localeCompare(b.name)));
  const totalOwed = (rows ?? []).reduce((s, r) => s + Math.max(0, Number(r.balance)), 0);

  return (
    <div>
      <PageHeader title="Customers & Udhaar" description={`Customers owe ${money(totalOwed)} in total.`}
        actions={<button className="button button-dark button-small" onClick={() => setEditing("new")}><Plus size={16} /> Add customer</button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input className="adm-input sm:max-w-sm" placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2">
          <button className="adm-mode-btn flex-none px-4" aria-pressed={onlyOwing} onClick={() => setOnlyOwing(true)}>Owes money</button>
          <button className="adm-mode-btn flex-none px-4" aria-pressed={!onlyOwing} onClick={() => setOnlyOwing(false)}>All customers</button>
        </div>
      </div>
      <Alert error={error} />

      <div className="adm-card overflow-hidden">
        {rows === null ? <Loading /> : visible.length === 0 ? (
          <Empty title={onlyOwing && !term ? "Nobody owes money right now" : "No customers found"}>Customers are added automatically when you enter a mobile number on a bill, or when you give udhaar.</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th /><th>Customer</th><th>Mobile</th><th>Last bill</th><th className="num">Owes</th><th /></tr></thead>
              <tbody>
                {visible.map((c) => (
                  <Fragment key={c.id}>
                    <tr className="cursor-pointer" onClick={() => { setLedger([]); setOpen(open === c.id ? null : c.id); }}>
                      <td className="w-8">{open === c.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td className="font-semibold">{c.name}{c.address && <span className="block text-xs font-normal text-[var(--ink-muted)]">{c.address}</span>}</td>
                      <td>{c.phone || "—"}</td>
                      <td>{c.last_bill_at ? dateLabel(c.last_bill_at.slice(0, 10)) : "—"}</td>
                      <td className={`num font-semibold ${Number(c.balance) > 0 ? "adm-text-amber" : ""}`}>{money(c.balance)}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex gap-2">
                          {Number(c.balance) > 0 && <button className="button button-small button-light" onClick={() => setCollecting(c)}><IndianRupee size={14} /> Collect</button>}
                          {Number(c.balance) > 0 && c.phone && (
                            <a className="button button-small button-whatsapp" href={reminderLink(c)} target="_blank" rel="noreferrer" title="Send a WhatsApp reminder"><WhatsAppIcon size={14} /> Remind</a>
                          )}
                          <button className="icon-button" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil size={15} /></button>
                        </span>
                      </td>
                    </tr>
                    {open === c.id && (
                      <tr><td /><td colSpan={5} className="adm-subrow">
                        {ledger.length === 0 ? <p className="py-2 text-sm text-[var(--ink-muted)]">No udhaar or payments yet.</p> : (
                          <table className="adm-table">
                            <thead><tr><th>Date</th><th>Details</th><th className="num">Udhaar</th><th className="num">Paid / returned</th></tr></thead>
                            <tbody>{ledger.map((l, i) => (
                              <tr key={i}>
                                <td>{l.date ? dateLabel(l.date) : "—"}</td>
                                <td>{l.href ? <Link className="text-[var(--brand-blue-strong)]" href={l.href}>{l.label}</Link> : l.label}</td>
                                <td className="num">{l.owed ? money(l.owed) : ""}</td>
                                <td className="num">{l.paid ? money(l.paid) : ""}</td>
                              </tr>
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

      {editing && <CustomerForm customer={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={(name) => { setEditing(null); reload(); toast.success(`${name} saved`); }} />}
      {collecting && <CollectForm customer={collecting} onClose={() => setCollecting(null)}
        onSaved={(amount) => { const c = collecting; setCollecting(null); reload(); toast.success(`Received ${money(amount)} from ${c.name}`, { detail: `Remaining udhaar ${money(Math.max(0, Number(c.balance) - amount))}` }); }} />}
    </div>
  );
}

async function fetchLedger(customerId: string, opening: number): Promise<LedgerRow[]> {
  const [sales, payments] = await Promise.all([
    db().from("sales_public").select("id, fy, bill_no, bill_date, net, payment_mode").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(100),
    db().from("customer_payments").select("payment_date, amount, mode, note").eq("customer_id", customerId).order("payment_date", { ascending: false }).limit(100),
  ]);
  const bills = (sales.data ?? []) as { id: string; fy: string; bill_no: number; bill_date: string; net: number; payment_mode: string }[];
  const credit = bills.filter((b) => b.payment_mode === "credit");
  const returns = credit.length
    ? ((await db().from("sales_returns_public").select("fy, return_no, return_date, amount, refund_mode, sale_id").in("sale_id", credit.map((b) => b.id))).data ?? []) as { fy: string; return_no: number; return_date: string; amount: number; refund_mode: string }[]
    : [];
  const rows: LedgerRow[] = [
    ...credit.map((b) => ({ date: b.bill_date, label: `Bill ${billNumber(b.fy, b.bill_no)} on udhaar`, href: `/admin/sales/${b.id}`, owed: Number(b.net), paid: 0 })),
    ...returns.filter((r) => r.refund_mode === "credit").map((r) => ({ date: r.return_date, label: `Return ${billNumber(r.fy, r.return_no)} (reduced udhaar)`, owed: 0, paid: Number(r.amount) })),
    ...((payments.data ?? []) as { payment_date: string; amount: number; mode: string; note: string }[]).map((p) => ({ date: p.payment_date, label: `Paid by ${modeLabel(p.mode)}${p.note ? " · " + p.note : ""}`, owed: 0, paid: Number(p.amount) })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  if (Number(opening)) rows.push({ date: "", label: "Opening balance", owed: Number(opening), paid: 0 });
  return rows;
}

function CustomerForm({ customer, onClose, onSaved }: { customer?: CustomerBalance; onClose: () => void; onSaved: (name: string) => void }) {
  const [form, setForm] = useState({ name: customer?.name ?? "", phone: customer?.phone ?? "", address: customer?.address ?? "", opening_balance: String(customer?.opening_balance ?? 0) });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const phone = form.phone.replace(/\D/g, "").slice(-10);
    if (!form.name.trim()) { setError("Enter the customer name."); return; }
    if (phone && phone.length !== 10) { setError("Enter a 10-digit mobile number."); return; }
    setSaving(true); setError("");
    const row = { name: form.name.trim(), phone, address: form.address.trim(), opening_balance: Number(form.opening_balance) || 0 };
    const result = customer
      ? await db().from("customers").update(row).eq("id", customer.id).select("id").single()
      : await db().from("customers").insert(row).select("id").single();
    setSaving(false);
    if (result.error) { setError(result.error.code === "23505" ? "Another customer already has this mobile number." : errorMessage(result.error, "Could not save the customer.")); return; }
    onSaved(row.name);
  }

  return (
    <Modal title={customer ? "Edit customer" : "Add customer"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Name"><input className="adm-input" value={form.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobile (10 digits)"><input className="adm-input" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Village / address"><input className="adm-input" value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        </div>
        <Field label="Old udhaar from before this software (₹)"><input className="adm-input" type="number" step="0.01" value={form.opening_balance} onChange={(e) => set({ opening_balance: e.target.value })} /></Field>
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save customer"}</button>
        </div>
      </form>
    </Modal>
  );
}

function CollectForm({ customer, onClose, onSaved }: { customer: CustomerBalance; onClose: () => void; onSaved: (amount: number) => void }) {
  const [amount, setAmount] = useState(String(customer.balance));
  const [mode, setMode] = useState<"cash" | "upi" | "card">("cash");
  const [date, setDate] = useState(istToday());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (Number(amount) > Number(customer.balance) && !confirm(`${money(amount)} is more than the ${money(customer.balance)} owed. Save it anyway as advance?`)) return;
    setSaving(true); setError("");
    const { error: e } = await db().rpc("record_customer_payment", { p_customer_id: customer.id, p_amount: Number(amount), p_mode: mode, p_note: note, p_date: date });
    setSaving(false);
    if (e) { setError(errorMessage(e, "Could not save the payment.")); return; }
    onSaved(Number(amount));
  }

  return (
    <Modal title={`Collect udhaar · ${customer.name}`} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm">Owes <b>{money(customer.balance)}</b></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received (₹)"><input className="adm-input" type="number" step="0.01" min={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label="Date"><DateField value={date} max={istToday()} onChange={setDate} ariaLabel="Payment date" /></Field>
        </div>
        <div>
          <span className="adm-label">Received by</span>
          <div className="flex gap-2">
            {(["cash", "upi", "card"] as const).map((m) => <button key={m} type="button" className="adm-mode-btn" aria-pressed={mode === m} onClick={() => setMode(m)}>{modeLabel(m)}</button>)}
          </div>
        </div>
        <Field label="Note (optional)"><input className="adm-input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save payment"}</button>
        </div>
      </form>
    </Modal>
  );
}
