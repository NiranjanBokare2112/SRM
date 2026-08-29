"use client";

import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Bandage,
  ChevronRight,
  Clock3,
  Compass,
  HeartPulse,
  Leaf,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  PawPrint,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Tablets,
  X,
} from "lucide-react";
import { useState } from "react";
import { addressLines, business } from "@/lib/business";
import { BrandLogo } from "@/components/brand/BrandLogo";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
];

const categories = [
  { 
    name: "Medicines & Pharmacy Essentials", 
    text: "Everyday medicines and essential pharmacy products for your healthcare needs.",
    icon: Tablets,
    featured: true
  },
  { 
    name: "Veterinary Care", 
    text: "Veterinary medicines and healthcare products for livestock and animals.",
    icon: Stethoscope,
    featured: false
  },
  { 
    name: "Livestock Nutrition", 
    text: "Calcium and nutritional products for cattle, buffaloes and other livestock.",
    icon: Leaf,
    featured: false
  },
  { 
    name: "Pet Food & Care", 
    text: "Food and everyday care products for dogs, cats and other pets.",
    icon: PawPrint,
    featured: false
  },
  { 
    name: "Baby Care & Nutrition", 
    text: "Baby food and everyday essentials for infants and young children.",
    icon: Baby,
    featured: false
  },
  { 
    name: "Personal Care & Cosmetics", 
    text: "Personal care, grooming and everyday cosmetic products.",
    icon: Sparkles,
    featured: false
  },
  { 
    name: "First Aid & Medical Supplies", 
    text: "Everyday first-aid and essential medical supplies.",
    icon: Bandage,
    featured: false
  },
  { 
    name: "Healthcare & Daily Essentials", 
    text: "A broad range of commonly needed pharmacy and healthcare products.",
    icon: ShoppingBag,
    featured: false
  },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)]/80 bg-[var(--background)]/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <BrandLogo />
        <nav className="desktop-nav items-center gap-8" aria-label="Primary navigation">
          {navItems.map((item) => <Link key={item.href} href={item.href} className="nav-link">{item.label}</Link>)}
        </nav>
        <div className="desktop-contact">
          <a className="button button-small button-dark" href={business.phoneHref}><Phone size={16} /> Contact us</a>
        </div>
        <button className="icon-button mobile-menu-button" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-controls="mobile-navigation" aria-label={isOpen ? "Close menu" : "Open menu"}>
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {isOpen && <nav id="mobile-navigation" className="mobile-nav border-t border-[var(--line)] bg-[var(--background)] px-5 py-4" aria-label="Mobile navigation">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-[var(--green-deep)] hover:bg-[var(--teal)]">{item.label}</Link>)}
          <a className="button button-dark mt-2" href={business.phoneHref}><Phone size={16} /> Contact us</a>
        </div>
      </nav>}
    </header>
  );
}

export function Hero() {
  return <section className="hero-shell overflow-hidden">
    <div className="hero-pattern" aria-hidden="true" />
    <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
      <div className="max-w-2xl">
        <p className="eyebrow"><span className="eyebrow-dot" /> Local healthcare, close to home</p>
        <h1 className="display-heading mt-5">Your trusted medical store <em>in Arag.</em></h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-[var(--ink-muted)] sm:text-lg">{business.description}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a className="button button-dark" href={business.phoneHref}><Phone size={17} /> Call now</a>
          <a className="button button-light" href={business.googleMapsUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> Get directions</a>
          <a className="button button-whatsapp" href={business.whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a>
        </div>
        <div className="mt-9 flex items-center gap-3 text-sm text-[var(--ink-muted)]"><ShieldCheck size={18} className="text-[var(--green)]" /> A familiar local point of care in {business.serviceArea}</div>
      </div>
      <div className="hero-visual" aria-label="Abstract pharmacy illustration">
        <div className="visual-ring visual-ring-one" /><div className="visual-ring visual-ring-two" />
        <div className="visual-card">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--green)]">Shree Ram Medical</span><HeartPulse size={20} className="text-[var(--coral)]" /></div>
          <div className="visual-cross"><span /><span /></div>
          <p className="mt-7 text-2xl font-semibold leading-tight text-[var(--green-deep)]">Care that feels<br /><span className="text-[var(--coral)]">close by.</span></p>
          <div className="mt-8 flex items-center gap-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--ink-muted)]"><MapPin size={15} className="text-[var(--green)]" /> Arag, Maharashtra</div>
        </div>
      </div>
    </div>
  </section>;
}

export function InfoStrip() {
  const items = [[Clock3, business.hours, "Opening hours"], [MapPin, business.serviceArea, "Local store"], [Phone, "Call us", business.phoneDisplay], [Compass, "Easy directions", "Find the store"]] as const;
  return <section className="border-b border-[var(--line)] bg-white"><div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-[var(--line)] px-5 sm:grid-cols-4 sm:divide-y-0 lg:px-8">{items.map(([Icon, value, label]) => <div key={label} className="flex items-center gap-3 px-3 py-5 first:pl-0 sm:py-6"><Icon size={20} className="shrink-0 text-[var(--green)]" /><div><p className="text-sm font-semibold text-[var(--green-deep)]">{value}</p><p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">{label}</p></div></div>)}</div></section>;
}

export function SectionHeading({ eyebrow, title, text, align = "left" }: { eyebrow: string; title: string; text?: string; align?: "left" | "center" }) {
  return <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}><p className="eyebrow">{eyebrow}</p><h2 className="section-heading mt-3">{title}</h2>{text && <p className="mt-4 leading-7 text-[var(--ink-muted)]">{text}</p>}</div>;
}

export function CategoryGrid({ preview = false }: { preview?: boolean }) {
  const list = preview ? categories.slice(0, 3) : categories;
  const featured = list.find(c => c.featured);
  const others = list.filter(c => !c.featured);
  
  return (
    <div className="space-y-6">
      {featured && (
        <div className="category-card category-card-featured p-6 sm:p-8">
          <span className="category-icon h-16 w-16"><featured.icon size={32} /></span>
          <h3 className="mt-6 text-2xl font-semibold text-[var(--green-deep)]">{featured.name}</h3>
          <p className="mt-4 text-base leading-7 text-[var(--ink-muted)] max-w-2xl">{featured.text}</p>
          <div className="mt-6 flex items-center gap-2">
            <ChevronRight size={18} className="text-[var(--coral)]" />
            <span className="text-sm font-medium text-[var(--brand-blue)]">Available in store</span>
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {others.map(({ name, text, icon: Icon }) => (
          <div key={name} className="category-card">
            <span className="category-icon"><Icon size={21} /></span>
            <h3 className="mt-5 font-semibold text-[var(--green-deep)]">{name}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{text}</p>
            <ChevronRight size={16} className="mt-5 text-[var(--coral)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutPreview() {
  return <section className="section-space"><div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:gap-20 lg:px-8"><div className="about-visual"><div className="about-label"><HeartPulse size={18} /> Local healthcare</div><div className="about-sun" /><div className="about-line line-one" /><div className="about-line line-two" /><span className="about-caption">ARAG · MAHARASHTRA</span></div><div><SectionHeading eyebrow="About the store" title="Healthcare, close to home." text="Shree Ram Medical is a local medical store in Arag, making it easier to find everyday healthcare support close to where you live and work." /><Link href="/about" className="text-link mt-7">Learn more about us <ArrowRight size={16} /></Link></div></div></section>;
}

export function WhyChoose() {
  const benefits = [[MapPin, "Convenient local location", "Find us at Mahavir Chowk on Main Road, Arag."], [Phone, "Easy to contact", "Call or message the store directly when you have a question."], [Clock3, "Open 8 AM to 10 PM", "A broad window for your local healthcare needs."], [HeartPulse, "Healthcare access nearby", "A straightforward, familiar place to start your pharmacy visit."] ] as const;
  return <section className="section-band"><div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionHeading eyebrow="Why choose us" title="A dependable local stop for healthcare." text="The essentials of a good local medical store: clear information, a convenient location and a direct human connection." align="center" /><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{benefits.map(([Icon, title, text]) => <div className="trust-card" key={title}><Icon size={22} className="text-[var(--coral)]" /><h3 className="mt-5 font-semibold text-[var(--green-deep)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{text}</p></div>)}</div></div></section>;
}

export function VisitStoreCTA() {
  return (
    <section className="section-space">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-8">
          <p className="eyebrow justify-center">Looking for something specific?</p>
          <h2 className="section-heading mt-3">Visit Shree Ram Medical or contact us to check availability.</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a className="button button-dark" href={business.phoneHref}>
            <Phone size={17} /> Call Now
          </a>
          <a className="button button-whatsapp" href={business.whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> WhatsApp Us
          </a>
          <a className="button button-light" href={business.googleMapsUrl} target="_blank" rel="noreferrer">
            <Navigation size={17} /> Get Directions
          </a>
        </div>
      </div>
    </section>
  );
}

export function LocationCard() {
  return <section className="section-space" id="location"><div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8"><div><SectionHeading eyebrow="Visit us" title="Find us in Arag." text="A local landmark and a simple route to your pharmacy visit." /><div className="mt-8 flex gap-4"><MapPin size={21} className="mt-1 shrink-0 text-[var(--green)]" /><address className="not-italic leading-7 text-[var(--ink-muted)]">{addressLines.map((line) => <span className="block" key={line}>{line}</span>)}</address></div><a className="button button-dark mt-8" href={business.googleMapsUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> Get directions</a></div><div className="map-placeholder"><div className="map-grid" /><div className="map-pin"><MapPin size={22} /></div><p className="absolute bottom-5 left-5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-[var(--green-deep)] shadow-sm">Mahavir Chowk · Arag</p></div></div></section>;
}

export function ContactPanel() {
  return <section className="section-band" id="contact"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><SectionHeading eyebrow="Contact" title="A quick conversation is just a call away." text="For general pharmacy enquiries, contact Shree Ram Medical directly." /><div className="grid gap-3 sm:grid-cols-3"><a className="contact-action" href={business.phoneHref}><Phone size={19} /><span><small>Phone</small>{business.phoneDisplay}</span></a><a className="contact-action" href={business.whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={19} /><span><small>WhatsApp</small>Message us</span></a><a className="contact-action" href={business.googleMapsUrl} target="_blank" rel="noreferrer"><Navigation size={19} /><span><small>Location</small>Get directions</span></a></div></div></div></section>;
}

export function CTASection() {
  return <section className="px-5 pb-16 pt-4 lg:px-8 lg:pb-24"><div className="cta-shell mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 py-9 sm:px-10 lg:flex-row lg:items-center"><div><p className="eyebrow text-white/80">Need to reach us?</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">Call or message Shree Ram Medical directly.</h2></div><div className="flex flex-col gap-3 sm:flex-row"><a className="button button-coral" href={business.phoneHref}><Phone size={17} /> Call now</a><a className="button button-outline" href={business.whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp</a></div></div></section>;
}

export function Footer() {
  return <footer className="border-t border-[var(--line)] bg-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.8fr_1fr] lg:px-8"><div><BrandLogo size="sm" /><p className="mt-5 max-w-xs text-sm leading-6 text-[var(--ink-muted)]">A local medical store for everyday healthcare needs in Arag.</p></div><div><h2 className="text-sm font-semibold text-[var(--green-deep)]">Explore</h2><div className="mt-4 flex flex-col gap-3">{navItems.map((item) => <Link className="text-sm text-[var(--ink-muted)] hover:text-[var(--green)]" key={item.href} href={item.href}>{item.label}</Link>)}</div></div><div><h2 className="text-sm font-semibold text-[var(--green-deep)]">Visit</h2><p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">{business.address.street}<br />{business.address.locality}, {business.address.region} {business.address.postalCode}</p><p className="mt-3 text-sm text-[var(--ink-muted)]">{business.hours}</p><Link className="owner-portal-link mt-4" href="/admin/login">Owner Portal</Link></div></div><div className="border-t border-[var(--line)] px-5 py-5 text-center text-xs text-[var(--ink-muted)]">© 2026 {business.name}. All rights reserved.</div></footer>;
}

export function FloatingActions() {
  return <div className="floating-actions md:hidden"><a href={business.phoneHref} aria-label="Call Shree Ram Medical"><Phone size={18} /><span>Call</span></a><a href={business.whatsappHref} target="_blank" rel="noreferrer" aria-label="Message Shree Ram Medical on WhatsApp"><MessageCircle size={18} /><span>WhatsApp</span></a><a href={business.googleMapsUrl} target="_blank" rel="noreferrer" aria-label="Get directions to Shree Ram Medical"><Navigation size={18} /><span>Directions</span></a></div>;
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return <><Header /><main>{children}</main><Footer /><FloatingActions /></>;
}
