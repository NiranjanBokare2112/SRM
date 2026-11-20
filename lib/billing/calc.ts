/**
 * Bill maths shown on screen. The database functions (create_sale / create_purchase)
 * do the same calculation and are the source of truth; these mirror them so the
 * owner sees exactly the total that will be saved. Everything is done in paise
 * (integers) to avoid floating-point drift.
 */

const toPaise = (rupees: number) => Math.round(rupees * 100);
const roundHalfUp = (x: number) => Math.sign(x) * Math.round(Math.abs(x));

export type SaleLineInput = { mrp: number; packSize: number; units: number; gstRate: number };

export function saleLine(line: SaleLineInput, discountPct: number) {
  const amount = roundHalfUp((toPaise(line.mrp) * line.units) / line.packSize);
  const net = roundHalfUp((amount * (10000 - Math.round(discountPct * 100))) / 10000);
  const taxable = roundHalfUp((net * 100) / (100 + line.gstRate));
  return { amount: amount / 100, net: net / 100, taxable: taxable / 100, gst: (net - taxable) / 100 };
}

export function saleTotals(lines: SaleLineInput[], discountPct: number) {
  let gross = 0, net = 0, taxable = 0;
  for (const line of lines) {
    const l = saleLine(line, discountPct);
    gross += toPaise(l.amount); net += toPaise(l.net); taxable += toPaise(l.taxable);
  }
  const rounded = roundHalfUp(net / 100) * 100;
  return {
    gross: gross / 100,
    discount: (gross - net) / 100,
    taxable: taxable / 100,
    gst: (net - taxable) / 100,
    roundOff: (rounded - net) / 100,
    net: rounded / 100,
  };
}

export type PurchaseLineInput = { rate: number; qty: number; discountPct: number; gstRate: number };

export function purchaseLine(line: PurchaseLineInput) {
  const gross = roundHalfUp(toPaise(line.rate) * line.qty);
  const discount = roundHalfUp((gross * Math.round(line.discountPct * 100)) / 10000);
  const taxable = gross - discount;
  const gst = roundHalfUp((taxable * Math.round(line.gstRate * 100)) / 10000);
  return { gross: gross / 100, discount: discount / 100, taxable: taxable / 100, gst: gst / 100, amount: (taxable + gst) / 100 };
}

export function purchaseTotals(lines: PurchaseLineInput[], adjustment: number) {
  let gross = 0, discount = 0, taxable = 0, gst = 0;
  for (const line of lines) {
    const l = purchaseLine(line);
    gross += toPaise(l.gross); discount += toPaise(l.discount); taxable += toPaise(l.taxable); gst += toPaise(l.gst);
  }
  const total = taxable + gst + toPaise(adjustment);
  const rounded = roundHalfUp(total / 100) * 100;
  return {
    gross: gross / 100, discount: discount / 100, taxable: taxable / 100, gst: gst / 100,
    roundOff: (rounded - total) / 100, net: rounded / 100,
  };
}
