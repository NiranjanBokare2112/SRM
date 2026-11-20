"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dateLabel, firstOfMonth, istToday, money } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { errorMessage } from "@/lib/billing/types";
import { Alert, Loading, PageHeader, Stat } from "@/components/admin/ui";
import { DateRangeField } from "@/components/admin/controls";

type Summary = {
  bills: number; gross: number; discount: number; net: number; gst: number; taxable: number; cost: number;
  by_mode: Record<string, number>; returns: number; returns_taxable: number; returns_cost: number; purchases: number;
};
type GstRow = { gst_rate: number; sales_taxable: number; sales_gst: number; purchase_taxable: number; purchase_gst: number };


export function ReportsScreen() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(istToday());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [gst, setGst] = useState<GstRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummary(null);
      const [s, g] = await Promise.all([
        db().rpc("sales_summary", { p_from: from, p_to: to }),
        db().rpc("gst_summary", { p_from: from, p_to: to }),
      ]);
      if (cancelled) return;
      if (s.error || g.error) { setError(errorMessage(s.error ?? g.error, "Could not load the report.")); return; }
      setError(""); setSummary(s.data as Summary); setGst((g.data ?? []) as GstRow[]);
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  const n = (v: number | undefined) => Number(v ?? 0);
  const salesAfterReturns = summary ? n(summary.net) - n(summary.returns) : 0;
  const profit = summary ? (n(summary.taxable) - n(summary.returns_taxable)) - (n(summary.cost) - n(summary.returns_cost)) : 0;
  const gstTotals = gst.reduce((t, r) => ({ st: t.st + n(r.sales_taxable), sg: t.sg + n(r.sales_gst), pt: t.pt + n(r.purchase_taxable), pg: t.pg + n(r.purchase_gst) }), { st: 0, sg: 0, pt: 0, pg: 0 });

  return (
    <div>
      <PageHeader title="Reports" description={`${dateLabel(from)} to ${dateLabel(to)}`} />
      <div className="mb-4 flex">
        <DateRangeField from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>
      <Alert error={error} />

      {!summary ? (!error && <Loading />) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Sales (after returns)" value={money(salesAfterReturns)} sub={`${summary.bills} bills · returns ${money(summary.returns)}`} tone="green" />
            <Stat label="Estimated profit" value={money(profit)} sub="Sales value without GST minus purchase cost" tone={profit >= 0 ? "green" : "red"} />
            <Stat label="Discount given" value={money(summary.discount)} />
            <Stat label="Purchases" value={money(summary.purchases)} sub="Supplier bills entered" />
          </div>

          <div className="mt-6 grid gap-6 2xl:grid-cols-2">
            <div className="adm-card overflow-hidden">
              <h2 className="border-b border-[var(--line)] px-5 py-3 font-semibold">Collection by payment mode</h2>
              <table className="adm-table">
                <tbody>
                  {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["credit", "Credit (udhaar)"]].map(([k, label]) => (
                    <tr key={k}><td>{label}</td><td className="num font-semibold">{money(summary.by_mode?.[k])}</td></tr>
                  ))}
                  <tr><td className="text-[var(--ink-muted)]">Refunds for returns</td><td className="num adm-text-amber">− {money(summary.returns)}</td></tr>
                </tbody>
                <tfoot><tr><td className="font-semibold">Total</td><td className="num font-bold">{money(salesAfterReturns)}</td></tr></tfoot>
              </table>
            </div>

            <div className="adm-card overflow-hidden">
              <h2 className="border-b border-[var(--line)] px-5 py-3 font-semibold">GST summary <span className="text-sm font-normal text-[var(--ink-muted)]">(for your CA / GSTR-3B)</span></h2>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>Rate</th><th className="num">Sales taxable</th><th className="num">Output GST</th><th className="num">Purchase taxable</th><th className="num">Input GST</th></tr></thead>
                  <tbody>
                    {gst.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[var(--ink-muted)]">No GST entries in these dates.</td></tr>}
                    {gst.map((r) => (
                      <tr key={r.gst_rate}>
                        <td>{n(r.gst_rate)}%</td>
                        <td className="num">{money(r.sales_taxable)}</td>
                        <td className="num">{money(r.sales_gst)}<span className="block text-xs text-[var(--ink-muted)]">CGST {money(n(r.sales_gst) / 2)} + SGST {money(n(r.sales_gst) / 2)}</span></td>
                        <td className="num">{money(r.purchase_taxable)}</td>
                        <td className="num">{money(r.purchase_gst)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td className="font-semibold">Total</td><td className="num font-semibold">{money(gstTotals.st)}</td><td className="num font-semibold">{money(gstTotals.sg)}</td><td className="num font-semibold">{money(gstTotals.pt)}</td><td className="num font-semibold">{money(gstTotals.pg)}</td></tr>
                    <tr><td colSpan={4} className="text-right font-semibold">GST payable (output − input)</td><td className="num font-bold">{money(gstTotals.sg - gstTotals.pg)}</td></tr>
                  </tfoot>
                </table>
              </div>
              <p className="px-5 py-3 text-xs text-[var(--ink-muted)]">Sales figures already subtract returns. Share this with your CA; the bill-wise list can be downloaded from Bills.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link className="adm-card adm-card-pad hover:border-[var(--brand-blue)]" href="/admin/products?filter=expiring"><b>Expiry report</b><p className="text-sm text-[var(--ink-muted)]">Batches expiring in the next 90 days</p></Link>
            <Link className="adm-card adm-card-pad hover:border-[var(--brand-blue)]" href="/admin/products?filter=low"><b>Re-order list</b><p className="text-sm text-[var(--ink-muted)]">Medicines below their low-stock level</p></Link>
            <Link className="adm-card adm-card-pad hover:border-[var(--brand-blue)]" href="/admin/suppliers"><b>Supplier dues</b><p className="text-sm text-[var(--ink-muted)]">How much you owe each supplier</p></Link>
          </div>
        </>
      )}
    </div>
  );
}
