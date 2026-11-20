"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Plus, UserMinus } from "lucide-react";
import { dateLabel } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { errorMessage } from "@/lib/billing/types";
import { Alert, Field, Modal } from "@/components/admin/ui";
import { useToast } from "@/components/admin/toast";

type Operator = { user_id: string; name: string; email: string; created_at: string };

/** Owner-only: counter staff logins that can bill but cannot see costs, profit, purchases or settings. */
export function OperatorsCard() {
  const toast = useToast();
  const [rows, setRows] = useState<Operator[]>([]);
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<Operator | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await db().from("operator_list").select("*").order("name");
      if (!cancelled) setRows((data ?? []) as Operator[]);
    })();
    return () => { cancelled = true; };
  }, [version]);

  async function remove(op: Operator) {
    if (!confirm(`Remove ${op.name}'s access? They will no longer be able to sign in to billing.`)) return;
    const { error } = await db().rpc("remove_operator", { p_user_id: op.user_id });
    if (error) { toast.error("Could not remove the operator", errorMessage(error)); return; }
    toast.success(`${op.name} removed`);
    setVersion((v) => v + 1);
  }

  return (
    <div className="adm-card adm-card-pad mt-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Operators (counter logins)</h2>
        <button className="button button-light button-small" onClick={() => setAdding(true)}><Plus size={15} /> Add operator</button>
      </div>
      <p className="mb-4 text-sm text-[var(--ink-muted)]">Operators can only use the New Bill screen: make bills, print them, take returns (F7) and pick customers. Every other page is owner-only. Bills still ask for the staff PIN.</p>
      {rows.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No operators yet.</p> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Login email</th><th>Added</th><th /></tr></thead>
            <tbody>
              {rows.map((op) => (
                <tr key={op.user_id}>
                  <td className="font-semibold">{op.name}</td>
                  <td>{op.email}</td>
                  <td>{dateLabel(op.created_at.slice(0, 10))}</td>
                  <td className="text-right">
                    <span className="inline-flex gap-2">
                      <button className="button button-light button-small" onClick={() => setResetting(op)}><KeyRound size={14} /> Password</button>
                      <button className="button button-danger button-small" onClick={() => remove(op)}><UserMinus size={14} /> Remove</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding && <AddOperator onClose={() => setAdding(false)} onSaved={(name) => { setAdding(false); setVersion((v) => v + 1); toast.success(`${name} can now sign in`, { detail: "Share the email and password with them." }); }} />}
      {resetting && <ResetPassword op={resetting} onClose={() => setResetting(null)} onSaved={() => { const n = resetting.name; setResetting(null); toast.success(`Password changed for ${n}`); }} />}
    </div>
  );
}

function AddOperator({ onClose, onSaved }: { onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    const { error: e } = await db().rpc("create_operator", { p_email: email, p_password: password, p_name: name });
    setSaving(false);
    if (e) { setError(errorMessage(e, "Could not add the operator.")); return; }
    onSaved(name.trim());
  }

  return (
    <Modal title="Add operator" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Name"><input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Counter 2 or Ramesh" required /></Field>
        <Field label="Login email"><input className="adm-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required /></Field>
        <Field label="Password" hint="At least 8 characters"><input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required /></Field>
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Create login"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ op, onClose, onSaved }: { op: Operator; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    const { error: e } = await db().rpc("set_operator_password", { p_user_id: op.user_id, p_password: password });
    setSaving(false);
    if (e) { setError(errorMessage(e, "Could not change the password.")); return; }
    onSaved();
  }

  return (
    <Modal title={`New password for ${op.name}`} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="New password" hint="At least 8 characters"><input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required /></Field>
        <Alert error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="button button-light" onClick={onClose}>Cancel</button>
          <button className="button button-dark" disabled={saving}>{saving ? "Saving…" : "Change password"}</button>
        </div>
      </form>
    </Modal>
  );
}
