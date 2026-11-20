/**
 * DEMO MODE ONLY. An in-browser stand-in for the Supabase database, used when no
 * Supabase keys are configured. It mirrors the SQL functions in
 * supabase/migrations (same validation messages, same rounding) and keeps its data
 * in this browser's localStorage. Delete this folder once the real database is live.
 */
import { purchaseLine, saleLine } from "@/lib/billing/calc";
import { istToday } from "@/lib/billing/format";

type Row = Record<string, unknown> & { id: string };
export type Tables = Record<string, Row[]>;
export type DemoDb = { tables: Tables; counters: Record<string, number>; pins: Record<string, string> };

export class DemoError extends Error {
  code: string;
  constructor(message: string, code = "P0001") { super(message); this.code = code; }
}

const STORAGE_KEY = "srm-demo-db-v3";

/** Who is signed in to the demo: set by the demo client from its session cookie. */
export type DemoRole = "owner" | "operator";
let role: DemoRole = "owner";
export const setDemoRole = (r: DemoRole) => { role = r; };
export const demoRole = () => role;
const ownerOnly = () => { if (role !== "owner") throw new DemoError("Not authorised", "42501"); };
const strip = (rows: Row[], ...cols: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !cols.includes(k))) as Row);

/** Tables and views an operator can never read (they carry cost/profit or are owner admin). */
export const OWNER_ONLY_SOURCES = new Set(["batches", "sales", "sale_items", "sales_returns", "sales_return_items", "purchases", "purchase_items",
  "suppliers", "supplier_payments", "stock_adjustments", "product_stock", "supplier_balances", "operator_list"]);
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const paise = (rupees: number) => Math.round(rupees * 100);
const r2 = (p: number) => Math.round(p) / 100;
const fail = (message: string): never => { throw new DemoError(message); };

export function financialYear(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}
const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
let cache: DemoDb | null = null;

export function loadDb(): DemoDb {
  if (cache) return cache;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as DemoDb | null;
    if (saved?.tables?.sales) { cache = saved; return cache; }
  } catch { /* fall through to seed */ }
  cache = seed();
  saveDb();
  return cache;
}

export function saveDb() {
  if (!cache) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch { /* storage full or blocked */ }
}

export function resetDb() {
  cache = seed();
  saveDb();
}

const t = (name: string) => loadDb().tables[name];
const byId = (name: string, id: unknown) => t(name).find((r) => r.id === id);

function nextNo(kind: string, fy: string) {
  const db = loadDb();
  const key = `${kind}:${fy}`;
  db.counters[key] = (db.counters[key] ?? 0) + 1;
  return db.counters[key];
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
export function view(name: string): Row[] | null {
  const today = istToday();
  if (name === "product_stock") {
    return t("products").map((p) => {
      const batches = t("batches").filter((b) => b.product_id === p.id);
      const live = batches.filter((b) => (b.expiry as string) >= today);
      const next = live.filter((b) => (b.stock_units as number) > 0).map((b) => b.expiry as string).sort()[0] ?? null;
      return {
        id: p.id, name: p.name, company: p.company, packing: p.packing, pack_size: p.pack_size, gst_rate: p.gst_rate,
        barcode: p.barcode, reorder_level: p.reorder_level, active: p.active,
        stock_units: live.reduce((s, b) => s + (b.stock_units as number), 0),
        expired_units: batches.filter((b) => (b.expiry as string) < today).reduce((s, b) => s + (b.stock_units as number), 0),
        next_expiry: next,
        stock_value: r2(batches.reduce((s, b) => s + Math.round((paise(b.purchase_rate as number) * (b.stock_units as number)) / (p.pack_size as number)), 0)),
      };
    });
  }
  if (name === "supplier_balances") {
    return t("suppliers").map((s) => {
      const credit = t("purchases").filter((p) => p.supplier_id === s.id && p.payment_mode === "credit").reduce((x, p) => x + paise(p.net as number), 0);
      const paid = t("supplier_payments").filter((p) => p.supplier_id === s.id).reduce((x, p) => x + paise(p.amount as number), 0);
      return { id: s.id, name: s.name, phone: s.phone, balance: r2(paise(s.opening_balance as number) + credit - paid) };
    });
  }
  if (name === "customer_balances") {
    return t("customers").map((c) => {
      const sales = t("sales").filter((s) => s.customer_id === c.id);
      const credit = sales.filter((s) => s.payment_mode === "credit").reduce((x, s) => x + paise(s.net as number), 0);
      const saleIds = new Set(sales.map((s) => s.id));
      const refunds = t("sales_returns").filter((r) => saleIds.has(r.sale_id as string) && r.refund_mode === "credit").reduce((x, r) => x + paise(r.amount as number), 0);
      const paid = t("customer_payments").filter((p) => p.customer_id === c.id).reduce((x, p) => x + paise(p.amount as number), 0);
      const last = sales.map((s) => s.created_at as string).sort().at(-1) ?? null;
      return { id: c.id, name: c.name, phone: c.phone, address: c.address, opening_balance: c.opening_balance, balance: r2(paise(c.opening_balance as number) + credit - refunds - paid), last_bill_at: last, bills: sales.length };
    });
  }
  if (name === "batches_public") return strip(t("batches"), "purchase_rate");
  if (name === "sales_public") return strip(t("sales"), "cost");
  if (name === "sale_items_public") return strip(t("sale_items"), "cost");
  if (name === "sales_returns_public") return strip(t("sales_returns"), "cost");
  if (name === "operator_list") {
    return role === "owner" ? t("operators").map((o) => ({ id: o.id, user_id: o.id, name: o.name, email: o.email, created_at: o.created_at })) : [];
  }
  if (name === "staff") {
    return t("staff").map(({ id, name: n, active, created_at }) => ({ id, name: n, active, created_at }));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Functions (ports of the SQL functions)
// ---------------------------------------------------------------------------
type Json = Record<string, unknown>;
type SaleItemIn = { batch_id: string; units: number };

function resolveStaff(pin: unknown): { id: string | null; name: string } {
  const settings = t("shop_settings")[0];
  const code = typeof pin === "string" ? pin.trim() : "";
  const active = t("staff").filter((s) => s.active);
  if (!code) {
    if (settings.require_staff_pin && active.length > 0) fail("Enter the staff PIN");
    return { id: null, name: "Owner" };
  }
  const pins = loadDb().pins;
  const staff = active.find((s) => pins[s.id] === code);
  if (!staff) fail("Wrong staff PIN");
  return { id: staff!.id, name: staff!.name as string };
}

function createSale(p: Json, date = istToday()) {
  const disc = Number(p.discount_pct ?? 0);
  const items = p.items as SaleItemIn[] | undefined;
  if (disc < 0 || disc > 100) fail("Discount must be between 0 and 100%");
  if (!Array.isArray(items) || items.length === 0) fail("Add at least one medicine to the bill");
  if (!["cash", "upi", "card", "credit"].includes(String(p.payment_mode))) fail("Choose a payment mode");
  const staff = resolveStaff(p.pin);
  let name = String(p.patient_name ?? "").trim();
  let phone = String(p.patient_phone ?? "").replace(/[^0-9]/g, "");
  if (phone.length > 10) phone = phone.slice(-10);
  let customer: Row | undefined;
  if (p.customer_id) {
    customer = byId("customers", p.customer_id) ?? fail("Customer not found");
    if (!name) name = customer.name as string;
    if (!phone) phone = customer.phone as string;
  } else if (phone) {
    customer = t("customers").find((c) => c.phone === phone);
  }
  const needNewCustomer = !customer && name !== "" && (phone !== "" || p.payment_mode === "credit");
  if (p.payment_mode === "credit" && !customer && !needNewCustomer) fail("Enter the customer name and mobile for a credit (udhaar) bill");

  // Validate everything before changing anything (acts like the SQL transaction).
  const need = new Map<string, number>();
  for (const item of items!) {
    const units = Math.floor(Number(item.units));
    if (!(units > 0)) fail("Quantity must be more than zero");
    need.set(item.batch_id, (need.get(item.batch_id) ?? 0) + units);
  }
  for (const [batchId, units] of need) {
    const b = byId("batches", batchId) ?? fail("Batch not found");
    const pr = byId("products", b.product_id)!;
    if ((b.expiry as string) < date) fail(`${pr.name} (batch ${b.batch_no}) has expired`);
    if ((b.stock_units as number) < units) fail(`Only ${b.stock_units} units of ${pr.name} (batch ${b.batch_no}) in stock`);
  }

  if (needNewCustomer) {
    customer = { id: uuid(), name, phone, address: "", opening_balance: 0, created_at: now() };
    t("customers").push(customer);
  }
  const fy = financialYear(date);
  const saleId = uuid();
  let gross = 0, net = 0, taxable = 0, cost = 0;
  const lines: Row[] = [];
  for (const item of items!) {
    const b = byId("batches", item.batch_id)!;
    const pr = byId("products", b.product_id)!;
    const units = Math.floor(Number(item.units));
    const l = saleLine({ mrp: b.mrp as number, packSize: pr.pack_size as number, units, gstRate: pr.gst_rate as number }, disc);
    const lineCost = Math.round((paise(b.purchase_rate as number) * units) / (pr.pack_size as number));
    b.stock_units = (b.stock_units as number) - units;
    lines.push({
      id: uuid(), sale_id: saleId, product_id: pr.id, batch_id: b.id, product_name: pr.name, packing: pr.packing, pack_size: pr.pack_size,
      batch_no: b.batch_no, expiry: b.expiry, mrp: b.mrp, gst_rate: pr.gst_rate, units, amount: l.amount, net_amount: l.net,
      taxable: l.taxable, gst: l.gst, cost: r2(lineCost), returned_units: 0,
    });
    gross += paise(l.amount); net += paise(l.net); taxable += paise(l.taxable); cost += lineCost;
  }
  const rounded = Math.round(net / 100) * 100;
  const billNo = nextNo("sale", fy);
  t("sales").push({
    id: saleId, fy, bill_no: billNo, bill_date: date, created_at: now(), staff_id: staff.id, staff_name: staff.name,
    customer_id: customer?.id ?? null, patient_name: name, patient_phone: phone, doctor_name: String(p.doctor_name ?? "").trim(),
    payment_mode: p.payment_mode, gross: r2(gross), discount_pct: disc, discount: r2(gross - net), taxable: r2(taxable), gst: r2(net - taxable),
    round_off: r2(rounded - net), net: r2(rounded), cost: r2(cost), returned_amount: 0,
  });
  t("sale_items").push(...lines);
  return { id: saleId, bill_no: billNo, fy, net: r2(rounded), customer_id: customer?.id ?? null };
}

function createSalesReturn(p: Json) {
  const items = (p.items as { sale_item_id: string; units: number }[] | undefined) ?? [];
  if (items.length === 0) fail("Select at least one item to return");
  if (!["cash", "upi", "card", "credit"].includes(String(p.refund_mode))) fail("Choose a refund mode");
  const sale = byId("sales", p.sale_id) ?? fail("Bill not found");
  for (const item of items) {
    const units = Math.floor(Number(item.units));
    if (!(units > 0)) continue;
    const si = t("sale_items").find((x) => x.id === item.sale_item_id && x.sale_id === sale.id) ?? fail("Item does not belong to this bill");
    if ((si.returned_units as number) + units > (si.units as number)) fail(`Only ${(si.units as number) - (si.returned_units as number)} units of ${si.product_name} can still be returned`);
  }
  const fy = financialYear(istToday());
  const returnId = uuid();
  let amount = 0, taxable = 0, cost = 0;
  const lines: Row[] = [];
  for (const item of items) {
    const units = Math.floor(Number(item.units));
    if (!(units > 0)) continue;
    const si = t("sale_items").find((x) => x.id === item.sale_item_id)!;
    const a = Math.round((paise(si.net_amount as number) * units) / (si.units as number));
    const tx = Math.round((a * 100) / (100 + (si.gst_rate as number)));
    const c = Math.round((paise(si.cost as number) * units) / (si.units as number));
    si.returned_units = (si.returned_units as number) + units;
    const b = byId("batches", si.batch_id)!;
    b.stock_units = (b.stock_units as number) + units;
    lines.push({ id: uuid(), return_id: returnId, sale_item_id: si.id, units, amount: r2(a), taxable: r2(tx), gst: r2(a - tx), gst_rate: si.gst_rate });
    amount += a; taxable += tx; cost += c;
  }
  if (amount === 0) fail("Select at least one item to return");
  const no = nextNo("sales_return", fy);
  t("sales_returns").push({ id: returnId, fy, return_no: no, return_date: istToday(), created_at: now(), sale_id: sale.id, refund_mode: p.refund_mode, taxable: r2(taxable), gst: r2(amount - taxable), amount: r2(amount), cost: r2(cost), note: String(p.note ?? "").trim() });
  t("sales_return_items").push(...lines);
  sale.returned_amount = r2(paise(sale.returned_amount as number) + amount);
  return { id: returnId, return_no: no, fy, amount: r2(amount) };
}

type PurchaseItemIn = { product_id: string; batch_no: string; expiry_month: number; expiry_year: number; mrp: number; rate: number; qty: number; free_qty: number; discount_pct: number };

function createPurchase(p: Json) {
  const date = String(p.bill_date ?? istToday());
  if (date > istToday()) fail("Bill date cannot be in the future");
  const items = p.items as PurchaseItemIn[] | undefined;
  if (!Array.isArray(items) || items.length === 0) fail("Add at least one item");
  if (!["cash", "credit"].includes(String(p.payment_mode))) fail("Choose cash or credit");
  const billNo = String(p.supplier_bill_no ?? "").trim();
  if (!billNo) fail("Enter the supplier bill number");
  if (!byId("suppliers", p.supplier_id)) fail("Choose a supplier");
  if (t("purchases").some((x) => x.supplier_id === p.supplier_id && String(x.supplier_bill_no).toLowerCase() === billNo.toLowerCase())) fail("This supplier bill number is already entered");
  for (const i of items!) {
    const pr = byId("products", i.product_id) ?? fail("Product not found");
    if (i.qty < 0 || i.free_qty < 0 || i.qty + i.free_qty === 0) fail(`Enter a quantity for ${pr.name}`);
    if (!(i.mrp > 0)) fail(`Enter the MRP for ${pr.name}`);
    if (i.rate < 0 || i.discount_pct < 0 || i.discount_pct > 100) fail(`Check the rate and discount for ${pr.name}`);
    if (!String(i.batch_no ?? "").trim()) fail(`Enter the batch number for ${pr.name}`);
  }

  const fy = financialYear(date);
  const id = uuid();
  const adjustment = Number(p.adjustment ?? 0);
  let gross = 0, discount = 0, taxable = 0, gst = 0;
  const lines: Row[] = [];
  for (const i of items!) {
    const pr = byId("products", i.product_id)!;
    const batchNo = String(i.batch_no).trim().toUpperCase();
    const expiry = monthEnd(i.expiry_year, i.expiry_month);
    const l = purchaseLine({ rate: i.rate, qty: i.qty, discountPct: i.discount_pct, gstRate: pr.gst_rate as number });
    const netRate = r2(Math.round(paise(l.taxable) / (i.qty + i.free_qty)));
    const units = (i.qty + i.free_qty) * (pr.pack_size as number);
    let batch = t("batches").find((b) => b.product_id === pr.id && b.batch_no === batchNo);
    if (batch) Object.assign(batch, { expiry, mrp: i.mrp, purchase_rate: netRate, stock_units: (batch.stock_units as number) + units });
    else { batch = { id: uuid(), product_id: pr.id, batch_no: batchNo, expiry, mrp: i.mrp, purchase_rate: netRate, stock_units: units, created_at: now() }; t("batches").push(batch); }
    lines.push({ id: uuid(), purchase_id: id, product_id: pr.id, batch_id: batch.id, product_name: pr.name, batch_no: batchNo, expiry, mrp: i.mrp, rate: i.rate, qty: i.qty, free_qty: i.free_qty, discount_pct: i.discount_pct, gst_rate: pr.gst_rate, gross: l.gross, discount: l.discount, taxable: l.taxable, gst: l.gst, amount: l.amount });
    gross += paise(l.gross); discount += paise(l.discount); taxable += paise(l.taxable); gst += paise(l.gst);
  }
  const total = taxable + gst + paise(adjustment);
  const rounded = Math.round(total / 100) * 100;
  const no = nextNo("purchase", fy);
  t("purchases").push({ id, fy, entry_no: no, bill_date: date, created_at: now(), supplier_id: p.supplier_id, supplier_bill_no: billNo, payment_mode: p.payment_mode, gross: r2(gross), discount: r2(discount), taxable: r2(taxable), gst: r2(gst), adjustment, round_off: r2(rounded - total), net: r2(rounded), narration: String(p.narration ?? "").trim() });
  t("purchase_items").push(...lines);
  return { id, entry_no: no, fy, net: r2(rounded) };
}

function addOpeningStock(a: Json) {
  const pr = byId("products", a.p_product_id) ?? fail("Product not found");
  const batchNo = String(a.p_batch_no ?? "").trim().toUpperCase();
  if (!batchNo) fail("Enter the batch number");
  if (!(Number(a.p_mrp) > 0)) fail("Enter the MRP");
  const units = Number(a.p_packs ?? 0) * (pr.pack_size as number) + Number(a.p_loose ?? 0);
  if (!(units > 0)) fail("Enter a quantity");
  const expiry = monthEnd(Number(a.p_expiry_year), Number(a.p_expiry_month));
  let batch = t("batches").find((b) => b.product_id === pr.id && b.batch_no === batchNo);
  if (batch) Object.assign(batch, { expiry, mrp: Number(a.p_mrp), purchase_rate: Number(a.p_purchase_rate) > 0 ? Number(a.p_purchase_rate) : batch.purchase_rate, stock_units: (batch.stock_units as number) + units });
  else { batch = { id: uuid(), product_id: pr.id, batch_no: batchNo, expiry, mrp: Number(a.p_mrp), purchase_rate: Number(a.p_purchase_rate) || 0, stock_units: units, created_at: now() }; t("batches").push(batch); }
  t("stock_adjustments").push({ id: uuid(), created_at: now(), adjust_date: istToday(), batch_id: batch.id, units, reason: "opening_stock", note: "" });
  return batch.id;
}

function adjustStock(a: Json) {
  const units = Number(a.p_units);
  if (!units) fail("Enter a quantity");
  const b = byId("batches", a.p_batch_id) ?? fail("Batch not found");
  if ((b.stock_units as number) + units < 0) fail(`Only ${b.stock_units} units in stock`);
  b.stock_units = (b.stock_units as number) + units;
  t("stock_adjustments").push({ id: uuid(), created_at: now(), adjust_date: istToday(), batch_id: b.id, units, reason: a.p_reason, note: String(a.p_note ?? "") });
  return null;
}

function saveStaff(a: Json) {
  const name = String(a.p_name ?? "").trim();
  const pin = a.p_pin == null ? null : String(a.p_pin).trim();
  if (!name) fail("Enter the staff name");
  if (pin !== null && !/^[0-9]{4,6}$/.test(pin)) fail("PIN must be 4 to 6 digits");
  const pins = loadDb().pins;
  if (pin !== null && t("staff").some((s) => s.active && s.id !== a.p_id && pins[s.id] === pin)) fail("Another staff member already uses this PIN");
  if (!a.p_id) {
    if (pin === null) fail("Set a PIN for the new staff member");
    const id = uuid();
    t("staff").push({ id, name, active: a.p_active ?? true, created_at: now() });
    pins[id] = pin!;
    return id;
  }
  const s = byId("staff", a.p_id) ?? fail("Staff member not found");
  s.name = name; s.active = a.p_active ?? s.active;
  if (pin !== null) pins[s.id] = pin;
  return s.id;
}

function recordSupplierPayment(a: Json) {
  const amount = Number(a.p_amount);
  if (!(amount > 0)) fail("Enter an amount");
  const date = String(a.p_date ?? istToday());
  if (date > istToday()) fail("Payment date cannot be in the future");
  const id = uuid();
  t("supplier_payments").push({ id, payment_date: date, created_at: now(), supplier_id: a.p_supplier_id, amount: r2(paise(amount)), mode: a.p_mode, note: String(a.p_note ?? "").trim() });
  return id;
}

function recordCustomerPayment(a: Json) {
  const amount = Number(a.p_amount);
  if (!(amount > 0)) fail("Enter an amount");
  if (!["cash", "upi", "card"].includes(String(a.p_mode))) fail("Choose how the money was received");
  const date = String(a.p_date ?? istToday());
  if (date > istToday()) fail("Payment date cannot be in the future");
  if (!byId("customers", a.p_customer_id)) fail("Customer not found");
  const id = uuid();
  t("customer_payments").push({ id, payment_date: date, created_at: now(), customer_id: a.p_customer_id, amount: r2(paise(amount)), mode: a.p_mode, note: String(a.p_note ?? "").trim() });
  return id;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);
const istHour = (ts: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(new Date(ts)));

function dashboardStats(from: string, to: string) {
  if (to < from) fail("The end date is before the start date");
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days > 400) fail("Choose a range of 400 days or less");
  const prevFrom = addDays(from, -days), prevTo = addDays(from, -1);
  const inRange = (d: unknown, a: string, b: string) => (d as string) >= a && (d as string) <= b;
  const totals = (a: string, b: string) => {
    const s = t("sales").filter((x) => inRange(x.bill_date, a, b));
    const r = t("sales_returns").filter((x) => inRange(x.return_date, a, b));
    const sum = (rows: Row[], f: (x: Row) => number) => rows.reduce((acc, x) => acc + f(x), 0);
    return {
      net: r2(sum(s, (x) => paise(x.net as number)) - sum(r, (x) => paise(x.amount as number))),
      bills: s.length,
      profit: r2(sum(s, (x) => paise(x.taxable as number) - paise(x.cost as number)) - sum(r, (x) => paise(x.taxable as number) - paise(x.cost as number))),
      returns: r2(sum(r, (x) => paise(x.amount as number))),
    };
  };
  const sales = t("sales").filter((x) => inRange(x.bill_date, from, to));
  const daily = Array.from({ length: days }, (_, i) => { const day = addDays(from, i); const d = totals(day, day); return { day, net: d.net, bills: d.bills, profit: d.profit }; });
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const hs = sales.filter((s) => istHour(s.created_at as string) === hour);
    return { hour, net: r2(hs.reduce((a, s) => a + paise(s.net as number), 0)), bills: hs.length };
  });
  const byMode = Object.fromEntries(["cash", "upi", "card", "credit"].map((m) => [m, r2(sales.filter((s) => s.payment_mode === m).reduce((a, s) => a + paise(s.net as number), 0))]));
  const ids = new Set(sales.map((s) => s.id));
  const top = new Map<string, { name: string; packing: string; pack_size: number; units: number; amount: number }>();
  for (const i of t("sale_items").filter((x) => ids.has(x.sale_id as string))) {
    const left = (i.units as number) - (i.returned_units as number);
    if (left <= 0) continue;
    const row = top.get(i.product_id as string) ?? { name: i.product_name as string, packing: i.packing as string, pack_size: i.pack_size as number, units: 0, amount: 0 };
    row.units += left;
    row.amount += Math.round((paise(i.net_amount as number) * left) / (i.units as number));
    top.set(i.product_id as string, row);
  }
  const topProducts = [...top.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)).slice(0, 8).map((x) => ({ ...x, amount: r2(x.amount) }));
  const { returns: _r, ...previous } = totals(prevFrom, prevTo);
  void _r;
  return { from, to, previous_from: prevFrom, previous_to: prevTo, totals: totals(from, to), previous, by_mode: byMode, daily, hourly, top_products: topProducts };
}

export const DEMO_OPERATOR = { email: "operator@shreeram.test", password: "Operator@123" };

function createOperator(a: Json) {
  const email = String(a.p_email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Enter a valid email for the operator login");
  if (String(a.p_password ?? "").length < 8) fail("Password must be at least 8 characters");
  if (!String(a.p_name ?? "").trim()) fail("Enter the operator name");
  if (email === "owner@shreeram.test") fail("This email is an owner login");
  const existing = t("operators").find((o) => o.email === email);
  if (existing) { existing.name = String(a.p_name).trim(); existing.password = a.p_password; return existing.id; }
  const id = uuid();
  t("operators").push({ id, email, name: String(a.p_name).trim(), password: a.p_password, created_at: now() });
  return id;
}

function setOperatorPassword(a: Json) {
  if (String(a.p_password ?? "").length < 8) fail("Password must be at least 8 characters");
  const op = byId("operators", a.p_user_id) ?? fail("Operator not found");
  op.password = a.p_password;
  return null;
}

/** Demo sign-in check for operators created in Settings (passwords are only ever kept in this browser). */
export function demoOperatorLogin(email: string, password: string) {
  return t("operators").some((o) => o.email === email.trim().toLowerCase() && o.password === password);
}

function salesSummary(from: string, to: string) {
  const sales = t("sales").filter((s) => (s.bill_date as string) >= from && (s.bill_date as string) <= to);
  const returns = t("sales_returns").filter((r) => (r.return_date as string) >= from && (r.return_date as string) <= to);
  const sum = (rows: Row[], k: string) => r2(rows.reduce((x, r) => x + paise(r[k] as number), 0));
  const byMode: Record<string, number> = {};
  for (const s of sales) byMode[s.payment_mode as string] = r2(paise(byMode[s.payment_mode as string] ?? 0) + paise(s.net as number));
  return {
    bills: sales.length, gross: sum(sales, "gross"), discount: sum(sales, "discount"), net: sum(sales, "net"), gst: sum(sales, "gst"),
    cost: sum(sales, "cost"), taxable: sum(sales, "taxable"), by_mode: byMode,
    returns: sum(returns, "amount"), returns_taxable: sum(returns, "taxable"), returns_cost: sum(returns, "cost"),
    purchases: sum(t("purchases").filter((p) => (p.bill_date as string) >= from && (p.bill_date as string) <= to), "net"),
  };
}

function gstSummary(from: string, to: string) {
  const rates = new Map<number, { st: number; sg: number; pt: number; pg: number }>();
  const row = (rate: number) => { const r = rates.get(rate) ?? { st: 0, sg: 0, pt: 0, pg: 0 }; rates.set(rate, r); return r; };
  const saleIds = new Set(t("sales").filter((s) => (s.bill_date as string) >= from && (s.bill_date as string) <= to).map((s) => s.id));
  for (const i of t("sale_items").filter((i) => saleIds.has(i.sale_id as string))) { const r = row(i.gst_rate as number); r.st += paise(i.taxable as number); r.sg += paise(i.gst as number); }
  const retIds = new Set(t("sales_returns").filter((s) => (s.return_date as string) >= from && (s.return_date as string) <= to).map((s) => s.id));
  for (const i of t("sales_return_items").filter((i) => retIds.has(i.return_id as string))) { const r = row(i.gst_rate as number); r.st -= paise(i.taxable as number); r.sg -= paise(i.gst as number); }
  const purIds = new Set(t("purchases").filter((p) => (p.bill_date as string) >= from && (p.bill_date as string) <= to).map((p) => p.id));
  for (const i of t("purchase_items").filter((i) => purIds.has(i.purchase_id as string))) { const r = row(i.gst_rate as number); r.pt += paise(i.taxable as number); r.pg += paise(i.gst as number); }
  return [...rates.entries()].sort((a, b) => a[0] - b[0]).map(([gst_rate, r]) => ({ gst_rate, sales_taxable: r2(r.st), sales_gst: r2(r.sg), purchase_taxable: r2(r.pt), purchase_gst: r2(r.pg) }));
}

export function callFunction(name: string, args: Json): unknown {
  switch (name) {
    case "is_owner": return role === "owner";
    case "my_role": return role;
    case "create_operator": ownerOnly(); return createOperator(args);
    case "set_operator_password": ownerOnly(); return setOperatorPassword(args);
    case "remove_operator": ownerOnly(); { const i = t("operators").findIndex((o) => o.id === args.p_user_id); if (i >= 0) t("operators").splice(i, 1); return null; }
    case "create_sale": return createSale(args.p as Json);
    case "create_sales_return": return createSalesReturn(args.p as Json);
    case "create_purchase": ownerOnly(); return createPurchase(args.p as Json);
    case "add_opening_stock": ownerOnly(); return addOpeningStock(args);
    case "adjust_stock": ownerOnly(); return adjustStock(args);
    case "save_staff": ownerOnly(); return saveStaff(args);
    case "record_supplier_payment": ownerOnly(); return recordSupplierPayment(args);
    case "sales_summary": ownerOnly(); return salesSummary(String(args.p_from), String(args.p_to));
    case "gst_summary": ownerOnly(); return gstSummary(String(args.p_from), String(args.p_to));
    case "dashboard_stats": ownerOnly(); return dashboardStats(String(args.p_from), String(args.p_to));
    case "record_customer_payment": return recordCustomerPayment(args);
    default: throw new DemoError(`Unknown function ${name}`, "42883");
  }
}

// ---------------------------------------------------------------------------
// Sample data (same as supabase/seed_demo.sql, plus a few bills so screens are not empty)
// ---------------------------------------------------------------------------
function seed(): DemoDb {
  const created = now();
  const db: DemoDb = {
    counters: {},
    pins: {},
    tables: {
      shop_settings: [{
        id: 1 as unknown as string, shop_name: "Shreeram Medical",
        address: "Mahavir Chowk, Palavi Enterprises, Main Road, Post Arag, Taluka Miraj, Maharashtra 416401",
        phone: "+91 77419 77111", gstin: "27ABCDE1234F1Z5", drug_license: "20B-MH-SAN-000000 / 21B-MH-SAN-000000",
        print_format: "a5", bill_footer: "Get well soon. Please check medicines and expiry before leaving the counter.",
        require_staff_pin: true, updated_at: created,
      }],
      staff: [], suppliers: [], products: [], batches: [], sales: [], sale_items: [], sales_returns: [], sales_return_items: [],
      purchases: [], purchase_items: [], supplier_payments: [], stock_adjustments: [], customers: [], customer_payments: [],
      operators: [{ id: "00000000-0000-0000-0000-0000operator", email: "operator@shreeram.test", name: "Counter 1", password: "Operator@123", created_at: new Date().toISOString() }],
    },
  };
  cache = db;

  const staffId = uuid();
  db.tables.staff.push({ id: staffId, name: "Ramesh", active: true, created_at: created });
  db.pins[staffId] = "1234";

  const supplierId = uuid();
  db.tables.suppliers.push({ id: supplierId, name: "Sangli Pharma Distributors", phone: "9800000000", gstin: "27AAAAA0000A1Z5", address: "Sangli", opening_balance: 2500, active: true, created_at: created });
  db.tables.suppliers.push({ id: uuid(), name: "Miraj Medical Agencies", phone: "9811111111", gstin: "", address: "Miraj", opening_balance: 0, active: true, created_at: created });

  const products: [string, string, string, number, number, string, number, string, [string, string, number, number, number][]][] = [
    ["DOLO 650 TAB", "MICRO LABS", "15 TAB", 15, 12, "8901234500011", 10, "Paracetamol 650mg", [["DL2405", "2027-08-31", 33.6, 24, 40], ["DL2311", "2026-12-31", 32, 22.8, 6]]],
    ["CALPOL 650 TAB", "GSK", "15 TAB", 15, 12, "8901234500103", 5, "Paracetamol 650mg", [["CP7710", "2028-02-29", 30.5, 21.5, 20]]],
    ["BETAPOD 200 TAB", "MANKIND", "10 TAB", 10, 12, "8901234500028", 5, "Cefpodoxime 200mg", [["UCT-25466", "2027-10-31", 164, 117.14, 12]]],
    ["PAN 40 TAB", "ALKEM", "15 TAB", 15, 12, "8901234500035", 10, "Pantoprazole 40mg", [["PN8812", "2028-01-31", 155, 105, 20]]],
    ["PANTOCID 40 TAB", "SUN PHARMA", "15 TAB", 15, 12, "8901234500110", 5, "Pantoprazole 40mg", [["PT3301", "2027-12-31", 148, 99, 10]]],
    ["AZITHRAL 500 TAB", "ALEMBIC", "5 TAB", 5, 12, "8901234500042", 5, "Azithromycin 500mg", [["AZ5521", "2027-03-31", 119.5, 82, 3]]],
    ["DICLOSAID GEL", "SAIDAL", "30 GM", 1, 18, "8901234500059", 5, "Diclofenac gel", [["OI1203", "2028-07-31", 119.5, 85, 10]]],
    ["ELECTRAL POWDER", "FDC", "21.8 GM", 1, 12, "8901234500066", 20, "Oral rehydration salts", [["EL7781", "2027-05-31", 22, 16.5, 50]]],
    ["BENADRYL COUGH SYRUP", "J&J", "100 ML", 1, 12, "8901234500073", 5, "Diphenhydramine syrup", [["BN3344", "2026-12-31", 135, 98, 2]]],
    ["CALCIUM VET LIQUID", "VETCARE", "1 LTR", 1, 5, "8901234500080", 3, "", [["CV1010", "2027-11-30", 450, 330, 6]]],
    ["CROCIN ADVANCE TAB", "GSK", "15 TAB", 15, 12, "8901234500097", 10, "Paracetamol 500mg", [["CR0921", "2026-10-31", 30, 21, 4]]],
  ];
  for (const [name, company, packing, packSize, gst, barcode, reorder, composition, batches] of products) {
    const id = uuid();
    db.tables.products.push({ id, name, company, packing, pack_size: packSize, hsn: "3004", gst_rate: gst, barcode, reorder_level: reorder, composition, active: true, created_at: created });
    for (const [batchNo, expiry, mrp, rate, packs] of batches) {
      db.tables.batches.push({ id: uuid(), product_id: id, batch_no: batchNo, expiry, mrp, purchase_rate: rate, stock_units: packs * packSize, created_at: created });
    }
  }

  db.tables.customers.push(
    { id: uuid(), name: "Mahadev Jadhav", phone: "9822111111", address: "Arag", opening_balance: 300, created_at: created },
    { id: uuid(), name: "Sunita Patil", phone: "9822000000", address: "Arag", opening_balance: 0, created_at: created },
  );

  // A purchase bill from earlier this week and a few bills today, so every screen has something to show.
  const productId = (name: string) => db.tables.products.find((p) => p.name === name)!.id;
  createPurchase({
    supplier_id: supplierId, supplier_bill_no: "SPD/4471", bill_date: istToday(-2), payment_mode: "credit", adjustment: 0, narration: "",
    items: [{ product_id: productId("PAN 40 TAB"), batch_no: "PN8812", expiry_month: 1, expiry_year: 2028, mrp: 155, rate: 105, qty: 10, free_qty: 1, discount_pct: 0 }],
  });
  const batchOf = (name: string) => db.tables.batches.filter((b) => b.product_id === productId(name) && (b.expiry as string) >= istToday()).sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)))[0].id;
  createSale({ pin: "1234", payment_mode: "cash", discount_pct: 0, items: [{ batch_id: batchOf("DICLOSAID GEL"), units: 1 }, { batch_id: batchOf("BETAPOD 200 TAB"), units: 2 }] });
  createSale({ pin: "1234", payment_mode: "upi", discount_pct: 5, patient_name: "Sunita Patil", patient_phone: "9822000000", doctor_name: "Dr. Kulkarni", items: [{ batch_id: batchOf("PAN 40 TAB"), units: 15 }, { batch_id: batchOf("DOLO 650 TAB"), units: 10 }] });
  createSale({ pin: "1234", payment_mode: "credit", discount_pct: 0, patient_name: "Mahadev Jadhav", patient_phone: "9822111111", items: [{ batch_id: batchOf("CALCIUM VET LIQUID"), units: 1 }] });
  const history: [number, string, [string, number][], number][] = [
    [-1, "cash", [["DOLO 650 TAB", 30], ["ELECTRAL POWDER", 4]], 0], [-1, "upi", [["PAN 40 TAB", 15]], 0],
    [-2, "cash", [["BETAPOD 200 TAB", 10]], 5], [-3, "upi", [["DICLOSAID GEL", 2], ["DOLO 650 TAB", 15]], 0],
    [-4, "card", [["PANTOCID 40 TAB", 15]], 0], [-5, "cash", [["ELECTRAL POWDER", 6], ["CALPOL 650 TAB", 15]], 0],
    [-6, "upi", [["PAN 40 TAB", 30], ["DOLO 650 TAB", 10]], 10], [-8, "cash", [["AZITHRAL 500 TAB", 5]], 0],
    [-10, "upi", [["DICLOSAID GEL", 1]], 0], [-13, "cash", [["CALPOL 650 TAB", 30]], 0],
  ];
  for (const [offset, mode, items, disc] of history) {
    const sale = createSale({ pin: "1234", payment_mode: mode, discount_pct: disc, items: items.map(([name, units]) => ({ batch_id: batchOf(name), units })) }, istToday(offset));
    const row = db.tables.sales.find((s) => s.id === sale.id)!;
    row.created_at = new Date(Date.parse(`${istToday(offset)}T${String(9 + ((offset * -7) % 12)).padStart(2, "0")}:20:00+05:30`)).toISOString();
  }
  // Bill numbers should follow dates, so renumber the sample bills in date order.
  const ordered = [...db.tables.sales].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  ordered.forEach((s, i) => { s.bill_no = i + 1; });
  return db;
}
