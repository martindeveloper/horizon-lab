import { ChartSpline, Satellite } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { BodyOrb, GLYPH_ICON } from "@/components/simulations/body-orb";
import { Rail, RailSection } from "@/components/simulations/rail";
import { SolarObjectPicks } from "@/components/simulations/solar-picks";
import { ATLAS_LANDMARKS, isAtlasLandmark, type AtlasId } from "@/space/cosmos/model/atlas";
import { HALO_FRAME_LY } from "@/space/galaxy/model/dark-halo";
import { neighbour } from "@/space/galaxy/model/neighbours";
import { viewOf } from "@/space/solar-system/model/framing";
import { PROBES } from "@/space/solar-system/model/probes";
import { ListItem, Orb, type OrbLook } from "@horizon/toolkit/ui";

import { DARK_VIEWS, type DarkView } from "../lib/model/dark-universe";
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

/** The Galaxy's parts, each marked by its shape: a disc's haze, the bulge's glow, the halo's bound. */
const MILKY_WAY: readonly {
  id: "milkyway" | "sun" | "bulge" | "halo";
  label: string;
  look: OrbLook;
}[] = [
  { id: "milkyway", label: "names.milkyway", look: "haze" },
  { id: "sun", label: "cards.galaxy.sun.title", look: "glow" },
  { id: "bulge", label: "names.bulge", look: "glow" },
  { id: "halo", label: "names.halo", look: "swarm" },
];

/** A spread mark (a galaxy's haze) is drawn wider than a body. */
const LOOK_PX: Readonly<Partial<Record<OrbLook, number>>> = { haze: 16 };
const ATLAS_OBJECTS: readonly AtlasId[] = [
  "quipu",
  "vela",
  "southPoleWall",
  "shapleyBasin",
  "sloanBasin",
  "ophiuchusBasin",
  "localVoid",
  "northernLocalVoid",
  "sculptorVoid",
  "cosmicSurveys",
  "cosmicBasins",
  "cosmicVoids",
  "cosmicKnots",
];

/** The dark universe's evidence, each marked by its picture: a halo's bound, a mass map's haze, a curve. */
const DARK_GLYPHS: Readonly<Record<DarkView, ReactNode>> = {
  halo: <Orb look="swarm" />,
  lensing: <Orb look="haze" size={LOOK_PX.haze} />,
  expansion: <ChartSpline aria-hidden className={GLYPH_ICON} />,
};

/** Everything to find, near to far: picking one flies to the view that frames it. */
export function ObjectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("deepField");
  const pick = (sel: Selection, view: ViewId) => {
    const api = useDeepField.getState();
    api.setView(view);
    if (sel.kind === "galaxy" && sel.id === "halo") {
      api.patchShow({ halo: true });
      api.seekTo(HALO_FRAME_LY);
    }
    if (sel.kind === "cosmos") {
      if (isAtlasLandmark(sel.id)) {
        api.patchShow({ [ATLAS_LANDMARKS[sel.id].layer]: true });
      } else {
        switch (sel.id) {
          case "cosmicSurveys":
            api.patchShow({ cosmicMeasured: true });
            break;
          case "cosmicBasins":
          case "cosmicVoids":
          case "cosmicKnots":
            api.patchShow({ [sel.id]: true });
            break;
        }
      }
    }
    api.select(sel);
    api.setPanel("none");
  };
  const section = (
    title: string,
    items: readonly { key: string; label: string; icon: ReactNode; onClick: () => void }[],
  ) => (
    <RailSection title={title} count={items.length}>
      <div className="-mx-3 grid gap-0.5">
        {items.map(({ key, label, icon, onClick }) => (
          <ListItem key={key} icon={icon} onClick={onClick}>
            {t(label)}
          </ListItem>
        ))}
      </div>
    </RailSection>
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
      {section(t("hud.reach"), [
        ...PROBES.map(({ id }) => ({
          key: id,
          label: `names.${id}`,
          icon: <Satellite aria-hidden className={GLYPH_ICON} />,
          onClick: () => pick({ kind: "reach", id }, "heliosphere"),
        })),
        {
          key: "heliopause",
          label: "names.heliopause",
          icon: <Orb look="swarm" />,
          onClick: () => pick({ kind: "reach", id: "heliopause" }, "heliosphere"),
        },
      ])}
      {section(
        t("hud.neighbours"),
        NEIGHBOUR_IDS.map((id) => ({
          key: id,
          label: `names.${id}`,
          icon: <Orb look="glow" color={neighbour(id).color} />,
          onClick: () => pick({ kind: "star", id }, "stars"),
        })),
      )}
      {section(
        t("hud.galaxyItems"),
        MILKY_WAY.map(({ id, label, look }) => ({
          key: id,
          label,
          icon: id === "sun" ? <BodyOrb id="sun" /> : <Orb look={look} size={LOOK_PX[look]} />,
          onClick: () => pick({ kind: "galaxy", id }, "galaxy"),
        })),
      )}
      {section(
        t("hud.cosmosItems"),
        BEYOND.map(({ id, label, view }) => {
          const look = id === "observableUniverse" ? "swarm" : "haze";
          return {
            key: id,
            label,
            icon: <Orb look={look} size={LOOK_PX[look]} />,
            onClick: () => pick({ kind: "cosmos", id }, view),
          };
        }),
      )}
      {section(
        t("atlas.finderTitle"),
        ATLAS_OBJECTS.map((id) => ({
          key: id,
          label: `names.${id}`,
          icon: <Orb look="haze" size={LOOK_PX.haze} />,
          onClick: () => pick({ kind: "cosmos", id }, "cosmic-web"),
        })),
      )}
      {section(
        t("dark.title"),
        DARK_VIEWS.map((id) => ({
          key: id,
          label: `dark.tabs.${id}`,
          icon: DARK_GLYPHS[id],
          onClick: () => useDeepField.getState().openDarkView(id),
        })),
      )}
    </Rail>
  );
}
