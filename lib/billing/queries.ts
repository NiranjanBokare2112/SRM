"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { istToday } from "@/lib/billing/format";
import type { Batch, Product } from "@/lib/billing/types";

export const db = () => getSupabaseBrowserClient();

/** PostgREST filter strings treat , ( ) as syntax; strip them from user input. */
const clean = (q: string) => q.replace(/[,()%*\\]/g, " ").trim();
export const PRODUCT_COLUMNS = "id, name, company, packing, pack_size, hsn, gst_rate, barcode, reorder_level, active, composition";

export async function searchProducts(query: string, limit = 12): Promise<Product[]> {
  const q = clean(query);
  if (!q) return [];
  const { data, error } = await db()
    .from("products")
    .select("id, name, company, packing, pack_size, hsn, gst_rate, barcode, reorder_level, active, composition")
    .eq("active", true)
    .or(`name.ilike.%${q}%,barcode.eq.${q},company.ilike.${q}%,composition.ilike.%${q}%`)
    .order("name")
    .limit(40);
  if (error) throw error;
  const lower = q.toLowerCase();
  const rank = (p: Product) => (p.barcode === q ? 0 : p.name.toLowerCase().startsWith(lower) ? 1 : 2);
  return (data as Product[]).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Exact barcode match (scanner input). */
export async function productByBarcode(code: string): Promise<Product | null> {
  const { data } = await db().from("products").select(PRODUCT_COLUMNS).eq("active", true).eq("barcode", code.trim()).limit(1);
  return ((data ?? [])[0] as Product | undefined) ?? null;
}

/** Other active medicines with the same salt/composition (case-insensitive). */
export async function substitutesFor(product: Product): Promise<Product[]> {
  const comp = clean(product.composition ?? "");
  if (!comp) return [];
  const { data } = await db().from("products").select(PRODUCT_COLUMNS).eq("active", true).or(`composition.ilike.${comp}`).order("name").limit(20);
  return ((data ?? []) as Product[]).filter((p) => p.id !== product.id);
}

/** Sellable batches (in stock, not expired), earliest expiry first. */
export async function sellableBatches(productIds: string[]): Promise<Batch[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await db()
    .from("batches_public")
    .select("id, product_id, batch_no, expiry, mrp, stock_units")
    .in("product_id", productIds)
    .gt("stock_units", 0)
    .gte("expiry", istToday())
    .order("expiry");
  if (error) throw error;
  return data as Batch[];
}

/** Opens the bill print page in a hidden frame and prints it, without leaving the current screen. */
export function printSale(saleId: string, format?: "a5" | "thermal") {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.src = `/admin/print/sale/${saleId}?autoprint=1${format ? `&format=${format}` : ""}`;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 120_000);
}
