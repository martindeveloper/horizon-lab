"use client";

import { ZoomIn } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { HC_EV_NM, dopplerWavelengthRatio, formatReadout } from "@horizon/toolkit/science";
import { Action, Chip, PanelHeader, cn } from "@horizon/toolkit/ui";

import { lineById, namedLine } from "../lib/model/atoms";
import { sequenceWidths, temperatureInView } from "../lib/model/scenes";
import { curveOfGrowth, reportLine } from "../lib/model/spectrum";
import { useSpectroscopy } from "../lib/store";
import { GrowthChart, LevelDiagram, SequenceChart } from "./charts";
import { kelvin, levelName, lineName, wavelength } from "./format";
import { useObservation, useRestObservation } from "./use-spectrum";

/** The card covers the stage's whole width at its foot only as a phone's bottom sheet. */
const isSheet: DockInTheWay = (card, stage) =>
  card.width > stage.width * 0.9 && card.bottom >= stage.bottom - 2;

/**
 * Focus moves into the card when it opens and back when it closes, as for every panel, except
 * while the visitor steps through lines on the spectrum with the arrow keys: there it stays.
 */
function useCardFocus(root: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    const card = root.current;
    if (!open || !card) return;
    const before = document.activeElement;
    const stepping = before instanceof HTMLElement && before.closest("[data-spectrum-surface]");
    if (!stepping) card.focus({ preventScroll: true });
    return () => {
      if (stepping) return;
      const away =
        document.activeElement === document.body || card.contains(document.activeElement);
      if (away && before instanceof HTMLElement) before.focus({ preventScroll: true });
    };
  }, [root, open]);
}

/** How long the observation must hold still before the curve of growth is worked out anew, ms. */
const SETTLE_MS = 150;

/**
 * `value` once it has held still for `SETTLE_MS`, the first at once: while a slider or the
 * guide carries it along, the last one that settled.
 */
function useSettled<T>(value: T) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(settled, value)) return;
    const timer = setTimeout(() => setSettled(value), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [value, settled]);
  return settled;
}

/**
 * The selected line: where it is and where it should be, the two levels it joins and the
 * photon between them, how strong it is and why (its place on the curve of growth), and for
 * stars how its strength runs down the spectral sequence. A bottom sheet on phones.
 */
export function LineCard() {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const locale = useLocale();
  const id = useSpectroscopy((s) => s.selection);
  const view = useSpectroscopy((s) => s.view);
  const star = useSpectroscopy((s) => s.star);
  const sequenceTemperature = useSpectroscopy((s) => s.sequenceTemperature);
  const compare = useSpectroscopy((s) => s.compare);
  const obs = useObservation();
  const line = id ? lineById(id) : undefined;
  const root = useRef<HTMLElement>(null);
  useCardFocus(root, id !== null);
  /* On phones the card is a sheet over the stage's foot: the spectrum ends above it. */
  useDockClearance(root, isSheet, "--sheet-clear");

  /* A line's strength is measured at rest: dragging the velocity only moves where it sits. */
  const rest = useRestObservation();
  const report = useMemo(() => (line ? reportLine(line, rest) : null), [line, rest]);
  /* Twenty-five widths of the line: worked out once the observation settles, not at every step
     of a slider or the guide. */
  const settled = useSettled(rest);
  const growth = useMemo(() => (line ? curveOfGrowth(line, settled) : []), [line, settled]);
  const sequence = useMemo(
    () => (line && obs.kind === "star" && view !== "mystery" ? sequenceWidths(line) : []),
    [line, obs.kind, view],
  );
  if (!line || !report) return null;

  const api = useSpectroscopy.getState;
  const named = namedLine(line.id);
  const glowing = obs.kind === "slab" && obs.background === null;
  const emitting =
    glowing ||
    (obs.kind === "slab" && obs.background !== null && obs.background < obs.gas.temperature);
  const observed = report.shape.centre * dopplerWavelengthRatio(obs.velocity);
  const shifted = Math.abs(observed - line.wavelength) > 1e-4;
  const element = t(`elements.${line.element}`);
  const stage = t(`stages.${line.stage}`);
  /* The star in view, marked on the sequence chart (never shown for a mystery). */
  const marker = temperatureInView({ view, star, sequenceTemperature }, obs);
  const ew = report.equivalentWidth;

  const facts: { id: string; label: string; value: string }[] = [
    {
      id: "energy",
      label: t("card.energy"),
      value: `${f.number(HC_EV_NM / line.vacuum, { maximumFractionDigits: 3 })} eV`,
    },
    {
      id: "transition",
      label: t("card.transition"),
      value: `${levelName(line, line.lowerLevel)} → ${levelName(line, line.upperLevel)}`,
    },
    {
      id: "gf",
      label: t("card.gf"),
      value: t("card.gfValue", {
        value: f.number(line.logGf, { maximumFractionDigits: 2, signDisplay: "exceptZero" }),
        grade: line.accuracy || "—",
      }),
    },
    {
      id: "tau",
      label: t("card.tau"),
      value: formatReadout(report.tau, locale),
    },
    {
      id: "width",
      label: t("card.width"),
      value:
        ew === null
          ? t("card.glows")
          : ew < 0
            ? t("card.bright")
            : `${f.number(ew * 1e4, { maximumFractionDigits: 0 })} mÅ`,
    },
  ];
  if (report.coreTemperature !== null)
    facts.push({
      id: "core",
      label: t("card.core"),
      value: `≈ ${kelvin(f, Math.round(report.coreTemperature / 10) * 10)} K`,
    });

  return (
    <article
      ref={root}
      data-coach="line"
      tabIndex={-1}
      aria-label={lineName(line, f)}
      className="glass-panel pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex max-h-[min(26rem,46dvh)] anim-sheet flex-col overflow-hidden rounded-t-xl outline-hidden md:inset-x-auto md:top-14 md:right-(--hud-gutter) md:bottom-auto md:max-h-[calc(100%-3.5rem-var(--hud-clear,5.5rem))] md:w-80 md:anim-rail md:rounded-lg"
    >
      <PanelHeader
        kicker={
          <span className="flex items-start gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-solar" aria-hidden />
            {element} · {stage}
            {named?.letter ? ` · ${t("card.letter", { letter: named.letter })}` : ""}
          </span>
        }
        title={<span className="mt-1 block text-xl leading-tight">{lineName(line, f)}</span>}
        onClose={() => api().select(null)}
        closeLabel={t("hud.close")}
        className="px-3.5 pt-3.5 md:px-4 md:pt-4"
      />
      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain px-3.5 pt-3 pb-4 md:px-4">
        <div>
          <p className="text-xs text-fg-secondary">
            {shifted ? t("card.observed") : t("card.wavelength")}
          </p>
          <p className="mt-0.5 font-mono text-2xl tracking-tight text-fg-primary tabular-nums">
            {wavelength(f, observed, 3)} nm
          </p>
          {shifted ? (
            <p className="font-mono text-xs text-fg-secondary tabular-nums">
              {t("card.rest", {
                rest: wavelength(f, line.wavelength, 3),
                shift: f.number(observed - line.wavelength, {
                  maximumFractionDigits: 3,
                  signDisplay: "exceptZero",
                }),
              })}
            </p>
          ) : null}
        </div>

        <LevelDiagram
          line={line}
          emitting={emitting}
          labels={{
            ground: t("card.ground"),
            limit: t("card.limit"),
            title: t(emitting ? "card.diagramEmit" : "card.diagramAbsorb", {
              lower: levelName(line, line.lowerLevel),
              upper: levelName(line, line.upperLevel),
            }),
          }}
        />

        <dl className="divide-y divide-border border-y border-border">
          {facts.map((fact) => (
            <div key={fact.id} className="flex items-baseline justify-between gap-4 py-1.5">
              <dt className="shrink-0 text-xs text-fg-secondary">{fact.label}</dt>
              <dd className="text-right font-mono text-[12px] text-fg-primary tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        <section>
          <h3 className="text-xs text-fg-secondary">
            {t("card.growthTitle")} ·{" "}
            <span className="text-fg-primary">{t(`regime.${report.regime}`)}</span>
          </h3>
          <GrowthChart
            points={growth}
            labels={{
              title: t("card.growthTitle"),
              x: t("card.growthX"),
              y: t("card.growthY"),
              weak: t("regime.weak"),
              saturated: t("regime.saturated"),
              damped: t("regime.damped"),
            }}
          />
          <p className="text-xs leading-relaxed text-fg-secondary">
            {/* Hydrogen's Holtsmark wings fall as Δλ^(−5/2), so its damped lines grow as N^(2/5). */}
            {t(
              report.regime === "damped" && line.species === "H I"
                ? "regimeNote.stark"
                : `regimeNote.${report.regime}`,
            )}
          </p>
        </section>

        {sequence.length ? (
          <section>
            <h3 className="text-xs text-fg-secondary">{t("card.sequenceTitle")}</h3>
            <SequenceChart
              points={sequence}
              marker={marker}
              labels={{ title: t("card.sequenceTitle"), y: t("card.sequenceY") }}
            />
          </section>
        ) : null}

        {named ? (
          <p className="text-sm leading-relaxed text-fg-primary/80">{t(`notes.${named.note}`)}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-3 md:px-4">
        <Action
          variant="glass"
          className="min-h-9 px-3 text-xs md:min-h-8"
          onClick={() => api().setRange([observed - 1.5, observed + 1.5])}
        >
          <ZoomIn className="size-3.5" />
          {t("card.zoom")}
        </Action>
        {view !== "mystery" ? (
          <Chip
            selected={compare.includes(line.element)}
            aria-pressed={compare.includes(line.element)}
            onClick={() => api().toggleCompare(line.element)}
            className={cn("ml-auto")}
          >
            {t("card.compare", { element })}
          </Chip>
        ) : null}
      </div>
    </article>
  );
}
