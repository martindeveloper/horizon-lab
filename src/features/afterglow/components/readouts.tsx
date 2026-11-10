"use client";

import { ArrowRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { formatReadout } from "@horizon/toolkit/science";
import { DataReadout, Kicker, Orb, type ReadoutItem } from "@horizon/toolkit/ui";
import { TextReveal } from "@horizon/toolkit/ui/motion";

import { sunAt } from "../lib/model/sun";
import { WORLDS, standingAt, temperatureAt } from "../lib/model/worlds";
import { useAfterglow } from "../lib/store";
import { WORLD_COLOUR } from "./dock";
import { formatWidth } from "./format";

/** The magnification shows once the disc's frame differs from the open view by this much, in log: a giant's wider frame reads under one. */
const MAGNIFIED_FROM = 0.05;

/**
 * The readouts on one dark-glass chip, top left: the world the view is over, its name spelled
 * out afresh whenever the scene changes to another, after the world it came from and an arrow
 * that stay while the move is read (under a giant every world's night side and glowing horizon
 * look alike, so this is how the visitor knows they have moved, and where), the chapter as
 * the largest text, then the Sun
 * as it is now (its light, surface temperature, radius and mass) over what the world stood on
 * gets of it (the sunlight against Earth's today, the Sun's true width, the world's temperature
 * from sunlight, named for the world, and the view's magnification when it is magnified), then
 * the one line that says what will happen. The age is read in the dock, on its own line over
 * the timeline.
 * Never bare text on the sky.
 */
export function Readouts() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const locale = useLocale();
  const age = useAfterglow((s) => s.age);
  const view = useAfterglow((s) => s.view);
  /* What the view shows: through a move, the world left until the globes change. */
  const world = useAfterglow((s) => s.drawn);
  const cameFrom = useAfterglow((s) => s.cameFrom);
  const magnification = useAfterglow((s) => s.magnification);
  const sun = sunAt(age);
  const standing = standingAt(WORLDS[world].orbit, age);
  const kelvin = temperatureAt(world, age);
  /* The shared readout's figures, trailing zeros kept and the power of ten tight, so every value keeps one line in its column. */
  const figure = (value: number) => formatReadout(value, locale, true, true);
  const name = t(`names.${world}`);
  const items: ReadoutItem[] = [
    {
      id: "light",
      label: t("readouts.light"),
      value: t("units.solarLuminosities", { value: figure(sun.luminosity) }),
    },
    {
      id: "surface",
      label: t("readouts.surface"),
      value: t("units.kelvin", { value: figure(sun.teff) }),
    },
    {
      id: "radius",
      label: t("readouts.radius"),
      value: t("units.solarRadii", { value: figure(sun.radius) }),
    },
    {
      id: "mass",
      label: t("readouts.mass"),
      value: t("units.solarMasses", { value: figure(sun.mass) }),
    },
    {
      id: "sunlight",
      label: t("readouts.sunlight"),
      value: standing.inside
        ? t("hud.insideSun")
        : t("units.earthSunlight", { value: figure(standing.sunlight) }),
    },
    { id: "width", label: t("readouts.width"), value: formatWidth(t, f, standing.sunWidth) },
    ...(kelvin === null
      ? []
      : [{ id: "temperature", label: name, value: t("units.kelvin", { value: figure(kelvin) }) }]),
    ...(Math.abs(Math.log(magnification)) > MAGNIFIED_FROM
      ? [
          {
            id: "magnification",
            label: t("readouts.magnification"),
            value: t("units.magnified", {
              value: figure(magnification),
            }),
          },
        ]
      : []),
  ];
  return (
    /*
     * A fixed width, each value on one line: the widest a value gets ("4.51×10⁻⁹ S⊕") fits its
     * column, so figures that grow and shrink as the Sun changes never move the columns or rows.
     */
    <div className="glass-hud pointer-events-auto mt-2 w-54 max-w-full shrink-0 rounded-panel px-3 py-2 md:w-108">
      <Kicker className="flex items-center gap-1.5">
        {cameFrom === null ? null : (
          <span
            key={`${cameFrom}-${world}`}
            aria-hidden
            className="afterglow-came-from flex items-center gap-1.5"
          >
            <Orb color={WORLD_COLOUR[cameFrom]} size={8} />
            {/* The narrow chip keeps the world left to its orb, so the name arrived at always fits. */}
            <span className="not-md:hidden">{t(`names.${cameFrom}`)}</span>
            <ArrowRight className="size-3 shrink-0" />
          </span>
        )}
        <Orb color={WORLD_COLOUR[world]} size={8} />
        <TextReveal key={world} text={name} />
      </Kicker>
      <p className="mt-0.5 font-display text-xl leading-tight font-medium text-fg-primary md:text-2xl">
        {t(`views.${view}`)}
      </p>
      <DataReadout
        aria-label={t("readouts.label", { name })}
        items={items.map((item) => ({ ...item, valueClassName: "whitespace-nowrap" }))}
        className="mt-2 grid-cols-2 gap-x-3 gap-y-1.5 md:grid-cols-4"
      />
      <p className="mt-2 text-xs leading-snug text-fg-secondary">{t(`viewHints.${view}`)}</p>
    </div>
  );
}
