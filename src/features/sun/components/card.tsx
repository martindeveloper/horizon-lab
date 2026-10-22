import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { staticCard } from "@/lib/facts";

import type { PlaceId } from "../lib/model/places";
import { useSun } from "../lib/store";
import { PLACE_CARDS } from "./card-specs";
import { useDistance, useSunT } from "./format";

/** The selected place's card: its figures with their sources, one remark and any caution. */
export function PlaceCard({ id }: { id: PlaceId }) {
  const t = useSunT();
  const distance = useDistance();
  return (
    <SelectionSheet
      card={staticCard(t, distance, `places.${id}`, PLACE_CARDS[id])}
      closeLabel={t("hud.close")}
      onClose={() => useSun.getState().select(null)}
    />
  );
}
