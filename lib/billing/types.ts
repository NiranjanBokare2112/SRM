export type PaymentMode = "cash" | "upi" | "card" | "credit";

export const paymentModes: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "credit", label: "Credit (Udhaar)" },
];

export const modeLabel = (mode: string) => ({ cash: "Cash", upi: "UPI", card: "Card", credit: "Credit", cheque: "Cheque", bank: "Bank" } as Record<string, string>)[mode] ?? mode;

export const gstRates = [0, 5, 12, 18, 28] as const;

export type ShopSettings = {
  shop_name: string;
  address: string;
  phone: string;
  gstin: string;
  drug_license: string;
  print_format: "a5" | "thermal";
  bill_footer: string;
  require_staff_pin: boolean;
};

export type Product = {
  id: string;
  name: string;
  company: string;
  packing: string;
  pack_size: number;
  hsn: string;
  gst_rate: number;
  barcode: string | null;
  reorder_level: number;
  active: boolean;
  composition?: string;
};

export type ProductStock = Pick<Product, "id" | "name" | "company" | "packing" | "pack_size" | "gst_rate" | "barcode" | "reorder_level" | "active"> & {
  stock_units: number;
  expired_units: number;
  next_expiry: string | null;
  stock_value: number;
};

export type Batch = {
  id: string;
  product_id: string;
  batch_no: string;
  expiry: string;
  mrp: number;
  /** Owner-only; absent in the cost-free batches_public view. */
  purchase_rate?: number;
  stock_units: number;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  gstin: string;
  address: string;
  opening_balance: number;
  active: boolean;
};

export type Sale = {
  id: string;
  fy: string;
  bill_no: number;
  bill_date: string;
  created_at: string;
  staff_name: string;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  payment_mode: PaymentMode;
  gross: number;
  discount_pct: number;
  discount: number;
  taxable: number;
  gst: number;
  round_off: number;
  net: number;
  cost: number;
  returned_amount: number;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  batch_id: string;
  product_name: string;
  packing: string;
  pack_size: number;
  batch_no: string;
  expiry: string;
  mrp: number;
  gst_rate: number;
  units: number;
  amount: number;
  net_amount: number;
  taxable: number;
  gst: number;
  returned_units: number;
};

export type Staff = { id: string; name: string; active: boolean };

/** Supabase RPC errors raised by our functions carry a readable message; anything else gets a generic one. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error && typeof error === "object" && "message" in error) {
    const e = error as { message?: string; code?: string };
    if (e.code === "P0001" || e.code === "23505") {
      if (e.code === "23505") return "This already exists. Please check for a duplicate.";
      return e.message ?? fallback;
    }
    if (e.code === "42501") return "Your account does not have owner access.";
    if (e.message?.includes("Failed to fetch")) return "No internet connection. Please check and try again.";
  }
  return fallback;
}
