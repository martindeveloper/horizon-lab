/**
 * What the cosmic map draws: the sampled clouds (every one swapped whole at a new detail), the
 * flows into Laniakea, the three galaxies seen whole, the clusters and the far field all round
 * the camera. Where each stands is the model's (`model/cosmos.ts`), in the root's Mly.
 */
import {
  Group,
  LineSegments,
  Points,
  Sprite,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";

import {
  clusterCloud,
  cosmicWeb,
  deepField,
  laniakeaWeb,
  localGroupClouds,
  localSheet,
  localSupercluster,
  observableUniverse,
  type CosmosDetail,
} from "../graphics/cosmos";
import type { Looks } from "../graphics/looks";
import {
  CMB_MLY,
  FIRST_GALAXIES_MLY,
  anchorById,
  anchorToday,
  type AnchorId,
} from "../model/cosmos";

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
export const DISC_MLY = { milkyWay: 0.1, andromeda: 0.15, triangulum: 0.06 };

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

export type CosmosClouds = ReturnType<typeof createCosmosClouds>;

/** Builds every drawn thing under `root` (the far field under `parent`, round the camera). */
export function createCosmosClouds(
  scope: DisposalScope,
  looks: Looks,
  root: Object3D,
  parent: Object3D,
  detail: CosmosDetail,
) {
  const m = looks.cosmos;
  /* Each drawn cloud remembers which sample it shows, so a new detail can swap them all. */
  const drawn: { object: Points | LineSegments; of: (s: Sampled) => BufferGeometry }[] = [];
  scope.defer(() => {
    for (const { object } of drawn) object.geometry.dispose();
  });
  /* Let go once the layer is built; a new detail samples afresh. */
  let first: Sampled | null = sample(detail);
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
  const laniakea = points((s) => s.laniakea, m.laniakea, root);
  const web = points((s) => s.web, m.web, root);

  /* The observable universe: the microwave background and the galaxies beyond the web. Each is
     scaled every frame. */
  const cmbShell = points((s) => s.cmb, m.cmb, root);
  const deepFill = points((s) => s.fill, m.deep, root);
  cmbShell.scale.setScalar(CMB_MLY);
  /* The galaxies beyond the web fill space out to the first galaxies; the dark ages lie between
     them and the microwave background. */
  deepFill.scale.setScalar(FIRST_GALAXIES_MLY);
  /** The unit circle the lookback rings are drawn with. */
  const circle = scope.own(first.circle);
  const flows = new LineSegments(first.flows, looks.cosmosFlow);
  flows.frustumCulled = false;
  /* The web's filaments are the picture, not a line drawn over it: a drift's veil leaves them. */
  flows.userData.content = true;
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

  /* Galaxies seen whole: the Milky Way where the Galaxy map was, Andromeda, Triangulum. */
  const milkyWay = new Sprite(looks.cosmosGalaxy);
  const andromeda = new Sprite(looks.cosmosGalaxy);
  const triangulum = new Sprite(looks.cosmosGalaxy);
  root.add(milkyWay, andromeda, triangulum);
  position(andromeda, anchorToday(anchorById("andromeda")));
  m31Group.position.copy(andromeda.position);
  position(triangulum, anchorToday(anchorById("triangulum")));

  first = null;

  return {
    circle,
    laniakea,
    web,
    cmbShell,
    deepFill,
    flows,
    field,
    clusters,
    cluster,
    milkyWay,
    andromeda,
    triangulum,
    /** Samples every cloud afresh at a new quality's detail. */
    setDetail(detail: CosmosDetail) {
      const next = sample(detail);
      for (const entry of drawn) {
        entry.object.geometry.dispose();
        entry.object.geometry = entry.of(next);
      }
      next.circle.dispose();
    },
  };
}
