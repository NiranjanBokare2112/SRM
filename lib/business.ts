const storeAddress = "Taluka-Miraj, Mahavir Chowk, Palavi Enterprises, Main Road, Post, Arag, Maharashtra 416401";

export const business = {
  siteUrl: "https://shreerammedical.com",
  name: "Shree Ram Medical",
  tagline: "Your trusted medical store in Arag",
  description:
    "Medicines, healthcare essentials, baby care, personal care, veterinary products and more — conveniently available at Shree Ram Medical.",
  phoneDisplay: "+91 77419 77111",
  phoneHref: "tel:+917741977111",
  whatsappHref:
    "https://wa.me/917741977111?text=Hello%20Shree%20Ram%20Medical%2C%20I%20would%20like%20to%20check%20the%20availability%20of%20a%20product.",
  fullAddress: storeAddress,
  address: {
    street: "Taluka-Miraj, Mahavir Chowk, Palavi Enterprises, Main Road, Post",
    locality: "Arag",
    area: "Taluka-Miraj",
    region: "Maharashtra",
    postalCode: "416401",
    country: "India",
  },
  hours: "8:00 AM – 10:00 PM",
  serviceArea: "Arag",
  googleMapsUrl: "https://maps.app.goo.gl/fz9AKNrGy7PAMM6f7",
  logoPath: "/logo.jpeg",
} as const;

export const addressLines = [
  business.address.street,
  business.address.locality,
  `${business.address.region} ${business.address.postalCode}`,
];
