import { useTranslations } from "next-intl";

import { useDeepField } from "../lib/store";

/** Quiet, shape-coded legend in the existing HUD, with details in the View rail. */
export function AtlasLegend() {
  const t = useTranslations("deepField");
  const ly = useDeepField((s) => s.viewLy);
  const show = useDeepField((s) => s.show);
  const panel = useDeepField((s) => s.panel);
  if (ly < 240e6 || ly > 8e9 || panel !== "none") return null;
  return (
    <section
      className="mt-2 flex max-w-xl flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-space-muted md:text-[11px]"
      aria-label={t("atlas.legendTitle")}
    >
      {show.cosmicMeasured ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-space-fg" aria-hidden />
          {t("atlas.measured")}
        </span>
      ) : null}
      {show.cosmicBasins ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full border border-space-muted" aria-hidden />
          {t("atlas.reconstructed")}
        </span>
      ) : null}
      {show.cosmicVoids || show.cosmicKnots ? (
        <span className="inline-flex items-center gap-1.5">
          {show.cosmicVoids ? (
            <span className="size-1.5 rounded-full border border-space-muted" aria-hidden />
          ) : null}
          {show.cosmicKnots ? (
            <span className="size-1.5 rotate-45 border border-space-muted" aria-hidden />
          ) : null}
          {t("atlas.preprint")}
        </span>
      ) : null}
      {show.cosmicGuides ? <span>{t("atlas.guidesEnabled")}</span> : null}
      {show.cosmicIllustrations ? <span>{t("atlas.illustration")}</span> : null}
      <p className="basis-full text-space-muted/90 not-md:hidden">{t("atlas.shortCoverage")}</p>
    </section>
  );
}
