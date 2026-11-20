import { PurchasesList } from "@/components/admin/PurchasesList";

export const metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }: PageProps<"/admin/purchases">) {
  const { saved } = await searchParams;
  return <PurchasesList saved={typeof saved === "string" ? saved : undefined} />;
}
