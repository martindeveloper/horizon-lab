"use client";

import { useTranslations } from "next-intl";

import type { OrbitTurn } from "@horizon/toolkit/camera";
import { OrbitPad } from "@horizon/toolkit/ui";

/** Button steps for a scene's orbit camera, worded by the shared space copy in `namespace`. */
export function CameraPad({
  namespace,
  onRotate,
}: {
  namespace: string;
  onRotate: (turn: OrbitTurn) => void;
}) {
  const t = useTranslations(namespace);
  return (
    <OrbitPad
      aria-label={t("hud.camera")}
      className="mx-auto"
      labels={{
        left: t("hud.rotateLeft"),
        right: t("hud.rotateRight"),
        up: t("hud.tiltUp"),
        down: t("hud.tiltDown"),
      }}
      onRotate={onRotate}
    />
  );
}
