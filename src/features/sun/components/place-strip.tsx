"use client";

import { useTranslations } from "next-intl";

import { Chip } from "@horizon/toolkit/ui";

import { PLACE_LIST } from "../lib/model/places";
import { useSun } from "../lib/store";

/**
 * The places this view shows, as a strip of chips across the dock: a pick flies to one and
 * opens its card, a second pick lets go. Wraps on wide screens, scrolls sideways on phones.
 */
export function PlaceStrip() {
  const t = useTranslations("sun");
  const view = useSun((s) => s.view);
  const selection = useSun((s) => s.selection);
  const places = PLACE_LIST.filter((place) => place.view === view);
  if (places.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={t("hud.places")}
      className="-mx-1 flex gap-1 not-md:[scrollbar-width:none] not-md:overflow-x-auto not-md:overscroll-x-contain md:flex-wrap"
    >
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
  );
}
