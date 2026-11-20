"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { db } from "@/lib/billing/queries";
import { resetDb } from "@/lib/demo/engine";
import { isDemoMode } from "@/lib/supabase/browser";
import { errorMessage, type ShopSettings, type Staff } from "@/lib/billing/types";
import { Alert, Field, Loading, Modal, PageHeader } from "@/components/admin/ui";
import { useToast } from "@/components/admin/toast";
import { OperatorsCard } from "@/components/admin/OperatorsCard";

export function SettingsScreen() {
  const toast = useToast();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [editingStaff, setEditingStaff] = useState<Staff | "new" | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [staffVersion, setStaffVersion] = useState(0);

  useEffect(() => {
    db().from("shop_settings").select("*").single().then(({ data, error: e }) => {
      if (e) setError(errorMessage(e, "Could not load settings.")); else setSettings(data as ShopSettings);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await db().from("staff").select("id, name, active").order("name");
      if (!cancelled) setStaff((data ?? []) as Staff[]);
    })();
    return () => { cancelled = true; };
  }, [staffVersion]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true); setError("");
    const { error: e } = await db().from("shop_settings").update({ ...settings, gstin: settings.gstin.trim().toUpperCase(), updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (e) setError(errorMessage(e, "Could not save settings.")); else toast.success("Settings saved", { detail: "New bills will use these details." });
  }

  if (!settings) return error ? <Alert error={error} /> : <Loading />;
  const set = (patch: Partial<ShopSettings>) => setSettings({ ...settings, ...patch });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Details printed on every bill, printer size and staff PINs." />
      <form className="adm-card adm-card-pad grid gap-4" onSubmit={save}>
        <h2 className="font-semibold">Shop details on the bill</h2>
        <Field label="Shop name"><input className="adm-input" value={settings.shop_name} onChange={(e) => set({ shop_name: e.target.value })} required /></Field>
        <Field label="Address"><textarea className="adm-input min-h-20" value={settings.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Phone"><input className="adm-input" value={settings.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="GSTIN"><input className="adm-input uppercase" value={settings.gstin} onChange={(e) => set({ gstin: e.target.value })} placeholder="27XXXXX…" /></Field>
          <Field label="Drug licence no(s)"><input className="adm-input" value={settings.drug_license} onChange={(e) => set({ drug_license: e.target.value })} placeholder="20B / 21B" /></Field>
        </div>
        <Field label="Message at the bottom of the bill"><input className="adm-input" value={settings.bill_footer} onChange={(e) => set({ bill_footer: e.target.value })} /></Field>

        <h2 className="mt-2 font-semibold">Printer</h2>
        <div className="flex gap-2">
          <button type="button" className="adm-mode-btn" aria-pressed={settings.print_format === "a5"} onClick={() => set({ print_format: "a5" })}>A5 / A4 sheet printer</button>
          <button type="button" className="adm-mode-btn" aria-pressed={settings.print_format === "thermal"} onClick={() => set({ print_format: "thermal" })}>80mm thermal (roll)</button>
        </div>
        <p className="text-xs text-[var(--ink-muted)]">Tip: in the print window, turn off “Headers and footers” and set margins to “None” once; the browser remembers it.</p>

        <h2 className="mt-2 font-semibold">Staff PIN on bills</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={settings.require_staff_pin} onChange={(e) => set({ require_staff_pin: e.target.checked })} />
          <span>Ask for a staff PIN when saving a bill, so every bill shows who made it. (Only applies once at least one staff member is added below.)</span>
        </label>

        <Alert error={error} />
        <div><button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button></div>
      </form>

      <div className="adm-card adm-card-pad mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Staff</h2>
          <button className="button button-light button-small" onClick={() => setEditingStaff("new")}><Plus size={15} /> Add staff</button>
        </div>
        {staff.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No staff added. Bills are saved as “Owner”.</p> : (
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Status</th><th /></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">{s.name}</td>
                  <td>{s.active ? <span className="adm-badge adm-badge-green">Active</span> : <span className="adm-badge adm-badge-gray">Removed</span>}</td>
                  <td className="text-right"><button className="button button-light button-small" onClick={() => setEditingStaff(s)}>Change</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <OperatorsCard />
      {isDemoMode && (
        <div className="adm-card adm-card-pad mt-6">
          <h2 className="font-semibold">Demo data</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Put all bills, stock and settings back to the original sample data.</p>
          <button className="button button-danger button-small mt-3" onClick={() => { if (confirm("Erase all demo changes and start again with the sample data?")) { resetDb(); window.location.reload(); } }}>Reset demo data</button>
        </div>
      )}
      {editingStaff && <StaffForm staff={editingStaff === "new" ? undefined : editingStaff} onClose={() => setEditingStaff(null)} onSaved={() => { setEditingStaff(null); setStaffVersion((v) => v + 1); toast.success("Staff saved"); }} />}
    </div>
  );
}

function StaffForm({ staff, onClose, onSaved }: { staff?: Staff; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(staff?.name ?? "");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(staff?.active ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    const { error: e } = await db().rpc("save_staff", { p_id: staff?.id ?? null, p_name: name, p_pin: pin ? pin : null, p_active: active });
    setSaving(false);
    if (e) { setError(errorMessage(e, "Could not save staff.")); return; }
    onSaved();
  }

  return (
    <Modal title={staff ? `Change ${staff.name}` : "Add staff"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Name"><input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label={staff ? "New PIN (leave empty to keep the old one)" : "PIN (4 to 6 digits)"}>
          <input className="adm-input tracking-[0.3em]" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required={!staff} autoComplete="new-password" />
        </Field>
        {staff && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (untick when this person leaves)</label>}
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
