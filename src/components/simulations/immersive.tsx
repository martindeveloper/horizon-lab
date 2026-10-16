"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ImmersiveScene, ImmersiveToggle } from "@horizon/toolkit/ui";

/** Every simulation stage carries `data-simulation`; it is what covers the window and goes fullscreen. */
const STAGE = "[data-simulation]";

/**
 * The one immersive view for every simulation. Mount it inside the scene after
 * the canvas and pass the feature overlay as children: they step aside while
 * the shared header, footer and canvas-only exit control are handled here.
 */
export function SimulationImmersive({
  onEnter,
  children,
}: {
  onEnter?: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("immersive");
  return (
    <ImmersiveScene
      stage={STAGE}
      {...(onEnter !== undefined ? { onEnter } : {})}
      labels={{
        group: t("title"),
        exit: t("exit"),
        exitTooltip: t("close"),
        fullscreen: t("fullscreen"),
      }}
    >
      {children}
    </ImmersiveScene>
  );
}

/** Entry button for a simulation's HUD toolbar. */
export function SimulationImmersiveToggle() {
  const t = useTranslations("immersive");
  return <ImmersiveToggle label={t("enter")} tooltip={t("title")} />;
}
