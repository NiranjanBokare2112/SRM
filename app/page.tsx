import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AboutPreview, CategoryGrid, ContactPanel, CTASection, Hero, InfoStrip, LocationCard, SectionHeading, SiteShell, WhyChoose } from "@/components/site";

export default function Home() {
  return <SiteShell><Hero /><InfoStrip /><AboutPreview /><section className="section-band" id="services"><div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionHeading eyebrow="What you can find" title="Healthcare categories, made easy to explore." text="These broad categories are here to help you know what to ask about in-store. Availability may vary." /><div className="mt-10"><CategoryGrid preview /><Link href="/services" className="text-link mt-8">View all categories <ArrowRight size={16} /></Link></div></div></section><WhyChoose /><LocationCard /><ContactPanel /><CTASection /></SiteShell>;
}
