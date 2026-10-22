import { ArrowLeft, ZoomIn } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";

import { HandoffRow } from "@/components/simulations/handoff-link";
import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { ATLAS_CARD_SOURCES, ATLAS_SOURCES, isAtlasId } from "@/space/cosmos/model/atlas";
import { viewOf } from "@/space/solar-system/model/framing";
import { isSolarSelection } from "@/space/solar-system/model/selection";
import { Action } from "@horizon/toolkit/ui";

import { canCloseUp, useDeepField } from "../lib/store";
import { AtlasProvenance } from "./atlas-provenance";
import { COSMOS_CARDS } from "./card-specs";
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
  // Keep the warning tied to the source manifest, including mixed-source cards.
  // When a preprint is published, update that manifest and review the caveat prose.
  const preprint =
    selection.kind === "cosmos" &&
    isAtlasId(selection.id) &&
    ATLAS_CARD_SOURCES[selection.id].some(
      (source) => ATLAS_SOURCES[source].publication === "preprint",
    );
  const evidence = selection.kind === "cosmos" ? COSMOS_CARDS[selection.id].badge : undefined;
  const noteTitle = preprint
    ? t("atlas.publication.preprint")
    : t(
        evidence === "observations"
          ? "detailNotes.measurements"
          : evidence === "reconstruction"
            ? "detailNotes.reconstruction"
            : "detailNotes.general",
      );
  return (
    <SelectionSheet
      card={cardFor(t, f, selection, { unit, locale }, now)}
      closeLabel={t("hud.close")}
      onClose={() => select(null)}
      cautionCallout={{ title: noteTitle, tone: preprint ? "warning" : "info" }}
      details={
        selection.kind === "cosmos" && isAtlasId(selection.id) ? (
          <AtlasProvenance id={selection.id} />
        ) : undefined
      }
      footer={
        closeUp ? (
          <>
            <Action
              variant="glass"
              className="flex-1"
              onClick={() => useDeepField.getState().leaveCloseUp()}
            >
              <ArrowLeft className="icon" aria-hidden />
              {t("hud.leaveCloseUp")}
            </Action>
            <p className="w-full text-ui text-fg-secondary">{t("hud.closeUpNote")}</p>
          </>
        ) : offerCloseUp ? (
          <Action className="flex-1" onClick={() => useDeepField.getState().enterCloseUp()}>
            <ZoomIn className="icon" aria-hidden />
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
