import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";

import { useSimulationEngine } from "@/components/simulations/use-simulation-engine";
import { createBlackHoleEngine } from "@/features/black-hole/lib/engine";
import { useBlackHole } from "@/features/black-hole/lib/store";
import type { StartEngine } from "@horizon/toolkit/rendering";

import { useSceneCamera, useSceneFrames } from "./scene-camera";

const resetReady = () => useBlackHole.getState().setSkyReady(false);

export function BlackHoleCanvas() {
  const camera = useSceneCamera();
  const frames = useSceneFrames();
  const t = useTranslations("blackHole");
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const create = useCallback<StartEngine>(
    (_signal, onError) => {
      const host = hostRef.current;
      const canvas = canvasRef.current;
      if (!host || !canvas) return;
      useBlackHole.getState().calibrateDevice();
      return createBlackHoleEngine(canvas, host, camera, {
        onFirstFrame: () => useBlackHole.getState().setSkyReady(true),
        onFrame: frames.notify,
        onError,
      });
    },
    [camera, frames],
  );
  useSimulationEngine(create, resetReady);

  return (
    <div ref={hostRef} className="absolute inset-0 z-0 bg-space">
      <canvas
        data-simulation-canvas="black-hole"
        ref={canvasRef}
        className="block size-full"
        role="img"
        aria-label={t("canvasLabel")}
      />
    </div>
  );
}
