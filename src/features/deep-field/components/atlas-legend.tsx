import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { atlasVisibility } from "@/space/cosmos/model/atlas";

import { useDeepField } from "../lib/store";

/** The map's marks as the scene draws them, in its muted ink. */
const DOT = <span className="size-1.5 rounded-full bg-space-fg" />;
const RING = <span className="size-2 rounded-full border border-space-muted" />;
const DIAMOND = <span className="size-1.5 rotate-45 border border-space-muted" />;
const LINE = <span className="w-3 border-t border-space-muted" />;

function Key({ marks, children }: { marks: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-flex items-center gap-1">
        {marks}
      </span>
      {children}
    </li>
  );
}

/**
 * The cosmic map's key, in the header's caption slot (`CaptionSlot`) while the atlas is in view (the views
 * captioned there lie nearer or farther): one short word per kind of mark, only for the layers
 * shown. What each means, the display mode and the coverage live in the Settings panel.
 */
export function AtlasLegend() {
  const t = useTranslations("deepField");
  const ly = useDeepField((s) => s.viewLy);
  const show = atlasVisibility(useDeepField((s) => s.show));
  if (ly < 240e6 || ly > 8e9) return null;
  return (
    <ul
      aria-label={t("atlas.legendTitle")}
      className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"
    >
      {show.cosmicMeasured ? <Key marks={DOT}>{t("atlas.measured")}</Key> : null}
      {show.cosmicBasins ? <Key marks={RING}>{t("atlas.reconstructed")}</Key> : null}
      {show.cosmicVoids || show.cosmicKnots ? (
        <Key
          marks={
            <>
              {show.cosmicVoids ? RING : null}
              {show.cosmicKnots ? DIAMOND : null}
            </>
          }
        >
          {t("atlas.preprint")}
        </Key>
      ) : null}
      {show.cosmicIllustrations ? <Key marks={LINE}>{t("atlas.illustration")}</Key> : null}
    </ul>
  );
}
