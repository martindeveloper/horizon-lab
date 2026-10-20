"use client";

import { useTranslations } from "next-intl";

import { cn } from "@horizon/toolkit/ui";

import { TILE_FRAME, tileSpan } from "./tiles";

/** Same cover-card geometry as the catalogue, pulsing glass instead of content. */
export function CatalogueLoading() {
  const t = useTranslations("loading");
  return (
    <main id="main-content" tabIndex={-1} className="pb-10 outline-hidden">
      <p role="status" className="sr-only">
        {t("catalogue")}
      </p>
      <div aria-hidden="true" className="horizon-skeleton">
        <div className="catalogue-hero">
          <div className="catalogue-sky border-b border-border">
            <div className="app-container flex h-full flex-col justify-end space-y-5 pb-10 lg:pb-14">
              <div className="h-3 w-32 rounded bg-surface-2" />
              <div className="h-28 w-full max-w-3xl rounded-lg bg-surface-2 sm:h-36 lg:h-56" />
            </div>
          </div>
          <div className="catalogue-ground h-14 lg:h-20" />
        </div>
        <div className="app-container grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12 lg:gap-6">
          {/* The first pair of tiles; the second shows only where it sits beside the first. */}
          {[tileSpan(0, 2), `hidden lg:flex ${tileSpan(1, 2)}`].map((span) => (
            <div
              key={span}
              className={cn(
                "flex flex-col justify-end bg-surface-2/60 p-3 sm:p-4",
                TILE_FRAME,
                span,
              )}
            >
              <div className="cover-panel space-y-3 rounded-2xl p-5 sm:p-6">
                <div className="h-3 w-40 rounded bg-surface-2" />
                <div className="h-9 w-2/3 rounded bg-surface-2" />
                <div className="h-12 rounded bg-surface-2" />
                <div className="h-11 w-44 rounded-full bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
