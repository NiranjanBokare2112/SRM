import { Clock3, Phone } from "lucide-react";
import { business } from "@/lib/business";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { LocationCard, OpenStatus, PrescriptionCTA, SectionHeading, SiteShell } from "@/components/site";

export const metadata = {
  title: "Contact",
  description: "Contact Shreeram Medical in Arag. Find our phone number, opening hours, store address and Google Maps location.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact | ${business.name}`,
    description: "Contact Shreeram Medical in Arag. Find our phone number, opening hours, store address and Google Maps location.",
    url: `${business.siteUrl}/contact`,
    type: "website",
    locale: "en_IN",
    siteName: business.name,
  },
};

export default function ContactPage() {
  return (
    <SiteShell>
      <section className="hero-shell">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <SectionHeading eyebrow={`Contact ${business.name}`} title="We are easy to reach." text="Call, message or find your way to the store in Arag." />
          <OpenStatus className="mt-6" />
        </div>
      </section>
      <section className="pb-4">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <a className="contact-action" href={business.phoneHref}><Phone size={20} /><span><small>Phone</small>{business.phoneDisplay}</span></a>
            <a className="contact-action" href={business.whatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon size={20} /><span><small>WhatsApp</small>Message us</span></a>
            <div className="contact-action"><Clock3 size={20} /><span><small>Business hours</small>Open daily, {business.hours}</span></div>
          </div>
        </div>
      </section>
      <LocationCard />
      <PrescriptionCTA />
    </SiteShell>
  );
}
