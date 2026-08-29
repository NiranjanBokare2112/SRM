import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LoginForm, type LoginMode } from "@/components/admin/LoginForm";

export const metadata = {
  title: "Owner Login | Shreeram Medical",
  description: "Private owner access for the Shreeram Medical management portal.",
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const initialMode: LoginMode = params.mode === "reset" ? "reset" : "sign-in";

  return (
    <main className="admin-login-page">
      <div className="admin-login-grid">
        <section className="admin-login-brand-panel">
          <div className="admin-login-brand-content">
            <BrandLogo />
            <div className="admin-login-copy">
              <p className="eyebrow"><span className="eyebrow-dot" /> Owner management portal</p>
              <h2>Keep the store running with clarity.</h2>
              <p>Manage private pharmacy information in one focused, secure workspace.</p>
            </div>
            <div className="admin-login-trust"><ShieldCheck size={19} /><span>Private access for authorized owners only</span></div>
          </div>
        </section>
        <section className="admin-login-form-panel">
          <div className="admin-login-form-content">
            <Link href="/" className="admin-back-link"><ArrowLeft size={16} /> Back to website</Link>
            <LoginForm initialMode={initialMode} />
            <p className="mt-6 text-center text-xs leading-5 text-[var(--ink-muted)]">Your private records are protected by Supabase authentication and database authorization.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
