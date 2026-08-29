import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/business";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const isSmall = size === "sm";

  return (
    <Link
      href="/"
      className={`brand-lockup ${isSmall ? "brand-lockup-small" : ""}`}
      aria-label="Shreeram Medical home"
    >
      <Image
        src={business.logoPath}
        alt="Shreeram Medical logo"
        width={388}
        height={259}
        className="brand-mark"
        priority={size === "md"}
      />
      <span className="brand-wordmark" aria-label="Shreeram Medical">
        <span className="brand-wordmark-green">Shreeram</span>{" "}
        <span className="brand-wordmark-blue">Medical</span>
      </span>
    </Link>
  );
}
