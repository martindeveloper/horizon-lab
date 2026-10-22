import { ArrowLeft, ChevronDown, ChevronUp, ZoomIn } from "lucide-react";
import { useState } from "react";

import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { staticCard } from "@/lib/facts";
import { Action, SwitchChip } from "@horizon/toolkit/ui";

import type { PlaceId } from "../lib/model/places";
import { canCloseUp, useSun } from "../lib/store";
import { PLACE_CARDS } from "./card-specs";
import { useDistance, useSunT } from "./format";

/**
 * The selected place's card: its figures with their sources, one remark and any caution.
 * Parker's offers its close-up, at the probe's true size; there, on phones, the card folds to
 * a bar so the probe has the screen, as every close-up's does.
 */
export function PlaceCard({ id }: { id: PlaceId }) {
  const t = useSunT();
  const distance = useDistance();
  const closeUp = useSun((s) => s.closeUp);
  const ride = useSun((s) => s.ride);
  const offerCloseUp = useSun(canCloseUp);
  const [expanded, setExpanded] = useState(false);
  return (
    <SelectionSheet
      card={staticCard(t, distance, `places.${id}`, PLACE_CARDS[id])}
      closeLabel={t("hud.close")}
      onClose={() => useSun.getState().select(null)}
      folded={closeUp && !expanded}
      footer={
        closeUp ? (
          <>
            <Action
              variant="glass"
              className="flex-1"
              onClick={() => useSun.getState().leaveCloseUp()}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("hud.leaveCloseUp")}
            </Action>
            <SwitchChip on={ride} onToggle={() => useSun.getState().setRide(!ride)}>
              {t("hud.ride")}
            </SwitchChip>
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
            <p className="w-full text-xs text-muted">
              {t(ride ? "hud.rideNote" : "hud.closeUpNote")}
            </p>
          </>
        ) : offerCloseUp ? (
          <Action className="flex-1" onClick={() => useSun.getState().enterCloseUp()}>
            <ZoomIn className="size-4" aria-hidden />
            {t("hud.closeUp")}
          </Action>
        ) : null
      }
    />
  );
}
