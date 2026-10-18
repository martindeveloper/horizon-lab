import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { StartEngine } from "@/components/simulations/engine-lifecycle";
import { useSimulationEngine } from "@/components/simulations/use-simulation-engine";

import { COSMOS_LABELS } from "../lib/model/cosmos";
import { createOrreryEngine } from "../lib/scene/engine";
import { useOrrery } from "../lib/store";

const LABEL_KEYS = [
  "sun",
  "snowLine",
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "sedna",
  "halley",
  "moon",
  "io",
  "europa",
  "ganymede",
  "callisto",
  "titan",
  "triton",
  "charon",
  "proxima",
  "alphaCen",
  "barnard",
  "scholz",
  "galaxySun",
  ...COSMOS_LABELS,
  "au",
  "lightTime",
  "lightYears",
  "parsecs",
  "million",
] as const;

const resetReady = () => useOrrery.getState().setReady(false);

export function OrreryCanvas() {
  const t = useTranslations("orrery");
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const names = useRef<Record<string, string>>({});
  const translated = useMemo(
    () => Object.fromEntries(LABEL_KEYS.map((key) => [key, t(`names.${key}`)])),
    [t],
  );
  useEffect(() => {
    names.current = translated;
  }, [translated]);

  const create = useCallback<StartEngine>((_signal, onError) => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const labelRoot = labelRef.current;
    if (!host || !canvas || !labelRoot) return;
    return createOrreryEngine(canvas, host, labelRoot, () => names.current, onError);
  }, []);
  useSimulationEngine(create, resetReady);

  return (
    <div ref={hostRef} className="absolute inset-0 z-0 bg-space">
      <canvas
        ref={canvasRef}
        data-orrery-canvas
        className="block size-full"
        role="img"
        aria-label={t("canvasLabel")}
      />
      {/* Projected names repeat the Objects panel in no reading order; keep them visual. */}
      <div
        ref={labelRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />
    </div>
  );
}
