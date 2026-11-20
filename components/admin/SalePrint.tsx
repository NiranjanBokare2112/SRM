"use client";

/* eslint-disable @next/next/no-img-element -- printed bills need a plain <img> that loads synchronously before window.print() */
import { useEffect, useState } from "react";
import { amount, billNumber, dateLabel, expiryLabel, qtyLabel, rupeesInWords, timeLabel } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { modeLabel, type Sale, type SaleItem, type ShopSettings } from "@/lib/billing/types";
import { business } from "@/lib/business";

type Data = { sale: Sale; items: SaleItem[]; settings: ShopSettings };

export function SalePrint({ id, format: formatOverride, autoprint, toolbar = true }: { id: string; format?: "a5" | "thermal"; autoprint: boolean; toolbar?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [format, setFormat] = useState<"a5" | "thermal" | null>(formatOverride ?? null);

  useEffect(() => {
    (async () => {
      const [sale, items, settings] = await Promise.all([
        db().from("sales_public").select("*").eq("id", id).single(),
        db().from("sale_items_public").select("*").eq("sale_id", id).order("product_name"),
        db().from("shop_settings").select("*").single(),
      ]);
      if (sale.error || items.error || settings.error) { setError("Bill not found, or you are not signed in."); return; }
      const s = sale.data as Sale;
      // The document title becomes the file name when the bill is saved as PDF.
      document.title = `Bill ${billNumber(s.fy, s.bill_no).replace("/", "-")}`;
      setData({ sale: s, items: items.data as SaleItem[], settings: settings.data as ShopSettings });
    })();
  }, [id]);

  useEffect(() => {
    if (!data || !autoprint) return;
    const timer = setTimeout(() => window.print(), 250);
    return () => clearTimeout(timer);
  }, [data, autoprint]);

  if (error) return <p style={{ padding: 24, fontFamily: "sans-serif" }}>{error}</p>;
  if (!data) return <p style={{ padding: 24, fontFamily: "sans-serif" }}>Preparing bill…</p>;

  const { sale, items, settings } = data;
  const thermal = (format ?? settings.print_format) === "thermal";

  // GST split by rate (CGST = SGST = half) for an intra-state sale.
  const byRate = new Map<number, { taxable: number; gst: number }>();
  for (const item of items) {
    const row = byRate.get(Number(item.gst_rate)) ?? { taxable: 0, gst: 0 };
    row.taxable += Number(item.taxable); row.gst += Number(item.gst);
    byRate.set(Number(item.gst_rate), row);
  }
  const rates = [...byRate.entries()].sort((a, b) => a[0] - b[0]);
  const billNo = billNumber(sale.fy, sale.bill_no);
  const when = `${dateLabel(sale.bill_date)}, ${timeLabel(sale.created_at)}`;
  const itemCount = items.length;

  return (
    <div className="print-root">
      <style>{printCss(thermal)}</style>
      {toolbar && (
        <div className="toolbar no-print">
          <button className="tb-primary" onClick={() => window.print()}>Print bill</button>
          <div className="tb-seg" role="group" aria-label="Paper size">
            <button aria-pressed={!thermal} onClick={() => setFormat("a5")}>A5 sheet</button>
            <button aria-pressed={thermal} onClick={() => setFormat("thermal")}>80mm roll</button>
          </div>
          <span className="tb-note">Bill {billNo}</span>
        </div>
      )}

      <article className={thermal ? "bill thermal" : "bill a5"}>
        {thermal ? (
          <>
            <header className="t-head">
              <img src={business.logoPath} alt="" className="t-logo" />
              <h1>{settings.shop_name}</h1>
              <p>{settings.address}</p>
              <p>Ph: {settings.phone}</p>
              {settings.gstin && <p>GSTIN: {settings.gstin}</p>}
              {settings.drug_license && <p>D.L.: {settings.drug_license}</p>}
              <p className="t-title">TAX INVOICE</p>
            </header>
            <section className="t-meta">
              <div><span>Bill</span><b>{billNo}</b></div>
              <div><span>Date</span><b>{when}</b></div>
              {sale.patient_name && <div><span>Patient</span><b>{sale.patient_name}</b></div>}
              {sale.doctor_name && <div><span>Doctor</span><b>{sale.doctor_name}</b></div>}
            </section>
            <table className="t-items">
              <thead><tr><th className="l">Item</th><th>Qty</th><th>Amt</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="l"><b>{item.product_name}</b><small>{item.batch_no} · Exp {expiryLabel(item.expiry)} · MRP {amount(item.mrp)}</small></td>
                    <td>{qtyLabel(item.units, item.pack_size)}</td>
                    <td>{amount(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="t-sum">
              <div><dt>Total ({itemCount} items)</dt><dd>{amount(sale.gross)}</dd></div>
              {Number(sale.discount) > 0 && <div><dt>Discount {Number(sale.discount_pct)}%</dt><dd>−{amount(sale.discount)}</dd></div>}
              {Number(sale.round_off) !== 0 && <div><dt>Round off</dt><dd>{amount(sale.round_off)}</dd></div>}
              <div className="t-net"><dt>NET</dt><dd>₹{amount(sale.net)}</dd></div>
            </dl>
            <p className="t-words">{rupeesInWords(Number(sale.net))}</p>
            <table className="t-gst">
              <thead><tr><th className="l">GST</th><th>Taxable</th><th>CGST</th><th>SGST</th></tr></thead>
              <tbody>{rates.map(([rate, row]) => <tr key={rate}><td className="l">{rate}%</td><td>{amount(row.taxable)}</td><td>{amount(row.gst / 2)}</td><td>{amount(row.gst / 2)}</td></tr>)}</tbody>
            </table>
            <p className="t-pay">Paid by {modeLabel(sale.payment_mode)}{sale.payment_mode === "credit" ? " (udhaar)" : ""} · Billed by {sale.staff_name}</p>
            {Number(sale.returned_amount) > 0 && <p className="t-pay">Items returned: ₹{amount(sale.returned_amount)}</p>}
            <footer className="t-foot">{settings.bill_footer}<br /><b>Thank you!</b></footer>
          </>
        ) : (
          <>
            <header className="head">
              <div className="brand">
                <img src={business.logoPath} alt="" className="logo" />
                <div>
                  <h1>{settings.shop_name}</h1>
                  <p>{settings.address}</p>
                  <p>Phone: {settings.phone}</p>
                </div>
              </div>
              <div className="inv">
                <p className="inv-title">TAX INVOICE</p>
                <p><span>Bill No</span><b>{billNo}</b></p>
                <p><span>Date</span><b>{dateLabel(sale.bill_date)}</b></p>
                <p><span>Time</span><b>{timeLabel(sale.created_at)}</b></p>
              </div>
            </header>
            {(settings.gstin || settings.drug_license) && (
              <p className="reg">
                {settings.gstin && <span>GSTIN: <b>{settings.gstin}</b></span>}
                {settings.drug_license && <span>Drug Licence: <b>{settings.drug_license}</b></span>}
              </p>
            )}

            <section className="party">
              <div><span>Patient</span><b>{sale.patient_name || "Walk-in customer"}</b>{sale.patient_phone && <em>{sale.patient_phone}</em>}</div>
              <div><span>Doctor</span><b>{sale.doctor_name || "—"}</b></div>
              <div><span>Payment</span><b>{modeLabel(sale.payment_mode)}{sale.payment_mode === "credit" ? " (udhaar)" : ""}</b></div>
              <div><span>Billed by</span><b>{sale.staff_name}</b></div>
            </section>

            <table className="items">
              <thead>
                <tr><th>#</th><th className="l">Medicine</th><th className="l">Pack</th><th className="l">Batch</th><th>Exp</th><th>Qty</th><th>MRP</th><th>GST</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td>{i + 1}</td>
                    <td className="l name">{item.product_name}</td>
                    <td className="l">{item.packing}</td>
                    <td className="l">{item.batch_no}</td>
                    <td>{expiryLabel(item.expiry)}</td>
                    <td>{qtyLabel(item.units, item.pack_size)}</td>
                    <td>{amount(item.mrp)}</td>
                    <td>{Number(item.gst_rate)}%</td>
                    <td className="amt">{amount(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="bottom">
              <div className="left">
                <table className="gst">
                  <thead><tr><th className="l">GST rate</th><th>Taxable</th><th>CGST</th><th>SGST</th></tr></thead>
                  <tbody>{rates.map(([rate, row]) => <tr key={rate}><td className="l">{rate}%</td><td>{amount(row.taxable)}</td><td>{amount(row.gst / 2)}</td><td>{amount(row.gst / 2)}</td></tr>)}</tbody>
                </table>
                <p className="words"><span>Amount in words</span>{rupeesInWords(Number(sale.net))}</p>
              </div>
              <dl className="totals">
                <div><dt>Total MRP ({itemCount} items)</dt><dd>{amount(sale.gross)}</dd></div>
                {Number(sale.discount) > 0 && <div><dt>Discount ({Number(sale.discount_pct)}%)</dt><dd>−{amount(sale.discount)}</dd></div>}
                <div><dt>GST included</dt><dd>{amount(sale.gst)}</dd></div>
                {Number(sale.round_off) !== 0 && <div><dt>Round off</dt><dd>{amount(sale.round_off)}</dd></div>}
                <div className="net"><dt>Net amount</dt><dd>₹ {amount(sale.net)}</dd></div>
                {Number(sale.returned_amount) > 0 && <div className="ret"><dt>Returned later</dt><dd>−{amount(sale.returned_amount)}</dd></div>}
              </dl>
            </section>

            <footer className="foot">
              <p className="msg">{settings.bill_footer}<br /><b>Thank you, get well soon!</b></p>
              <p className="sign">For <b>{settings.shop_name}</b><span>Pharmacist&apos;s signature</span></p>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

function printCss(thermal: boolean) {
  return `
  /* Zero page margin: browsers then have no room to print their own header/footer
     (date, page title, URL). The bill keeps its own inner padding instead. */
  @page { size: ${thermal ? "80mm auto" : "A5 portrait"}; margin: 0; }
  html, body { background: #e9edf0 !important; margin: 0; }
  .print-root { min-height: 100vh; padding: 0 0 40px; font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 12px; padding: 12px 20px; margin-bottom: 24px; background: #fff; border-bottom: 1px solid #dde3e8; box-shadow: 0 2px 10px rgba(0,0,0,.05); }
  .tb-primary { border: 0; border-radius: 8px; background: #167A99; color: #fff; padding: 9px 18px; font-weight: 700; font-size: 14px; cursor: pointer; }
  .tb-primary:hover { background: #12687F; }
  .tb-seg { display: inline-flex; border: 1px solid #d5dbe1; border-radius: 8px; padding: 2px; }
  .tb-seg button { border: 0; background: transparent; border-radius: 6px; padding: 6px 12px; font-size: 13px; font-weight: 600; color: #4b5563; cursor: pointer; }
  .tb-seg button[aria-pressed="true"] { background: #eaf7fa; color: #12687F; }
  .tb-note { margin-left: auto; color: #6b7280; font-size: 13px; }

  .bill { background: #fff; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,.12); }
  .l { text-align: left !important; }

  /* ---------- A5 ---------- */
  .a5 { width: 148mm; min-height: 210mm; padding: 9mm 9mm 8mm; font-size: 10.5px; line-height: 1.35; box-sizing: border-box; display: flex; flex-direction: column; }
  .head { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 8px; border-bottom: 2px solid #167A99; }
  .brand { display: flex; gap: 10px; align-items: flex-start; }
  .logo { width: 46px; height: 46px; object-fit: contain; }
  .brand h1 { margin: 0 0 2px; font-size: 19px; letter-spacing: -.01em; color: #0f5f78; }
  .brand p { margin: 0; color: #374151; max-width: 62mm; }
  .inv { text-align: right; min-width: 40mm; }
  .inv-title { display: inline-block; margin: 0 0 5px; padding: 3px 9px; border-radius: 4px; background: #167A99; color: #fff; font-size: 9.5px; font-weight: 700; letter-spacing: .14em; }
  .inv p { margin: 1px 0; }
  .inv span { color: #6b7280; margin-right: 6px; }
  .reg { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 6px 0 0; color: #374151; font-size: 9.5px; }
  .party { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 6px; margin: 8px 0; padding: 7px 9px; border: 1px solid #d7dde2; border-radius: 6px; background: #f8fafb; }
  .party span { display: block; color: #6b7280; font-size: 8.5px; text-transform: uppercase; letter-spacing: .06em; }
  .party b { display: block; font-size: 10.5px; }
  .party em { font-style: normal; color: #374151; }

  .items { width: 100%; border-collapse: collapse; }
  .items th { background: #eef3f5; color: #1f2933; font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; padding: 5px 4px; text-align: right; border-bottom: 1px solid #c9d2d8; }
  .items td { padding: 5px 4px; text-align: right; border-bottom: 1px solid #edf0f2; vertical-align: top; }
  .items td.name { font-weight: 600; }
  .items td.amt { font-weight: 600; }
  .items tbody tr:last-child td { border-bottom: 1px solid #c9d2d8; }

  .bottom { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; }
  .left { flex: 1; }
  .gst { border-collapse: collapse; font-size: 9px; }
  .gst th, .gst td { padding: 2px 8px 2px 0; text-align: right; }
  .gst th { color: #6b7280; font-weight: 600; border-bottom: 1px solid #d7dde2; }
  .words { margin: 8px 0 0; font-style: italic; }
  .words span { display: block; font-style: normal; color: #6b7280; font-size: 8.5px; text-transform: uppercase; letter-spacing: .06em; }
  .totals { margin: 0; min-width: 52mm; }
  .totals div { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; }
  .totals dt { color: #374151; }
  .totals dd { margin: 0; font-variant-numeric: tabular-nums; }
  .totals .net { margin-top: 4px; padding: 6px 8px; border-radius: 6px; background: #0f5f78; color: #fff; font-size: 14px; font-weight: 700; }
  .totals .net dt { color: #fff; }
  .totals .ret dt, .totals .ret dd { color: #92400e; }

  .foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-top: auto; padding-top: 10px; border-top: 1px dashed #b8c2c9; }
  .msg { margin: 0; color: #374151; max-width: 75mm; }
  .sign { margin: 0; text-align: right; }
  .sign span { display: block; margin-top: 22px; padding-top: 3px; border-top: 1px solid #6b7280; color: #6b7280; font-size: 8.5px; }

  /* ---------- 80mm thermal ---------- */
  .thermal { width: 76mm; padding: 4mm 3mm 6mm; font-size: 11px; line-height: 1.35; box-sizing: border-box; color: #000; }
  .t-head { text-align: center; padding-bottom: 5px; border-bottom: 1px dashed #000; }
  .t-logo { width: 34px; height: 34px; object-fit: contain; }
  .t-head h1 { margin: 2px 0; font-size: 15px; }
  .t-head p { margin: 0; }
  .t-title { margin-top: 4px !important; font-weight: 700; letter-spacing: .2em; font-size: 10px; }
  .t-meta { padding: 5px 0; border-bottom: 1px dashed #000; }
  .t-meta div, .t-sum div { display: flex; justify-content: space-between; gap: 8px; }
  .t-meta span { color: #333; }
  .t-items { width: 100%; border-collapse: collapse; margin-top: 3px; }
  .t-items th { font-size: 10px; text-align: right; border-bottom: 1px solid #000; padding: 3px 0; }
  .t-items td { text-align: right; vertical-align: top; padding: 3px 0; border-bottom: 1px dotted #999; }
  .t-items td.l { padding-right: 6px; }
  .t-items small { display: block; font-size: 9px; color: #333; }
  .t-sum { margin: 5px 0 0; }
  .t-sum dd { margin: 0; }
  .t-net { margin-top: 3px; padding: 4px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 15px; font-weight: 700; }
  .t-words { margin: 4px 0; font-style: italic; font-size: 10px; }
  .t-gst { width: 100%; border-collapse: collapse; font-size: 9px; }
  .t-gst th, .t-gst td { text-align: right; padding: 1px 0; }
  .t-gst th { border-bottom: 1px solid #000; }
  .t-pay { margin: 5px 0 0; font-size: 10px; }
  .t-foot { margin-top: 6px; padding-top: 5px; border-top: 1px dashed #000; text-align: center; font-size: 10px; }

  @media print {
    html, body { background: #fff !important; }
    .no-print { display: none !important; }
    .print-root { padding: 0; min-height: 0; }
    .bill { box-shadow: none; margin: 0; }
    .a5 { width: 148mm; min-height: 210mm; }
  }
  `;
}
