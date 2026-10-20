"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { ExperienceMenu, ImmersiveScene, useImmersive } from "@horizon/toolkit/ui";

import { ambientMusic } from "../shell/ambient-music";
import { useDriftMusic, type SimulationDrift } from "./drift";
import { FrameRateReadout } from "./frame-rate";

/** Every simulation stage carries `data-simulation`; it is what covers the window and goes fullscreen. */
const STAGE = "[data-simulation]";

const serverMusic = () => "paused" as const;

/**
 * The one immersive view for every simulation. Mount it inside the scene after
 * the canvas and pass the feature overlay as children: they step aside while
 * the shared header, footer and canvas-only exit control are handled here. The
 * frame-rate readout stays in both views. With `drift`, the view carries the
 * simulation's drift: leaving the view (Esc, the exit control, fullscreen's end)
 * stops it, and the music lifts for as long as it is on.
 */
export function SimulationImmersive({
  onEnter,
  drift,
  children,
}: {
  onEnter?: () => void;
  /** The simulation's drift (`useSimulationDrift`), where it has one. */
  drift?: SimulationDrift;
  children: ReactNode;
}) {
  const t = useTranslations("immersive");
  const tDrift = useTranslations("drift");
  const immersive = useImmersive();
  const drifting = drift !== undefined && drift.state !== "off";
  useDriftMusic(drift?.music, drifting);
  /* The drift's own music control: the ambient music, silenced or brought back without leaving. */
  const musicOn =
    useSyncExternalStore(ambientMusic.subscribe, ambientMusic.getState, serverMusic) === "playing";

  /* The drift lives inside immersive view: whichever way the view ends, so does the drift. */
  const stop = drift?.onStop;
  useEffect(() => {
    if (!immersive && drifting) stop?.();
  }, [immersive, drifting, stop]);

  return (
    <>
      <FrameRateReadout />
      <ImmersiveScene
        stage={STAGE}
        {...(onEnter !== undefined ? { onEnter } : {})}
        labels={{
          group: t("title"),
          exit: t("exit"),
          exitTooltip: t("close"),
          fullscreen: t("fullscreen"),
        }}
        {...(drift !== undefined
          ? {
              drift: {
                active: drifting,
                playing: drift.state === "playing",
                onToggle: drift.onToggle,
                ...(drift.caption !== undefined ? { caption: drift.caption } : {}),
                labels: {
                  pause: tDrift("pause"),
                  resume: tDrift("resume"),
                  stop: tDrift("stop"),
                },
                music: {
                  on: musicOn,
                  onToggle: ambientMusic.toggle,
                  labels: { mute: tDrift("muteMusic"), unmute: tDrift("playMusic") },
                },
              },
            }
          : {})}
      >
        {children}
      </ImmersiveScene>
    </>
  );
}

/**
 * The experiences button that ends every simulation's HUD toolbar: immersive view and, where
 * the simulation has one (`onDrift`), its drift. The last control, so its tooltips open leftward.
 */
export function SimulationExperience({ onDrift }: { onDrift?: (() => void) | undefined }) {
  const t = useTranslations("immersive");
  const tDrift = useTranslations("drift");
  return (
    <ExperienceMenu
      labels={{ menu: t("experiences"), immersive: t("enter"), drift: tDrift("start") }}
      {...(onDrift !== undefined ? { onDrift } : {})}
      align="end"
    />
  );
}
