import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CMB_FACTS, CMB_PALETTE, CMB_SOURCE, type CmbStatus } from "@/space/cosmos/model/cmb";
import { formatFigure } from "@horizon/toolkit/science";
import { Action, Callout, Disclosure, Orb, SegmentedControl } from "@horizon/toolkit/ui";

import { useDeepField } from "../lib/store";
import { CaptionKey } from "./header-caption";

export function cmbStatusKey(status: CmbStatus, detail: boolean) {
  if (status.planck === "ready") {
    if (!detail) return "planck";
    return status.act === "ready"
      ? "combined"
      : status.act === "error"
        ? "fallback"
        : "detailLoading";
  }
  if (detail && status.act === "ready") return "actOnly";
  if (status.planck === "error") return "unavailable";
  return status.planck === "idle" ? "idle" : "loading";
}

export function CmbControl() {
  const t = useTranslations("deepField");
  const detail = useDeepField((s) => s.show.cmbDetail);
  return (
    <SegmentedControl
      aria-label={t("cmb.control")}
      options={[
        { value: "planck", label: t("cmb.planck") },
        { value: "combined", label: t("cmb.combined") },
      ]}
      value={detail ? "combined" : "planck"}
      onValueChange={(value) =>
        useDeepField.getState().patchShow({ cmbDetail: value === "combined" })
      }
    />
  );
}

/** Always identifies reconstruction and masks, even when the broader map is in Data mode. */
export function CmbEvidence({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("deepField");
  const locale = useLocale();
  const status = useDeepField((s) => s.cmbStatus);
  const detail = useDeepField((s) => s.show.cmbDetail);
  const key = cmbStatusKey(status, detail);
  const limit = formatFigure(locale, CMB_FACTS.colourLimit, { perPower: -6 }).text;
  const resolution = {
    planck: formatFigure(locale, CMB_FACTS.planckPixel, { digits: 3, withUnit: true }).text,
    act: formatFigure(locale, CMB_FACTS.actPixel, { digits: 3, withUnit: true }).text,
  };
  const failed = status.planck === "error" || (detail && status.act === "error");
  return (
    <div className="grid gap-3">
      {compact ? null : <CmbControl />}
      <p role="status" className="text-ui text-fg-secondary">
        {t(`cmb.status.${key}`)}
      </p>
      {failed ? (
        <Action variant="glass" onClick={() => useDeepField.getState().retryCmb()}>
          {t("cmb.retry")}
        </Action>
      ) : null}
      <Callout title={t("cmb.reconstructed")}>
        <p>{t("cmb.measured")}</p>
        <p className="mt-2">{t("cmb.processing")}</p>
      </Callout>
      <div>
        <div
          aria-hidden
          className="h-1 rounded-full"
          style={{
            background: `linear-gradient(to right, ${CMB_PALETTE.cool}, ${CMB_PALETTE.neutral}, ${CMB_PALETTE.warm})`,
          }}
        />
        <p className="mt-2 text-xs text-fg-secondary">{t("cmb.colours", { limit })}</p>
      </div>
      <Disclosure summary={t("cmb.limits")}>
        <p>{t("cmb.geometry")}</p>
        <p>{t("cmb.masks")}</p>
        <p>{t("cmb.resolution", resolution)}</p>
        <p>{t("cmb.releases")}</p>
        <p>{t("atlas.reviewed", { date: CMB_SOURCE.reviewed })}</p>
        <ul className="grid gap-2">
          {(["planck", "act"] as const).map((id) => (
            <li key={id}>
              <a
                href={CMB_SOURCE[`${id}Page`]}
                target="_blank"
                rel="noreferrer"
                className="inline-flex gap-1 rounded-compact underline decoration-border underline-offset-4 ui-focus hover:decoration-current"
              >
                {CMB_SOURCE[`${id}Release`]}
                <ExternalLink aria-hidden className="mt-0.5 icon size-icon-micro shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}

export function CmbLegend() {
  const t = useTranslations("deepField");
  const ly = useDeepField((s) => s.viewLy);
  const status = useDeepField((s) => s.cmbStatus);
  const detail = useDeepField((s) => s.show.cmbDetail);
  if (ly <= 2e10) return null;
  return (
    <CaptionKey
      mark={<Orb look="swarm" color="var(--color-space-muted)" size={10} />}
      aria-label={t("cmb.open")}
      onClick={() => {
        const api = useDeepField.getState();
        api.setPanel("none");
        api.select({ kind: "cosmos", id: "observableUniverse" });
      }}
    >
      <span>
        {t("cmb.reconstructed")}
        <span className="block text-xs">{t(`cmb.status.${cmbStatusKey(status, detail)}`)}</span>
      </span>
    </CaptionKey>
  );
}
