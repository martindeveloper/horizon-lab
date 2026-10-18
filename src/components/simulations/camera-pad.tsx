"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { CameraAngles } from "@/lib/scene-store";
import { ORBIT_STEP, type OrbitTurn } from "@horizon/toolkit/camera";
import { DataReadout, OrbitPad } from "@horizon/toolkit/ui";

/** One button step, whole degrees. */
const STEP_DEG = Math.round((ORBIT_STEP * 180) / Math.PI);

/**
 * Button steps for a scene's orbit camera, worded by the shared space copy in `namespace`:
 * the dial with the size of one step in its middle, and where the camera points now (its
 * heading round the aim and its elevation above the map's plane), which each step moves on.
 */
export function CameraPad({
  namespace,
  angles,
  onRotate,
}: {
  namespace: string;
  angles: CameraAngles;
  onRotate: (turn: OrbitTurn) => void;
}) {
  const t = useTranslations(namespace);
  const f = useFormatter();
  const step = `${STEP_DEG}°`;
  const degrees = (value: number) => `${f.number(value)}°`;
  return (
    <div className="flex items-center gap-6">
      <OrbitPad
        aria-label={t("hud.camera")}
        centre={step}
        labels={{
          left: `${t("hud.rotateLeft")} · ${step}`,
          right: `${t("hud.rotateRight")} · ${step}`,
          up: `${t("hud.tiltUp")} · ${step}`,
          down: `${t("hud.tiltDown")} · ${step}`,
        }}
        onRotate={onRotate}
      />
      <DataReadout
        className="grid-cols-1 gap-y-2.5"
        items={[
          { id: "heading", label: t("hud.heading"), value: degrees(angles.heading) },
          { id: "elevation", label: t("hud.elevation"), value: degrees(angles.tilt) },
        ]}
      />
    </div>
  );
}
