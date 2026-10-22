/**
 * Builds the spacecraft models (`SPACECRAFT` in src/space/spacecraft/models.ts) from the NASA
 * 3D Resources glTFs into the local CDN mirror, cdn/ + `MODELS_KEY`. Not part of `next build`:
 * run it when a source or a step changes, bump that model's `version`, and upload its new
 * folder (scripts/README.md). Name models to build only those (new versions); all by default.
 *
 *   node --import tsx scripts/build-spacecraft-models.mjs [cache-dir] [id ...]
 *
 * Each model is put in metres about the centre of its face (the high-gain dish, Parker's heat
 * shield, an observatory's solar arrays or sunshield), scaled so the face (or the part named
 * as its size) spans its sourced width and turned so the face looks down +z; the host turns
 * +z toward Earth or the Sun. Helper geometry is dropped, meshes are welded, simplified and
 * meshopt-compressed, and textures become WebP of at most `TEXTURE_PX`. The build checks that
 * each dish opens toward +z and that the model's radius is the registry's.
 */
import { mkdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  getBounds,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

import { MODELS_KEY, SPACECRAFT, spacecraftFile } from "../src/space/spacecraft/models.ts";
import { fetchCached } from "./lib/net.mjs";

/** Longest texture side, px: a 4 m craft fills a phone's screen at about this many. */
const TEXTURE_PX = 1024;
/** Simplification stops at this share of the triangles, or at this error (of the model's size). */
const SIMPLIFY_RATIO = 0.5;
const SIMPLIFY_ERROR = 0.0005;
/** The built radius may differ from the registry's by this share before the build fails. */
const RADIUS_TOLERANCE = 0.02;

/**
 * Per source: the face (a node, or the primitives of one material), the axis it looks along in
 * the source ("normal": the mean normal of its triangles, for a one-sided panel), the axis its
 * sourced width runs along, measured on `size` when that is another node, and nodes whose own
 * mesh is a helper (an exporter's clear cube). Observatories face the Sun with what powers or
 * shades them: Hubble's and Chandra's solar arrays (their cells), Webb's sunshield (its
 * sun-facing layer, the model's fifth).
 */
const SOURCES = {
  voyager: { face: "tex_02_AO", look: "+y", across: "x", helpers: ["_root"] },
  pioneer: { face: "AO_dish", look: "-z", across: "x", helpers: [] },
  newHorizons: { face: "AO_dish", look: "+y", across: "x", helpers: ["_root"] },
  parker: { face: "heatShield_Mounting", look: "-z", across: "y", helpers: [] },
  hubble: {
    face: "shiny_panel",
    look: "-z",
    across: "x",
    size: "shiny_panel_cylinder",
    helpers: ["_root"],
  },
  chandra: { face: "shiny_panel", look: "normal", across: "z", helpers: ["_root"] },
  webb: { face: { material: "JWST-FoilLayer5-PURPLEY" }, look: "-y", across: "z", helpers: [] },
};

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const axisOf = (look) => AXES[look[1]].map((v) => (look[0] === "-" ? -v : v));

/** The rotation (column-major 3×3) taking unit vector `from` onto +z. */
function rotationToZ([x, y, z]) {
  if (z > 1 - 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (z < -1 + 1e-9) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
  // Rodrigues about k = from × z, normalised; cos = z, sin = |k|.
  const s = Math.hypot(x, y);
  const [kx, ky] = [y / s, -x / s];
  const c = z;
  const t = 1 - c;
  return [
    t * kx * kx + c,
    t * kx * ky,
    -s * ky,
    t * kx * ky,
    t * ky * ky + c,
    s * kx,
    s * ky,
    -s * kx,
    c,
  ];
}

/** World positions of every vertex of `node`'s primitives that `keep` keeps. */
function worldVertices(node, keep = () => true) {
  const m = node.getWorldMatrix();
  const out = [];
  const v = [0, 0, 0];
  for (const prim of node.getMesh()?.listPrimitives() ?? []) {
    if (!keep(prim)) continue;
    const pos = prim.getAttribute("POSITION");
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      out.push([0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]));
    }
  }
  return out;
}

/** A face's parts: a node's primitives, or every node's primitives of one material. */
function faceParts(root, face) {
  const keep = (prim) =>
    typeof face === "string" || prim.getMaterial()?.getName() === face.material;
  return root
    .listNodes()
    .filter((node) => (typeof face === "string" ? node.getName() === face : node.getMesh()))
    .flatMap((node) =>
      (node.getMesh()?.listPrimitives() ?? []).filter(keep).map((prim) => ({ node, prim })),
    );
}

/** World positions of every vertex of a face. */
const faceVertices = (parts) =>
  parts.flatMap(({ node, prim }) => worldVertices(node, (p) => p === prim));

/** World triangles of a face. */
function faceTriangles(parts) {
  const triangles = [];
  for (const { node, prim } of parts) {
    const points = worldVertices(node, (p) => p === prim);
    const index = prim.getIndices();
    const count = index ? index.getCount() : points.length;
    for (let i = 0; i < count; i += 3)
      triangles.push([0, 1, 2].map((k) => points[index ? index.getScalar(i + k) : i + k]));
  }
  return triangles;
}

/** The bounds of a set of points. */
function boundsOf(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  return { min, max };
}

/** The area-weighted mean normal of triangles, unit: which way a one-sided panel faces. */
function meanNormal(triangles) {
  const sum = [0, 0, 0];
  for (const [a, b, c] of triangles) {
    const u = b.map((v, k) => v - a[k]);
    const w = c.map((v, k) => v - a[k]);
    sum[0] += u[1] * w[2] - u[2] * w[1];
    sum[1] += u[2] * w[0] - u[0] * w[2];
    sum[2] += u[0] * w[1] - u[1] * w[0];
  }
  const length = Math.hypot(...sum);
  return sum.map((v) => v / length);
}

/**
 * Which way a dish opens along `axis`: a paraboloid's rim lies further toward its opening than
 * a ring halfway out (the feed on the axis is left out). +1 or −1.
 */
function opening(points, centre, axis) {
  const along = (p) => p.reduce((s, v, i) => s + (v - centre[i]) * axis[i], 0);
  const radial = (p) => {
    const a = along(p);
    return Math.hypot(...p.map((v, i) => v - centre[i] - a * axis[i]));
  };
  const rMax = Math.max(...points.map(radial));
  const mean = (lo, hi) => {
    const ring = points.filter((p) => radial(p) > lo * rMax && radial(p) < hi * rMax);
    return ring.reduce((s, p) => s + along(p), 0) / ring.length;
  };
  return Math.sign(mean(0.9, 1.01) - mean(0.5, 0.7));
}

sharp.cache(false);
const args = process.argv.slice(2);
const only = args.filter((arg) => arg in SPACECRAFT);
const cache = path.resolve(
  args.find((arg) => !(arg in SPACECRAFT)) ?? path.join(os.tmpdir(), "horizon-spacecraft"),
);
const outDir = new URL(`../cdn${MODELS_KEY}`, import.meta.url).pathname;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "meshopt.encoder": MeshoptEncoder,
});
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const uploads = [];
for (const [id, model] of Object.entries(SPACECRAFT)) {
  if (only.length > 0 && !only.includes(id)) continue;
  const spec = SOURCES[id];
  const doc = await io.read(await fetchCached(model.download, cache));
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  for (const node of root.listNodes())
    if (spec.helpers.includes(node.getName())) node.setMesh(null);

  const parts = faceParts(root, spec.face);
  if (parts.length === 0) throw new Error(`${id}: no face ${JSON.stringify(spec.face)}`);
  const facePoints = faceVertices(parts);
  const faceBounds = boundsOf(facePoints);
  const centre = faceBounds.min.map((v, i) => (v + faceBounds.max[i]) / 2);
  const look = spec.look === "normal" ? meanNormal(faceTriangles(parts)) : axisOf(spec.look);
  const sizeNode = spec.size && root.listNodes().find((node) => node.getName() === spec.size);
  if (spec.size && !sizeNode) throw new Error(`${id}: no node ${spec.size}`);
  const sizeBounds = sizeNode ? getBounds(sizeNode) : faceBounds;
  const acrossIndex = "xyz".indexOf(spec.across);
  const scale =
    model.face.across.value / (sizeBounds.max[acrossIndex] - sizeBounds.min[acrossIndex]);
  if (model.face.toward === "earth" && opening(facePoints, centre, look) !== 1)
    throw new Error(`${id}: the dish does not open toward ${spec.look}`);

  /* One new root: scale about the face's centre, then turn its look onto +z. */
  const r = rotationToZ(look);
  const offset = [0, 1, 2].map(
    (row) => -scale * (r[row] * centre[0] + r[3 + row] * centre[1] + r[6 + row] * centre[2]),
  );
  const pivot = doc
    .createNode(id)
    .setMatrix([
      ...[0, 1, 2].map((i) => r[i] * scale),
      0,
      ...[3, 4, 5].map((i) => r[i] * scale),
      0,
      ...[6, 7, 8].map((i) => r[i] * scale),
      0,
      ...offset,
      1,
    ]);
  for (const child of scene.listChildren()) pivot.addChild(child);
  scene.addChild(pivot);

  for (const ext of root.listExtensionsUsed())
    if (ext.extensionName === "KHR_draco_mesh_compression") ext.dispose();
  await doc.transform(
    prune(),
    dedup(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY_RATIO, error: SIMPLIFY_ERROR }),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [TEXTURE_PX, TEXTURE_PX] }),
    prune(),
  );

  /* A loop, not a spread: Webb's vertices overflow an argument list. */
  let radius = 0;
  for (const node of root.listNodes())
    for (const p of worldVertices(node)) radius = Math.max(radius, Math.hypot(...p));
  if (Math.abs(radius / model.radius - 1) > RADIUS_TOLERANCE)
    throw new Error(`${id}: radius ${radius.toFixed(2)} m, the registry says ${model.radius} m`);

  await doc.transform(meshopt({ encoder: MeshoptEncoder }));
  const file = spacecraftFile(outDir, id);
  mkdirSync(path.dirname(file), { recursive: true });
  await io.write(file, doc);
  const kb = (statSync(file).size / 1024).toFixed(0);
  console.log(`${id}: ×${scale.toFixed(3)}, radius ${radius.toFixed(2)} m, ${kb} KB → ${file}`);
  uploads.push(path.dirname(spacecraftFile(MODELS_KEY, id)));
}

console.log("\nUpload each new folder (scripts/README.md):");
for (const key of uploads)
  console.log(
    `aws s3 cp cdn${key}/ s3://horizon-cdn${key}/ --recursive --content-type model/gltf-binary ` +
      `--cache-control "public, max-age=31536000, immutable" --profile horizon-cdn`,
  );
