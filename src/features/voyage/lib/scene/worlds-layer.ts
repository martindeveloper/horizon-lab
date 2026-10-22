/**
 * The shared worlds beyond the solar system, placed about the ship: our reach (the probes and
 * the heliopause), the Galaxy and the cosmic map. Each layer draws in the au world it was
 * written for; one group carries them, scaled to km and placed by the ship's offset (the
 * floating origin). The cosmic map draws the universe's expansion as the clocks run: what lies
 * beyond the Local Group recedes by the shared rule (`expansionFactor`), the one the anchors
 * the ship flies to stand by, and the Local Group keeps its place. The layers fade by the
 * ship's distance from the Sun; beyond the mapped structures the field of galaxies is kept
 * round the ship.
 */
import { Group, PerspectiveCamera, type Object3D } from "three";

import { createBrush } from "@/space/brush";
import type { CosmosDetail } from "@/space/cosmos/graphics/cosmos";
import { createCosmosLooks } from "@/space/cosmos/graphics/looks";
import { createCosmosLayer } from "@/space/cosmos/scene/cosmos-layer";
import { createGalaxyLooks } from "@/space/galaxy/graphics/looks";
import { GALAXY_LAYER, LY } from "@/space/galaxy/scene/frames";
import { createGalaxyLayer } from "@/space/galaxy/scene/galaxy-layer";
import { createLabelPicks } from "@/space/galaxy/scene/label-picks";
import { createLod } from "@/space/galaxy/scene/lod";
import type { WorldFrame, WorldSelection } from "@/space/galaxy/show";
import { createReachLooks } from "@/space/solar-system/graphics/reach-looks";
import { PROBES, yearOf } from "@/space/solar-system/model/probes";
import { createReachLayer, type ReachFrame } from "@/space/solar-system/scene/reach-layer";
import { solarLabelPick } from "@/space/solar-system/scene/solar-system";
import {
  SOLAR_GOLD,
  createAnchoredRulers,
  rising,
  sceneKit,
  type DistanceText,
  type LabelText,
  type PlaceLabel,
  type SceneHostBasics,
  type Vec3d,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { BAND_TO_MAP_LY } from "../model/parameters";
import type { Show } from "../store";

export { GALAXY_LAYER };

/** Light-years from the Sun over which the ship leaves the mapped structures for the open field. */
const AFIELD_LY = [3e8, 1.5e9] as const;

export function createWorldsLayer(
  basics: SceneHostBasics,
  parent: Object3D,
  deps: {
    /** Places a label at km about the ship. */
    place: PlaceLabel;
    labels: LabelText;
    distanceText: DistanceText;
    detail: CosmosDetail;
  },
) {
  const { scope, camera, viewport } = basics;
  const { labels, distanceText } = deps;
  /* The layers size what they draw by the camera's distance in their own au world: a shadow
     camera stands where the ship is, in au, looking the same way. */
  const worldCamera = new PerspectiveCamera(camera.fov, camera.aspect, 1e-6, 1e14);
  const worldBasics: SceneHostBasics = { ...basics, camera: worldCamera };
  const brush = createBrush();
  const galaxyLooks = createGalaxyLooks(brush);
  const cosmosLooks = createCosmosLooks(brush);
  const reachLooks = createReachLooks(brush);
  scope.defer(() => {
    reachLooks.dispose();
    cosmosLooks.dispose();
    galaxyLooks.dispose();
    brush.dispose();
  });
  const lod = createLod(worldCamera, viewport);
  const galaxyKit = sceneKit(worldBasics, galaxyLooks, lod);
  const cosmosKit = sceneKit(worldBasics, cosmosLooks, lod);
  const reachKit = sceneKit(worldBasics, reachLooks, lod);

  /* The worlds in au about the Sun; the cosmic map draws its own expansion (`setExpansion`). */
  const bound = new Group();
  bound.scale.setScalar(AU_KM);
  parent.add(bound);

  /** The ship this frame, km: the au world's labels come out in km about it. */
  let ship: Vec3d = [0, 0, 0];
  const placeBound: PlaceLabel = (key, x, y, z, on, style) =>
    deps.place(key, x * AU_KM - ship[0], y * AU_KM - ship[1], z * AU_KM - ship[2], on, style);
  /* The cosmic map's labels pass through its root's world matrix, so they arrive in km already. */
  const placeCosmic: PlaceLabel = deps.place;

  /* The frames handed to the layers, rewritten in place each frame. */
  const galaxyShow = { halo: false, names: true, distances: false, lightTime: false };
  const maps: WorldFrame = { show: galaxyShow, sel: null, dist: 1, lines: 1 };
  const reachFrame: ReachFrame = {
    show: { names: true, lightTime: false },
    sel: null,
    dist: 1,
    lines: 1,
    year: 0,
    approach: null,
  };

  const picks = createLabelPicks();
  picks.register(solarLabelPick);
  const rulers = createAnchoredRulers(scope, bound, placeBound, {
    keys: PROBES.map((p) => p.id),
    color: SOLAR_GOLD,
    pxWorld: (dist, px) => lod.pxWorld(dist * AU_KM, px) / AU_KM,
    distanceText,
  });
  const reach = createReachLayer(reachKit, bound, { place: placeBound, rulers, picks });
  const galaxy = createGalaxyLayer(galaxyKit, bound, {
    place: placeBound,
    rulers,
    distanceText,
    picks,
  });
  const cosmos = createCosmosLayer(cosmosKit, bound, {
    place: placeCosmic,
    rulers,
    labels,
    distanceText,
    picks,
    detail: deps.detail,
  });

  return {
    pickables: [...reach.pickables, ...galaxy.pickables, ...cosmos.pickables],
    /** What a tapped name opens. */
    pick: (key: string): WorldSelection | undefined => picks.pick(key),
    get busy() {
      return lod.busy;
    },
    setDetail: (detail: CosmosDetail) => cosmos.setDetail(detail),
    /**
     * Draws a frame about the ship at `at` (km, heliocentric), `aimKm` from its aim, with the
     * universe at scale `a` on Earth's clock (held at `MAX_SCALE_FACTOR`, inside the far plane)
     * on the clock's `date`. The maps' presence follows the ship's distance from the Sun (the
     * Galaxy appears once the ship is light-years out, the cosmic map once it has left the
     * Galaxy); the probes' markers are sized for the ship's distance to its aim, and the one it
     * closes on gives way to its model (`approach`).
     */
    update(
      dt: number,
      at: Vec3d,
      aimKm: number,
      a: number,
      date: Date,
      show: Show,
      sel: WorldSelection | null,
      approach: ReachFrame["approach"],
    ) {
      ship = at;
      const distAu = Math.hypot(at[0], at[1], at[2]) / AU_KM;
      const aimAu = Math.max(1e-9, aimKm / AU_KM);
      if (worldCamera.fov !== camera.fov || worldCamera.aspect !== camera.aspect) {
        worldCamera.fov = camera.fov;
        worldCamera.aspect = camera.aspect;
        worldCamera.updateProjectionMatrix();
      }
      worldCamera.position.set(at[0] / AU_KM, at[1] / AU_KM, at[2] / AU_KM);
      worldCamera.quaternion.copy(camera.quaternion);
      worldCamera.updateMatrixWorld();
      lod.begin(dt, Math.max(1e-6, distAu));
      bound.position.set(-at[0], -at[1], -at[2]);
      bound.updateMatrixWorld(true);
      cosmos.setExpansion(a);
      /* The Galaxy map comes in as the painted band gives way; beyond the mapped structures
         the field of galaxies is drawn round the ship. */
      const ly = distAu / LY;
      galaxyShow.names = show.names;
      maps.sel = sel;
      maps.dist = distAu;
      maps.galaxyPresence = rising(ly, BAND_TO_MAP_LY[0], BAND_TO_MAP_LY[1]);
      maps.afield = rising(ly, AFIELD_LY[0], AFIELD_LY[1]);
      reachFrame.show.names = show.names;
      reachFrame.sel = sel;
      reachFrame.dist = aimAu;
      reachFrame.year = yearOf(date);
      reachFrame.approach = approach;
      reach.update(reachFrame);
      galaxy.update(maps);
      cosmos.update(maps);
      rulers.finish();
    },
  };
}
