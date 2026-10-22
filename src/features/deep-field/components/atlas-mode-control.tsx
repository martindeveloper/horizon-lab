import { useTranslations } from "next-intl";

import { ATLAS_MODES } from "@/space/cosmos/model/atlas";
import { SegmentedControl } from "@horizon/toolkit/ui";

import { useDeepField } from "../lib/store";

/** The cosmic map's display: data, illustration or both, in the Settings panel. */
export function AtlasModeControl() {
  const t = useTranslations("deepField");
  const mode = useDeepField((s) => s.show.cosmicMode);
  return (
    <SegmentedControl
      aria-label={t("atlas.modeTitle")}
      options={ATLAS_MODES.map((value) => ({ value, label: t(`atlas.modes.${value}`) }))}
      value={mode}
      onValueChange={(cosmicMode) => useDeepField.getState().patchShow({ cosmicMode })}
    />
  );
}
