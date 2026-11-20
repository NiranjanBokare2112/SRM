const rupee = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (value: number | string | null | undefined) => rupee.format(Number(value ?? 0));
export const amount = (value: number | string | null | undefined) => plain.format(Number(value ?? 0));

/** Today's date in India as YYYY-MM-DD, regardless of the computer's time zone. */
export function istToday(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

export function firstOfMonth(monthsBack = 0) {
  const [y, m] = istToday().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  return date.toISOString().slice(0, 10);
}

export function lastOfMonth(monthsBack = 0) {
  const [y, m] = istToday().split("-").map(Number);
  const date = new Date(Date.UTC(y, m - monthsBack, 0));
  return date.toISOString().slice(0, 10);
}

/** 2027-10-31 -> 10/27 */
export function expiryLabel(isoDate: string) {
  const [y, m] = isoDate.split("-");
  return `${m}/${y.slice(2)}`;
}

export function dateLabel(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function timeLabel(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

/** Days from today (IST) until an ISO date. Negative when in the past. */
export function daysUntil(isoDate: string) {
  const today = Date.parse(istToday());
  return Math.round((Date.parse(isoDate) - today) / 86_400_000);
}

/** 25 units with pack size 10 -> "2 strips + 5". */
export function qtyLabel(units: number, packSize: number) {
  if (packSize <= 1 || units === 0) return String(units);
  const packs = Math.floor(units / packSize);
  const loose = units % packSize;
  if (packs === 0) return `${loose} loose`;
  return loose ? `${packs} + ${loose} loose` : String(packs);
}

export function billNumber(fy: string, no: number) {
  return `${fy}/${String(no).padStart(4, "0")}`;
}

/** Parses "10/27", "1027", "10-2027" into { month, year }. */
export function parseExpiry(input: string): { month: number; year: number } | null {
  const digits = input.replace(/[^0-9/.-]/g, "").replace(/[.-]/g, "/");
  let month: number, year: number;
  if (digits.includes("/")) {
    const [m, y] = digits.split("/");
    month = Number(m); year = Number(y);
  } else if (digits.length === 4) {
    month = Number(digits.slice(0, 2)); year = Number(digits.slice(2));
  } else if (digits.length === 6) {
    month = Number(digits.slice(0, 2)); year = Number(digits.slice(2));
  } else return null;
  if (year < 100) year += 2000;
  if (!Number.isInteger(month) || month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { month, year };
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function below100(n: number) { return n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim(); }
function below1000(n: number) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ones[h]} Hundred` : "", r ? below100(r) : ""].filter(Boolean).join(" ");
}

/** Indian numbering: 1,23,456 -> "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees Only". */
export function rupeesInWords(value: number) {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  return `${parts.join(" ")} Rupees Only`;
}
