export const business = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  name: "Shree Ram Medical",
  tagline: "Your trusted medical store in Arag",
  description:
    "Medicines, healthcare essentials, baby care, personal care, veterinary products and more — conveniently available at Shree Ram Medical.",
  phoneDisplay: "+91 77419 77111",
  phoneHref: "tel:+917741977111",
  whatsappHref:
    "https://wa.me/917741977111?text=Hello%20Shree%20Ram%20Medical%2C%20I%20would%20like%20to%20check%20the%20availability%20of%20a%20product.",
  address: {
    street: "Mahavir Chowk, Palavi Enterprises, Main Road",
    locality: "Arag",
    area: "Taluka-Miraj",
    region: "Maharashtra",
    postalCode: "416401",
    country: "India",
  },
  hours: "8:00 AM – 10:00 PM",
  serviceArea: "Arag",
  googleMapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Shree%20Ram%20Medical%2C%20Mahavir%20Chowk%2C%20Palavi%20Enterprises%2C%20Main%20Road%2C%20Arag%2C%20Maharashtra%20416401",
  logoPath: "/logo.jpeg",
} as const;

export const addressLines = [
  business.address.street,
  business.address.locality,
  business.address.area,
  `${business.address.region} ${business.address.postalCode}`,
];
