import { DirectionsLink } from "@/components/DirectionsLink";
import { Clock3, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { business } from "@/lib/business";
import { ContactPanel, CTASection, LocationCard, SectionHeading, SiteShell } from "@/components/site";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return <SiteShell><section className="hero-shell"><div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24"><SectionHeading eyebrow="Contact Shree Ram Medical" title="We are easy to reach." text="Call, message or find your way to the store in Arag." /></div></section><section className="section-space"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="grid gap-4 sm:grid-cols-3"><a className="contact-action" href={business.phoneHref}><Phone size={20} /><span><small>Phone</small>{business.phoneDisplay}</span></a><a className="contact-action" href={business.whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={20} /><span><small>WhatsApp</small>Message us</span></a><div className="contact-action"><Clock3 size={20} /><span><small>Business hours</small>{business.hours}</span></div></div><div className="mt-12 grid gap-5 border-t border-[var(--line)] pt-10 sm:grid-cols-2"><div className="flex gap-4"><MapPin className="shrink-0 text-[var(--green)]" size={22} /><p className="text-sm leading-6 text-[var(--ink-muted)]">{business.address.street}<br />{business.address.locality}<br />{business.address.region} {business.address.postalCode}</p></div><DirectionsLink className="button button-dark w-fit self-start" ><Navigation size={17} /> Get directions</DirectionsLink></div></div></section><LocationCard /><ContactPanel /><CTASection /></SiteShell>;
}
