import { ArrowLeft, ZoomIn } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";

import { HandoffRow } from "@/components/simulations/handoff-link";
import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { viewOf } from "@/space/solar-system/model/framing";
import { isSolarSelection } from "@/space/solar-system/model/selection";
import { Action } from "@horizon/toolkit/ui";

import { canCloseUp, useDeepField } from "../lib/store";
import { cardFor } from "./cards";

/**
 * Facts and notes for the selected object. A solar system body leads back in time, to the
 * Orrery; the Sun on the Galaxy map flies back down to the planets; a probe offers its
 * close-up, at its true size.
 */
export function SelectionCard() {
  const t = useTranslations("deepField");
  const f = useFormatter();
  const selection = useDeepField((s) => s.selection);
  const unit = useDeepField((s) => s.distanceUnit);
  const locale = useLocale();
  const select = useDeepField((s) => s.select);
  const closeUp = useDeepField((s) => s.closeUp);
  const offerCloseUp = useDeepField(canCloseUp);
  const now = useNow({ updateInterval: 60_000 });
  if (!selection) return null;
  return (
    <SelectionSheet
      card={cardFor(t, f, selection, { unit, locale }, now)}
      closeLabel={t("hud.close")}
      onClose={() => select(null)}
      footer={
        closeUp ? (
          <>
            <Action
              variant="glass"
              className="flex-1"
              onClick={() => useDeepField.getState().leaveCloseUp()}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("hud.leaveCloseUp")}
            </Action>
            <p className="w-full text-xs text-muted">{t("hud.closeUpNote")}</p>
          </>
        ) : offerCloseUp ? (
          <Action className="flex-1" onClick={() => useDeepField.getState().enterCloseUp()}>
            <ZoomIn className="size-4" aria-hidden />
            {t("hud.closeUp")}
          </Action>
        ) : isSolarSelection(selection) ? (
          <HandoffRow
            to="orrery"
            view={viewOf(selection)}
            title={t("hud.backInTime")}
            hint={t("hud.backInTimeHint")}
            className="-mx-2 flex-1 px-2"
          />
        ) : selection.kind === "galaxy" && selection.id === "sun" ? (
          <Action className="w-full" onClick={() => useDeepField.getState().setView("giants")}>
            {t("hud.home")}
          </Action>
        ) : null
      }
    />
  );
}
