import { SalePrint } from "@/components/admin/SalePrint";

export const metadata = { title: "Print Bill", robots: { index: false, follow: false } };

export default async function PrintSalePage({ params, searchParams }: PageProps<"/admin/print/sale/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const format = query.format === "thermal" || query.format === "a5" ? query.format : undefined;
  return <SalePrint id={id} format={format} autoprint={query.autoprint === "1"} toolbar={query.autoprint !== "1" && query.embed !== "1"} />;
}
