import type { MetadataRoute } from "next";
import { business } from "@/lib/business";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = business.siteUrl;
  return ["", "/about", "/services", "/contact"].map((path) => ({
    url: new URL(path || "/", baseUrl).href,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}