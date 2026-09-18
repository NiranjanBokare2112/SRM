"use client";

import type { ComponentProps } from "react";
import { business } from "@/lib/business";

export function DirectionsLink({ children, ...props }: Omit<ComponentProps<"a">, "href" | "target" | "rel" | "onClick">) {
  return (
    <a
      {...props}
      href={business.googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
          || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        // Keep a direct user-initiated link so the phone can hand off to Maps.
        event.currentTarget.target = mobile ? "_self" : "_blank";
      }}
    >
      {children}
    </a>
  );
}
