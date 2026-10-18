import { useTranslations } from "next-intl";

import { CameraPad } from "@/components/simulations/camera-pad";
import { DistanceUnitControl } from "@/components/simulations/map-readouts";
import { Rail, RailSection } from "@/components/simulations/rail";
import { SolarBodyPicks } from "@/components/simulations/solar-picks";
import { SwitchChips } from "@/components/simulations/switch-chips";
import { viewOf } from "@/space/solar-system/model/framing";
import { ListItem } from "@horizon/toolkit/ui";

import type { ViewId } from "../lib/model/view-ids";
import { useDeepField, type CosmosId, type Selection, type Show } from "../lib/store";
import { NEIGHBOUR_IDS } from "./cards";

const SWITCHES: (keyof Show)[] = ["names", "distances", "halo"];

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

/** Display switches, the distance unit, the camera pad and every pickable object. */
export function ObjectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("deepField");
  const show = useDeepField((s) => s.show);
  const unit = useDeepField((s) => s.distanceUnit);
  const pick = (sel: Selection, view: ViewId) => {
    const api = useDeepField.getState();
    api.setView(view);
    api.select(sel);
    api.setPanel("none");
  };
  return (
    <Rail
      id="deep-field-objects"
      title={t("hud.objects")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <RailSection title={t("hud.display")}>
        <div className="flex flex-col gap-3">
          <SwitchChips
            keys={SWITCHES}
            values={show}
            label={(key) => t(`toggles.${key}`)}
            onToggle={(key) => useDeepField.getState().patchShow({ [key]: !show[key] })}
          />
          <DistanceUnitControl
            namespace="deepField"
            value={unit}
            onChange={(next) => useDeepField.getState().setDistanceUnit(next)}
          />
        </div>
      </RailSection>
      <RailSection title={t("hud.camera")}>
        <CameraPad
          namespace="deepField"
          onRotate={(turn) => useDeepField.getState().rotate(turn)}
        />
      </RailSection>
      <RailSection title={t("hud.bodies")}>
        <SolarBodyPicks namespace="deepField" onPick={(sel) => pick(sel, viewOf(sel))} />
      </RailSection>
      <RailSection title={t("hud.neighbours")}>
        <div className="grid gap-1">
          {NEIGHBOUR_IDS.map((id) => (
            <ListItem key={id} onClick={() => pick({ kind: "star", id }, "stars")}>
              {t(`names.${id}`)}
            </ListItem>
          ))}
        </div>
      </RailSection>
      <RailSection title={t("hud.galaxyItems")}>
        <div className="grid gap-1">
          <ListItem onClick={() => pick({ kind: "galaxy", id: "milkyway" }, "galaxy")}>
            {t("names.milkyway")}
          </ListItem>
          <ListItem onClick={() => pick({ kind: "galaxy", id: "sun" }, "galaxy")}>
            {t("cards.galaxy.sun.title")}
          </ListItem>
          <ListItem onClick={() => pick({ kind: "galaxy", id: "bulge" }, "galaxy")}>
            {t("names.bulge")}
          </ListItem>
          <ListItem onClick={() => pick({ kind: "galaxy", id: "halo" }, "galaxy")}>
            {t("names.halo")}
          </ListItem>
        </div>
      </RailSection>
      <RailSection title={t("hud.cosmosItems")}>
        <div className="grid gap-1">
          {BEYOND.map(({ id, label, view }) => (
            <ListItem key={id} onClick={() => pick({ kind: "cosmos", id }, view)}>
              {t(label)}
            </ListItem>
          ))}
        </div>
      </RailSection>
    </Rail>
  );
}
