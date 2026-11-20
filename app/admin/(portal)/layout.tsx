import "../admin.css";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = {
  title: { default: "Billing", template: "%s | Shreeram Medical Billing" },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
