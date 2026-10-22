import type { AtlasMode } from "@/space/cosmos/model/atlas";

/**
 * Display policy, independent of the source manifest's scientific status.
 * Both preserves the familiar Laniakea illustration beside the catalogue data.
 * Drift favours a quiet illustration; Guide keeps data visible for its explanations.
 * Automatic experiences temporarily suppress full-map guides and restore manual settings.
 */
export const ATLAS_EXPERIENCE_MODE = {
  manual: "both",
  drift: "illustration",
  guide: "both",
} as const satisfies Record<string, AtlasMode>;
