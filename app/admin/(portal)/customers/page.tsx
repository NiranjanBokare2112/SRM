import { CustomersScreen } from "@/components/admin/CustomersScreen";

export const metadata = { title: "Customers & Udhaar" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const { q } = await searchParams;
  return <CustomersScreen key={String(q ?? "")} initialQuery={typeof q === "string" ? q : ""} />;
}
