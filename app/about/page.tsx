import { ShieldCheck } from "lucide-react";
import { CTASection, SectionHeading, SiteShell } from "@/components/site";

export const metadata = { title: "About" };

export default function AboutPage() {
  return <SiteShell><section className="hero-shell"><div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24"><SectionHeading eyebrow="About Shree Ram Medical" title="Healthcare, close to home." text="Shree Ram Medical is a local medical store in Arag, Maharashtra, making everyday healthcare access more convenient for the people around us." /></div></section><section className="section-space"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="flex flex-col justify-center"><SectionHeading eyebrow="Our approach" title="Simple, direct and nearby." text="When you need a medical store, useful information should be easy to find. We keep this website focused on the essentials: where to find us, when we are open and how to contact the store." /><div className="mt-8 flex gap-4 border-t border-[var(--line)] pt-6"><ShieldCheck className="shrink-0 text-[var(--green)]" size={22} /><p className="text-sm leading-6 text-[var(--ink-muted)]">For product-specific questions, please contact the pharmacy directly so our team can guide you based on availability.</p></div></div></div></section><CTASection /></SiteShell>;
}
