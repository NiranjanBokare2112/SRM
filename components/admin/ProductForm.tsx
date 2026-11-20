"use client";

import { useState, type FormEvent } from "react";
import { db } from "@/lib/billing/queries";
import { errorMessage, gstRates, type Product } from "@/lib/billing/types";
import { Alert, Field, Modal } from "@/components/admin/ui";
import { Select } from "@/components/admin/controls";

const blank = { name: "", company: "", packing: "", pack_size: 1, hsn: "3004", gst_rate: 12, barcode: "", reorder_level: 0, composition: "" };

export function ProductForm({ product, initialName = "", onClose, onSaved }: { product?: Product; initialName?: string; onClose: () => void; onSaved: (p: Product) => void }) {
  const [form, setForm] = useState(product ? { ...product, barcode: product.barcode ?? "", composition: product.composition ?? "" } : { ...blank, name: initialName });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Enter the medicine name."); return; }
    setSaving(true);
    const row = {
      name: form.name.trim().toUpperCase(), company: form.company.trim(), packing: form.packing.trim().toUpperCase(),
      pack_size: Math.max(1, Math.floor(Number(form.pack_size) || 1)), hsn: form.hsn.trim(), gst_rate: Number(form.gst_rate),
      barcode: form.barcode.trim() || null, reorder_level: Math.max(0, Math.floor(Number(form.reorder_level) || 0)),
      composition: form.composition.trim().replace(/\s+/g, " "),
    };
    const columns = "id, name, company, packing, pack_size, hsn, gst_rate, barcode, reorder_level, active, composition";
    const result = product
      ? await db().from("products").update(row).eq("id", product.id).select(columns).single()
      : await db().from("products").insert(row).select(columns).single();
    setSaving(false);
    if (result.error) {
      setError(result.error.code === "23505" ? "A medicine with this name and packing (or barcode) already exists." : errorMessage(result.error, "Could not save the medicine."));
      return;
    }
    onSaved(result.data as Product);
  }

  return (
    <Modal title={product ? "Edit medicine" : "Add medicine"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Medicine name"><input className="adm-input uppercase" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. DOLO 650 TAB" required /></Field>
        <Field label="Salt / composition" hint="e.g. Paracetamol 650mg. Medicines with the same salt are offered as substitutes while billing.">
          <input className="adm-input" value={form.composition} onChange={(e) => set({ composition: e.target.value })} placeholder="Paracetamol 650mg" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Packing (as printed)" hint="e.g. 15 TAB, 100 ML, 30 GM"><input className="adm-input uppercase" value={form.packing} onChange={(e) => set({ packing: e.target.value })} /></Field>
          <Field label="Units in one pack" hint="Tablets per strip. Use 1 for bottles, tubes, etc."><input className="adm-input" type="number" min={1} value={form.pack_size} onChange={(e) => set({ pack_size: Number(e.target.value) })} /></Field>
          <Field label="Company"><input className="adm-input" value={form.company} onChange={(e) => set({ company: e.target.value })} /></Field>
          <Field label="GST %">
            <Select value={Number(form.gst_rate)} onChange={(v) => set({ gst_rate: v })} options={gstRates.map((r) => ({ value: r as number, label: `${r}%`, hint: r === 12 ? "Most medicines" : r === 5 ? "Some vet / nutrition items" : r === 18 ? "Cosmetics, some devices" : undefined }))} ariaLabel="GST %" />
          </Field>
          <Field label="HSN code"><input className="adm-input" value={form.hsn} onChange={(e) => set({ hsn: e.target.value })} /></Field>
          <Field label="Barcode (optional)"><input className="adm-input" value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} placeholder="Scan here" /></Field>
          <Field label="Low stock alert at (packs)" hint="0 = no alert"><input className="adm-input" type="number" min={0} value={form.reorder_level} onChange={(e) => set({ reorder_level: Number(e.target.value) })} /></Field>
        </div>
        {product && product.pack_size !== Number(form.pack_size) && <p className="adm-error">Changing units per pack changes how existing stock is counted. Only do this if it was entered wrongly and the medicine has no stock.</p>}
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save medicine"}</button>
        </div>
      </form>
    </Modal>
  );
}
