import { useTranslations } from "next-intl";

import { Rail, RailSection } from "@/components/simulations/rail";
import { SolarObjectPicks } from "@/components/simulations/solar-picks";
import { viewOf } from "@/space/solar-system/model/framing";
import { PROBES } from "@/space/solar-system/model/probes";
import { ListItem } from "@horizon/toolkit/ui";

import type { ViewId } from "../lib/model/view-ids";
import { useDeepField, type CosmosId, type Selection } from "../lib/store";
import { NEIGHBOUR_IDS } from "./cards";

/** Structures beyond the Milky Way, each with the view that frames it. */
const BEYOND: readonly { id: CosmosId; label: string; view: ViewId }[] = [
  { id: "localGroup", label: "names.localGroup", view: "local-group" },
  { id: "andromeda", label: "cards.cosmos.andromeda.title", view: "local-group" },
  { id: "localSheet", label: "names.localSheet", view: "local-sheet" },
  { id: "virgo", label: "names.virgoCluster", view: "virgo-cluster" },
  { id: "supercluster", label: "names.virgoSupercluster", view: "virgo-supercluster" },
  { id: "laniakea", label: "names.laniakea", view: "laniakea" },
  { id: "perseusPisces", label: "names.perseusPisces", view: "cosmic-web" },
  { id: "coma", label: "names.comaCluster", view: "cosmic-web" },
  { id: "shapley", label: "names.shapleySupercluster", view: "cosmic-web" },
  { id: "sloanGreatWall", label: "names.sloanGreatWall", view: "cosmic-web" },
  { id: "observableUniverse", label: "names.observableUniverse", view: "observable-universe" },
];

const MILKY_WAY: readonly { id: "milkyway" | "sun" | "bulge" | "halo"; label: string }[] = [
  { id: "milkyway", label: "names.milkyway" },
  { id: "sun", label: "cards.galaxy.sun.title" },
  { id: "bulge", label: "names.bulge" },
  { id: "halo", label: "names.halo" },
];

/** Everything to find, near to far: picking one flies to the view that frames it. */
export function ObjectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("deepField");
  const pick = (sel: Selection, view: ViewId) => {
    const api = useDeepField.getState();
    api.setView(view);
    api.select(sel);
    api.setPanel("none");
  };
  const list = (items: readonly { key: string; label: string; onClick: () => void }[]) => (
    <div className="grid gap-1">
      {items.map(({ key, label, onClick }) => (
        <ListItem key={key} onClick={onClick}>
          {t(label)}
        </ListItem>
      ))}
    </div>
  );
  return (
    <Rail
      id="deep-field-objects"
      title={t("hud.objects")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <SolarObjectPicks
        namespace="deepField"
        belts={["asteroids", "kuiper", "scattered", "oort"]}
        onPick={(sel) => pick(sel, viewOf(sel))}
      />
      <RailSection title={t("hud.reach")}>
        {list([
          ...PROBES.map(({ id }) => ({
            key: id,
            label: `names.${id}`,
            onClick: () => pick({ kind: "reach", id }, "heliosphere"),
          })),
          {
            key: "heliopause",
            label: "names.heliopause",
            onClick: () => pick({ kind: "reach", id: "heliopause" }, "heliosphere"),
          },
        ])}
      </RailSection>
      <RailSection title={t("hud.neighbours")}>
        {list(
          NEIGHBOUR_IDS.map((id) => ({
            key: id,
            label: `names.${id}`,
            onClick: () => pick({ kind: "star", id }, "stars"),
          })),
        )}
      </RailSection>
      <RailSection title={t("hud.galaxyItems")}>
        {list(
          MILKY_WAY.map(({ id, label }) => ({
            key: id,
            label,
            onClick: () => pick({ kind: "galaxy", id }, "galaxy"),
          })),
        )}
      </RailSection>
      <RailSection title={t("hud.cosmosItems")}>
        {list(
          BEYOND.map(({ id, label, view }) => ({
            key: id,
            label,
            onClick: () => pick({ kind: "cosmos", id }, view),
          })),
        )}
      </RailSection>
    </Rail>
  );
}
