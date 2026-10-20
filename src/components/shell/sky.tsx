"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { usePathname } from "@/i18n/navigation";
import { simulationForPath } from "@/lib/simulations";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { mulberry32 } from "@horizon/toolkit/math";

import { createSky, TWINKLE_COUNT } from "./sky-field";

/* Seeded so server and client render the same filler. */

/* Faint filler for the thousands of stars below our catalogue's limit. */
const FILLER = (() => {
  const random = mulberry32(11);
  let dots = "";
  for (let i = 0; i < 220; i += 1) {
    dots += `<circle cx="${(random() * 1600).toFixed(1)}" cy="${(random() * 1000).toFixed(1)}" r="${(0.3 + random() * random() * 0.6).toFixed(2)}" opacity="${(0.2 + random() * 0.6).toFixed(2)}"/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><g fill="#fff">${dots}</g></svg>`,
  )}")`;
})();

/**
 * The shared sky, and it is the real one: the stars over Ondřejov Observatory at this
 * moment, drawn by `createSky` while a catalogue page is open. Nothing runs over a
 * simulation; the still markup stays for the server and for reduced motion.
 */
export function Sky() {
  const interactive = !simulationForPath(usePathname());
  const root = useRef<HTMLDivElement>(null);
  const t = useTranslations("shell");
  const locale = useLocale();

  useEffect(() => {
    const sky = root.current;
    if (!interactive || !sky) return;
    // Read live, so turning on reduced motion while the page is open stills the sky at once.
    return createSky(sky, { t, locale, reduce: window.matchMedia(REDUCED_MOTION_QUERY) });
  }, [interactive, locale, t]);

  return (
    <div ref={root} className="horizon-sky" aria-hidden="true">
      <div className="sky-layer" data-parallax="10">
        <div className="sky-filler" style={{ maskImage: FILLER }} />
      </div>
      <div className="sky-layer" data-parallax="24">
        <canvas className="sky-real" />
        {Array.from({ length: TWINKLE_COUNT }, (_, i) => (
          <span
            key={i}
            data-twinkle
            className="sky-twinkle"
            style={{
              display: "none",
              "--period": `${5 + (i % 5) * 1.3}s`,
              "--delay": `${-(i * 1.7) % 9}s`,
            }}
          />
        ))}
        <span data-star-mark className="sky-mark" />
        <span data-star-label className="sky-label" />
      </div>
      <span data-meteor className="sky-meteor" />
    </div>
  );
}
