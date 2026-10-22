import { useTranslations } from "next-intl";

import { SceneCanvas } from "@/components/simulations/scene-canvas";
import { useSceneLabels } from "@/components/simulations/use-scene-labels";

import { PLACE_IDS } from "../lib/model/places";
import { createSunScene } from "../lib/scene/bridge";
import { useSun } from "../lib/store";

const resetReady = () => useSun.getState().setReady(false);

/** The names the scene places: the Sun's, and each place's, by its id. */
const NAME_KEYS = ["sun"];
const placeNames = (t: ReturnType<typeof useTranslations>) => ({
  ...Object.fromEntries(PLACE_IDS.map((id) => [id, t(`places.${id}.title`)])),
  coronaEdge: t("hud.coronaEdge"),
});

export function SunCanvas() {
  const t = useTranslations("sun");
  const labels = useSceneLabels(t, NAME_KEYS, placeNames);
  return (
    <SceneCanvas
      id="sun"
      label={t("canvasLabel")}
      labels={labels}
      create={createSunScene}
      resetReady={resetReady}
    />
  );
}
