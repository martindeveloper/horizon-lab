/**
 * The cosmic map beyond the Galaxy: the Local Group, the Virgo Cluster, the Virgo
 * Supercluster, Laniakea, the cosmic web around it and the observable universe. The model is in millions of light-years around the galactic
 * centre (see `model/cosmos.ts`); its group is turned by `GALAXY_FRAME` and placed where the
 * Galaxy is, so the Milky Way drawn here takes over from the Galaxy map as it fades. It
 * draws in the Galaxy's pass. Everything stands where it is today; only the lookback rings
 * and the edge's name follow the camera.
 *
 * Every label is a mark: it names something with a card, and a finger-sized target sits
 * under it while it reads. Where two labels share a place (Virgo and its supercluster, the
 * Great Attractor and Laniakea), the target opens the one this scale frames.
 */
import {
  Group,
  LineLoop,
  LineSegments,
  Mesh,
  Points,
  Quaternion,
  SphereGeometry,
  Sprite,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";

import {
  BELOW,
  rising,
  STRONG,
  type AnchoredRulers,
  type DistanceText,
  type LabelStyle,
  type LabelText,
  type PlaceLabel,
} from "@horizon/toolkit/scene";

import {
  clusterCloud,
  type CosmosDetail,
  cosmicWeb,
  deepField,
  laniakeaWeb,
  localGroupClouds,
  localSheet,
  localSupercluster,
  observableUniverse,
} from "../graphics/cosmos";
import {
  CMB_MLY,
  COSMIC_VIEW_LY,
  COSMOS_LABELS,
  FIRST_GALAXIES_MLY,
  LOCAL_GROUP_CENTRE,
  LOOKBACK_RINGS_GYR,
  anchorById,
  anchorToday,
  lookbackMly,
  type AnchorId,
} from "../model/cosmos";
import type { Selection } from "../store";
import type { Frame, SceneKit } from "./kit";
import { GALAXY_FRAME, GALAXY_LAYER, LY, MLY, cosmicToWorld, galaxyToWorld } from "./lod";

/** Farthest anything drawn reaches from the galactic centre, Mly: the microwave background. */
const EXTENT_MLY = 48_000;
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
  /* Beyond Laniakea. Coma reaches ~2.9 h₇₀⁻¹ Mpc at Δc = 102 (Łokas & Mamon 2003); r₂₀₀c is 2.07 Mpc. */
  { id: "perseusCluster", count: 500, core: 0.9, reach: 6, far: true },
  { id: "comaCluster", count: 1000, core: 1.3, reach: 9.5, far: true },
  { id: "shapleyCore", count: 700, core: 1.1, reach: 7, far: true },
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

/** Every cloud the cosmic maps sample at one detail. */
function sample(detail: CosmosDetail) {
  const lg = localGroupClouds(detail);
  const web = laniakeaWeb(detail);
  const universe = observableUniverse(detail);
  return {
    local: lg.local,
    andromeda: lg.andromeda,
    sheet: localSheet(detail),
    supercluster: localSupercluster(detail),
    laniakea: web.points,
    flows: web.flows,
    web: cosmicWeb(detail),
    cmb: universe.cmb,
    fill: universe.fill,
    circle: universe.circle,
    field: deepField(detail),
    clusters: CLUSTERS.map((spec, i) =>
      clusterCloud(Math.round(spec.count * detail.share), spec.core, spec.reach, 101 + i * 13),
    ),
  };
}
type Sampled = ReturnType<typeof sample>;

export function createCosmosLayer(
  { scope, looks, camera, pxWorld, lod }: SceneKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    rulers: AnchoredRulers;
    labels: LabelText;
    distanceText: DistanceText;
    /** How densely to sample, from the render quality (`DeepFieldQuality.cosmos`). */
    detail: CosmosDetail;
  },
) {
  const { place, rulers, labels, distanceText } = deps;
  const m = looks.cosmos;
  const root = new Group();
  root.quaternion.copy(GALAXY_FRAME);
  root.scale.setScalar(MLY);
  /* The galactic centre, with the Sun at the scene's origin. */
  galaxyToWorld(0, 0, 0, root.position);
  parent.add(root);

  /* Each drawn cloud remembers which sample it shows, so a new detail can swap them all. */
  const drawn: { object: Points | LineSegments; of: (s: Sampled) => BufferGeometry }[] = [];
  scope.defer(() => {
    for (const { object } of drawn) object.geometry.dispose();
  });
  /* Let go once the layer is built; a new detail samples afresh. */
  let first: Sampled | null = sample(deps.detail);
  const points = (of: (s: Sampled) => BufferGeometry, material: Material, into: Object3D) => {
    const cloud = new Points(of(first!), material);
    cloud.frustumCulled = false;
    into.add(cloud);
    drawn.push({ object: cloud, of });
    return cloud;
  };
  const position = (object: Object3D, p: Readonly<[number, number, number]>) =>
    object.position.set(p[0], p[1], p[2]);
  points((s) => s.local, m.dwarfs, root);
  const m31Group = new Group();
  root.add(m31Group);
  points((s) => s.andromeda, m.dwarfs, m31Group);
  points((s) => s.sheet, m.sheet, root);
  points((s) => s.supercluster, m.supercluster, root);
  const laniakeaCloud = points((s) => s.laniakea, m.laniakea, root);
  const webCloud = points((s) => s.web, m.web, root);

  /* The observable universe: the microwave background, galaxies beyond the web and rings
     where light set out 1, 5 and 10 billion years ago. Each is scaled every frame. */
  const cmbShell = points((s) => s.cmb, m.cmb, root);
  const deepFill = points((s) => s.fill, m.deep, root);
  cmbShell.scale.setScalar(CMB_MLY);
  /* The galaxies beyond the web fill space out to the first galaxies; the dark ages lie between
     them and the microwave background. */
  deepFill.scale.setScalar(FIRST_GALAXIES_MLY);
  const circle = scope.own(first.circle);
  const rings = LOOKBACK_RINGS_GYR.map((gyr) => {
    const line = new LineLoop(circle, looks.cosmosRing);
    line.frustumCulled = false;
    root.add(line);
    return { gyr, mly: lookbackMly(gyr), line, key: `lookback${gyr}` };
  });
  const RING_KEYS = rings.map((ring) => ring.key);
  const flows = new LineSegments(first.flows, looks.cosmosFlow);
  flows.frustumCulled = false;
  root.add(flows);
  drawn.push({ object: flows, of: (s) => s.flows });

  /* Far galaxies all round the camera: depth behind the Local Group and Virgo. */
  const field = new Group();
  points((s) => s.field, m.field, field);
  parent.add(field);

  const clusters = CLUSTERS.map((spec, i) => {
    const group = new Group();
    root.add(group);
    const cloud = points((s) => s.clusters[i]!, spec.far ? m.far : m.near, group);
    const glow = new Sprite(looks.cosmosCluster);
    group.add(glow);
    position(group, anchorToday(anchorById(spec.id)));
    return { spec, group, cloud, glow };
  });
  const cluster = (id: AnchorId) => clusters.find((c) => c.spec.id === id)!;
  const virgo = cluster("virgoCluster");
  const heart = cluster("greatAttractor");

  /* Galaxies seen whole: the Milky Way where the Galaxy map was, Andromeda, Triangulum. */
  const milkyWay = new Sprite(looks.cosmosGalaxy);
  const andromeda = new Sprite(looks.cosmosGalaxy);
  const triangulum = new Sprite(looks.cosmosGalaxy);
  root.add(milkyWay, andromeda, triangulum);
  position(andromeda, anchorToday(anchorById("andromeda")));
  m31Group.position.copy(andromeda.position);
  position(triangulum, anchorToday(anchorById("triangulum")));
  const lgCentre = new Vector3(...LOCAL_GROUP_CENTRE);
  const wallCentre = new Vector3(...anchorToday(anchorById("sloanGreatWall")));
  /* Laniakea's inner landmarks give way once the web is in frame. */
  const insideWeb = (ly: number) => 1 - rising(ly, 1.3e9, 2.2e9);
  /* The web's names give way to the observable universe. */
  const insideUniverse = (ly: number) => 1 - rising(ly, 8e9, 2e10);
  /* Under the microwave background's outline: where the edge is named. */
  const edgeMark = new Vector3();

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
    web: m.web.opacity,
    cmb: m.cmb.opacity,
    deep: m.deep.opacity,
    ring: looks.cosmosRing.opacity,
    galaxy: looks.cosmosGalaxy.opacity,
    cluster: looks.cosmosCluster.opacity,
    flow: looks.cosmosFlow.opacity,
  };
  const names = lod.fader();
  const centre = root.position;
  const at = new Vector3();
  const from = cosmicToWorld([0, 0, 0], new Vector3());
  const best = new Map<string, { mark: Mark; alpha: number; fit: number }>();
  const eye = new Vector3();
  const toward = new Vector3();
  const up = new Vector3();
  const turn = new Quaternion();
  const facing = new Quaternion();
  const Z = new Vector3(0, 0, 1);

  /** Size a sprite or target (in the root's Mly) to `px` pixels where it stands. */
  const toPx = (object: Object3D, local: Vector3, px: number) => {
    root.localToWorld(at.copy(local));
    object.scale.setScalar(pxWorld(camera.position.distanceTo(at), px) / MLY);
  };

  const labelPicks = new Map<string, Selection>(marks.map((mark) => [mark.key, mark.pick]));

  first = null;

  return {
    pickables: [...spots.values()],
    /** Samples every cloud afresh at a new quality's detail. */
    setDetail(detail: CosmosDetail) {
      const next = sample(detail);
      for (const entry of drawn) {
        entry.object.geometry.dispose();
        entry.object.geometry = entry.of(next);
      }
      next.circle.dispose();
    },
    /** What a tap on a label opens. */
    labelPick: (key: string) => labelPicks.get(key),
    get visible() {
      return root.visible;
    },
    /** Camera distance to the far side of everything drawn, au: shared with the Galaxy pass. */
    reach() {
      return camera.position.distanceTo(centre) + EXTENT_MLY * MLY;
    },
    update({ show, sel }: Frame) {
      const shown = lod.cosmos;
      root.visible = field.visible = shown > 0.001;
      const labelled = names.to(show.names) * shown;
      if (!root.visible) {
        for (const key of COSMOS_LABELS) place(key, 0, 0, 0, false);
        for (const key of RING_KEYS) place(key, 0, 0, 0, false);
        return;
      }
      const ly = lod.dist / LY;
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
      /* From the observable universe, everything nearer shrinks to a dim knot round us. */
      const speck = 1 - 0.75 * rising(ly, 1.5e10, 5e10);
      m.web.opacity = base.web * shown * rising(ly, 500e6, 1.4e9) * speck;
      m.laniakea.opacity *= speck;
      m.far.opacity *= speck;
      m.cmb.opacity = base.cmb * shown * rising(ly, 2e10, 6e10);
      m.deep.opacity = base.deep * shown * rising(ly, 4e9, 2e10);
      cmbShell.visible = m.cmb.opacity > 0.002;
      deepFill.visible = m.deep.opacity > 0.002;
      const ringsOn = shown * rising(ly, 5e9, 2e10);
      looks.cosmosRing.opacity = base.ring * ringsOn;
      /* The two big clouds skip their draw while they are faded out. */
      webCloud.visible = m.web.opacity > 0.002;
      laniakeaCloud.visible = m.laniakea.opacity > 0.002;
      looks.cosmosFlow.opacity = base.flow * shown * rising(ly, 220e6, 600e6);
      flows.visible = looks.cosmosFlow.opacity > 0.002;
      looks.cosmosGalaxy.opacity = base.galaxy * shown * (1 - rising(ly, 40e6, 120e6));
      looks.cosmosCluster.opacity = base.cluster * shown;

      /* Each shell's outline as the camera sees it: a sphere of radius R seen from d shows a
         circle of R √(1 − R²/d²), R²/d nearer than its centre. */
      const cmb = CMB_MLY;
      root.worldToLocal(eye.copy(camera.position));
      const d = eye.length() || 1;
      toward.copy(eye).divideScalar(d);
      root.getWorldQuaternion(turn).invert();
      up.setFromMatrixColumn(camera.matrixWorld, 1).applyQuaternion(turn);
      up.addScaledVector(toward, -up.dot(toward)).normalize();
      facing.setFromUnitVectors(Z, toward);
      const L = labels();
      for (const ring of rings) {
        const R = ring.mly;
        const outside = d > R * 1.001;
        ring.line.visible = outside && looks.cosmosRing.opacity > 0.002;
        if (!outside) {
          place(ring.key, 0, 0, 0, false);
          continue;
        }
        const radius = R * Math.sqrt(1 - (R / d) ** 2);
        ring.line.position.copy(toward).multiplyScalar((R * R) / d);
        ring.line.quaternion.copy(facing);
        ring.line.scale.setScalar(radius);
        root.localToWorld(at.copy(ring.line.position).addScaledVector(up, radius));
        place(ring.key, at.x, at.y, at.z, labelled * ringsOn, {
          text: (L.lookbackRing ?? "{value}").replace("{value}", String(ring.gyr)),
        });
      }
      const outline = d > cmb ? cmb * Math.sqrt(1 - (cmb / d) ** 2) : cmb;
      edgeMark
        .copy(toward)
        .multiplyScalar(d > cmb ? (cmb * cmb) / d : 0)
        .addScaledVector(up, -outline);
      /* At their real size once that is larger than a dozen pixels. */
      for (const [sprite, mly] of [
        [milkyWay, DISC_MLY.milkyWay],
        [andromeda, DISC_MLY.andromeda],
        [triangulum, DISC_MLY.triangulum],
      ] as const) {
        toPx(sprite, sprite.position, sprite === triangulum ? 7 : 12);
        sprite.scale.setScalar(Math.max(sprite.scale.x, mly * 2.2));
      }

      for (const k of clusters) {
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
              : ly > 2e10
                ? edgeMark
                : ly > 1.5e9
                  ? wallCentre
                  : ly > 220e6
                    ? heart.group.position
                    : virgo.group.position;
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
