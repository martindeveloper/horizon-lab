import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import {
  Group,
  PerspectiveCamera,
  PointsMaterial,
  SpriteMaterial,
  MeshBasicMaterial,
  Texture,
  TextureLoader,
  FrontSide,
  BackSide,
  Vector3,
} from "three";

import { DisposalScope } from "@horizon/toolkit/rendering";

import { CmbEvidence } from "../src/features/deep-field/components/cmb.tsx";
import { useDeepField } from "../src/features/deep-field/lib/store.ts";
import { assetUrl } from "../src/lib/assets.ts";
import { createCosmosLooks } from "../src/space/cosmos/graphics/looks.ts";
import { ATLAS_DEFAULT_SHOW } from "../src/space/cosmos/model/atlas.ts";
import {
  CMB_SOURCE,
  cmbMapUv,
  decodeCmbPixel,
  createCmbResources,
} from "../src/space/cosmos/model/cmb.ts";
import { CMB_MLY } from "../src/space/cosmos/model/cosmos.ts";
import { createCmbSky } from "../src/space/cosmos/scene/cmb-sky.ts";
import { createCosmosLayer } from "../src/space/cosmos/scene/cosmos-layer.ts";
import { LY, MLY } from "../src/space/galaxy/scene/frames.ts";
import { createLod } from "../src/space/galaxy/scene/lod.ts";
import { featureMessages } from "./messages-helper.mjs";
import { close } from "./toolkit-helpers.mjs";

/** The published maps, from the local CDN mirror (`npm run cdn:pull`). */
const mirrored = (product) =>
  new URL(`../cdn${CMB_SOURCE.products[product].path}`, import.meta.url);
const skip =
  !["planck", "act"].every((product) => existsSync(mirrored(product))) &&
  "no CDN mirror: run npm run cdn:pull";

const pixels = async (product) => {
  const asset = CMB_SOURCE.products[product];
  const bytes = readFileSync(mirrored(product));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  assert.equal(info.width, asset.width);
  assert.equal(info.height, asset.height);
  const at = (x, y) =>
    decodeCmbPixel(...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 3));
  return { data, info, at, asset };
};

test(
  "CMB snapshots preserve numerical temperatures, confidence masks and reference pixels",
  { skip },
  async () => {
    for (const product of ["planck", "act"]) {
      const { data, at, asset } = await pixels(product);
      let valid = 0,
        low = Infinity,
        high = -Infinity;
      for (let i = 0; i < data.length; i += 4) {
        assert.equal(data[i + 3], 255, "opaque container prevents alpha premultiplication");
        assert.ok(data[i + 2] === 0 || data[i + 2] === 255);
        const value = decodeCmbPixel(data[i], data[i + 1], data[i + 2]);
        if (value !== null) {
          valid++;
          low = Math.min(low, value);
          high = Math.max(high, value);
        }
      }
      assert.equal(valid, asset.validPixels);
      assert.ok(valid > 0 && valid < asset.width * asset.height);
      close(low, asset.minMicrokelvin, 0.051);
      close(high, asset.maxMicrokelvin, 0.051);
      assert.ok(low < -100 && high > 100, "signed microkelvin, not kelvin or a display image");
      for (const p of asset.referencePixels)
        if (p.valid) close(at(p.x, p.y), p.microkelvin, 1e-9);
        else assert.equal(at(p.x, p.y), null);
    }
  },
);

test(
  "ACT and Planck structures align after independent coordinate reprojections",
  { skip },
  async () => {
    const p = await pixels("planck"),
      a = await pixels("act");
    const pairs = [];
    for (let y = 100; y < p.info.height - 100; y += 7) {
      for (let x = 0; x < p.info.width; x += 7) {
        const v = p.at(x, y);
        const cells = [
          a.at(x * 2, y * 2),
          a.at(x * 2 + 1, y * 2),
          a.at(x * 2, y * 2 + 1),
          a.at(x * 2 + 1, y * 2 + 1),
        ];
        if (v !== null && cells.every((c) => c !== null))
          pairs.push([v, cells.reduce((s, c) => s + c, 0) / 4]);
      }
    }
    assert.ok(pairs.length > 2000);
    const mean = (axis) => pairs.reduce((s, p) => s + p[axis], 0) / pairs.length;
    const pm = mean(0),
      am = mean(1);
    let cross = 0,
      pp = 0,
      aa = 0;
    for (const [p, a] of pairs) {
      cross += (p - pm) * (a - am);
      pp += (p - pm) ** 2;
      aa += (a - am) ** 2;
    }
    assert.ok(cross / Math.sqrt(pp * aa) > 0.9, "same sky, hemisphere, orientation and units");
    assert.ok(Math.sqrt(aa / pp) > 0.8 && Math.sqrt(aa / pp) < 1.2);
  },
);

test("CMB lookup follows Galactic longitude, north and the periodic seam", () => {
  assert.deepEqual(cmbMapUv([-1, 0, 0]), [0, 0.5]);
  assert.deepEqual(cmbMapUv([0, 0, 1]), [0.25, 0.5]);
  assert.deepEqual(cmbMapUv([1, 0, 0]), [0.5, 0.5]);
  assert.equal(cmbMapUv([0, 1, 0])[1], 0);
  assert.equal(cmbMapUv([0, -1, 0])[1], 1);
  assert.ok(cmbMapUv([-1, 0, -1e-7])[0] > 0.9999);
  for (const [l, b] of [
    [37, -28],
    [172, 54],
    [301, 12],
  ]) {
    const lr = (l * Math.PI) / 180,
      br = (b * Math.PI) / 180;
    const [u, v] = cmbMapUv([
      -Math.cos(br) * Math.cos(lr),
      Math.sin(br),
      Math.cos(br) * Math.sin(lr),
    ]);
    close(u * 360, l);
    close(90 - v * 180, b);
  }
  assert.throws(() => cmbMapUv([0, 0, 0]), RangeError);
});

test("CMB loading is lazy, failed ACT retains Planck, retry is explicit and late arrivals are disposed", async () => {
  const loads = [],
    states = [],
    pending = {};
  const resources = createCmbResources(
    (id) => {
      loads.push(id);
      return new Promise((resolve, reject) => {
        pending[id] = { resolve, reject };
      });
    },
    (s) => states.push(s),
  );
  assert.deepEqual(loads, []);
  resources.request("planck");
  resources.request("planck");
  let disposed = 0;
  const planck = {
    dispose() {
      disposed++;
    },
  };
  pending.planck.resolve(planck);
  await Promise.resolve();
  resources.request("act");
  pending.act.reject(new Error("offline"));
  await Promise.resolve();
  resources.request("act");
  assert.deepEqual(loads, ["planck", "act"]);
  assert.equal(resources.resources.planck, planck);
  assert.deepEqual(states.at(-1), { planck: "ready", act: "error" });
  resources.retry();
  resources.request("act");
  resources.dispose();
  pending.act.resolve({
    dispose() {
      disposed++;
    },
  });
  await Promise.resolve();
  assert.equal(disposed, 2);
  assert.equal(resources.resources.act, undefined);
  resources.dispose();
  assert.equal(disposed, 2);
});

test("Data mode hides synthetic distant galaxies while every mode uses the same loaded CMB", async (t) => {
  const loaded = [];
  t.mock.method(TextureLoader.prototype, "loadAsync", async (path) => {
    loaded.push(path);
    return new Texture();
  });
  const scope = new DisposalScope();
  const looks = createCosmosLooks({
    points: () => new PointsMaterial({ opacity: 0.6 }),
    sprite: () => new SpriteMaterial(),
    ghost: new MeshBasicMaterial(),
  });
  const parent = new Group(),
    camera = new PerspectiveCamera(50, 1, 1, 1e20);
  const lod = createLod(camera, { height: 800 });
  const scene = createCosmosLayer(
    {
      scope,
      looks,
      camera,
      lod,
      pxWorld: (distance, px) => lod.pxWorld(distance, px),
      invalidate() {},
    },
    parent,
    {
      place() {},
      rulers: { draw() {} },
      distanceText: () => "",
      picks: { register() {} },
      cmbMaxTextureSize: 4096,
      detail: { share: 0.01, filaments: 2, knots: 2, strand: 0.01, bridgeStrand: 0.01 },
    },
  );
  try {
    camera.position.set(0, 0, 1e11 * LY);
    camera.updateMatrixWorld();
    lod.begin(1, 1e11 * LY);
    const show = {
      ...ATLAS_DEFAULT_SHOW,
      cosmicMode: "both",
      cmbDetail: true,
      names: false,
      distances: false,
    };
    const frame = { show, sel: null, lines: 1 };
    scene.update(frame);
    await Promise.resolve();
    await Promise.resolve();
    scene.update(frame);
    const meshes = [];
    parent.traverse((o) => {
      if (o.material?.uniforms?.planckMap) meshes.push(o);
    });
    assert.equal(meshes.length, 1);
    const shell = meshes[0];
    assert.equal(shell.visible, true);
    assert.equal(shell.material.side, FrontSide);
    assert.equal(loaded.length, 2);
    const map = shell.material.uniforms.planckMap.value;
    for (const mode of ["data", "illustration", "both"]) {
      show.cosmicMode = mode;
      scene.update(frame);
      assert.equal(looks.cosmos.deep.opacity > 0, mode !== "data");
      assert.equal(shell.material.uniforms.planckMap.value, map);
      assert.equal(shell.material.uniforms.planckReady.value, true);
    }
    scene.setExpansion(2);
    close(shell.scale.x, 2 * CMB_MLY);
    // Shell is observer-centred in world space, independently of galactocentric root placement.
    close(shell.getWorldPosition(new Vector3()).length() / MLY, 0, 1e-8);
    camera.position.set(0, 0, 3e10 * LY);
    camera.updateMatrixWorld();
    lod.begin(1, 3e10 * LY);
    scene.update(frame);
    assert.equal(shell.material.side, BackSide);
  } finally {
    scope.dispose();
    looks.dispose();
  }
});

test("CMB evidence renders all load states and quoted figures in both languages", () => {
  const initial = useDeepField.getState();
  try {
    for (const locale of ["en", "cs"]) {
      const messages = featureMessages("deep-field", locale);
      for (const planck of ["idle", "loading", "ready", "error"])
        for (const act of ["idle", "loading", "ready", "error"])
          for (const cmbDetail of [false, true]) {
            useDeepField.setState({
              cmbStatus: { planck, act },
              show: { ...initial.show, cmbDetail },
            });
            const html = renderToStaticMarkup(
              createElement(
                NextIntlClientProvider,
                {
                  locale,
                  messages: { deepField: messages },
                  timeZone: "UTC",
                  onError: (e) => {
                    throw e;
                  },
                },
                createElement(CmbEvidence),
              ),
            );
            assert.doesNotMatch(html, /NaN|undefined/);
            assert.match(html, /role="note"/);
            assert.match(html, /µK/);
          }
    }
  } finally {
    useDeepField.setState(initial, true);
  }
});

test("undersized GPUs retain Planck instead of resizing packed ACT temperatures as colours", async (t) => {
  const loaded = [],
    states = [];
  t.mock.method(TextureLoader.prototype, "loadAsync", async (path) => {
    loaded.push(path);
    return new Texture();
  });
  const scope = new DisposalScope(),
    root = new Group();
  const sky = createCmbSky(
    scope,
    root,
    () => {},
    (s) => states.push(s),
    2048,
  );
  try {
    sky.update(1, true, new Vector3(0, 0, 1e5));
    assert.equal(sky.waiting, true, "the needed Planck map is still loading");
    sky.update(0, true, new Vector3(0, 0, 1e5));
    assert.equal(sky.waiting, false, "a hidden map never holds the loading badge");
    await Promise.resolve();
    await Promise.resolve();
    sky.update(1, true, new Vector3(0, 0, 1e5));
    assert.equal(sky.waiting, false);
    assert.deepEqual(loaded, [assetUrl(CMB_SOURCE.products.planck.path)]);
    assert.deepEqual(states.at(-1), { planck: "ready", act: "error" });
    assert.equal(root.children[0].visible, true);
    assert.equal(root.children[0].material.uniforms.actReady.value, false);
  } finally {
    scope.dispose();
  }
});
