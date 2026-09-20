import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { business } from "@/lib/business";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(business.siteUrl),
  title: {
    default: "Shree Ram Medical | Medical Store in Arag, Maharashtra",
    template: `%s | ${business.name}`,
  },
  description:
    "Visit Shree Ram Medical in Arag, Maharashtra for local healthcare and medical needs. Find our location, opening hours, contact details and directions.",
  openGraph: {
    url: business.siteUrl,
    title: "Shree Ram Medical | Medical Store in Arag, Maharashtra",
    description:
      "Your local medical store in Arag. Find opening hours, contact details and directions.",
    type: "website",
    locale: "en_IN",
    siteName: business.name,
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Pharmacy",
    name: business.name,
    description: business.description,
    telephone: business.phoneDisplay,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address.street,
      addressLocality: business.address.locality,
      addressRegion: business.address.region,
      postalCode: business.address.postalCode,
      addressCountry: "IN",
    },
    areaServed: business.serviceArea,
    url: business.siteUrl,
  };

  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
