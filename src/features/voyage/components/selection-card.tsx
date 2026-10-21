import { useFormatter, useLocale, useTranslations } from "next-intl";

import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { Action } from "@horizon/toolkit/ui";

import { dateAt } from "../lib/model/calendar";
import { useVoyage } from "../lib/store";
import { bodyOfSelection, cardFor } from "./cards";

/** Facts for the selected body, from where the ship is, and the way to fly there. */
export function SelectionCard() {
  const t = useTranslations("voyage");
  const f = useFormatter();
  const locale = useLocale();
  const selection = useVoyage((s) => s.selection);
  const unit = useVoyage((s) => s.distanceUnit);
  const destination = useVoyage((s) => s.destination);
  const earthSeconds = useVoyage((s) => s.earthSeconds);
  const epochMs = useVoyage((s) => s.epochMs);
  const ship = useVoyage((s) => s.shipKm);
  const select = useVoyage((s) => s.select);
  if (!selection) return null;
  const body = bodyOfSelection(selection);
  const now = dateAt(epochMs, earthSeconds);
  return (
    <SelectionSheet
      card={cardFor(t, f, selection, { unit, locale }, now, ship)}
      closeLabel={t("hud.close")}
      onClose={() => select(null)}
      footer={
        body && body !== destination ? (
          <Action className="w-full" onClick={() => useVoyage.getState().goTo(body)}>
            {t("hud.flyHere")}
          </Action>
        ) : null
      }
    />
  );
}
