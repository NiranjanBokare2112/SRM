"use client";

import { DirectionsLink } from "@/components/DirectionsLink";
import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Bandage,
  Camera,
  CheckCircle2,
  Clock3,
  Compass,
  FileText,
  HeartPulse,
  Leaf,
  MapPin,
  Navigation,
  PawPrint,
  Phone,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Tablets,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { business } from "@/lib/business";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

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
    tone: "blue",
  },
  {
    name: "Veterinary Care",
    text: "Veterinary medicines and healthcare products for livestock and animals.",
    icon: Stethoscope,
    tone: "green",
  },
  {
    name: "Livestock Nutrition",
    text: "Calcium and nutritional products for cattle, buffaloes and other livestock.",
    icon: Leaf,
    tone: "amber",
  },
  {
    name: "Pet Food & Care",
    text: "Food and everyday care products for dogs, cats and other pets.",
    icon: PawPrint,
    tone: "rose",
  },
  {
    name: "Baby Care & Nutrition",
    text: "Baby food and everyday essentials for infants and young children.",
    icon: Baby,
    tone: "violet",
  },
  {
    name: "Personal Care & Cosmetics",
    text: "Personal care, grooming and everyday cosmetic products.",
    icon: Sparkles,
    tone: "rose",
  },
  {
    name: "First Aid & Medical Supplies",
    text: "Everyday first-aid and essential medical supplies.",
    icon: Bandage,
    tone: "blue",
  },
  {
    name: "Healthcare & Daily Essentials",
    text: "A broad range of commonly needed pharmacy and healthcare products.",
    icon: ShoppingBag,
    tone: "green",
  },
] as const;

/** Current hour and minute in India Standard Time, independent of the visitor's time zone. */
function getIndiaTime() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return read("hour") + read("minute") / 60;
}

function useStoreOpen() {
  // null until mounted, so the server render and first client render match.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => {
      const now = getIndiaTime();
      setOpen(now >= business.openHour && now < business.closeHour);
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return open;
}

export function OpenStatus({ className = "" }: { className?: string }) {
  const open = useStoreOpen();
  if (open === null) return <span className={`open-status ${className}`} data-state="loading" aria-hidden="true">{business.hours}</span>;
  return (
    <span className={`open-status ${className}`} data-state={open ? "open" : "closed"} role="status">
      <span className="open-status-dot" aria-hidden="true" />
      {open ? "Open now" : "Closed now"}
      <span className="open-status-hours">· {open ? "until 10 PM" : "opens 8 AM"}</span>
    </span>
  );
}

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setIsOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [isOpen]);
  return (
    <header ref={headerRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false); }} className="sticky top-0 z-40 border-b border-[var(--line)]/80 bg-[var(--background)]/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
        <BrandLogo />
        <nav className="desktop-nav items-center gap-5 lg:gap-8" aria-label="Primary navigation">
          {navItems.map((item) => <Link key={item.href} href={item.href} className="nav-link" aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <div className="desktop-contact">
          <div className="flex items-center gap-4">
            <OpenStatus className="hidden lg:inline-flex" />
            <a className="button button-small button-dark" href={business.phoneHref}><Phone size={16} /> Contact us</a>
          </div>
        </div>
        <button ref={menuButtonRef} className="icon-button mobile-menu-button" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-controls="mobile-navigation" aria-label={isOpen ? "Close menu" : "Open menu"}>
          <span className="menu-icon" aria-hidden="true"><span /><span /><span /></span>
        </button>
      </div>
      <nav id="mobile-navigation" className="mobile-nav mobile-menu-panel" data-open={isOpen} inert={!isOpen} aria-hidden={!isOpen} aria-label="Mobile navigation">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setIsOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-[var(--green-deep)] hover:bg-[var(--teal)]">{item.label}</Link>)}
          <a className="button button-dark mt-2" href={business.phoneHref}><Phone size={16} /> Contact us</a>
        </div>
      </nav>
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
          <a className="button button-whatsapp" href={business.whatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon size={17} /> WhatsApp</a>
          <DirectionsLink className="button button-light"><Navigation size={17} /> Get directions</DirectionsLink>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--ink-muted)]">
          <OpenStatus />
          <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-[var(--green)]" /> Open daily, {business.hours}</span>
        </div>
      </div>
      <div className="hero-visual" aria-label="Abstract pharmacy illustration">
        <div className="visual-ring visual-ring-one" /><div className="visual-ring visual-ring-two" />
        <div className="visual-card">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--green)]">{business.name}</span><HeartPulse size={20} className="text-[var(--coral)]" /></div>
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
  return <section className="border-b border-[var(--line)] bg-white"><div className="mx-auto grid max-w-7xl info-grid px-5 lg:px-8">{items.map(([Icon, value, label]) => <div key={label} className="info-item"><Icon size={20} className="shrink-0 text-[var(--green)]" /><div><p className="text-sm font-semibold text-[var(--green-deep)]">{value}</p><p className="mt-0.5 text-xs text-[var(--ink-muted)]">{label}</p></div></div>)}</div></section>;
}

export function SectionHeading({ eyebrow, title, text, align = "left" }: { eyebrow: string; title: string; text?: string; align?: "left" | "center" }) {
  return <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}><p className={align === "center" ? "eyebrow justify-center" : "eyebrow"}>{eyebrow}</p><h2 className="section-heading mt-3">{title}</h2>{text && <p className="mt-4 leading-7 text-[var(--ink-muted)]">{text}</p>}</div>;
}

export function CategoryGrid({ preview = false }: { preview?: boolean }) {
  const list = preview ? categories.slice(0, 3) : categories;
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${preview ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
      {list.map(({ name, text, icon: Icon, tone }) => (
        <div key={name} className={`category-card ${preview ? "last:sm:col-span-2 last:lg:col-span-1" : ""}`} data-tone={tone}>
          <span className="category-icon"><Icon size={21} /></span>
          <h3 className="mt-5 font-semibold text-[var(--green-deep)]">{name}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{text}</p>
        </div>
      ))}
    </div>
  );
}

export function PrescriptionCTA() {
  const steps = [
    [Camera, "Take a clear photo", "Photograph your doctor's prescription or the medicine strip."],
    [WhatsAppIcon, "Send it on WhatsApp", "Share it with us along with your name."],
    [CheckCircle2, "We confirm availability", "We reply to let you know what is in stock before you visit."],
  ] as const;
  return (
    <section className="section-space">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="prescription-shell">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow"><FileText size={14} /> Have a prescription?</p>
              <h2 className="section-heading mt-3">Send a photo, we&apos;ll check what&apos;s in stock.</h2>
              <p className="mt-4 max-w-md leading-7 text-[var(--ink-muted)]">Save a trip. Share your prescription with us on WhatsApp and we will confirm availability before you come to the store.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a className="button button-whatsapp" href={business.prescriptionWhatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon size={17} /> Send prescription</a>
                <a className="button button-light" href={business.phoneHref}><Phone size={17} /> Call instead</a>
              </div>
            </div>
            <ol className="grid gap-3">
              {steps.map(([Icon, title, text], index) => (
                <li key={title} className="prescription-step">
                  <span className="prescription-step-number" aria-hidden="true">{index + 1}</span>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-[var(--green-deep)]"><Icon size={17} className="text-[var(--green)]" /> {title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutPreview() {
  return (
    <section className="section-space">
      <div className="mx-auto grid max-w-7xl gap-6 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
        <div>
          <p className="eyebrow">About the store</p>
          <h2 className="section-heading mt-3 max-w-lg">Healthcare, close to home.</h2>
        </div>
        <div className="lg:border-l lg:border-[var(--line)] lg:pl-12">
          <p className="max-w-xl text-base leading-7 text-[var(--ink-muted)] sm:text-lg sm:leading-8">{business.name} is a local medical store in Arag, making it easier to find everyday healthcare support close to where you live and work.</p>
          <Link href="/about" className="text-link mt-6">Learn more about us <ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>
  );
}

export function WhyChoose() {
  const benefits = [[MapPin, "Convenient local location", "Find us at Mahavir Chowk on Main Road, Arag."], [Phone, "Easy to contact", "Call or message the store directly when you have a question."], [Clock3, "Open 8 AM to 10 PM", "A broad window for your local healthcare needs."], [HeartPulse, "Healthcare access nearby", "A straightforward, familiar place to start your pharmacy visit."] ] as const;
  return <section className="section-band"><div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionHeading eyebrow="Why choose us" title="A dependable local stop for healthcare." text="The essentials of a good local medical store: clear information, a convenient location and a direct human connection." align="center" /><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{benefits.map(([Icon, title, text]) => <div className="trust-card" key={title}><span className="trust-icon"><Icon size={21} /></span><h3 className="mt-5 font-semibold text-[var(--green-deep)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{text}</p></div>)}</div></div></section>;
}

export function LocationCard() {
  return (
    <section className="section-space" id="location">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8">
        <div>
          <SectionHeading eyebrow="Visit us" title="Find us in Arag." text="Right on Main Road at Mahavir Chowk, easy to reach from anywhere in the village." />
          <div className="mt-8 flex gap-4">
            <MapPin size={21} className="mt-1 shrink-0 text-[var(--green)]" />
            <address className="not-italic leading-7 text-[var(--ink-muted)]">
              <span className="font-semibold text-[var(--green-deep)]">{business.name}</span><br />
              {business.fullAddress}
            </address>
          </div>
          <div className="mt-4 flex gap-4">
            <Clock3 size={21} className="mt-0.5 shrink-0 text-[var(--green)]" />
            <div className="flex flex-col gap-2 text-[var(--ink-muted)]"><span>Open daily, {business.hours}</span><OpenStatus className="w-fit" /></div>
          </div>
          <DirectionsLink className="button button-dark mt-8"><Navigation size={17} /> Get directions</DirectionsLink>
        </div>
        <div className="map-frame">
          <iframe
            title={`Map showing ${business.name} in Arag`}
            src={business.mapEmbedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}

export function CTASection() {
  return <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-20"><div className="cta-shell mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 py-9 sm:px-10 lg:flex-row lg:items-center"><div><p className="eyebrow cta-eyebrow">Need to reach us?</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">Call or message {business.name} directly.</h2></div><div className="flex shrink-0 flex-col gap-3 sm:flex-row"><a className="button button-coral" href={business.phoneHref}><Phone size={17} /> Call now</a><a className="button button-outline" href={business.whatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon size={17} /> WhatsApp</a></div></div></section>;
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_1fr_1fr] lg:px-8">
        <div>
          <BrandLogo size="sm" />
          <p className="mt-5 max-w-xs text-sm leading-6 text-[var(--ink-muted)]">A local medical store for everyday healthcare needs in Arag.</p>
          <OpenStatus className="mt-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--green-deep)]">Explore</h2>
          <div className="mt-4 flex flex-col gap-3">{navItems.map((item) => <Link className="text-sm text-[var(--ink-muted)] hover:text-[var(--green)]" key={item.href} href={item.href}>{item.label}</Link>)}</div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--green-deep)]">Contact</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm text-[var(--ink-muted)]">
            <a className="footer-link" href={business.phoneHref}><Phone size={15} /> {business.phoneDisplay}</a>
            <a className="footer-link" href={business.whatsappHref} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} /> WhatsApp us</a>
            <a className="footer-link" href={business.prescriptionWhatsappHref} target="_blank" rel="noreferrer"><FileText size={15} /> Send a prescription</a>
            <DirectionsLink className="footer-link"><Navigation size={15} /> Get directions</DirectionsLink>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--green-deep)]">Visit</h2>
          <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">{business.fullAddress}</p>
          <p className="mt-3 text-sm text-[var(--ink-muted)]">Open daily, {business.hours}</p>
          <Link className="owner-portal-link mt-4" href="/admin/login">Staff login</Link>
        </div>
      </div>
      <div className="border-t border-[var(--line)] px-5 py-5 text-center text-xs text-[var(--ink-muted)]">© 2026 {business.name}. All rights reserved.</div>
    </footer>
  );
}

export function FloatingActions() {
  return <div className="floating-actions md:hidden"><a href={business.phoneHref} aria-label={`Call ${business.name}`}><Phone size={18} /><span>Call</span></a><a href={business.whatsappHref} target="_blank" rel="noreferrer" aria-label={`Message ${business.name} on WhatsApp`}><WhatsAppIcon size={18} /><span>WhatsApp</span></a><DirectionsLink aria-label={`Get directions to ${business.name}`}><Navigation size={18} /><span>Directions</span></DirectionsLink></div>;
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = mainRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(entry => entry.isIntersecting);
      visible.forEach((entry, index) => {
        observer.unobserve(entry.target);
        const card = entry.target.matches(".category-card, .trust-card, .prescription-step");
        const animation = entry.target.animate(
          [{ opacity: 0, translate: "0 16px" }, { opacity: 1, translate: "0 0" }],
          { duration: card ? 700 : 550, delay: card ? Math.min(index, 3) * 90 : 0, easing: "cubic-bezier(0.2, 0.65, 0.3, 1)", fill: "backwards" }
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      });
    }, { threshold: 0.12 });
    root.querySelectorAll(".section-heading, .display-heading, .category-card, .trust-card, .prescription-step").forEach(element => observer.observe(element));
    const stop = () => {
      observer.disconnect();
      animations.forEach(animation => animation.cancel());
      animations.clear();
    };
    motion.addEventListener("change", stop);
    return () => { stop(); motion.removeEventListener("change", stop); };
  }, [pathname]);

  return <div className="site-shell"><Header key={pathname} /><main ref={mainRef}>{children}</main><Footer /><FloatingActions /></div>;
}
