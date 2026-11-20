import { ReturnsScreen } from "@/components/admin/ReturnsScreen";

export const metadata = { title: "Sales Return" };

export default async function ReturnsPage({ searchParams }: PageProps<"/admin/returns">) {
  const { bill } = await searchParams;
  return <ReturnsScreen initialBillId={typeof bill === "string" ? bill : undefined} />;
}
