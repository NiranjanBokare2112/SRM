import { CategoryGrid, CTASection, SectionHeading, SiteShell, VisitStoreCTA } from "@/components/site";

export const metadata = { title: "Healthcare Categories | Shree Ram Medical" };

export default function ServicesPage() {
  return (
    <SiteShell>
      <section className="hero-shell">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <SectionHeading 
            eyebrow="Healthcare categories" 
            title="Medicines, healthcare essentials, baby care and more." 
            text="Explore the diverse range of products available at Shree Ram Medical, from everyday medicines to personal care, veterinary products and beyond."
          />
        </div>
      </section>

      <section className="section-space">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl mb-10">
            <p className="eyebrow">More Than Just a Medical Store</p>
            <p className="mt-6 text-lg leading-8 text-[var(--ink-muted)]">
              From everyday medicines and first-aid essentials to baby care, personal care, pet food and veterinary products, Shree Ram Medical offers a broad range of everyday healthcare and wellness needs.
            </p>
          </div>
          <CategoryGrid />
        </div>
      </section>

      <VisitStoreCTA />
      <CTASection />
    </SiteShell>
  );
}
