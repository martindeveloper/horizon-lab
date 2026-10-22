"use client";

import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useFormatter } from "next-intl";
import { useRef } from "react";

import { useDockClearance } from "@/components/simulations/use-dock-clearance";
import { WIDE_LAYOUT_QUERY } from "@horizon/toolkit/environment";
import {
  Dock,
  IconButton,
  ScaleBar,
  Tooltip,
  cn,
  kickerClass,
  useMediaQuery,
} from "@horizon/toolkit/ui";

import { spectralOf } from "../lib/model/catalogue";
import { rungNameKey } from "../lib/model/names";
import { rulerFor } from "../lib/model/ruler";
import { RUNGS, RUNG_IDS } from "../lib/model/rungs";
import { useGiants } from "../lib/store";
import { badgeOf, keyFigures, useDistance, useGiantsT } from "./format";
import { LadderStrip } from "./ladder-strip";

const LAST = RUNG_IDS.length - 1;

/** The ruler at the camera's scale, in the unit the View panel holds. */
function Ruler() {
  const { t } = useGiantsT();
  const f = useFormatter();
  const scale = useGiants((s) => s.scale);
  const choice = useGiants((s) => s.ruler);
  const bar = rulerFor(choice, scale);
  if (!bar) return null;
  const text = `${f.number(bar.value, { maximumSignificantDigits: 3 })} ${t(`units.${bar.unit}`)}`;
  return <ScaleBar text={text} px={bar.px} label={t("hud.ruler", { value: text })} />;
}

/**
 * The dock: the body in focus (its class, name and key figures, read without opening
 * anything), back and on by one body, the card's toggle, the ruler, and the whole ladder as a
 * strip of dots beneath. Steps fly; the camera settles on the body.
 */
export function GiantsDock() {
  const { t } = useGiantsT();
  const distance = useDistance();
  /* The desktop layout, where the card stands beside the stage rather than over the dock. */
  const wide = useMediaQuery(WIDE_LAYOUT_QUERY, true);
  const focus = useGiants((s) => s.focus);
  const open = useGiants((s) => (wide ? s.card : s.sheet));
  /* On phones the card's sheet or a panel takes the foot of the stage, and the dock steps aside. */
  const aside = useGiants((s) => s.sheet || s.panel !== "none");
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface);
  const api = useGiants.getState;
  const id = RUNG_IDS[focus]!;
  const rung = RUNGS[focus]!;
  const spectral = spectralOf(rung.id);
  const name = t(rungNameKey(id));
  const figures = keyFigures(t, distance, id);
  return (
    <Dock
      ref={surface}
      footerClassName={cn(aside && "not-md:hidden")}
      className="anim-rise flex flex-col gap-1"
    >
      <div className="flex items-center gap-3 not-md:gap-2">
        <Tooltip label={t("hud.previous")} align="start">
          <IconButton
            aria-label={t("hud.previous")}
            disabled={focus <= 0}
            onClick={() => api().step(-1)}
          >
            <ChevronLeft className="size-4" />
          </IconButton>
        </Tooltip>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={cn(kickerClass, "truncate")}>
            {spectral ? `${badgeOf(t, rung)} · ${spectral}` : badgeOf(t, rung)}
          </span>
          <span className="flex min-w-0 items-baseline gap-x-3 not-md:flex-col">
            <span className="truncate font-display text-base leading-tight text-fg">{name}</span>
            <span className="truncate font-mono text-xs text-muted tabular-nums short:hidden">
              {figures.map((fact) => fact.value).join("  ·  ")}
            </span>
          </span>
        </div>
        <div className="w-28 shrink-0 not-sm:hidden">
          <Ruler />
        </div>
        <Tooltip label={t(open ? "hud.hideCard" : "hud.showCard")}>
          <IconButton
            aria-label={t(open ? "hud.hideCard" : "hud.showCard")}
            aria-expanded={open}
            active={open}
            onClick={() => api().setCard(!open)}
          >
            <Info className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip label={t("hud.next")} align="end">
          <IconButton
            aria-label={t("hud.next")}
            disabled={focus >= LAST}
            onClick={() => api().step(1)}
          >
            <ChevronRight className="size-4" />
          </IconButton>
        </Tooltip>
      </div>
      <LadderStrip />
    </Dock>
  );
}
