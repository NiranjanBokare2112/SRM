const storeName = "Shreeram Medical";
const phoneDigits = "917741977111";

const whatsappLink = (message: string) => `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;

export const business = {
  siteUrl: "https://shreerammedical.com",
  name: storeName,
  tagline: "Your trusted medical store in Arag",
  description:
    "Medicines, healthcare essentials, baby care, personal care, veterinary products and more — conveniently available at Shreeram Medical.",
  phoneDisplay: "+91 77419 77111",
  phoneHref: `tel:+${phoneDigits}`,
  whatsappHref: whatsappLink(`Hello ${storeName}, I would like to check the availability of a product.`),
  prescriptionWhatsappHref: whatsappLink(
    `Hello ${storeName}, I would like to check the availability of the medicines in my prescription. I am attaching a photo.`,
  ),
  fullAddress: "Mahavir Chowk, Palavi Enterprises, Main Road, Post Arag, Taluka Miraj, Maharashtra 416401",
  address: {
    street: "Mahavir Chowk, Palavi Enterprises, Main Road",
    locality: "Arag",
    area: "Taluka Miraj",
    region: "Maharashtra",
    postalCode: "416401",
    country: "India",
  },
  hours: "8:00 AM – 10:00 PM",
  /** Opening hours in 24h India Standard Time, used for the live open/closed badge. */
  openHour: 8,
  closeHour: 22,
  serviceArea: "Arag",
  geo: { latitude: 16.7910496, longitude: 74.8048737 },
  googleMapsUrl: "https://maps.app.goo.gl/fz9AKNrGy7PAMM6f7",
  mapEmbedUrl: "https://maps.google.com/maps?q=16.7910496,74.8048737&z=17&output=embed",
  logoPath: "/logo.jpeg",
} as const;

export const addressLines = [
  business.address.street,
  `${business.address.locality}, ${business.address.area}`,
  `${business.address.region} ${business.address.postalCode}`,
];
