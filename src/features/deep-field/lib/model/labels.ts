import type { Translate } from "@/lib/facts";
import { ATLAS_LABELS, ATLAS_LANDMARKS, ATLAS_SOURCES } from "@/space/cosmos/model/atlas";
import { lookbackRingLabels } from "@/space/cosmos/model/cosmos";

/** Canvas templates need their values before they reach the DOM label renderer. */
export function extraSceneLabels(t: Translate): Record<string, string> {
  return {
    ...lookbackRingLabels((gyr) => t("names.lookbackRing", { value: gyr })),
    ...Object.fromEntries(
      ATLAS_LABELS.filter(
        (id) => ATLAS_SOURCES[ATLAS_LANDMARKS[id].source].publication === "preprint",
      ).map((id) => [id, t("atlas.canvasPreprint", { name: t(`names.${id}`) })]),
    ),
  };
}
