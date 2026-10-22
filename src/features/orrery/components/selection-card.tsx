import { ArrowLeft, ChevronDown, ChevronUp, ZoomIn } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { solarNameKey } from "@/space/solar-system/format";
import { Action } from "@horizon/toolkit/ui";

import { orreryKey, upFrom } from "../lib/model/selection";
import { canCloseUp, closeUpAwaitsPresent, useOrrery } from "../lib/store";
import { cardFor } from "./cards";
import { SolarActivityControls } from "./solar-activity-controls";

/**
 * Facts and notes for the selected object, with the close-up entry. In a close-up the card may
 * show another of its system, offering to fly on to it; Back goes up a level, from a moon or an
 * observatory to its planet and from a planet to the map.
 */
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
  const here = closeUp !== null && orreryKey(closeUp) === orreryKey(selection);
  const offer = offerCloseUp && !here;
  const up = closeUp && upFrom(closeUp);
  const back = up ? t("hud.backTo", { name: t(solarNameKey(up)) }) : t("hud.leaveCloseUp");
  return (
    <SelectionSheet
      card={cardFor(t, f, selection, yearsAgo, elliptical, now, { unit, locale })}
      closeLabel={t("hud.close")}
      onClose={() => select(null)}
      folded={closeUp !== null && !expanded}
      footer={
        closeUp || offerCloseUp || deepTime ? (
          <>
            {offer ? (
              <Action
                data-coach="closeUp"
                className="flex-1"
                onClick={() => useOrrery.getState().enterCloseUp()}
              >
                <ZoomIn className="size-4" aria-hidden />
                {t("hud.closeUp")}
              </Action>
            ) : null}
            {closeUp ? (
              <Action
                data-coach="closeUp"
                variant={offer ? "ghost" : "glass"}
                className={offer ? "px-3" : "flex-1"}
                onClick={() => useOrrery.getState().leaveCloseUp()}
              >
                <ArrowLeft className="size-4" aria-hidden />
                {back}
              </Action>
            ) : !offer && deepTime ? (
              <Action
                data-coach="closeUp"
                className="flex-1"
                disabled
                aria-describedby={deepTimeNote}
              >
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
            {here ? (
              <p className="w-full text-ui text-fg-secondary">
                {t(selection.kind === "observatory" ? "hud.craftNote" : "hud.closeUpNote")}
              </p>
            ) : null}
            {deepTime ? (
              <p id={deepTimeNote} className="w-full text-ui text-fg-secondary">
                {t("hud.closeUpPresentOnly")}
              </p>
            ) : null}
            {here && selection.kind === "sun" ? <SolarActivityControls /> : null}
          </>
        ) : null
      }
    />
  );
}
