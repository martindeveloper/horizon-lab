/**
 * The cosmic map beyond the Galaxy: the Local Group, the Virgo Cluster, the Virgo
 * Supercluster, Laniakea, the cosmic web around it and the observable universe. The model is in
 * millions of light-years around the galactic centre (see `model/cosmos.ts`); its group is
 * turned by `GALAXY_FRAME` and placed where the Galaxy is, so the Milky Way drawn here takes
 * over from the Galaxy map as it fades. It draws in the Galaxy's pass. Everything stands where
 * it is today; only the lookback rings and the edge's name follow the camera.
 *
 * The drawing is `cosmos-clouds.ts`, the rings `cosmos-rings.ts`, the labels, their targets and
 * the ruler `cosmos-marks.ts`; this file fades each by the camera's distance.
 */
import { Group, Quaternion, Vector3, type Object3D } from "three";

import {
  GALAXY_FRAME,
  GALAXY_LAYER,
  LY,
  MLY,
  cosmicToWorld,
  galaxyToWorld,
} from "@/space/galaxy/scene/frames";
import type { LabelPicks } from "@/space/galaxy/scene/label-picks";
import type { Lod } from "@/space/galaxy/scene/lod";
import type { WorldFrame as Frame } from "@/space/galaxy/show";
import {
  FAINTEST_OPACITY,
  fadeMaterial,
  rising,
  type AnchoredRulers,
  type DistanceText,
  type PlaceLabel,
  type SceneKit,
} from "@horizon/toolkit/scene";

import type { CosmosDetail } from "../graphics/cosmos";
import type { CosmosLooks } from "../graphics/looks";
import { atlasVisibility } from "../model/atlas";
import type { CmbStatus } from "../model/cmb";
import { CMB_MLY } from "../model/cosmos";
import { createCmbSky } from "./cmb-sky";
import { createCosmosAtlas } from "./cosmos-atlas";
import { DISC_MLY, createCosmosClouds } from "./cosmos-clouds";
import { createCosmosMarks } from "./cosmos-marks";
import { createLookbackRings, shellOutline, type RootView } from "./cosmos-rings";

/** What the cosmic map's layer is built with: the host's basics, its looks and the world's level of detail. */
export type CosmosKit = SceneKit<CosmosLooks, Lod>;

/** Farthest anything drawn reaches from the galactic centre, Mly: the microwave background. */
const EXTENT_MLY = 48_000;
/** The deep field's distance from the camera, Mly: inside the pass's far plane at any zoom. */
const FIELD_MLY = 450;

export function createCosmosLayer(
  { scope, looks, camera, pxWorld, lod, invalidate }: CosmosKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    rulers: AnchoredRulers;
    distanceText: DistanceText;
    picks: LabelPicks;
    /** How densely to sample, from the render quality (the host's `cosmos` detail). */
    detail: CosmosDetail;
    onCmbStatus?: (status: CmbStatus) => void;
    cmbMaxTextureSize?: number;
  },
) {
  const { place, rulers, distanceText } = deps;
  const m = looks.cosmos;
  const root = new Group();
  root.quaternion.copy(GALAXY_FRAME);
  root.scale.setScalar(MLY);
  /* The galactic centre, with the Sun at the scene's origin. */
  galaxyToWorld(0, 0, 0, root.position);
  parent.add(root);

  const clouds = createCosmosClouds(scope, looks, root, parent, deps.detail);
  const cmb = createCmbSky(scope, root, invalidate, deps.onCmbStatus, deps.cmbMaxTextureSize);
  const atlas = createCosmosAtlas(scope, looks, root, deps.detail);
  const { field, clusters, milkyWay, andromeda, triangulum } = clouds;
  const rings = createLookbackRings(root, clouds.circle, looks.cosmosRing);
  /* Under the microwave background's outline: where the edge is named. */
  const edgeMark = new Vector3();
  const marks = createCosmosMarks(scope, looks, root, clouds, edgeMark);
  deps.picks.register(marks.picks);
  root.traverse((object) => object.layers.set(GALAXY_LAYER));
  field.traverse((object) => object.layers.set(GALAXY_LAYER));

  const base = {
    dwarfs: m.dwarfs.opacity,
    field: m.field.opacity,
    fieldSize: m.field.size,
    sheet: m.sheet.opacity,
    near: m.near.opacity,
    supercluster: m.supercluster.opacity,
    far: m.far.opacity,
    laniakea: m.laniakea.opacity,
    web: m.web.opacity,
    deep: m.deep.opacity,
    ring: looks.cosmosRing.opacity,
    galaxy: looks.cosmosGalaxy.opacity,
    cluster: looks.cosmosCluster.opacity,
    flow: looks.cosmosFlow.opacity,
  };
  const names = lod.fader();
  /** How far out among the galaxies the camera stood last frame (`afield`). */
  let standing = 0;
  const centre = root.position;
  const at = new Vector3();
  const from = cosmicToWorld([0, 0, 0], new Vector3());
  const eye = new Vector3();
  const view: RootView = {
    d: 1,
    toward: new Vector3(),
    up: new Vector3(),
    facing: new Quaternion(),
  };
  const turn = new Quaternion();
  const atlasFacing = new Quaternion();
  const Z = new Vector3(0, 0, 1);
  /** The universe's scale factor the map is drawn at (`setExpansion`); 1 is today. */
  let expansion = 1;
  /* The Sun, root-local Mly: what the map expands about, as the places a host flies to do. */
  const sun = new Vector3()
    .sub(root.position)
    .applyQuaternion(root.quaternion.clone().invert())
    .divideScalar(MLY);

  cmb.setExpansion(1, sun);

  /** Size a sprite or target (in the root's Mly) to `px` pixels where it stands. */
  const toPx = (object: Object3D, local: Vector3, px: number) => {
    root.localToWorld(at.copy(local));
    object.scale.setScalar(pxWorld(camera.position.distanceTo(at), px) / MLY);
  };

  return {
    pickables: marks.pickables,
    retryCmb: cmb.retry,
    /** Samples every cloud afresh at a new quality's detail. */
    setDetail(detail: CosmosDetail) {
      clouds.setDetail(detail);
      atlas.setDetail(detail);
    },
    /**
     * Draws the universe at scale `a` (1, today, unless a host runs a clock through cosmic
     * time): what lies beyond the Local Group recedes by the shared rule (`expansionFactor`).
     */
    setExpansion(a: number) {
      if (a === expansion) return;
      expansion = a;
      clouds.setExpansion(a, sun);
      cmb.setExpansion(a, sun);
      atlas.setExpansion(a, sun);
      marks.setExpansion(a, sun);
    },
    get visible() {
      return root.visible;
    },
    /** A CMB map the view draws is still loading. */
    get cmbWaiting() {
      return root.visible && cmb.waiting;
    },
    /** Camera distance to the far side of everything drawn, au: shared with the Galaxy pass. */
    reach() {
      return camera.position.distanceTo(centre) + EXTENT_MLY * expansion * MLY;
    },
    update({ show, sel, lines, afield = 0 }: Frame) {
      const layers = atlasVisibility(show);
      const shown = lod.cosmos;
      root.visible = field.visible = shown > 0.001;
      const labelled = names.to(show.names) * shown;
      if (!root.visible) {
        marks.hide(place);
        rings.hide(place);
        return;
      }
      const ly = lod.dist / LY;
      clouds.laniakea.visible =
        clouds.web.visible =
        clouds.flows.visible =
          layers.cosmicIllustrations;
      /* This frame's placement, before anything below asks for world positions. */
      root.updateMatrixWorld();
      field.position.copy(camera.position);
      field.scale.setScalar(FIELD_MLY * MLY);

      /* Each population reads at its own scale and gives way when it shrinks to a knot; one
         faded past what shows skips its draws. */
      const near = rising(ly, 8e6, 30e6);
      const far = rising(ly, 60e6, 200e6);
      /* From the observable universe, everything nearer shrinks to a dim knot round us. */
      const speck = 1 - 0.75 * rising(ly, 1.5e10, 5e10);
      const sketch = layers.cosmicIllustrations ? 1 : 1 - rising(ly, 80e6, 240e6);
      fadeMaterial(m.dwarfs, base.dwarfs * shown * (1 - rising(ly, 60e6, 160e6)));
      /* Out among the galaxies the field is all there is: fuller, larger, and doubled. */
      fadeMaterial(m.field, base.field * shown * Math.max(1 - rising(ly, 60e6, 250e6), afield));
      if (afield !== standing) {
        standing = afield;
        m.field.size = base.fieldSize * (1 + 1.5 * afield);
        m.field.color.setScalar(1 + 1.2 * afield);
      }
      /* The second field, drawn with the first's material, shows as far as its own share does. */
      clouds.fieldBeyond.visible = base.field * shown * afield > FAINTEST_OPACITY;
      fadeMaterial(
        m.sheet,
        base.sheet * shown * rising(ly, 3e6, 9e6) * (1 - rising(ly, 300e6, 900e6)) * sketch,
      );
      fadeMaterial(m.near, base.near * shown * near * sketch);
      fadeMaterial(m.supercluster, base.supercluster * shown * rising(ly, 25e6, 80e6) * sketch);
      fadeMaterial(m.far, base.far * shown * far * speck * sketch);
      fadeMaterial(m.laniakea, base.laniakea * shown * rising(ly, 120e6, 380e6) * speck);
      fadeMaterial(m.web, base.web * shown * rising(ly, 500e6, 1.4e9) * speck);
      fadeMaterial(
        m.deep,
        layers.cosmicIllustrations ? base.deep * shown * rising(ly, 4e9, 2e10) : 0,
      );
      const ringsOn = shown * rising(ly, 5e9, 2e10);
      fadeMaterial(looks.cosmosRing, base.ring * ringsOn);
      fadeMaterial(looks.cosmosFlow, base.flow * shown * rising(ly, 220e6, 600e6));
      fadeMaterial(looks.cosmosGalaxy, base.galaxy * shown * (1 - rising(ly, 40e6, 120e6)));
      fadeMaterial(looks.cosmosCluster, base.cluster * shown);

      /* The camera in the root's frame: the shells' outlines face it. */
      root.worldToLocal(eye.copy(camera.position));
      cmb.update(shown * rising(ly, 2e10, 6e10), show.cmbDetail ?? false, eye);
      view.d = eye.length() || 1;
      view.toward.copy(eye).divideScalar(view.d);
      root.getWorldQuaternion(turn).invert();
      view.up.setFromMatrixColumn(camera.matrixWorld, 1).applyQuaternion(turn);
      view.up.addScaledVector(view.toward, -view.up.dot(view.toward)).normalize();
      view.facing.setFromUnitVectors(Z, view.toward);
      // Off-centre size guides face the camera's actual orientation, including
      // when inspection pans away from the Milky Way at the origin.
      camera.getWorldQuaternion(atlasFacing).premultiply(turn);
      atlas.update(ly, shown, layers, atlasFacing, sel?.kind === "cosmos" ? sel.id : null);
      rings.update(view, expansion, labelled * ringsOn * lines, place);
      const edge = shellOutline(CMB_MLY * expansion, view.d);
      edgeMark.copy(view.toward).multiplyScalar(edge.offset).addScaledVector(view.up, -edge.radius);
      /* At their real size once that is larger than a dozen pixels. */
      for (const [sprite, mly] of [
        [milkyWay, DISC_MLY.milkyWay],
        [andromeda, DISC_MLY.andromeda],
        [triangulum, DISC_MLY.triangulum],
      ] as const) {
        toPx(sprite, sprite.position, sprite === triangulum ? 7 : 12);
        sprite.scale.setScalar(Math.max(sprite.scale.x, mly * 2.2));
      }

      /* A cluster's glow shows while its cloud does. */
      for (const k of clusters) {
        k.group.visible = shown * (k.spec.far ? far : near) > FAINTEST_OPACITY;
        toPx(k.glow, k.group.position, 16);
      }

      marks.update(ly, labelled, shown, place, toPx, layers);

      /* Distances: from the Milky Way to the selected structure, or to what the scale frames. */
      if (show.distances && lod.realm === "cosmos") {
        root.localToWorld(at.copy(marks.rulerEnd(sel, ly)));
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
