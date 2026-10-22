import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { IconButton, Surface, SwitchChip, useImmersive, useMediaQuery } from "@horizon/toolkit/ui";

import { useOrrery } from "../lib/store";

/** Keep the scientific qualification on screen when the normal facts/controls are hidden. */
export function SolarActivityNotice() {
  const t = useTranslations("orrery.solarActivity");
  const immersive = useImmersive();
  const active = useOrrery((s) => s.solarActivity && s.closeUp?.kind === "sun");
  const panel = useOrrery((s) => s.panel);
  if (!active || (!immersive && panel === "none")) return null;
  return (
    <Surface
      variant="hud"
      className="pointer-events-none absolute top-14 left-(--hud-gutter) z-[70] max-w-[calc(100%-2*var(--hud-gutter))] rounded-lg px-3 py-2 text-xs text-fg-primary"
    >
      {t("toggle")} · {t("model")}
    </Surface>
  );
}

/** Kept in the close-up footer, including when the phone's facts panel is folded. */
export function SolarActivityControls() {
  const t = useTranslations("orrery.solarActivity");
  const enabled = useOrrery((s) => s.solarActivity);
  const paused = useOrrery((s) => s.solarActivityPaused);
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  const description = useId();
  return (
    <div className="w-full border-t border-border pt-2">
      <div className="flex items-center gap-2">
        <SwitchChip
          on={enabled}
          onToggle={() => useOrrery.getState().toggleSolarActivity()}
          aria-describedby={description}
        >
          {t("toggle")}
        </SwitchChip>
        {enabled && !reduced ? (
          <IconButton
            aria-label={paused ? t("resume") : t("pause")}
            title={paused ? t("resume") : t("pause")}
            onClick={() => useOrrery.getState().toggleSolarActivityPaused()}
          >
            {paused ? (
              <Play className="size-3.5" aria-hidden />
            ) : (
              <Pause className="size-3.5" aria-hidden />
            )}
          </IconButton>
        ) : null}
      </div>
      <p id={description} className="mt-1 text-xs leading-relaxed text-fg-secondary">
        <span className="text-fg-primary">{t("model")}</span>
        {enabled ? <> · {t("description")}</> : null}
      </p>
      {enabled && (reduced || paused) ? (
        <p className="mt-1 text-xs text-fg-secondary">{reduced ? t("reducedMotion") : t("paused")}</p>
      ) : null}
    </div>
  );
}
