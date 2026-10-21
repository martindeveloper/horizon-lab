"use client";

import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useMemo, useRef } from "react";

import { useDockClearance } from "@/components/simulations/use-dock-clearance";
import { formatAu } from "@/lib/facts";
import { asideOpen } from "@/lib/scene-store";
import { CMB_LY, anchorById, type AnchorId } from "@/space/cosmos/model/cosmos";
import { NEIGHBOURS, neighbourDistanceLy } from "@/space/galaxy/model/neighbours";
import { SUN_GALACTIC_RADIUS_LY } from "@/space/galaxy/model/parameters";
import { solarNameKey } from "@/space/solar-system/format";
import { TODAY } from "@/space/solar-system/model/moment";
import { distanceFromEarth } from "@/space/solar-system/model/position";
import { probeFromEarth } from "@/space/solar-system/model/probes";
import { isSolarSelection } from "@/space/solar-system/model/selection";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";
import { cn } from "@horizon/toolkit/ui";

import { sightline, thenOf } from "../lib/model/depth";
import { METHOD_OF } from "../lib/model/views";
import { useDeepField, type CosmosId, type Selection } from "../lib/store";
import { formatAgo, formatThen } from "./format";

/** Structures with a measured place: the anchor their distance is read from. */
const ANCHOR_OF: Partial<Record<CosmosId, AnchorId>> = {
  andromeda: "andromeda",
  triangulum: "triangulum",
  virgo: "virgoCluster",
  fornax: "fornaxCluster",
  centaurus: "centaurusCluster",
  hydra: "hydraCluster",
  greatAttractor: "greatAttractor",
  perseusPisces: "perseusCluster",
  coma: "comaCluster",
  shapley: "shapleyCore",
  sloanGreatWall: "sloanGreatWall",
};

/**
 * How far a selection is from us (ly), when it is one place; null for what surrounds us. In
 * the solar system "us" is Earth: the light from Jupiter crosses the gap to Earth, not the Sun.
 */
function distanceOf(sel: Selection, now: Date): number | null {
  if (isSolarSelection(sel)) {
    const au = distanceFromEarth(sel, TODAY, now);
    return au === null ? null : au / LIGHT_YEAR_AU;
  }
  if (sel.kind === "star")
    return neighbourDistanceLy(
      NEIGHBOURS.find((n) => n.id === sel.id)!,
      0,
    );
  if (sel.kind === "galaxy") return sel.id === "bulge" ? SUN_GALACTIC_RADIUS_LY : null;
  /* A probe's signal crosses the gap to Earth; the heliopause is all round us. */
  if (sel.kind === "reach")
    return sel.id === "heliopause" ? null : probeFromEarth(sel.id, now) / LIGHT_YEAR_AU;
  if (sel.id === "observableUniverse") return CMB_LY;
  const anchor = ANCHOR_OF[sel.id];
  return anchor ? anchorById(anchor).mly * 1e6 : null;
}

/** The selection's name as its card titles it. */
function nameOf(sel: Selection) {
  if (isSolarSelection(sel)) return solarNameKey(sel);
  return sel.kind === "star" || sel.kind === "reach"
    ? `names.${sel.id}`
    : `cards.${sel.kind}.${sel.id}.title`;
}

/**
 * The sightline along the bottom of the sky: a line from here to what the view reaches (or
 * the selected object), how far that is, when the light we see from there set out, and what
 * Earth was like then. Distance is Deep Field's clock, so there is nothing here to set: it
 * reads straight onto the sky, with no panel, and lets drags through to the scene.
 */
export function Sightline() {
  const t = useTranslations("deepField");
  const f = useFormatter();
  const locale = useLocale();
  const view = useDeepField((s) => s.view);
  const reachLy = useDeepField((s) => s.reachLy);
  const selection = useDeepField((s) => s.selection);
  const unit = useDeepField((s) => s.distanceUnit);
  const now = useNow({ updateInterval: 60_000 });
  // Phones give an open sheet or card the bottom of the screen; the journey keeps it.
  const aside = useDeepField((s) => !s.guideOpen && asideOpen(s));
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface);

  const selected = selection ? distanceOf(selection, now) : null;
  const ly = selected ?? reachLy;
  /* The bisection behind a redshift runs only when the distance moves. */
  const line = useMemo(() => sightline(ly), [ly]);
  const distance = formatAu(t, { unit, locale }, line.ly * LIGHT_YEAR_AU);
  const name = selection ? t(nameOf(selection)) : t(`views.${view}`);
  const reach = [
    selected === null ? t("hud.outToValue", { distance }) : distance,
    ...(line.z >= 1e-3
      ? [
          t("hud.redshiftValue", {
            value: f.number(line.z, { maximumSignificantDigits: line.z < 10 ? 2 : 4 }),
          }),
        ]
      : []),
  ].join(" · ");

  return (
    <footer
      className={cn(
        "hud-bottom pad-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-30 pt-12 short:pt-6",
        aside && "not-md:hidden",
      )}
    >
      <section
        ref={surface}
        aria-label={t("hud.eyepiece")}
        className="deep-field-sightline mx-auto flex max-w-xl flex-col items-center text-center"
      >
        <p className="max-w-full truncate font-mono text-[10px] tracking-[0.14em] text-space-muted uppercase tabular-nums">
          {/* Phones name the view in the caption up top, so the numbers keep the line. */}
          <span className={selection ? undefined : "not-md:hidden"}>{name} · </span>
          {reach}
        </p>
        {/* Here on the left, there on the right, and light on its way between. */}
        <div aria-hidden className="relative mt-2.5 h-2 w-full max-w-sm short:hidden">
          <span className="absolute inset-x-1 top-1/2 h-px bg-linear-to-r from-space-fg/40 via-space-fg/15 to-solar/70" />
          <span className="absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full bg-space-fg/80" />
          <span className="absolute top-1/2 right-0 size-2 -translate-y-1/2 rounded-full border border-solar bg-space shadow-[0_0_10px_rgb(var(--solar)/0.6)]" />
          <span className="deep-field-photon absolute top-1/2 size-1 -translate-y-1/2 rounded-full bg-solar" />
        </div>
        <p className="mt-2 font-display text-base font-medium tracking-tight text-space-fg tabular-nums md:text-lg short:mt-0.5 short:text-sm">
          {t("hud.lightLeftAgo", { ago: formatAgo(t, f, line.years) })}
        </p>
        {/* Phones wrap these rather than cut them; the era keeps two lines so the ladder above
            never jumps while it is dragged through the ages. */}
        <p className="mt-0.5 max-w-full text-xs text-balance text-space-muted not-md:line-clamp-2 not-md:min-h-[2lh] md:truncate short:hidden">
          {formatThen(t, f, thenOf(line, now))}
        </p>
        {/* How that distance is known; wide screens read it beside the ladder's rung. */}
        <p className="mt-0.5 line-clamp-2 max-w-full text-[11px] text-balance text-space-muted/80 md:hidden short:hidden">
          {t(`methods.${METHOD_OF[view]}`)}
        </p>
      </section>
    </footer>
  );
}
