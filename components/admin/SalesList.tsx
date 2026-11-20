"use client";

import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { billNumber, dateLabel, istToday, money, timeLabel } from "@/lib/billing/format";
import { db, printSale } from "@/lib/billing/queries";
import { errorMessage, modeLabel, paymentModes, type Sale } from "@/lib/billing/types";
import { Alert, Empty, Field, Loading, Modal, PageHeader } from "@/components/admin/ui";
import { SaleDetail } from "@/components/admin/SaleDetail";
import { DateRangeField, Select } from "@/components/admin/controls";

export function SalesList() {
  const [from, setFrom] = useState(istToday());
  const [to, setTo] = useState(istToday());
  const [mode, setMode] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Sale[] | null>(null);
  const [error, setError] = useState("");
  const [openBill, setOpenBill] = useState<Sale | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRows(null);
      let q = db().from("sales_public").select("*").gte("bill_date", from).lte("bill_date", to).order("created_at", { ascending: false }).limit(1000);
      if (mode) q = q.eq("payment_mode", mode);
      const { data, error: e } = await q;
      if (cancelled) return;
      if (e) { setError(errorMessage(e, "Could not load bills.")); setRows([]); return; }
      setError(""); setRows(data as Sale[]);
    })();
    return () => { cancelled = true; };
  }, [from, to, mode, version]);

  const term = search.trim().toLowerCase();
  const visible = (rows ?? []).filter((s) => !term || String(s.bill_no) === term.replace(/^0+/, "") || billNumber(s.fy, s.bill_no).includes(term) || s.patient_name.toLowerCase().includes(term) || s.patient_phone.includes(term));
  const total = visible.reduce((sum, s) => sum + Number(s.net), 0);

  function downloadCsv() {
    const header = ["Bill No", "Date", "Customer", "Phone", "Doctor", "Payment", "Staff", "Gross", "Discount", "Taxable", "GST", "Round off", "Net", "Returned"];
    const lines = visible.map((s) => [billNumber(s.fy, s.bill_no), dateLabel(s.bill_date), s.patient_name, s.patient_phone, s.doctor_name, s.payment_mode, s.staff_name, s.gross, s.discount, s.taxable, s.gst, s.round_off, s.net, s.returned_amount]);
    const csv = [header, ...lines].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `bills-${from}-to-${to}.csv` });
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Bills" description="Every sales bill, with reprint and return." actions={<button className="button button-light button-small" onClick={downloadCsv} disabled={!visible.length}><Download size={15} /> Download for CA (CSV)</button>} />
      <div className="adm-card adm-card-pad mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_12rem_1fr] lg:items-end">
        <DateRangeField label="Dates" from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <Field label="Payment">
          <Select value={mode} onChange={setMode} ariaLabel="Payment" options={[{ value: "", label: "All payments" }, ...paymentModes.map((m) => ({ value: m.value as string, label: m.label }))]} />
        </Field>
        <Field label="Search"><input className="adm-input" placeholder="Bill no, name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
      </div>
      <Alert error={error} />
      <div className="adm-card overflow-hidden">
        {rows === null ? <Loading /> : visible.length === 0 ? <Empty title="No bills for these dates" /> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th>Payment</th><th>Billed by</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => setOpenBill(s)}>
                    <td><button className="font-semibold text-[var(--brand-blue-strong)] hover:underline" onClick={(e) => { e.stopPropagation(); setOpenBill(s); }}>{billNumber(s.fy, s.bill_no)}</button></td>
                    <td className="whitespace-nowrap">{dateLabel(s.bill_date)} <span className="text-[var(--ink-muted)]">{timeLabel(s.created_at)}</span></td>
                    <td>{s.patient_name || "—"}{s.patient_phone && <span className="block text-xs text-[var(--ink-muted)]">{s.patient_phone}</span>}</td>
                    <td>{modeLabel(s.payment_mode)}</td>
                    <td>{s.staff_name}</td>
                    <td className="num font-semibold">{money(s.net)}{Number(s.returned_amount) > 0 && <span className="block text-xs font-normal adm-text-amber">returned {money(s.returned_amount)}</span>}</td>
                    <td><button className="icon-button" onClick={(e) => { e.stopPropagation(); printSale(s.id); }} aria-label={`Print bill ${s.bill_no}`}><Printer size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5} className="font-semibold">{visible.length} bills</td><td className="num font-bold">{money(total)}</td><td /></tr></tfoot>
            </table>
          </div>
        )}
      </div>
      {openBill && (
        <Modal title={`Bill ${billNumber(openBill.fy, openBill.bill_no)}`} wide onClose={() => setOpenBill(null)}>
          <SaleDetail id={openBill.id} embedded onChanged={() => setVersion((v) => v + 1)} />
        </Modal>
      )}
    </div>
  );
}
