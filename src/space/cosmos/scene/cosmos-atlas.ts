/** Observed catalogue points and reconstruction summaries, owned by the cosmic layer. */
import { Group, LineSegments, Points, type Object3D, type Quaternion, type Vector3 } from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";
import { fadeMaterial, rising } from "@horizon/toolkit/scene";

import {
  SIZE_GUIDES,
  basinGeometry,
  centreCloud,
  classixCloud,
  observedCloud,
  sizeGuideGeometry,
} from "../graphics/atlas";
import type { CosmosDetail } from "../graphics/cosmos";
import type { CosmosLooks } from "../graphics/looks";
import {
  ATLAS_LANDMARKS,
  BASINS,
  KNOTS,
  VOIDS,
  isAtlasLandmark,
  type AtlasShow,
} from "../model/atlas";

export function createCosmosAtlas(
  scope: DisposalScope,
  looks: CosmosLooks,
  parent: Object3D,
  detail: CosmosDetail,
) {
  const root = new Group();
  parent.add(root);
  const observed = new Points(observedCloud(detail.share), looks.cosmos.observed);
  scope.defer(() => observed.geometry.dispose());
  const clusters = new Points(scope.own(classixCloud()), looks.cosmos.classix);
  const basins = new Points(
    scope.own(centreCloud([...BASINS, ATLAS_LANDMARKS.vela, ATLAS_LANDMARKS.southPoleWall])),
    looks.atlasCentre,
  );
  const voids = new Points(scope.own(centreCloud(VOIDS)), looks.atlasVoidCentre);
  const knots = new Points(scope.own(centreCloud(KNOTS)), looks.atlasKnot);
  root.add(observed, clusters, basins, voids, knots);
  const uncertainties = BASINS.map((basin) => {
    const object = new LineSegments(scope.own(basinGeometry(basin)), looks.atlasBasin);
    object.visible = false;
    root.add(object);
    return { object, at: basin.at };
  });
  const circle = scope.own(sizeGuideGeometry());
  const guides = SIZE_GUIDES.map((spec) => {
    const group = new Group();
    group.visible = false;
    group.position.set(...spec.at);
    const full = new LineSegments(circle, looks.atlasVoid);
    full.scale.setScalar(spec.radius);
    group.add(full);
    if (spec.robust !== null) {
      const robust = new LineSegments(circle, looks.atlasRobust);
      robust.scale.setScalar(spec.robust);
      group.add(robust);
    }
    root.add(group);
    return { group, at: spec.at, layer: spec.layer };
  });
  root.traverse((object) => {
    object.frustumCulled = false;
  });
  const base = {
    observed: looks.cosmos.observed.opacity,
    classix: looks.cosmos.classix.opacity,
    basin: looks.atlasBasin.opacity,
    void: looks.atlasVoid.opacity,
    robust: looks.atlasRobust.opacity,
    knot: looks.atlasKnot.opacity,
    centre: looks.atlasCentre.opacity,
    voidCentre: looks.atlasVoidCentre.opacity,
  };
  return {
    root,
    setDetail(next: CosmosDetail) {
      observed.geometry.dispose();
      observed.geometry = observedCloud(next.share);
    },
    setExpansion(a: number, sun: Vector3) {
      root.scale.setScalar(a);
      root.position.copy(sun).multiplyScalar(1 - a);
    },
    update(
      ly: number,
      shown: number,
      show: AtlasShow,
      facing: Quaternion,
      selected: string | null = null,
    ) {
      const presence = shown * rising(ly, 60e6, 300e6) * (1 - rising(ly, 5e9, 2e10));
      const recon = presence * rising(ly, 180e6, 600e6);
      // Landmarks retain their catalogue record's coordinate tuple. Compare that
      // identity so a source refresh cannot leave a second, stale guide lookup.
      const selectedAt =
        selected && isAtlasLandmark(selected) ? ATLAS_LANDMARKS[selected].at : null;
      observed.visible = clusters.visible = show.cosmicMeasured;
      basins.visible = show.cosmicBasins;
      voids.visible = show.cosmicVoids;
      knots.visible = show.cosmicKnots;
      fadeMaterial(looks.cosmos.observed, base.observed * presence);
      fadeMaterial(looks.cosmos.classix, base.classix * presence);
      fadeMaterial(looks.atlasBasin, base.basin * recon);
      fadeMaterial(looks.atlasVoid, base.void * recon);
      fadeMaterial(looks.atlasRobust, base.robust * recon);
      fadeMaterial(looks.atlasKnot, base.knot * recon);
      fadeMaterial(looks.atlasCentre, base.centre * recon);
      fadeMaterial(looks.atlasVoidCentre, base.voidCentre * recon);
      for (const { object, at } of uncertainties)
        object.visible = show.cosmicBasins && (show.cosmicGuides || at === selectedAt);
      for (const { group, at, layer } of guides) {
        group.visible = show[layer] && (show.cosmicGuides || at === selectedAt);
        group.quaternion.copy(facing);
      }
    },
  };
}
