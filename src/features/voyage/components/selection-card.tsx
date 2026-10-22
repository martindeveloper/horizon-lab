import { useFormatter, useLocale, useTranslations } from "next-intl";

import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { Action, ListItem } from "@horizon/toolkit/ui";

import { anchorOfSelection, isFlyable } from "../lib/model/anchors";
import { DRIVE_IDS } from "../lib/model/parameters";
import { courseOf, useVoyage } from "../lib/store";
import { cardFor } from "./cards";
import { formatDuration, formatTrip } from "./format";
import { clocksPart, momentOf, tripTo } from "./trips";

/**
 * Facts for the selected body, from the ship's last fix, and the way to fly there unless the
 * ship is bound for it already: each drive's trip on the ship's clock (and Earth's, where they
 * part), the chosen one lit; tapping another chooses it. Where no drive goes, the trips read
 * never and the ship jumps there.
 */
export function SelectionCard() {
  const t = useTranslations("voyage");
  const f = useFormatter();
  const locale = useLocale();
  const selection = useVoyage((s) => s.selection);
  const unit = useVoyage((s) => s.distanceUnit);
  const course = useVoyage(courseOf);
  const fix = useVoyage((s) => s.fix);
  const epochMs = useVoyage((s) => s.epochMs);
  const drive = useVoyage((s) => s.drive);
  const select = useVoyage((s) => s.select);
  if (!selection) return null;
  const body = anchorOfSelection(selection);
  const moment = momentOf(epochMs, fix);
  const ship = fix.km;
  return (
    <SelectionSheet
      card={cardFor(t, f, selection, { unit, locale }, moment, ship)}
      closeLabel={t("hud.close")}
      onClose={() => select(null)}
      footer={
        body && body !== course ? (
          <div className="flex flex-col gap-2">
            <div role="group" aria-label={t("hud.drive")} className="flex flex-col gap-0.5">
              {DRIVE_IDS.map((id) => {
                const trip = tripTo(id, body, ship, moment);
                return (
                  <ListItem
                    key={id}
                    {...(id === drive ? { selected: true } : {})}
                    aria-pressed={id === drive}
                    onClick={() => useVoyage.getState().setDrive(id)}
                  >
                    <span className="min-w-0 truncate">{t(`drives.${id}`)}</span>
                    <span className="shrink-0 text-right font-mono text-caption text-fg-secondary tabular-nums">
                      {formatTrip(t, f, trip.tau, locale)}
                      {clocksPart(trip) ? (
                        <span className="block text-micro text-fg-tertiary">
                          {t("hud.earthTime", { value: formatDuration(t, f, trip.t, locale) })}
                        </span>
                      ) : null}
                    </span>
                  </ListItem>
                );
              })}
            </div>
            <Action className="w-full" onClick={() => useVoyage.getState().goTo(body)}>
              {t(isFlyable(body) ? "hud.flyHere" : "hud.jumpHere")}
            </Action>
          </div>
        ) : null
      }
    />
  );
}
