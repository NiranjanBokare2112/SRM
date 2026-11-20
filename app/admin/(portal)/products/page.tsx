import { ProductsScreen } from "@/components/admin/ProductsScreen";

export const metadata = { title: "Medicines & Stock" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const { filter, q } = await searchParams;
  return <ProductsScreen key={`${filter ?? "all"}|${q ?? ""}`} initialFilter={typeof filter === "string" ? filter : undefined} initialQuery={typeof q === "string" ? q : ""} />;
}
