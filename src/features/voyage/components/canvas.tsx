import { useTranslations } from "next-intl";

import { SceneCanvas } from "@/components/simulations/scene-canvas";
import { useSceneLabels } from "@/components/simulations/use-scene-labels";
import { COSMOS_LABELS } from "@/space/cosmos/model/cosmos";
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

/* A template the scene fills with each ring's age. */
const lookbackRing = (t: ReturnType<typeof useTranslations>) => ({
  lookbackRing: String(t.raw("names.lookbackRing")),
});

const resetReady = () => useVoyage.getState().setReady(false);

export function VoyageCanvas() {
  const t = useTranslations("voyage");
  const translated = useSceneLabels(t, LABEL_KEYS, lookbackRing);
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
