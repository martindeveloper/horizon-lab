import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import sharp from "sharp";
import { Vector3 } from "three";

import { mapFile } from "@horizon/toolkit/bodies";

import {
  HMI_SOURCES,
  projectSolarPoint,
  sampleBilinear,
  solarObserver,
  solarSurface,
} from "../scripts/lib/sun-map.mjs";
import { MAPS_KEY } from "../src/lib/assets.ts";
import { SUN_MAP_QUIET_INTENSITY } from "../src/space/solar-system/model/parameters.ts";
import { OBSERVED_REGIONS, mapUv } from "../src/space/sun/model/observed.ts";

const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("solar reprojection preserves disc centre, north/east directions and hides the far side", () => {
  const observer = solarObserver(new Date(HMI_SOURCES[1].date));
  const centre = projectSolarPoint(observer.toward, observer);
  near(centre.x, 0);
  near(centre.y, 0);
  assert.equal(projectSolarPoint(observer.toward.clone().negate(), observer), null);
  const north = observer.toward
    .clone()
    .multiplyScalar(Math.cos(0.4))
    .addScaledVector(observer.north, Math.sin(0.4));
  const east = observer.toward
    .clone()
    .multiplyScalar(Math.cos(0.4))
    .addScaledVector(observer.right, Math.sin(0.4));
  assert.ok(projectSolarPoint(north, observer).y > 0);
  near(projectSolarPoint(north, observer).x, 0);
  assert.ok(projectSolarPoint(east, observer).x > 0);
  near(projectSolarPoint(east, observer).y, 0);
  near(solarSurface(0, 0).distanceTo(new Vector3(-1, 0, 0)), 0);
  near(solarSurface(0, 0.2).distanceTo(solarSurface(2 * Math.PI, 0.2)), 0);
});

test("the dated observations cover all nonpolar longitudes without duplicating a hemisphere", () => {
  const observers = HMI_SOURCES.map(({ date }) => solarObserver(new Date(date)));
  for (let lat = -60; lat <= 60; lat += 15)
    for (let lon = 0; lon < 360; lon += 5) {
      const point = solarSurface((lon * Math.PI) / 180, (lat * Math.PI) / 180);
      assert.ok(
        observers.some((o) => (projectSolarPoint(point, o)?.mu ?? 0) > 0.25),
        `${lon}, ${lat}`,
      );
    }
  near(sampleBilinear(new Float32Array([0, 2, 4, 6]), 2, 0.5, 0.5), 3);
});

const shippedSun = new URL(`../cdn${mapFile(MAPS_KEY, "sun", "nearLight")}`, import.meta.url);
const skip = !existsSync(shippedSun) && "no CDN mirror: run npm run cdn:pull";

test(
  "shipped Sun retains dark sunspots, a quiet polar fill and a continuous longitude seam",
  { skip },
  async () => {
    const { data, info } = await sharp(shippedSun.pathname)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels: c } = info;
    const linear = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    let dark = 0,
      bright = 0,
      mean = 0,
      seam = 0;
    for (let y = 0; y < h; y += 1) {
      seam += Math.abs(data[y * w * c] - data[(y * w + w - 1) * c]);
      for (let x = 0; x < w; x += 1) {
        const v = linear(data[(y * w + x) * c]);
        if (v < SUN_MAP_QUIET_INTENSITY * 0.4) dark += 1;
        if (v > SUN_MAP_QUIET_INTENSITY * 0.9) bright += 1;
        mean += v;
      }
    }
    assert.ok(dark > 50, "observed umbrae remain dark");
    assert.ok(bright > w * h * 0.9, "quiet photosphere dominates");
    near(mean / (w * h), SUN_MAP_QUIET_INTENSITY, 0.03);
    assert.ok(seam / h < 3, "no hard longitude seam");
    const polarRow = Array.from({ length: w }, (_, x) => data[x * c]);
    assert.ok(Math.max(...polarRow) - Math.min(...polarRow) < 3, "no invented polar features");
  },
);

test(
  "the shipped Sun is dark where the regions read off it stand, by the rule the globe samples it with",
  { skip },
  async () => {
    const { data, info } = await sharp(shippedSun.pathname)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels: c } = info;
    const at = (u, v) => {
      const x = Math.min(w - 1, Math.floor((((u % 1) + 1) % 1) * w));
      const y = Math.min(h - 1, Math.floor((1 - v) * h));
      return data[(y * w + x) * c];
    };
    /* The darkest pixel within `reach` radians of where the model places a group. */
    const darkest = (region, reach) => {
      let min = 255;
      for (let dlat = -reach; dlat <= reach; dlat += reach / 12)
        for (let dlon = -reach; dlon <= reach; dlon += reach / 12) {
          const [u, v] = mapUv(region.lat + dlat, region.lon + dlon);
          min = Math.min(min, at(u, v));
        }
      return min;
    };
    const umbral = 255 * SUN_MAP_QUIET_INTENSITY * 0.7;
    const degree = Math.PI / 180;
    /* The mosaic's largest group, AR 13664, stands where its report puts it. */
    const ar13664 = OBSERVED_REGIONS.find((region) => region.number === 13_664);
    assert.ok(darkest(ar13664, degree) < umbral, "AR 13664 is under its model position");
    /* The mosaic prefers each longitude's most face-on disc, so a group that decayed before
       that disc was taken is missing; the rest stand within a few degrees of their reports. */
    const large = OBSERVED_REGIONS.filter((region) => region.areaMsh >= 100);
    const found = large.filter((region) => darkest(region, 3 * degree) < umbral);
    assert.ok(large.length >= 6, "several large groups were reported");
    assert.ok(
      found.length >= large.length - 2,
      `${found.length} of ${large.length} large groups have spots under them`,
    );
  },
);
