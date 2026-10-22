"use client";

import { useTranslations } from "next-intl";

import { Chip, LabelledRow } from "@horizon/toolkit/ui";

import { PLACE_LIST } from "../lib/model/places";
import { useSun } from "../lib/store";
import { RowLabel } from "./dock-rows";

/**
 * What this view shows, as a labelled strip of chips across the dock: a pick opens its card
 * (the camera stays: each place listed belongs to this view), a second pick lets go. Wraps
 * on wide screens, scrolls sideways on phones.
 */
export function PlaceStrip({ className }: { className?: string }) {
  const t = useTranslations("sun");
  const view = useSun((s) => s.view);
  const selection = useSun((s) => s.selection);
  const places = PLACE_LIST.filter((place) => place.view === view);
  if (places.length === 0) return null;
  return (
    <LabelledRow
      data-coach="places"
      label={t("hud.places")}
      shown={<RowLabel>{t("hud.places")}</RowLabel>}
      className={className}
    >
      <div className="-mx-1 flex min-w-0 gap-1 not-md:[scrollbar-width:none] not-md:overflow-x-auto not-md:overscroll-x-contain md:flex-wrap">
        {places.map((place) => (
          <Chip
            key={place.id}
            selected={selection === place.id}
            aria-pressed={selection === place.id}
            className="shrink-0 not-md:h-9"
            onClick={() =>
              selection === place.id
                ? useSun.getState().select(null)
                : useSun.getState().goTo(place.id)
            }
          >
            {t(`places.${place.id}.title`)}
          </Chip>
        ))}
      </div>
    </LabelledRow>
  );
}
