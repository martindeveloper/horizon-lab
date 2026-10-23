import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { CloseUpFooter } from "@/components/simulations/close-up-footer";
import { HandoffRow } from "@/components/simulations/handoff-link";
import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { ATLAS_CARD_SOURCES, ATLAS_SOURCES, isAtlasId } from "@/space/cosmos/model/atlas";
import { solarNameKey } from "@/space/solar-system/format";
import { closeUpKey, upFrom } from "@/space/solar-system/model/close-up";
import { viewOf } from "@/space/solar-system/model/framing";
import { isReachSelection } from "@/space/solar-system/model/probes";
import { isSolarSelection } from "@/space/solar-system/model/selection";
import { Action } from "@horizon/toolkit/ui";

import { canCloseUp, useDeepField } from "../lib/store";
import { AtlasProvenance } from "./atlas-provenance";
import { COSMOS_CARDS } from "./card-specs";
import { cardFor } from "./cards";
import { CmbEvidence } from "./cmb";
import { HaloEvidence } from "./dark-universe";

/**
 * Facts and notes for the selected object, with the close-up entry: a body or a probe flies in
 * at its true size, as in the Orrery; Back goes up a level, from a moon to its planet and from
 * a planet to the map. A solar system body also leads back in time, to the Orrery; the Sun on
 * the Galaxy map flies back down to the planets.
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
  /* On phones a close-up folds the card to a bar so the globe has the screen. */
  const [expanded, setExpanded] = useState(false);
  const now = useNow({ updateInterval: 60_000 });
  if (!selection) return null;
  /** The close-up open is the selection's own. */
  const here =
    closeUp !== null &&
    (closeUp.kind === "reach"
      ? isReachSelection(selection) && selection.id === closeUp.id
      : isSolarSelection(selection) && closeUpKey(closeUp) === closeUpKey(selection));
  const up = closeUp && closeUp.kind !== "reach" ? upFrom(closeUp) : null;
  // Keep the warning tied to the source manifest, including mixed-source cards.
  // When a preprint is published, update that manifest and review the caveat prose.
  const preprint =
    selection.kind === "cosmos" &&
    isAtlasId(selection.id) &&
    ATLAS_CARD_SOURCES[selection.id].some(
      (source) => ATLAS_SOURCES[source].publication === "preprint",
    );
  const evidence = selection.kind === "cosmos" ? COSMOS_CARDS[selection.id].badge : undefined;
  const halo = selection.kind === "galaxy" && selection.id === "halo";
  let noteKey = "detailNotes.general";
  if (preprint) {
    noteKey = "atlas.publication.preprint";
  } else if (evidence === "observations") {
    noteKey = "detailNotes.measurements";
  } else if (evidence === "reconstruction") {
    noteKey = "detailNotes.reconstruction";
  } else if (halo) {
    noteKey = "dark.inferred";
  }

  let details: ReactNode;
  if (selection.kind === "cosmos" && isAtlasId(selection.id)) {
    details = <AtlasProvenance id={selection.id} />;
  } else if (selection.kind === "cosmos" && selection.id === "observableUniverse") {
    details = <CmbEvidence />;
  } else if (halo) {
    details = <HaloEvidence />;
  }

  let footer: ReactNode = null;
  if (closeUp || offerCloseUp || isSolarSelection(selection)) {
    footer = (
      <>
        <CloseUpFooter
          namespace="deepField"
          offer={offerCloseUp && !here}
          open={closeUp !== null}
          here={here}
          note={isReachSelection(selection) ? "craft" : "body"}
          backLabel={up ? t("hud.backTo", { name: t(solarNameKey(up)) }) : t("hud.leaveCloseUp")}
          expanded={expanded}
          onExpand={setExpanded}
          onEnter={() => useDeepField.getState().enterCloseUp()}
          onLeave={() => useDeepField.getState().leaveCloseUp()}
        />
        {isSolarSelection(selection) ? (
          <HandoffRow
            to="orrery"
            view={viewOf(selection)}
            title={t("hud.backInTime")}
            hint={t("hud.backInTimeHint")}
            className="-mx-2 w-full px-2"
          />
        ) : null}
      </>
    );
  } else if (selection.kind === "galaxy" && selection.id === "sun") {
    footer = (
      <Action className="w-full" onClick={() => useDeepField.getState().setView("giants")}>
        {t("hud.home")}
      </Action>
    );
  } else if (halo) {
    footer = (
      <Action
        variant="glass"
        className="w-full"
        onClick={() => useDeepField.getState().openDarkView("halo")}
      >
        {t("dark.open")}
      </Action>
    );
  }
  return (
    <SelectionSheet
      card={cardFor(t, f, selection, { unit, locale }, now)}
      closeLabel={t("hud.close")}
      onClose={() => select(null)}
      folded={closeUp !== null && !expanded}
      cautionCallout={{ title: t(noteKey), tone: preprint ? "warning" : "info" }}
      details={details}
      footer={footer}
    />
  );
}
