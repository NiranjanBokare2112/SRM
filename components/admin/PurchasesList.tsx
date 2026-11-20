"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { billNumber, dateLabel, expiryLabel, firstOfMonth, istToday, money } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { errorMessage } from "@/lib/billing/types";
import { Alert, Empty, Loading, PageHeader } from "@/components/admin/ui";
import { DateRangeField } from "@/components/admin/controls";
import { useToast } from "@/components/admin/toast";

type Row = { id: string; fy: string; entry_no: number; bill_date: string; supplier_bill_no: string; payment_mode: string; taxable: number; gst: number; net: number; suppliers: { name: string } | null };
type ItemRow = { id: string; product_name: string; batch_no: string; expiry: string; mrp: number; rate: number; qty: number; free_qty: number; amount: number };

export function PurchasesList({ saved }: { saved?: string }) {
  const toast = useToast();
  const shownSaved = useRef(false);
  useEffect(() => {
    if (!saved || shownSaved.current) return;
    shownSaved.current = true;
    toast.success(`Purchase ${saved} saved`, { detail: "Stock has been updated." });
  }, [saved, toast]);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(istToday());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRows(null);
      const { data, error: e } = await db().from("purchases").select("id, fy, entry_no, bill_date, supplier_bill_no, payment_mode, taxable, gst, net, suppliers(name)")
        .gte("bill_date", from).lte("bill_date", to).order("bill_date", { ascending: false }).order("entry_no", { ascending: false });
      if (cancelled) return;
      if (e) { setError(errorMessage(e, "Could not load purchases.")); setRows([]); return; }
      setRows(data as unknown as Row[]);
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  async function toggle(id: string) {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setItems([]);
    const { data } = await db().from("purchase_items").select("id, product_name, batch_no, expiry, mrp, rate, qty, free_qty, amount").eq("purchase_id", id);
    setItems((data ?? []) as ItemRow[]);
  }

  const total = (rows ?? []).reduce((s, r) => s + Number(r.net), 0);

  return (
    <div>
      <PageHeader title="Purchases" description="Supplier bills entered into stock." actions={<Link className="button button-dark button-small" href="/admin/purchases/new"><Plus size={16} /> Enter purchase bill</Link>} />
      <div className="mb-4 flex">
        <DateRangeField from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>
      <Alert error={error} />
      <div className="adm-card overflow-hidden">
        {rows === null ? <Loading /> : rows.length === 0 ? <Empty title="No purchases in these dates" /> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th /><th>Entry</th><th>Date</th><th>Supplier</th><th>Their bill no</th><th>Payment</th><th className="num">GST</th><th className="num">Net</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer" onClick={() => toggle(r.id)}>
                      <td className="w-8">{open === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td>{billNumber(r.fy, r.entry_no)}</td>
                      <td>{dateLabel(r.bill_date)}</td>
                      <td className="font-semibold">{r.suppliers?.name}</td>
                      <td>{r.supplier_bill_no}</td>
                      <td><span className={r.payment_mode === "credit" ? "adm-badge adm-badge-amber" : "adm-badge adm-badge-green"}>{r.payment_mode === "credit" ? "Credit" : "Cash"}</span></td>
                      <td className="num">{money(r.gst)}</td>
                      <td className="num font-semibold">{money(r.net)}</td>
                    </tr>
                    {open === r.id && (
                      <tr><td /><td colSpan={7} className="adm-subrow">
                        <table className="adm-table">
                          <thead><tr><th>Medicine</th><th>Batch</th><th>Exp</th><th className="num">MRP</th><th className="num">Rate</th><th className="num">Qty + Free</th><th className="num">Amount</th></tr></thead>
                          <tbody>{items.map((i) => (
                            <tr key={i.id}><td>{i.product_name}</td><td>{i.batch_no}</td><td>{expiryLabel(i.expiry)}</td><td className="num">{money(i.mrp)}</td><td className="num">{money(i.rate)}</td><td className="num">{i.qty}{i.free_qty ? ` + ${i.free_qty}` : ""}</td><td className="num">{money(i.amount)}</td></tr>
                          ))}</tbody>
                        </table>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot><tr><td /><td colSpan={6} className="font-semibold">{rows.length} purchase bills</td><td className="num font-bold">{money(total)}</td></tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
