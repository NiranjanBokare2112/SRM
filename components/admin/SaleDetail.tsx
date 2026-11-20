"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, Printer, RotateCcw } from "lucide-react";
import { billNumber, dateLabel, expiryLabel, money, qtyLabel, timeLabel } from "@/lib/billing/format";
import { db, printSale } from "@/lib/billing/queries";
import { modeLabel, type Sale, type SaleItem } from "@/lib/billing/types";
import { Empty, Loading, Modal, PageHeader } from "@/components/admin/ui";
import { ReturnsScreen } from "@/components/admin/ReturnsScreen";

/** Bill details. Used as a full page (/admin/sales/[id]) and inside a panel on the Bills list (embedded). */
export function SaleDetail({ id, embedded = false, onChanged }: { id: string; embedded?: boolean; onChanged?: () => void }) {
  const [sale, setSale] = useState<Sale | null | undefined>(undefined);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState<"a5" | "thermal" | null>(null);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, i] = await Promise.all([
        db().from("sales_public").select("*").eq("id", id).maybeSingle(),
        db().from("sale_items_public").select("*").eq("sale_id", id).order("product_name"),
      ]);
      if (cancelled) return;
      setSale((s.data as Sale) ?? null);
      setItems((i.data ?? []) as SaleItem[]);
    })();
    return () => { cancelled = true; };
  }, [id, version]);

  if (sale === undefined) return <Loading />;
  if (sale === null) return <Empty title="Bill not found">{!embedded && <Link className="text-link" href="/admin/sales">Back to bills</Link>}</Empty>;

  const canReturn = items.some((i) => i.returned_units < i.units);
  const actions = (
    <>
      <button className="button button-dark button-small" onClick={() => printSale(sale.id)}><Printer size={15} /> Print</button>
      <button className="button button-light button-small" onClick={() => setPreview("a5")}><Eye size={15} /> Preview</button>
      {canReturn && <button className="button button-light button-small" onClick={() => setReturning(true)}><RotateCcw size={15} /> Return items</button>}
    </>
  );
  const subtitle = `${dateLabel(sale.bill_date)} at ${timeLabel(sale.created_at)} · billed by ${sale.staff_name} · ${modeLabel(sale.payment_mode)}`;

  return (
    <div>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--ink-muted)]">{subtitle}</p>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      ) : (
        <>
          <Link href="/admin/sales" className="admin-back-link mb-4"><ArrowLeft size={16} /> All bills</Link>
          <PageHeader title={`Bill ${billNumber(sale.fy, sale.bill_no)}`} description={subtitle} actions={actions} />
        </>
      )}
      {(sale.patient_name || sale.doctor_name) && (
        <p className="mb-4 text-sm">{sale.patient_name && <>Patient: <b>{sale.patient_name}</b> {sale.patient_phone}</>} {sale.doctor_name && <> · Doctor: <b>{sale.doctor_name}</b></>}</p>
      )}
      <div className="adm-card overflow-hidden">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Medicine</th><th>Batch</th><th>Exp</th><th className="num">MRP</th><th className="num">Qty</th><th className="num">GST</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.product_name}</b> <span className="text-xs text-[var(--ink-muted)]">{i.packing}</span></td>
                  <td>{i.batch_no}</td>
                  <td>{expiryLabel(i.expiry)}</td>
                  <td className="num">{money(i.mrp)}</td>
                  <td className="num">{qtyLabel(i.units, i.pack_size)}{i.returned_units > 0 && <span className="block text-xs adm-text-amber">returned {qtyLabel(i.returned_units, i.pack_size)}</span>}</td>
                  <td className="num">{Number(i.gst_rate)}%</td>
                  <td className="num font-semibold">{money(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto grid max-w-sm gap-1.5 p-5 text-sm">
          <div className="flex justify-between"><dt>Total (MRP)</dt><dd>{money(sale.gross)}</dd></div>
          {Number(sale.discount) > 0 && <div className="flex justify-between"><dt>Discount ({Number(sale.discount_pct)}%)</dt><dd>− {money(sale.discount)}</dd></div>}
          <div className="flex justify-between text-[var(--ink-muted)]"><dt>Taxable value</dt><dd>{money(sale.taxable)}</dd></div>
          <div className="flex justify-between text-[var(--ink-muted)]"><dt>GST included</dt><dd>{money(sale.gst)}</dd></div>
          <div className="flex justify-between"><dt>Round off</dt><dd>{money(sale.round_off)}</dd></div>
          <div className="flex justify-between border-t border-[var(--line)] pt-2 text-lg font-bold"><dt>Net</dt><dd>{money(sale.net)}</dd></div>
          {Number(sale.returned_amount) > 0 && <div className="flex justify-between adm-text-amber"><dt>Refunded</dt><dd>− {money(sale.returned_amount)}</dd></div>}
        </dl>
      </div>

      {preview && <BillPreview saleId={sale.id} label={billNumber(sale.fy, sale.bill_no)} format={preview} onFormat={setPreview} onClose={() => setPreview(null)} />}
      {returning && (
        <Modal title={`Return items · Bill ${billNumber(sale.fy, sale.bill_no)}`} wide onClose={() => { setReturning(false); setVersion((v) => v + 1); onChanged?.(); }}>
          <ReturnsScreen embedded initialBillId={sale.id} />
        </Modal>
      )}
    </div>
  );
}

/** Shows the printable bill inside the admin (no new tab), with paper-size switch and print. */
export function BillPreview({ saleId, label, format, onFormat, onClose }: { saleId: string; label: string; format: "a5" | "thermal"; onFormat: (f: "a5" | "thermal") => void; onClose: () => void }) {
  return (
    <Modal title={`Bill ${label}`} wide onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-[var(--line)] p-0.5 text-xs font-semibold" role="group" aria-label="Paper size">
          {(["a5", "thermal"] as const).map((f) => (
            <button key={f} className={`rounded-md px-3 py-1.5 ${format === f ? "bg-[var(--brand-light-blue)] text-[var(--brand-blue-deeper)]" : "text-[var(--ink-muted)]"}`} aria-pressed={format === f} onClick={() => onFormat(f)}>
              {f === "a5" ? "A5 sheet" : "80mm roll"}
            </button>
          ))}
        </div>
        <button className="button button-dark button-small" onClick={() => printSale(saleId, format)}><Printer size={15} /> Print</button>
      </div>
      <iframe key={format} title={`Bill ${label} preview`} src={`/admin/print/sale/${saleId}?format=${format}&embed=1`} className="h-[70vh] w-full rounded-lg border border-[var(--line)] bg-[#e9edf0]" />
    </Modal>
  );
}
