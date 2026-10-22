/**
 * The cosmic map's marks: every label names something with a card, and a finger-sized target
 * sits under it while it reads. Where two labels share a place (Virgo and its supercluster, the
 * Great Attractor and Laniakea), the target opens the one this scale frames. The distance ruler
 * runs from the Milky Way to the selected structure, or to what the scale frames.
 */
import { Mesh, SphereGeometry, Vector3, type Object3D } from "three";

import type { WorldSelection as Selection } from "@/space/galaxy/show";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import {
  BELOW,
  STRONG,
  TAP_REACH_PX,
  rising,
  type LabelStyle,
  type PlaceLabel,
} from "@horizon/toolkit/scene";

import type { CosmosLooks } from "../graphics/looks";
import {
  ATLAS_LABELS,
  ATLAS_LANDMARKS,
  atlasVisibility,
  type AtlasLandmarkId,
  type AtlasLayer,
  type AtlasShow,
} from "../model/atlas";
import {
  COSMIC_VIEW_LY,
  type COSMOS_LABELS,
  LOCAL_GROUP_CENTRE,
  anchorById,
  anchorToday,
} from "../model/cosmos";
import { expandAbout, type CosmosClouds } from "./cosmos-clouds";

type LabelKey = (typeof COSMOS_LABELS)[number] | AtlasLandmarkId;
type Mark = {
  key: LabelKey;
  pick: Selection;
  style: LabelStyle;
  /** Where it stands this frame (root-local Mly). */
  at: Vector3;
  /** Marks at one place share a target, which goes to the best-framed one. */
  spot: string;
  /** Camera distance (ly) that frames it best. */
  frame: number;
  /** 0..1 presence by camera distance (ly). */
  range: (ly: number) => number;
  layer?: AtlasLayer;
};

const samePick = (a: Selection, b: Selection) =>
  a.kind === b.kind && "id" in a && "id" in b && a.id === b.id;

/**
 * The marks over the drawn clouds; `edgeMark` is where the observable universe is named, under
 * the microwave background's outline, which the layer moves each frame.
 */
export function createCosmosMarks(
  scope: DisposalScope,
  looks: CosmosLooks,
  root: Object3D,
  clouds: Pick<CosmosClouds, "milkyWay" | "andromeda" | "triangulum" | "cluster">,
  edgeMark: Vector3,
) {
  const { milkyWay, andromeda, triangulum, cluster } = clouds;
  const virgo = cluster("virgoCluster");
  const heart = cluster("greatAttractor");
  const lgCentre = new Vector3(...LOCAL_GROUP_CENTRE);
  const wallToday = new Vector3(...anchorToday(anchorById("sloanGreatWall")));
  const wallCentre = wallToday.clone();
  const atlasMarks = ATLAS_LABELS.map((id) => ({
    id,
    today: new Vector3(...ATLAS_LANDMARKS[id].at),
    at: new Vector3(...ATLAS_LANDMARKS[id].at),
  }));
  /* Laniakea's inner landmarks give way once the web is in frame. */
  const insideWeb = (ly: number) => 1 - rising(ly, 1.3e9, 2.2e9);
  /* The web's names give way to the observable universe. */
  const insideUniverse = (ly: number) => 1 - rising(ly, 8e9, 2e10);

  const marks: Mark[] = [
    ...atlasMarks.map(({ id, at }): Mark => ({
      key: id,
      pick: { kind: "cosmos", id },
      style: BELOW,
      at,
      spot: id,
      layer: ATLAS_LANDMARKS[id].layer,
      frame: COSMIC_VIEW_LY.web,
      range: (ly) => rising(ly, 450e6, 1e9) * insideUniverse(ly),
    })),
    {
      key: "milkyway",
      pick: { kind: "galaxy", id: "milkyway" },
      style: STRONG,
      at: milkyWay.position,
      spot: "milkyWay",
      frame: COSMIC_VIEW_LY.localGroup,
      range: (ly) => 1 - rising(ly, 30e6, 80e6),
    },
    {
      key: "andromeda",
      pick: { kind: "cosmos", id: "andromeda" },
      style: STRONG,
      at: andromeda.position,
      spot: "andromeda",
      frame: COSMIC_VIEW_LY.localGroup,
      range: (ly) => 1 - rising(ly, 20e6, 50e6),
    },
    {
      key: "triangulum",
      pick: { kind: "cosmos", id: "triangulum" },
      style: STRONG,
      at: triangulum.position,
      spot: "triangulum",
      frame: COSMIC_VIEW_LY.localGroup,
      range: (ly) => 1 - rising(ly, 8e6, 16e6),
    },
    {
      key: "localGroup",
      pick: { kind: "cosmos", id: "localGroup" },
      style: BELOW,
      at: lgCentre,
      spot: "localGroup",
      frame: 15e6,
      range: (ly) => rising(ly, 15e6, 30e6) * (1 - rising(ly, 150e6, 300e6)),
    },
    {
      key: "localSheet",
      pick: { kind: "cosmos", id: "localSheet" },
      style: BELOW,
      at: lgCentre,
      spot: "localGroup",
      frame: COSMIC_VIEW_LY.sheet,
      range: (ly) => rising(ly, 18e6, 30e6) * (1 - rising(ly, 120e6, 250e6)),
    },
    {
      key: "virgoCluster",
      pick: { kind: "cosmos", id: "virgo" },
      style: STRONG,
      at: virgo.group.position,
      spot: "virgo",
      frame: COSMIC_VIEW_LY.virgo,
      range: (ly) => rising(ly, 12e6, 25e6) * (1 - rising(ly, 500e6, 1e9)),
    },
    {
      key: "virgoSupercluster",
      pick: { kind: "cosmos", id: "supercluster" },
      style: BELOW,
      at: virgo.group.position,
      spot: "virgo",
      frame: COSMIC_VIEW_LY.supercluster,
      range: (ly) => rising(ly, 110e6, 200e6) * (1 - rising(ly, 700e6, 1.2e9)),
    },
    {
      key: "fornaxCluster",
      pick: { kind: "cosmos", id: "fornax" },
      style: STRONG,
      at: cluster("fornaxCluster").group.position,
      spot: "fornax",
      frame: COSMIC_VIEW_LY.supercluster,
      range: (ly) => rising(ly, 30e6, 60e6) * (1 - rising(ly, 300e6, 600e6)),
    },
    {
      key: "centaurusCluster",
      pick: { kind: "cosmos", id: "centaurus" },
      style: STRONG,
      at: cluster("centaurusCluster").group.position,
      spot: "centaurus",
      frame: COSMIC_VIEW_LY.laniakea,
      range: (ly) => rising(ly, 200e6, 400e6) * insideWeb(ly),
    },
    {
      key: "hydraCluster",
      pick: { kind: "cosmos", id: "hydra" },
      style: STRONG,
      at: cluster("hydraCluster").group.position,
      spot: "hydra",
      frame: COSMIC_VIEW_LY.laniakea,
      range: (ly) => rising(ly, 200e6, 400e6) * insideWeb(ly),
    },
    {
      key: "greatAttractor",
      pick: { kind: "cosmos", id: "greatAttractor" },
      style: STRONG,
      at: heart.group.position,
      spot: "heart",
      frame: 300e6,
      range: (ly) => rising(ly, 150e6, 300e6) * insideWeb(ly),
    },
    {
      key: "laniakea",
      pick: { kind: "cosmos", id: "laniakea" },
      style: BELOW,
      at: heart.group.position,
      spot: "heart",
      frame: COSMIC_VIEW_LY.laniakea,
      range: (ly) => rising(ly, 400e6, 650e6) * insideUniverse(ly),
    },
    {
      key: "perseusPisces",
      pick: { kind: "cosmos", id: "perseusPisces" },
      style: BELOW,
      at: cluster("perseusCluster").group.position,
      spot: "perseus",
      frame: COSMIC_VIEW_LY.web,
      range: (ly) => rising(ly, 350e6, 700e6) * insideUniverse(ly),
    },
    {
      key: "comaCluster",
      pick: { kind: "cosmos", id: "coma" },
      style: STRONG,
      at: cluster("comaCluster").group.position,
      spot: "coma",
      frame: COSMIC_VIEW_LY.web,
      range: (ly) => rising(ly, 250e6, 500e6) * insideUniverse(ly),
    },
    {
      key: "shapleySupercluster",
      pick: { kind: "cosmos", id: "shapley" },
      style: BELOW,
      at: cluster("shapleyCore").group.position,
      spot: "shapley",
      frame: COSMIC_VIEW_LY.web,
      range: (ly) => rising(ly, 700e6, 1.2e9) * insideUniverse(ly),
    },
    {
      key: "sloanGreatWall",
      pick: { kind: "cosmos", id: "sloanGreatWall" },
      style: BELOW,
      at: wallCentre,
      spot: "sloanGreatWall",
      frame: COSMIC_VIEW_LY.web,
      range: (ly) => rising(ly, 900e6, 1.6e9) * insideUniverse(ly),
    },
    {
      key: "observableUniverse",
      pick: { kind: "cosmos", id: "observableUniverse" },
      style: BELOW,
      at: edgeMark,
      spot: "observableUniverse",
      frame: COSMIC_VIEW_LY.universe,
      range: (ly) => rising(ly, 2e10, 6e10),
    },
  ];

  /* One target per place, sized per frame. */
  const hitGeometry = scope.own(new SphereGeometry(1, 8, 6));
  const spots = new Map<string, Mesh>();
  for (const mark of marks) {
    if (spots.has(mark.spot)) continue;
    const mesh = new Mesh(hitGeometry, looks.ghost);
    root.add(mesh);
    spots.set(mark.spot, mesh);
  }

  const at = new Vector3();
  /* Each spot's best-framed mark this frame: one record per spot, rewritten in place. */
  const best = new Map<string, { mark: Mark | null; fit: number }>();

  return {
    pickables: [...spots.values()],
    /** What a tap on each label opens. */
    picks: new Map<string, Selection>(marks.map((mark) => [mark.key, mark.pick])),
    hide(place: PlaceLabel) {
      for (const mark of marks) place(mark.key, 0, 0, 0, false);
      for (const mesh of spots.values()) mesh.visible = false;
    },
    /**
     * Places every label at `labelled` times its presence, and moves each place's target to the
     * best-framed mark that reads there (`toPx` sizes it where it stands).
     */
    update(
      ly: number,
      labelled: number,
      shown: number,
      place: PlaceLabel,
      toPx: (object: Object3D, local: Vector3, px: number) => void,
      layers: AtlasShow = atlasVisibility({}),
    ) {
      for (const record of best.values()) record.mark = null;
      for (const mark of marks) {
        const alpha = mark.layer && !layers[mark.layer] ? 0 : mark.range(ly);
        root.localToWorld(at.copy(mark.at));
        place(mark.key, at.x, at.y, at.z, labelled * alpha, mark.style);
        if (alpha * shown < 0.3) continue;
        const fit = Math.abs(Math.log(ly / mark.frame));
        let record = best.get(mark.spot);
        if (!record) best.set(mark.spot, (record = { mark: null, fit: 0 }));
        if (!record.mark || fit < record.fit) {
          record.mark = mark;
          record.fit = fit;
        }
      }
      for (const [spot, mesh] of spots) {
        const chosen = best.get(spot)?.mark;
        mesh.visible = !!chosen;
        if (!chosen) continue;
        mesh.userData.pick = chosen.pick;
        mesh.position.copy(chosen.at);
        toPx(mesh, mesh.position, TAP_REACH_PX);
      }
    },
    /** Moves the marks that are no cluster's (the Great Wall's) with the universe at scale `a`. */
    setExpansion(a: number, sun: Vector3) {
      expandAbout(wallCentre, wallToday, sun, a);
      for (const mark of atlasMarks) expandAbout(mark.at, mark.today, sun, a);
    },
    /** Where the distance ruler ends (root-local): the selected structure, or what the scale frames. */
    rulerEnd(sel: Selection | null, ly: number): Vector3 {
      const chosen = sel?.kind === "cosmos" ? marks.find((k) => samePick(k.pick, sel)) : undefined;
      return chosen && chosen.key !== "localGroup"
        ? chosen.at
        : ly < 25e6
          ? andromeda.position
          : ly > 2e10
            ? edgeMark
            : ly > 1.5e9
              ? wallCentre
              : ly > 220e6
                ? heart.group.position
                : virgo.group.position;
    },
  };
}
