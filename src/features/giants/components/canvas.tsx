import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";

import { useSimulationEngine } from "@/components/simulations/use-simulation-engine";
import type { StartEngine } from "@horizon/toolkit/rendering";
import { useImmersive } from "@horizon/toolkit/ui";

import { createGiantsEngine } from "../lib/engine";
import { RUNG_IDS, type RungId } from "../lib/model/rungs";
import { ORBIT_IDS } from "../lib/parameters";
import { useGiants } from "../lib/store";

const resetReady = () => useGiants.getState().setReady(false);

/** A name over its body opens its card, and flies there first if it is not in focus. */
const open = (id: RungId) => useGiants.getState().goTo(id);

/**
 * The stage: the ladder's canvas, and over it each body's name, which the engine moves onto its
 * body every frame and shows only for the body in focus and those large enough to name.
 */
export function GiantsCanvas() {
  const t = useTranslations("giants");
  const immersive = useImmersive();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const create = useCallback<StartEngine>((_signal, onError) => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!host || !canvas || !labels) return;
    return createGiantsEngine(canvas, host, labels, onError);
  }, []);
  useSimulationEngine(create, resetReady);

  return (
    <div ref={hostRef} className="giants-stage absolute inset-0 z-0 bg-space">
      <canvas
        data-simulation-canvas="giants"
        ref={canvasRef}
        className="block size-full"
        role="img"
        aria-label={t("canvasLabel")}
      />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0" hidden={immersive}>
        {RUNG_IDS.map((id) => (
          <button
            key={id}
            type="button"
            data-rung={id}
            data-shown="false"
            className="giants-label"
            tabIndex={-1}
            onClick={() => open(id)}
          >
            {t(`rungs.${id}.name`)}
          </button>
        ))}
        {ORBIT_IDS.map((id) => (
          <span key={id} data-orbit={id} data-shown="false" className="giants-orbit" aria-hidden>
            {t(`orbits.${id}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
