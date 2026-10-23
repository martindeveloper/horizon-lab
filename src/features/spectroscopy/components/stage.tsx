"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { cn } from "@horizon/toolkit/ui";

import { temperatureInView } from "../lib/model/scenes";
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
  const { view, star, air } = settings;
  const teff = temperatureInView(settings, obs);
  const labels = useMemo(() => {
    let sourceKey = `names.${star}`;
    if (view === "mystery") {
      sourceKey = "scene.unknown";
    } else if (obs.kind === "slab") {
      sourceKey = "scene.lamp";
    } else if (view === "sun") {
      sourceKey = "scene.sun";
    } else if (star === "sequence") {
      sourceKey = "scene.dwarf";
    }
    return {
      source: t(sourceKey),
      gas: obs.kind === "slab" ? t("scene.gas") : t("scene.atmosphere"),
      air: obs.kind === "star" && air ? t("scene.air") : null,
      spectrograph: t("scene.spectrograph"),
    };
  }, [t, view, obs.kind, star, air]);

  return (
    /* A new view fades in rather than cutting. */
    <div
      key={view}
      className={cn(
        "spectroscopy-stage pad-hud-top absolute inset-x-0 flex anim-fade flex-col",
        /* --hud-clear already counts the footer: the dock's or guide's top from the window's foot. */
        "top-[calc(var(--app-header-height)+2.75rem)] bottom-[max(var(--hud-clear,calc(var(--app-footer-height)+1rem)),var(--sheet-clear,0px))]",
        /* The dock leaving (the immersive view) or growing moves the foot: glide, as the HUD does. */
        "transition-[top,bottom] duration-scene ease-enter motion-reduce:transition-none",
      )}
    >
      {/* The scene sets the stage but the spectrum is the instrument: the scene stops at a third
          of the window and the plot takes the rest. A phone held sideways lets the scene go, and
          so does a stage too short to show it whole (`spectroscopy-scene`, by the stage's height). */}
      <div
        className={cn(
          "spectroscopy-scene relative min-h-0 flex-[1_1_0%] short:hidden",
          /* The bench is the lesson in Kirchhoff's view; elsewhere the scene is a strip. */
          view === "kirchhoff" ? "max-h-[32dvh]" : "max-h-[20dvh]",
        )}
      >
        <SceneCanvas
          obs={obs}
          lines={lines}
          range={range}
          labels={labels}
          photons={photons}
          teff={teff}
        />
      </div>
      <SpectrumView className="max-h-full flex-[1_1_auto]" />
    </div>
  );
}
