import { ArrowLeft, ChevronDown, ChevronUp, ZoomIn } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { Action } from "@horizon/toolkit/ui";

import { canCloseUp, closeUpAwaitsPresent, useOrrery } from "../lib/store";
import { cardFor } from "./cards";
import { SolarActivityControls } from "./solar-activity-controls";

/** Facts and notes for the selected object, with the close-up entry. */
export function SelectionCard() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const selection = useOrrery((s) => s.selection);
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const elliptical = useOrrery((s) => s.show.elliptical);
  const unit = useOrrery((s) => s.distanceUnit);
  const locale = useLocale();
  const select = useOrrery((s) => s.select);
  const closeUp = useOrrery((s) => s.closeUp);
  const offerCloseUp = useOrrery(canCloseUp);
  const deepTime = useOrrery(closeUpAwaitsPresent);
  const deepTimeNote = useId();
  /* On phones a close-up folds the card to a bar so the globe has the screen. */
  const [expanded, setExpanded] = useState(false);
  const now = useNow({ updateInterval: 60_000 });
  if (!selection) return null;
  return (
    <SelectionSheet
      card={cardFor(t, f, selection, yearsAgo, elliptical, now, { unit, locale })}
      closeLabel={t("hud.close")}
      onClose={() => select(null)}
      folded={closeUp && !expanded}
      footer={
        closeUp || offerCloseUp || deepTime ? (
          <>
            {closeUp ? (
              <Action className="flex-1" onClick={() => useOrrery.getState().leaveCloseUp()}>
                <ArrowLeft className="size-4" aria-hidden />
                {t("hud.leaveCloseUp")}
              </Action>
            ) : offerCloseUp ? (
              <Action className="flex-1" onClick={() => useOrrery.getState().enterCloseUp()}>
                <ZoomIn className="size-4" aria-hidden />
                {t("hud.closeUp")}
              </Action>
            ) : deepTime ? (
              <Action className="flex-1" disabled aria-describedby={deepTimeNote}>
                <ZoomIn className="size-4" aria-hidden />
                {t("hud.closeUp")}
              </Action>
            ) : null}
            {closeUp ? (
              <Action
                variant="ghost"
                className="px-3 md:hidden"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? t("hud.hideDetails") : t("hud.details")}
                {expanded ? (
                  <ChevronDown className="size-4" aria-hidden />
                ) : (
                  <ChevronUp className="size-4" aria-hidden />
                )}
              </Action>
            ) : null}
            {closeUp ? <p className="w-full text-xs text-muted">{t("hud.closeUpNote")}</p> : null}
            {deepTime ? (
              <p id={deepTimeNote} className="w-full text-xs text-muted">
                {t("hud.closeUpPresentOnly")}
              </p>
            ) : null}
            {closeUp && selection.kind === "sun" ? <SolarActivityControls /> : null}
          </>
        ) : null
      }
    />
  );
}
