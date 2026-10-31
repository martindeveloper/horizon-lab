import { useTranslations } from "next-intl";

import { SceneCanvas } from "@/components/simulations/scene-canvas";

import { createAfterglowEngine } from "../lib/scene/engine";
import { useAfterglow } from "../lib/store";

/** The scene places no names: its labels are empty. */
const NO_LABELS = {};

const resetReady = () => useAfterglow.getState().setReady(false);

export function AfterglowCanvas() {
  const t = useTranslations("afterglow");
  return (
    <SceneCanvas
      id="afterglow"
      label={t("canvasLabel")}
      labels={NO_LABELS}
      create={createAfterglowEngine}
      resetReady={resetReady}
    />
  );
}
