import { SaleDetail } from "@/components/admin/SaleDetail";

export const metadata = { title: "Bill" };

export default async function SalePage({ params }: PageProps<"/admin/sales/[id]">) {
  const { id } = await params;
  return <SaleDetail id={id} />;
}
