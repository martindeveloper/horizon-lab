import { useTranslations } from "next-intl";

import { SceneCanvas } from "@/components/simulations/scene-canvas";
import { useSceneLabels } from "@/components/simulations/use-scene-labels";
import { ATLAS_LABELS } from "@/space/cosmos/model/atlas";
import { COSMOS_LABELS } from "@/space/cosmos/model/cosmos";
import { NEIGHBOURS } from "@/space/galaxy/model/neighbours";
import { LIGHT_RINGS, PROBES } from "@/space/solar-system/model/probes";
import { SOLAR_LABEL_KEYS } from "@/space/solar-system/scene/solar-system";
import { DISTANCE_WORDS } from "@horizon/toolkit/scene";

import { extraSceneLabels } from "../lib/model/labels";
import { createDeepFieldEngine } from "../lib/scene/engine";
import { useDeepField } from "../lib/store";

/** Every name the scene places, and the words its distance labels use. */
const LABEL_KEYS = [
  ...SOLAR_LABEL_KEYS,
  ...PROBES.map((p) => p.id),
  "heliopause",
  ...LIGHT_RINGS.map((r) => r.id),
  ...NEIGHBOURS.map((n) => n.id),
  "galaxySun",
  ...COSMOS_LABELS,
  ...ATLAS_LABELS,
  ...DISTANCE_WORDS,
];

const resetReady = () => useDeepField.getState().setReady(false);

export function DeepFieldCanvas() {
  const t = useTranslations("deepField");
  const translated = useSceneLabels(t, LABEL_KEYS, extraSceneLabels);
  return (
    <SceneCanvas
      id="deep-field"
      label={t("canvasLabel")}
      labels={translated}
      create={createDeepFieldEngine}
      resetReady={resetReady}
    />
  );
}
