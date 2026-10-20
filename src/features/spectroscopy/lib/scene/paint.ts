import { minstd } from "@horizon/toolkit/math";
import {
  cieObserver,
  cssColor,
  wavelengthColor,
  type Gamut,
  type Rgb,
} from "@horizon/toolkit/science";

import type { Glow } from "../model/glow";
import { layout, type Geometry } from "./layout";

/** What the scene needs to say about itself, already translated. */
export type SceneLabels = {
  source: string;
  gas: string;
  air: string | null;
  spectrograph: string;
};

/** Everything the still scene is drawn from. */
export type SceneInputs = {
  kind: "slab" | "star";
  glowing: boolean;
  glow: Glow | null;
  starColor: Rgb | null;
  /** K; null on the bench. */
  teff: number | null;
  lampColor: Rgb | null;
  strong: readonly { centre: number; tau: number }[];
  range: readonly [number, number];
  labels: SceneLabels;
  /** The canvas's colour space, which the colours above are computed in. */
  gamut: Gamut;
};

/** Whether two inputs draw the same still scene (the photons' lines aside). */
export const sameScene = (a: SceneInputs, b: SceneInputs) =>
  a.kind === b.kind &&
  a.glowing === b.glowing &&
  a.glow === b.glow &&
  a.starColor === b.starColor &&
  a.teff === b.teff &&
  a.lampColor === b.lampColor &&
  a.range === b.range &&
  a.labels === b.labels &&
  a.gamut === b.gamut;

/** The scene stays dark in both themes, so it keeps the dark theme's gold and muted text. */
const SCENE_GOLD = "rgb(226 192 122 / 0.9)";
const SCENE_MUTED = "rgb(178 178 174 / 0.8)";

/** Model colours are computed in the canvas's gamut and printed for it. */
const css = (rgb: Rgb, alpha: number, gamut: Gamut) => cssColor(rgb, alpha, gamut);

/**
 * A star's surface mottled by convection cells (granules), as a tile drawn once: neutral grey
 * with lighter cell centres and darker lanes, laid over the disc in overlay so it only
 * modulates the star's own colour.
 */
let granuleTile: HTMLCanvasElement | null = null;
function granulation() {
  if (granuleTile) return granuleTile;
  const size = 160;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const g = tile.getContext("2d");
  if (!g) return null;
  g.fillStyle = "rgb(118 118 118)";
  g.fillRect(0, 0, size, size);
  const random = minstd(7);
  for (let i = 0; i < 260; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = 3.5 + random() * 4.5;
    /* Drawn at every wrap, so the tile repeats without seams. */
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        const cell = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        cell.addColorStop(0, "rgb(200 200 200 / 0.55)");
        cell.addColorStop(1, "rgb(200 200 200 / 0)");
        g.fillStyle = cell;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
  }
  granuleTile = tile;
  return tile;
}

/**
 * Linear limb darkening, I(μ) / I(1) = 1 − u (1 − μ): about 0.6 for the Sun in visible light,
 * less in hotter stars, whose light comes from a shallower temperature gradient.
 */
const limbCoefficient = (teff: number) => (teff < 7000 ? 0.6 : teff < 12_000 ? 0.5 : 0.35);

/** The star's disc: limb-darkened in its own colour, granulated if it is cool enough to convect. */
function drawStar(
  ctx: CanvasRenderingContext2D,
  star: Geometry["star"],
  rgb: Rgb,
  teff: number,
  gamut: Gamut,
) {
  const u = limbCoefficient(teff);
  const disc = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r);
  for (const s of [0, 0.4, 0.6, 0.75, 0.85, 0.92, 0.96, 0.985, 1]) {
    const mu = Math.sqrt(1 - s * s);
    const level = 1 - u * (1 - mu);
    /* The limb darkens most in the blue, so it also reddens a little. */
    disc.addColorStop(
      s,
      css(
        [rgb[0] * level, rgb[1] * level * (0.96 + 0.04 * mu), rgb[2] * level * (0.88 + 0.12 * mu)],
        1,
        gamut,
      ),
    );
  }
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
  ctx.fill();
  /* Convection reaches the surface only in stars cooler than about 7,000 K. */
  const tile = teff < 7000 ? granulation() : null;
  const pattern = tile ? ctx.createPattern(tile, "repeat") : null;
  if (pattern) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pattern;
    ctx.fillRect(star.x - star.r, star.y - star.r, star.r * 2, star.r * 2);
    ctx.restore();
  }
  const halo = ctx.createRadialGradient(
    star.x,
    star.y,
    star.r * 0.98,
    star.x,
    star.y,
    star.r * 1.3,
  );
  halo.addColorStop(0, css(rgb, 0.2, gamut));
  halo.addColorStop(0.4, css(rgb, 0.06, gamut));
  halo.addColorStop(1, css(rgb, 0, gamut));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(star.x, star.y, star.r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  /* Its atmosphere: the thin, cooler shell the lines form in, a veil just above the limb. */
  const shell = ctx.createRadialGradient(star.x, star.y, star.r, star.x, star.y, star.r * 1.05);
  shell.addColorStop(0, css(rgb, 0.16, gamut));
  shell.addColorStop(1, css(rgb, 0, gamut));
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(star.x, star.y, star.r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgb(255 255 255 / 0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(star.x, star.y, star.r * 1.04, -0.55, 0.55);
  ctx.stroke();
}

/** A lamp at its temperature: a bulb, its filament, and the light around it; dark when off. */
function drawLamp(
  ctx: CanvasRenderingContext2D,
  at: Geometry["source"],
  rgb: Rgb | null,
  height: number,
  gamut: Gamut,
) {
  if (rgb) {
    const reach = height * 0.36;
    const light = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, reach);
    light.addColorStop(0, css(rgb, 0.95, gamut));
    light.addColorStop(0.12, css(rgb, 0.6, gamut));
    light.addColorStop(0.4, css(rgb, 0.14, gamut));
    light.addColorStop(1, css(rgb, 0, gamut));
    ctx.fillStyle = light;
    ctx.fillRect(at.x - reach, at.y - reach, reach * 2, reach * 2);
  }
  ctx.strokeStyle = rgb ? "rgb(255 255 255 / 0.4)" : "rgb(255 255 255 / 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(at.x, at.y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgb ? css([1, 1, 1], 0.9, "srgb") : "rgb(255 255 255 / 0.3)";
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) ctx.lineTo(at.x - 5 + (10 * i) / 6, at.y + (i % 2 ? -2.5 : 2.5));
  ctx.stroke();
}

/** The gas cell: a glass cell, glowing in the colour of its own light when it glows. */
function drawCell(
  ctx: CanvasRenderingContext2D,
  gas: Geometry["gas"],
  midY: number,
  height: number,
  glow: Glow | null,
  gamut: Gamut,
) {
  const top = midY - height * 0.3;
  const h = height * 0.6;
  if (glow) {
    const cell = ctx.createRadialGradient(gas.x, midY, 0, gas.x, midY, h * 0.75);
    cell.addColorStop(0, css(glow.rgb, 0.6 * glow.level, gamut));
    cell.addColorStop(0.5, css(glow.rgb, 0.18 * glow.level, gamut));
    cell.addColorStop(1, css(glow.rgb, 0, gamut));
    ctx.fillStyle = cell;
    ctx.fillRect(gas.x - h * 0.75, midY - h * 0.75, h * 1.5, h * 1.5);
  }
  const glass = ctx.createLinearGradient(gas.x - gas.w / 2, 0, gas.x + gas.w / 2, 0);
  glass.addColorStop(0, "rgb(255 255 255 / 0.1)");
  glass.addColorStop(0.3, "rgb(255 255 255 / 0.02)");
  glass.addColorStop(1, "rgb(255 255 255 / 0.05)");
  ctx.fillStyle = glass;
  ctx.strokeStyle = "rgb(255 255 255 / 0.24)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(gas.x - gas.w / 2, top, gas.w, h, 4);
  ctx.fill();
  ctx.stroke();
}

/**
 * The fan of colours from the grating to the ribbon, the window's wavelengths left to right.
 * Drawn first, then dimmed with distance from the grating (nothing else is on the layer yet),
 * so it reads as light spreading out rather than a wedge of paint.
 */
function drawFan(
  ctx: CanvasRenderingContext2D,
  grating: Geometry["grating"],
  width: number,
  height: number,
  range: readonly [number, number],
  gamut: Gamut,
) {
  const [from, to] = range;
  const slices = 72;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < slices; i++) {
    /* As bright as the eye finds each colour (CIE ȳ), so the far red and violet stay dim. */
    const nm = from + ((to - from) * (i + 0.5)) / slices;
    ctx.fillStyle = css(wavelengthColor(nm, gamut), 0.03 + 0.14 * cieObserver(nm)[1], gamut);
    ctx.beginPath();
    ctx.moveTo(grating.x, grating.y);
    ctx.lineTo((width * i) / slices - 0.5, height);
    ctx.lineTo((width * (i + 1)) / slices + 0.5, height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "destination-in";
  const spread = ctx.createRadialGradient(grating.x, grating.y, 0, grating.x, grating.y, grating.x);
  spread.addColorStop(0, "rgb(0 0 0 / 1)");
  spread.addColorStop(0.25, "rgb(0 0 0 / 0.5)");
  spread.addColorStop(1, "rgb(0 0 0 / 0.22)");
  ctx.fillStyle = spread;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** Under the sky, a few faint background stars, the same ones every time; not on the bench. */
function drawBackgroundStars(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const random = minstd(11);
  const stars = Math.round((width * height) / 2600);
  for (let i = 0; i < stars; i++) {
    const x = random() * width;
    const y = random() * height;
    const bright = random();
    ctx.fillStyle = `rgb(220 225 240 / ${(0.12 + 0.4 * bright ** 3).toFixed(3)})`;
    ctx.fillRect(x, y, bright > 0.92 ? 1.4 : 0.9, bright > 0.92 ? 1.4 : 0.9);
  }
}

/** Earth's air: a soft column of blue haze the light crosses on its way down to us. */
function drawAir(
  ctx: CanvasRenderingContext2D,
  airBand: Geometry["airBand"],
  midY: number,
  height: number,
) {
  ctx.save();
  ctx.translate(airBand.x, midY);
  ctx.scale(airBand.w / height, 1);
  const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, height * 0.75);
  haze.addColorStop(0, "rgb(130 170 255 / 0.16)");
  haze.addColorStop(0.55, "rgb(110 150 245 / 0.07)");
  haze.addColorStop(1, "rgb(110 150 245 / 0)");
  ctx.fillStyle = haze;
  ctx.fillRect(-height * 0.75, -height * 0.75, height * 1.5, height * 1.5);
  ctx.restore();
}

/** The beam: a soft band of the source's light with a crisp core, fading toward the slit. */
function drawBeam(
  ctx: CanvasRenderingContext2D,
  from: number,
  slit: Geometry["slit"],
  midY: number,
  tint: Rgb,
  gamut: Gamut,
) {
  for (const [half, alpha] of [
    [7, 0.05],
    [3, 0.08],
    [0.6, 0.3],
  ] as const) {
    const beam = ctx.createLinearGradient(from, 0, slit.x, 0);
    beam.addColorStop(0, css(tint, alpha, gamut));
    beam.addColorStop(1, css(tint, alpha * 0.45, gamut));
    ctx.fillStyle = beam;
    ctx.fillRect(from, midY - half, slit.x - from, half * 2);
  }
}

/** The spectrograph: slit jaws, then a ruled grating in gold that spreads the light. */
function drawSpectrograph(
  ctx: CanvasRenderingContext2D,
  slit: Geometry["slit"],
  grating: Geometry["grating"],
  midY: number,
) {
  ctx.strokeStyle = "rgb(255 255 255 / 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(slit.x, midY - 11);
  ctx.lineTo(slit.x, midY - 2);
  ctx.moveTo(slit.x, midY + 2);
  ctx.lineTo(slit.x, midY + 11);
  ctx.stroke();
  ctx.strokeStyle = "rgb(255 255 255 / 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(slit.x, midY);
  ctx.lineTo(grating.x, grating.y);
  ctx.stroke();
  ctx.save();
  ctx.translate(grating.x, grating.y);
  ctx.rotate(-0.5);
  const metal = ctx.createLinearGradient(-2, 0, 2, 0);
  metal.addColorStop(0, "rgb(160 128 70)");
  metal.addColorStop(0.5, SCENE_GOLD);
  metal.addColorStop(1, "rgb(140 110 60)");
  ctx.fillStyle = metal;
  ctx.fillRect(-2, -10, 4, 20);
  ctx.fillStyle = "rgb(8 8 11 / 0.45)";
  for (let y = -9; y < 10; y += 2.5) ctx.fillRect(-2, y, 4, 0.6);
  ctx.restore();
}

/**
 * Names along the foot, kept inside the canvas and apart: one that would touch a name already
 * placed is left out (a narrow phone has room for fewer).
 */
function drawLabels(
  ctx: CanvasRenderingContext2D,
  g: Geometry,
  kind: SceneInputs["kind"],
  labels: SceneLabels,
  width: number,
  height: number,
  font: string,
) {
  ctx.font = `10px ${font}`;
  ctx.textBaseline = "top";
  const placed: [number, number][] = [];
  const label = (text: string, x: number, align: CanvasTextAlign = "center") => {
    if (height < 40) return;
    const upper = text.toUpperCase();
    const w = ctx.measureText(upper).width;
    const wanted = align === "left" ? x : x - w / 2;
    const start = Math.min(width - 2 - w, Math.max(2, wanted));
    if (placed.some(([a, b]) => start < b + 8 && start + w > a - 8)) return;
    placed.push([start, start + w]);
    /* A dark backing, so a name over a bright disc still reads. */
    ctx.fillStyle = "rgb(8 8 11 / 0.7)";
    ctx.fillRect(start - 3, height - 16, w + 6, 14);
    ctx.textAlign = "left";
    ctx.fillStyle = SCENE_MUTED;
    ctx.fillText(upper, start, height - 14);
  };
  const { star, source, gas, airBand, slit } = g;
  if (kind === "star") {
    label(labels.source, Math.max(30, star.x + star.r * 0.75));
    label(labels.gas, star.x + star.r * 1.04 + 8, "left");
  } else {
    label(labels.source, source.x);
    label(labels.gas, gas.x);
  }
  if (labels.air !== null) label(labels.air, airBand.x);
  label(labels.spectrograph, Math.min(width - 50, slit.x + 10));
}

/**
 * The still scene: source, beam, gas, Earth's air, spectrograph and the fan of colours toward
 * the ribbon, drawn once per change into its own layer (the running photons only stamp it).
 * Returns the geometry it was laid out on.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  font: string,
  inputs: SceneInputs,
) {
  const { kind, glowing, glow, starColor, teff, lampColor, range, labels, gamut } = inputs;
  const g = layout(kind, width, height);
  const { midY, star, source, gas, airBand, slit, grating } = g;
  ctx.clearRect(0, 0, width, height);
  drawFan(ctx, grating, width, height, range, gamut);
  if (kind === "star") drawBackgroundStars(ctx, width, height);
  if (labels.air !== null) drawAir(ctx, airBand, midY, height);
  const beamStart = kind === "slab" && glowing ? gas.x : source.x;
  const tint = (kind === "star"
    ? starColor
    : kind === "slab" && glowing
      ? glow?.rgb
      : lampColor) ?? [1, 1, 1];
  drawBeam(ctx, beamStart, slit, midY, tint, gamut);
  if (kind === "star" && starColor && teff) drawStar(ctx, star, starColor, teff, gamut);
  else if (kind === "slab") {
    drawLamp(ctx, source, lampColor, height, gamut);
    drawCell(ctx, gas, midY, height, glow, gamut);
  }
  drawSpectrograph(ctx, slit, grating, midY);
  drawLabels(ctx, g, kind, labels, width, height, font);
  return g;
}
