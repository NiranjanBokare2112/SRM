"use client";

import { useState, type FormEvent } from "react";
import { db } from "@/lib/billing/queries";
import { errorMessage, type Supplier } from "@/lib/billing/types";
import { Alert, Field, Modal } from "@/components/admin/ui";

export function SupplierForm({ supplier, onClose, onSaved }: { supplier?: Supplier; onClose: () => void; onSaved: (s: Supplier) => void }) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "", phone: supplier?.phone ?? "", gstin: supplier?.gstin ?? "",
    address: supplier?.address ?? "", opening_balance: String(supplier?.opening_balance ?? 0),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) { setError("Enter the supplier name."); return; }
    setSaving(true); setError("");
    const row = { name: form.name.trim(), phone: form.phone.trim(), gstin: form.gstin.trim().toUpperCase(), address: form.address.trim(), opening_balance: Number(form.opening_balance) || 0 };
    const result = supplier
      ? await db().from("suppliers").update(row).eq("id", supplier.id).select("*").single()
      : await db().from("suppliers").insert(row).select("*").single();
    setSaving(false);
    if (result.error) { setError(result.error.code === "23505" ? "A supplier with this name already exists." : errorMessage(result.error, "Could not save the supplier.")); return; }
    onSaved(result.data as Supplier);
  }

  return (
    <Modal title={supplier ? "Edit supplier" : "Add supplier"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Supplier / distributor name"><input className="adm-input" value={form.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone"><input className="adm-input" value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="GSTIN"><input className="adm-input uppercase" value={form.gstin} onChange={(e) => set({ gstin: e.target.value })} /></Field>
        </div>
        <Field label="Address"><input className="adm-input" value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field label="Opening balance (₹ you already owe them)"><input className="adm-input" type="number" step="0.01" value={form.opening_balance} onChange={(e) => set({ opening_balance: e.target.value })} /></Field>
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save supplier"}</button>
        </div>
      </form>
    </Modal>
  );
}
