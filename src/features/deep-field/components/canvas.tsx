import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { SceneCanvas } from "@/components/simulations/scene-canvas";
import { SOLAR_LABEL_KEYS } from "@/space/solar-system/scene/solar-system";
import { DISTANCE_WORDS } from "@horizon/toolkit/scene";

import { COSMOS_LABELS } from "../lib/model/cosmos";
import { NEIGHBOURS } from "../lib/model/neighbours";
import { LIGHT_RINGS, PROBES } from "../lib/model/probes";
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
  ...DISTANCE_WORDS,
];

const resetReady = () => useDeepField.getState().setReady(false);

export function DeepFieldCanvas() {
  const t = useTranslations("deepField");
  const translated = useMemo(
    () => ({
      ...Object.fromEntries(LABEL_KEYS.map((key) => [key, t(`names.${key}`)])),
      /* A template the scene fills with each ring's age. */
      lookbackRing: String(t.raw("names.lookbackRing")),
    }),
    [t],
  );
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
