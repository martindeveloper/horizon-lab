import { useTranslations } from "next-intl";

import { SceneCanvas } from "@/components/simulations/scene-canvas";
import { useSceneLabels } from "@/components/simulations/use-scene-labels";
import { COSMOS_LABELS, lookbackRingLabels } from "@/space/cosmos/model/cosmos";
import { LIGHT_RINGS, PROBES } from "@/space/solar-system/model/probes";
import { SOLAR_LABEL_KEYS } from "@/space/solar-system/scene/solar-system";
import { DISTANCE_WORDS } from "@horizon/toolkit/scene";

import { createVoyageEngine } from "../lib/scene/engine";
import { useVoyage } from "../lib/store";

/** Every name the scene places, and the words its distance labels use. */
const LABEL_KEYS = [
  ...SOLAR_LABEL_KEYS,
  ...PROBES.map((p) => p.id),
  "heliopause",
  ...LIGHT_RINGS.map((r) => r.id),
  "alphaCen",
  "alphaCenB",
  "proxima",
  "galaxySun",
  ...COSMOS_LABELS,
  ...DISTANCE_WORDS,
];

/* Each lookback ring named with its age, and the words the floating readouts print. */
const sceneWords = (t: ReturnType<typeof useTranslations>) => ({
  ...lookbackRingLabels((gyr) => t("names.lookbackRing", { value: gyr })),
  speedWord: t("hud.speed"),
  closingWord: t("hud.closing"),
});

const resetReady = () => useVoyage.getState().setReady(false);

export function VoyageCanvas() {
  const t = useTranslations("voyage");
  const translated = useSceneLabels(t, LABEL_KEYS, sceneWords);
  return (
    <SceneCanvas
      id="voyage"
      label={t("canvasLabel")}
      labels={translated}
      create={createVoyageEngine}
      resetReady={resetReady}
    />
  );
}
