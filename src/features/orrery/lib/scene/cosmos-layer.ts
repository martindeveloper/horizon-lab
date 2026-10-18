/**
 * The cosmic map beyond the Galaxy: the Local Group, the Virgo Cluster, the Virgo
 * Supercluster and Laniakea. The model is in millions of light-years around the galactic
 * centre (see `model/cosmos.ts`); its group is turned by `GALAXY_FRAME` and placed where the
 * Galaxy is, so the Milky Way drawn here takes over from the Galaxy map as it fades. It
 * draws in the Galaxy's pass. With the timeline, unbound structures ride the expansion,
 * Andromeda follows its orbit and clusters gather their members.
 *
 * Every label is a mark: it names something with a card, and a finger-sized target sits
 * under it while it reads. Where two labels share a place (Virgo and its supercluster, the
 * Great Attractor and Laniakea), the target opens the one this scale frames.
 */
import {
  Group,
  LineSegments,
  Mesh,
  Points,
  SphereGeometry,
  Sprite,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";

import {
  clusterCloud,
  deepField,
  laniakeaWeb,
  localGroupClouds,
  localSheet,
  localSupercluster,
} from "../graphics/cosmos";
import {
  COSMIC_VIEW_LY,
  COSMOS_LABELS,
  anchorAt,
  anchorById,
  clusterGathered,
  localGroupCentre,
  scaleAt,
  type AnchorId,
  type Vec,
} from "../model/cosmos";
import type { Selection } from "../store";
import type { Frame, SceneKit } from "./kit";
import { BELOW, STRONG, type LabelStyle, type PlaceLabel } from "./labels";
import {
  GALAXY_FRAME,
  GALAXY_LAYER,
  LY,
  MLY,
  cosmicToWorld,
  galacticAnchor,
  galaxyToWorld,
  rising,
} from "./lod";
import type { DistanceText, Rulers } from "./rulers";

/** Farthest anything drawn reaches from the galactic centre, Mly: Laniakea's far side. */
const EXTENT_MLY = 560;
/** The deep field's distance from the camera, Mly: inside the pass's far plane at any zoom. */
const FIELD_MLY = 450;

type ClusterSpec = {
  id: AnchorId;
  count: number;
  /** Concentration and outer edge, Mly. */
  core: number;
  reach: number;
  far: boolean;
};
/* Member counts are drawn samples, not catalogues; Virgo has ~1,500 known galaxies. */
const CLUSTERS: readonly ClusterSpec[] = [
  /* Out to the virial radius, ~1.6 Mpc (McLaughlin 1999). */
  { id: "virgoCluster", count: 1400, core: 0.9, reach: 5.2, far: false },
  /* ~0.7 Mpc (Drinkwater et al. 2001). */
  { id: "fornaxCluster", count: 340, core: 0.4, reach: 2.3, far: false },
  { id: "centaurusCluster", count: 700, core: 1, reach: 6, far: true },
  { id: "hydraCluster", count: 560, core: 0.9, reach: 5, far: true },
  { id: "greatAttractor", count: 900, core: 1.2, reach: 7, far: true },
];

/** Visible diameters (Mly) of the galaxies drawn whole: the glow never shrinks below a few px. */
const DISC_MLY = { milkyWay: 0.1, andromeda: 0.15, triangulum: 0.06 };

type LabelKey = (typeof COSMOS_LABELS)[number];
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
};

export function createCosmosLayer(
  { scope, looks, camera, pxWorld, lod, tight }: SceneKit,
  parent: Object3D,
  deps: { place: PlaceLabel; rulers: Rulers; distanceText: DistanceText },
) {
  const { place, rulers, distanceText } = deps;
  const m = looks.cosmos;
  const root = new Group();
  root.quaternion.copy(GALAXY_FRAME);
  root.scale.setScalar(MLY);
  parent.add(root);
  /* Unbound structures keep comoving places: this group scales with the expansion. */
  const flow = new Group();
  root.add(flow);

  const points = (geometry: BufferGeometry, material: Material, into: Object3D) => {
    const cloud = new Points(scope.own(geometry), material);
    cloud.frustumCulled = false;
    into.add(cloud);
    return cloud;
  };
  const lg = localGroupClouds(tight);
  points(lg.local, m.dwarfs, root);
  const m31Group = new Group();
  root.add(m31Group);
  points(lg.andromeda, m.dwarfs, m31Group);
  points(localSheet(tight), m.sheet, flow);
  points(localSupercluster(tight), m.supercluster, flow);
  const web = laniakeaWeb(tight);
  points(web.points, m.laniakea, flow);
  const flows = new LineSegments(scope.own(web.flows), looks.cosmosFlow);
  flows.frustumCulled = false;
  flow.add(flows);

  /* Far galaxies all round the camera: depth behind the Local Group and Virgo. */
  const field = new Group();
  points(deepField(tight), m.field, field);
  parent.add(field);

  const clusters = CLUSTERS.map((spec, i) => {
    const group = new Group();
    root.add(group);
    const count = Math.round(spec.count * (tight ? 0.6 : 1));
    const cloud = points(
      clusterCloud(count, spec.core, spec.reach, 101 + i * 13),
      spec.far ? m.far : m.near,
      group,
    );
    const glow = new Sprite(looks.cosmosCluster);
    group.add(glow);
    return { spec, group, cloud, count, glow };
  });
  const cluster = (id: AnchorId) => clusters.find((c) => c.spec.id === id)!;
  const virgo = cluster("virgoCluster");
  const heart = cluster("greatAttractor");

  /* Galaxies seen whole: the Milky Way where the Galaxy map was, Andromeda, Triangulum. */
  const milkyWay = new Sprite(looks.cosmosGalaxy);
  const andromeda = new Sprite(looks.cosmosGalaxy);
  const triangulum = new Sprite(looks.cosmosGalaxy);
  root.add(milkyWay, andromeda, triangulum);
  const lgCentre = new Vector3();

  const marks: Mark[] = [
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
      range: (ly) => rising(ly, 200e6, 400e6),
    },
    {
      key: "hydraCluster",
      pick: { kind: "cosmos", id: "hydra" },
      style: STRONG,
      at: cluster("hydraCluster").group.position,
      spot: "hydra",
      frame: COSMIC_VIEW_LY.laniakea,
      range: (ly) => rising(ly, 200e6, 400e6),
    },
    {
      key: "greatAttractor",
      pick: { kind: "cosmos", id: "greatAttractor" },
      style: STRONG,
      at: heart.group.position,
      spot: "heart",
      frame: 300e6,
      range: (ly) => rising(ly, 150e6, 300e6),
    },
    {
      key: "laniakea",
      pick: { kind: "cosmos", id: "laniakea" },
      style: BELOW,
      at: heart.group.position,
      spot: "heart",
      frame: COSMIC_VIEW_LY.laniakea,
      range: (ly) => rising(ly, 400e6, 650e6),
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
  root.traverse((object) => object.layers.set(GALAXY_LAYER));
  field.traverse((object) => object.layers.set(GALAXY_LAYER));

  const base = {
    dwarfs: m.dwarfs.opacity,
    field: m.field.opacity,
    sheet: m.sheet.opacity,
    near: m.near.opacity,
    supercluster: m.supercluster.opacity,
    far: m.far.opacity,
    laniakea: m.laniakea.opacity,
    galaxy: looks.cosmosGalaxy.opacity,
    cluster: looks.cosmosCluster.opacity,
    flow: looks.cosmosFlow.opacity,
  };
  const names = lod.fader();
  const anchor: [number, number, number] = [0, 0, 0];
  const centre = new Vector3();
  const at = new Vector3();
  const from = new Vector3();
  const v: Vec = [0, 0, 0];
  const best = new Map<string, { mark: Mark; alpha: number; fit: number }>();

  /** Size a sprite or target (in the root's Mly) to `px` pixels where it stands. */
  const toPx = (object: Object3D, local: Vector3, px: number) => {
    root.localToWorld(at.copy(local));
    object.scale.setScalar(pxWorld(camera.position.distanceTo(at), px) / MLY);
  };
  const position = (object: Object3D, p: Vec) => object.position.set(p[0], p[1], p[2]);

  const labelPicks = new Map<string, Selection>(marks.map((mark) => [mark.key, mark.pick]));

  return {
    pickables: [...spots.values()],
    /** What a tap on a label opens. */
    labelPick: (key: string) => labelPicks.get(key),
    get visible() {
      return root.visible;
    },
    /** Camera distance to the far side of everything drawn, au: shared with the Galaxy pass. */
    reach() {
      return camera.position.distanceTo(centre) + EXTENT_MLY * MLY;
    },
    update({ show, yearsAgo, sel }: Frame) {
      const shown = lod.cosmos;
      root.visible = field.visible = shown > 0.001;
      const labelled = names.to(show.names) * shown;
      if (!root.visible) {
        for (const key of COSMOS_LABELS) place(key, 0, 0, 0, false);
        return;
      }
      const ly = lod.dist / LY;
      galacticAnchor(yearsAgo, show.elliptical, anchor);
      galaxyToWorld(0, 0, 0, anchor, centre);
      root.position.copy(centre);
      flow.scale.setScalar(scaleAt(yearsAgo));
      /* This frame's placement, before anything below asks for world positions. */
      root.updateMatrixWorld();
      field.position.copy(camera.position);
      field.scale.setScalar(FIELD_MLY * MLY);

      /* Each population reads at its own scale and gives way when it shrinks to a knot. */
      const near = rising(ly, 8e6, 30e6);
      const far = rising(ly, 60e6, 200e6);
      m.dwarfs.opacity = base.dwarfs * shown * (1 - rising(ly, 60e6, 160e6));
      m.field.opacity = base.field * shown * (1 - rising(ly, 60e6, 250e6));
      m.sheet.opacity = base.sheet * shown * rising(ly, 3e6, 9e6) * (1 - rising(ly, 300e6, 900e6));
      m.near.opacity = base.near * shown * near;
      m.supercluster.opacity = base.supercluster * shown * rising(ly, 25e6, 80e6);
      m.far.opacity = base.far * shown * far;
      m.laniakea.opacity = base.laniakea * shown * rising(ly, 120e6, 380e6);
      looks.cosmosFlow.opacity = base.flow * shown * rising(ly, 220e6, 600e6);
      looks.cosmosGalaxy.opacity = base.galaxy * shown * (1 - rising(ly, 40e6, 120e6));
      looks.cosmosCluster.opacity = base.cluster * shown;

      /* The Local Group: Andromeda and its own on their orbit toward us. */
      position(andromeda, anchorAt(anchorById("andromeda"), yearsAgo, v));
      m31Group.position.copy(andromeda.position);
      position(triangulum, anchorAt(anchorById("triangulum"), yearsAgo, v));
      position(milkyWay, [0, 0, 0]);
      const c = localGroupCentre(yearsAgo, v);
      lgCentre.set(c[0], c[1], c[2]);
      /* At their real size once that is larger than a dozen pixels. */
      for (const [sprite, mly] of [
        [milkyWay, DISC_MLY.milkyWay],
        [andromeda, DISC_MLY.andromeda],
        [triangulum, DISC_MLY.triangulum],
      ] as const) {
        toPx(sprite, sprite.position, sprite === triangulum ? 7 : 12);
        sprite.scale.setScalar(Math.max(sprite.scale.x, mly * 2.2));
      }

      /* Clusters: carried by the expansion, their own size kept; members gather toward today. */
      const gathered = clusterGathered(yearsAgo);
      for (const k of clusters) {
        position(k.group, anchorAt(anchorById(k.spec.id), yearsAgo, v));
        k.cloud.geometry.setDrawRange(0, Math.max(1, Math.round(k.count * gathered)));
        k.group.visible = (k.spec.far ? far : near) > 0.002;
        toPx(k.glow, k.group.position, 16);
      }

      /* Labels; each place's target opens the best-framed mark that reads there. */
      best.clear();
      for (const mark of marks) {
        const alpha = mark.range(ly);
        root.localToWorld(at.copy(mark.at));
        place(mark.key, at.x, at.y, at.z, labelled * alpha, mark.style);
        if (alpha * shown < 0.3) continue;
        const fit = Math.abs(Math.log(ly / mark.frame));
        const current = best.get(mark.spot);
        if (!current || fit < current.fit) best.set(mark.spot, { mark, alpha, fit });
      }
      for (const [spot, mesh] of spots) {
        const chosen = best.get(spot);
        mesh.visible = !!chosen;
        if (!chosen) continue;
        mesh.userData.pick = chosen.mark.pick;
        mesh.position.copy(chosen.mark.at);
        toPx(mesh, mesh.position, 22);
      }

      /* Distances: from the Milky Way to the selected structure, or to what the scale frames. */
      if (show.distances && lod.realm === "cosmos") {
        const chosen =
          sel?.kind === "cosmos" ? marks.find((k) => samePick(k.pick, sel)) : undefined;
        const to =
          chosen && chosen.key !== "localGroup"
            ? chosen.at
            : ly < 25e6
              ? andromeda.position
              : ly > 220e6
                ? heart.group.position
                : virgo.group.position;
        cosmicToWorld([0, 0, 0], anchor, from);
        root.localToWorld(at.copy(to));
        rulers.draw(
          from.x,
          from.y,
          from.z,
          at.x,
          at.y,
          at.z,
          distanceText(from.distanceTo(at)),
          0,
          pxWorld(lod.dist, 5),
        );
      }
    },
  };
}

const samePick = (a: Selection, b: Selection) =>
  a.kind === b.kind && "id" in a && "id" in b && a.id === b.id;
