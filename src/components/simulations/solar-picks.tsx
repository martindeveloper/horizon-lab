"use client";

import { useTranslations } from "next-intl";

import type { SolarSelection } from "@/space/solar-system/model/selection";
import { PLANET_IDS } from "@horizon/toolkit/bodies";
import { ListItem } from "@horizon/toolkit/ui";

/** The Sun and the planets to pick from, named by the shared space copy in `namespace`. */
export function SolarBodyPicks({
  namespace,
  onPick,
}: {
  namespace: string;
  onPick: (sel: SolarSelection) => void;
}) {
  const t = useTranslations(namespace);
  return (
    <div className="grid grid-cols-2 gap-1">
      <ListItem onClick={() => onPick({ kind: "sun" })}>{t("names.sun")}</ListItem>
      {PLANET_IDS.map((id) => (
        <ListItem key={id} onClick={() => onPick({ kind: "planet", id })}>
          {t(`names.${id}`)}
        </ListItem>
      ))}
    </div>
  );
}
