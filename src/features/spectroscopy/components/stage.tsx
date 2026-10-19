"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { cn } from "@horizon/toolkit/ui";

import { STARS } from "../lib/model/stars";
import { useSpectroscopy } from "../lib/store";
import { SceneCanvas } from "./scene-canvas";
import { SpectrumView } from "./spectrum-view";
import { useFormedLines, useObservation, useSettings } from "./use-spectrum";

/**
 * The scene and its spectrum, between the HUD's top row and the dock (`--hud-clear`). They are
 * the simulation's canvas: the immersive view hides the controls around them, not them.
 */
export function Stage() {
  const t = useTranslations("spectroscopy");
  const settings = useSettings();
  const obs = useObservation();
  const lines = useFormedLines(obs);
  const range = useSpectroscopy((s) => s.range);
  const photons = useSpectroscopy((s) => s.photons);
  const { view, star, sequenceTemperature, air } = settings;

  const teff =
    obs.kind === "star"
      ? view === "stars" && star !== "sequence"
        ? STARS[star].teff
        : view === "sun"
          ? STARS.sun.teff
          : view === "stars"
            ? sequenceTemperature
            : obs.photosphere.teff
      : null;
  const labels = useMemo(
    () => ({
      source:
        view === "mystery"
          ? t("scene.unknown")
          : obs.kind === "slab"
            ? t("scene.lamp")
            : view === "sun"
              ? t("scene.sun")
              : star === "sequence"
                ? t("scene.dwarf")
                : t(`stars.${star}`),
      gas: obs.kind === "slab" ? t("scene.gas") : t("scene.atmosphere"),
      air: obs.kind === "star" && air ? t("scene.air") : null,
      spectrograph: t("scene.spectrograph"),
    }),
    [t, view, obs.kind, star, air],
  );

  return (
    /* A new view fades in rather than cutting. */
    <div
      key={view}
      className={cn(
        "spectroscopy-stage pad-hud-top anim-fade absolute inset-x-0 flex flex-col",
        /* --hud-clear already counts the footer: the dock's or guide's top from the window's foot. */
        "top-[calc(var(--app-header-height)+2.75rem)] bottom-[max(var(--hud-clear,calc(var(--app-footer-height)+1rem)),var(--sheet-clear,0px))]",
      )}
    >
      {/* A phone held sideways keeps the spectrum and lets the scene go. */}
      <div className="relative min-h-0 flex-1 short:hidden">
        <SceneCanvas
          obs={obs}
          lines={lines}
          range={range}
          labels={labels}
          photons={photons}
          teff={teff}
        />
      </div>
      <SpectrumView className="max-h-full" />
    </div>
  );
}
