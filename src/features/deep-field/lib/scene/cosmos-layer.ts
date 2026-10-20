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
  rising,
  type AnchoredRulers,
  type DistanceText,
  type LabelText,
  type PlaceLabel,
} from "@horizon/toolkit/scene";

import type { CosmosDetail } from "../graphics/cosmos";
import { CMB_MLY } from "../model/cosmos";
import { DISC_MLY, createCosmosClouds } from "./cosmos-clouds";
import { createCosmosMarks } from "./cosmos-marks";
import { createLookbackRings, shellOutline, type RootView } from "./cosmos-rings";
import type { Frame, SceneKit } from "./kit";
import type { LabelPicks } from "./label-picks";
import { GALAXY_FRAME, GALAXY_LAYER, LY, MLY, cosmicToWorld, galaxyToWorld } from "./lod";

/** Farthest anything drawn reaches from the galactic centre, Mly: the microwave background. */
const EXTENT_MLY = 48_000;
/** The deep field's distance from the camera, Mly: inside the pass's far plane at any zoom. */
const FIELD_MLY = 450;

export function createCosmosLayer(
  { scope, looks, camera, pxWorld, lod }: SceneKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    rulers: AnchoredRulers;
    labels: LabelText;
    distanceText: DistanceText;
    picks: LabelPicks;
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

  const clouds = createCosmosClouds(scope, looks, root, parent, deps.detail);
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
  const eye = new Vector3();
  const view: RootView = {
    d: 1,
    toward: new Vector3(),
    up: new Vector3(),
    facing: new Quaternion(),
  };
  const turn = new Quaternion();
  const Z = new Vector3(0, 0, 1);

  /** Size a sprite or target (in the root's Mly) to `px` pixels where it stands. */
  const toPx = (object: Object3D, local: Vector3, px: number) => {
    root.localToWorld(at.copy(local));
    object.scale.setScalar(pxWorld(camera.position.distanceTo(at), px) / MLY);
  };

  return {
    pickables: marks.pickables,
    /** Samples every cloud afresh at a new quality's detail. */
    setDetail: (detail: CosmosDetail) => clouds.setDetail(detail),
    get visible() {
      return root.visible;
    },
    /** Camera distance to the far side of everything drawn, au: shared with the Galaxy pass. */
    reach() {
      return camera.position.distanceTo(centre) + EXTENT_MLY * MLY;
    },
    update({ show, sel, lines }: Frame) {
      const shown = lod.cosmos;
      root.visible = field.visible = shown > 0.001;
      const labelled = names.to(show.names) * shown;
      if (!root.visible) {
        marks.hide(place);
        rings.hide(place);
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
      clouds.cmbShell.visible = m.cmb.opacity > 0.002;
      clouds.deepFill.visible = m.deep.opacity > 0.002;
      const ringsOn = shown * rising(ly, 5e9, 2e10);
      looks.cosmosRing.opacity = base.ring * ringsOn;
      /* The two big clouds skip their draw while they are faded out. */
      clouds.web.visible = m.web.opacity > 0.002;
      clouds.laniakea.visible = m.laniakea.opacity > 0.002;
      looks.cosmosFlow.opacity = base.flow * shown * rising(ly, 220e6, 600e6);
      clouds.flows.visible = looks.cosmosFlow.opacity > 0.002;
      looks.cosmosGalaxy.opacity = base.galaxy * shown * (1 - rising(ly, 40e6, 120e6));
      looks.cosmosCluster.opacity = base.cluster * shown;

      /* The camera in the root's frame: the shells' outlines face it. */
      root.worldToLocal(eye.copy(camera.position));
      view.d = eye.length() || 1;
      view.toward.copy(eye).divideScalar(view.d);
      root.getWorldQuaternion(turn).invert();
      view.up.setFromMatrixColumn(camera.matrixWorld, 1).applyQuaternion(turn);
      view.up.addScaledVector(view.toward, -view.up.dot(view.toward)).normalize();
      view.facing.setFromUnitVectors(Z, view.toward);
      rings.update(view, labelled * ringsOn * lines, labels().lookbackRing, place);
      const edge = shellOutline(CMB_MLY, view.d);
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

      for (const k of clusters) {
        k.group.visible = (k.spec.far ? far : near) > 0.002;
        toPx(k.glow, k.group.position, 16);
      }

      marks.update(ly, labelled, shown, place, toPx);

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
