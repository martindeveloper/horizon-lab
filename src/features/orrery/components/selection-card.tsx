import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useState } from "react";

import { CloseUpFooter } from "@/components/simulations/close-up-footer";
import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { solarNameKey } from "@/space/solar-system/format";

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
  /* On phones a close-up folds the card to a bar so the globe has the screen. */
  const [expanded, setExpanded] = useState(false);
  const now = useNow({ updateInterval: 60_000 });
  if (!selection) return null;
  const here = closeUp !== null && orreryKey(closeUp) === orreryKey(selection);
  const up = closeUp && upFrom(closeUp);
  return (
    <SelectionSheet
      card={cardFor(t, f, selection, yearsAgo, elliptical, now, { unit, locale })}
      closeLabel={t("hud.close")}
      onClose={() => select(null)}
      folded={closeUp !== null && !expanded}
      footer={
        closeUp !== null || offerCloseUp || deepTime ? (
          <CloseUpFooter
            namespace="orrery"
            offer={offerCloseUp && !here}
            open={closeUp !== null}
            here={here}
            note={selection.kind === "observatory" ? "craft" : "body"}
            backLabel={up ? t("hud.backTo", { name: t(solarNameKey(up)) }) : t("hud.leaveCloseUp")}
            awaiting={deepTime ? t("hud.closeUpPresentOnly") : null}
            expanded={expanded}
            onExpand={setExpanded}
            onEnter={() => useOrrery.getState().enterCloseUp()}
            onLeave={() => useOrrery.getState().leaveCloseUp()}
          >
            {selection.kind === "sun" ? <SolarActivityControls /> : null}
          </CloseUpFooter>
        ) : null
      }
    />
  );
}
