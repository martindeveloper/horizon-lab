import { useTranslations } from "next-intl";

import { SceneCanvas } from "@/components/simulations/scene-canvas";
import { useSceneLabels } from "@/components/simulations/use-scene-labels";
import { OBSERVATORY_IDS } from "@/space/solar-system/model/observatories";
import { SOLAR_LABEL_KEYS } from "@/space/solar-system/scene/solar-system";
import { DISTANCE_WORDS } from "@horizon/toolkit/scene";

import { createOrreryEngine } from "../lib/scene/engine";
import { useOrrery } from "../lib/store";

/** Every name the scene places, and the words its distance labels use. */
const LABEL_KEYS = [...SOLAR_LABEL_KEYS, "habitableZone", ...OBSERVATORY_IDS, ...DISTANCE_WORDS];

const resetReady = () => useOrrery.getState().setReady(false);

export function OrreryCanvas() {
  const t = useTranslations("orrery");
  const translated = useSceneLabels(t, LABEL_KEYS);
  return (
    <SceneCanvas
      id="orrery"
      label={t("canvasLabel")}
      labels={translated}
      create={createOrreryEngine}
      resetReady={resetReady}
    />
  );
}
