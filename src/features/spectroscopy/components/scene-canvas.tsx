"use client";

import { useEffect, useMemo, useRef } from "react";

import { prefersReducedMotion } from "@horizon/toolkit/environment";
import {
  blackbodyColor,
  cieObserver,
  displayColor,
  planckRadiance,
  wavelengthColor,
  type Rgb,
} from "@horizon/toolkit/science";

import { absorbedWidth, slabProfiles, type Observation } from "../lib/model/spectrum";
import { BAND_HEADS } from "../lib/model/telluric";
import { canvasScale } from "../lib/render";
import { useSpectroscopy } from "../lib/store";

/** What the scene needs to say about itself, already translated. */
export type SceneLabels = {
  source: string;
  gas: string;
  air: string | null;
  spectrograph: string;
};

type Photon = {
  nm: number;
  rgb: Rgb;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds left before it fades out. */
  life: number;
  /** Re-emitted by the gas in a new direction. */
  scattered: boolean;
  /** Absorption already decided for the gas and the air. */
  passedGas: boolean;
  passedAir: boolean;
};

/** The light a slab of gas gives off on its own: its colour and how bright, for the flame's glow. */
function glowOf(obs: Observation): { rgb: Rgb; level: number } | null {
  if (obs.kind !== "slab") return null;
  const lines = slabProfiles(obs);
  if (lines.length === 0) return null;
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (const { line, profile } of lines) {
    const power = planckRadiance(line.wavelength, obs.gas.temperature) * absorbedWidth(profile);
    const [x, y, z] = cieObserver(line.wavelength);
    X += power * x;
    Y += power * y;
    Z += power * z;
  }
  if (!(Y > 0) && !(X > 0)) return null;
  /* A dim flame still shows; a bright one saturates. */
  const reference = planckRadiance(555, obs.gas.temperature) * 0.05;
  return {
    rgb: displayColor([X, Y, Z]),
    level: Math.min(1, 0.25 + Math.log10(1 + (X + Y + Z) / reference) / 3),
  };
}

/** The scene stays dark in both themes, so it keeps the dark theme's gold and muted text. */
const SCENE_GOLD = "rgb(226 192 122 / 0.9)";
const SCENE_MUTED = "rgb(178 178 174 / 0.8)";

const css = ([r, g, b]: Rgb, alpha = 1) =>
  `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${alpha})`;

/** Everything a frame draws from, refreshed on every render and read by the running loop. */
type Inputs = {
  kind: Observation["kind"];
  glowing: boolean;
  glow: { rgb: Rgb; level: number } | null;
  starColor: Rgb | null;
  /** K; null on the bench. */
  teff: number | null;
  lampColor: Rgb | null;
  strong: readonly { centre: number; tau: number }[];
  range: readonly [number, number];
  labels: SceneLabels;
};

/** Whether two inputs draw the same still scene (the photons' lines aside). */
const sameScene = (a: Inputs, b: Inputs) =>
  a.kind === b.kind &&
  a.glowing === b.glowing &&
  a.glow === b.glow &&
  a.starColor === b.starColor &&
  a.teff === b.teff &&
  a.lampColor === b.lampColor &&
  a.range === b.range &&
  a.labels === b.labels;

type Geometry = {
  midY: number;
  star: { x: number; y: number; r: number };
  source: { x: number; y: number };
  gas: { x: number; w: number };
  airBand: { x: number; w: number };
  slit: { x: number; y: number };
  grating: { x: number; y: number };
};

function layout(kind: Inputs["kind"], width: number, height: number): Geometry {
  const midY = height * 0.5;
  const star = { x: -height * 0.55, y: midY, r: Math.max(height * 0.95, 60) };
  const source = kind === "slab" ? { x: width * 0.1, y: midY } : { x: star.x + star.r, y: midY };
  const gas =
    kind === "slab"
      ? { x: width * 0.36, w: Math.max(18, width * 0.06) }
      : { x: star.x + star.r * 1.04, w: Math.max(6, star.r * 0.05) };
  const slit = { x: width * 0.84, y: midY };
  return {
    midY,
    star,
    source,
    gas,
    airBand: { x: width * 0.6, w: Math.max(10, width * 0.035) },
    slit,
    grating: { x: slit.x + 22, y: midY },
  };
}

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
  let seed = 7;
  const random = () => (seed = (seed * 16_807) % 2_147_483_647) / 2_147_483_647;
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
function drawStar(ctx: CanvasRenderingContext2D, star: Geometry["star"], rgb: Rgb, teff: number) {
  const u = limbCoefficient(teff);
  const disc = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r);
  for (const s of [0, 0.4, 0.6, 0.75, 0.85, 0.92, 0.96, 0.985, 1]) {
    const mu = Math.sqrt(1 - s * s);
    const level = 1 - u * (1 - mu);
    /* The limb darkens most in the blue, so it also reddens a little. */
    disc.addColorStop(
      s,
      css([
        rgb[0] * level,
        rgb[1] * level * (0.96 + 0.04 * mu),
        rgb[2] * level * (0.88 + 0.12 * mu),
      ]),
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
  halo.addColorStop(0, css(rgb, 0.2));
  halo.addColorStop(0.4, css(rgb, 0.06));
  halo.addColorStop(1, css(rgb, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(star.x, star.y, star.r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  /* Its atmosphere: the thin, cooler shell the lines form in, a veil just above the limb. */
  const shell = ctx.createRadialGradient(star.x, star.y, star.r, star.x, star.y, star.r * 1.05);
  shell.addColorStop(0, css(rgb, 0.16));
  shell.addColorStop(1, css(rgb, 0));
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
) {
  if (rgb) {
    const reach = height * 0.36;
    const light = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, reach);
    light.addColorStop(0, css(rgb, 0.95));
    light.addColorStop(0.12, css(rgb, 0.6));
    light.addColorStop(0.4, css(rgb, 0.14));
    light.addColorStop(1, css(rgb, 0));
    ctx.fillStyle = light;
    ctx.fillRect(at.x - reach, at.y - reach, reach * 2, reach * 2);
  }
  ctx.strokeStyle = rgb ? "rgb(255 255 255 / 0.4)" : "rgb(255 255 255 / 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(at.x, at.y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgb ? css([1, 1, 1], 0.9) : "rgb(255 255 255 / 0.3)";
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
  glow: Inputs["glow"],
) {
  const top = midY - height * 0.3;
  const h = height * 0.6;
  if (glow) {
    const cell = ctx.createRadialGradient(gas.x, midY, 0, gas.x, midY, h * 0.75);
    cell.addColorStop(0, css(glow.rgb, 0.6 * glow.level));
    cell.addColorStop(0.5, css(glow.rgb, 0.18 * glow.level));
    cell.addColorStop(1, css(glow.rgb, 0));
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
 * The still scene: source, beam, gas, Earth's air, spectrograph and the fan of colours toward
 * the ribbon, drawn once per change into its own layer (the running photons only stamp it).
 */
function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  font: string,
  inputs: Inputs,
) {
  const { kind, glowing, glow, starColor, teff, lampColor, range, labels } = inputs;
  const g = layout(kind, width, height);
  const { midY, star, source, gas, airBand, slit, grating } = g;
  ctx.clearRect(0, 0, width, height);

  /* The fan of colours from the grating to the ribbon, the window's wavelengths left to right.
     Drawn first, then dimmed with distance from the grating (nothing else is on the layer yet),
     so it reads as light spreading out rather than a wedge of paint. */
  const [from, to] = range;
  const slices = 72;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < slices; i++) {
    /* As bright as the eye finds each colour (CIE ȳ), so the far red and violet stay dim. */
    const nm = from + ((to - from) * (i + 0.5)) / slices;
    ctx.fillStyle = css(wavelengthColor(nm), 0.03 + 0.14 * cieObserver(nm)[1]);
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

  /* Under the sky, a few faint background stars, the same ones every time; not on the bench. */
  let seed = 11;
  const random = () => (seed = (seed * 16_807) % 2_147_483_647) / 2_147_483_647;
  const stars = kind === "star" ? Math.round((width * height) / 2600) : 0;
  for (let i = 0; i < stars; i++) {
    const x = random() * width;
    const y = random() * height;
    const bright = random();
    ctx.fillStyle = `rgb(220 225 240 / ${(0.12 + 0.4 * bright ** 3).toFixed(3)})`;
    ctx.fillRect(x, y, bright > 0.92 ? 1.4 : 0.9, bright > 0.92 ? 1.4 : 0.9);
  }

  /* Earth's air: a soft column of blue haze the light crosses on its way down to us. */
  if (labels.air !== null) {
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

  /* The beam: a soft band of the source's light with a crisp core, fading toward the slit. */
  const beamStart = kind === "slab" && glowing ? gas.x : source.x;
  const tint = (kind === "star"
    ? starColor
    : kind === "slab" && glowing
      ? glow?.rgb
      : lampColor) ?? [1, 1, 1];
  for (const [half, alpha] of [
    [7, 0.05],
    [3, 0.08],
    [0.6, 0.3],
  ] as const) {
    const beam = ctx.createLinearGradient(beamStart, 0, slit.x, 0);
    beam.addColorStop(0, css(tint, alpha));
    beam.addColorStop(1, css(tint, alpha * 0.45));
    ctx.fillStyle = beam;
    ctx.fillRect(beamStart, midY - half, slit.x - beamStart, half * 2);
  }

  if (kind === "star" && starColor && teff) drawStar(ctx, star, starColor, teff);
  else if (kind === "slab") {
    drawLamp(ctx, source, lampColor, height);
    drawCell(ctx, gas, midY, height, glow);
  }

  /* The spectrograph: slit jaws, then a ruled grating in gold that spreads the light. */
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

  /* Names along the foot, kept inside the canvas and apart: one that would touch a name
     already placed is left out (a narrow phone has room for fewer). */
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
  if (kind === "star") {
    label(labels.source, Math.max(30, star.x + star.r * 0.75));
    label(labels.gas, star.x + star.r * 1.04 + 8, "left");
  } else {
    label(labels.source, source.x);
    label(labels.gas, gas.x);
  }
  if (labels.air !== null) label(labels.air, airBand.x);
  label(labels.spectrograph, Math.min(width - 50, slit.x + 10));
  return g;
}

/** The scene at most this often while photons fly: smooth enough, and half a 60 Hz budget. */
const FRAME_MS = 1000 / 30;

/**
 * The bench or the sky above the spectrum: where the light starts (a star's limb in its true
 * colour, or a lamp), the gas it crosses, Earth's air, and the spectrograph that spreads it
 * into the ribbon below. Optional photons sketch what happens: most cross, those at a line's
 * wavelength are absorbed and sent off in other directions. Schematic, and still under reduced
 * motion or when switched off.
 *
 * Kind to batteries: the still scene is drawn into its own layer only when it changes; while
 * photons fly, a frame (at most 30 a second) stamps that layer and draws them, and nothing
 * runs while the canvas is out of sight or the page hidden.
 */
export function SceneCanvas({
  obs,
  lines,
  range,
  labels,
  photons,
  teff,
}: {
  obs: Observation;
  /** Line centres and their optical depths, for which photons the gas takes. */
  lines: readonly { centre: number; tau: number }[];
  range: readonly [number, number];
  labels: SceneLabels;
  photons: boolean;
  /** The star's effective temperature, for its colour; null on the bench. */
  teff: number | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const glow = useMemo(() => glowOf(obs), [obs]);
  const lamp = obs.kind === "slab" ? obs.background : null;
  const starColor = useMemo(() => (teff ? blackbodyColor(teff) : null), [teff]);
  const lampColor = useMemo(() => (lamp ? blackbodyColor(lamp) : null), [lamp]);
  const strong = useMemo(
    () =>
      lines.filter((l) => l.tau > 0.3 && l.centre >= range[0] && l.centre <= range[1]).slice(0, 24),
    [lines, range],
  );
  const inputs: Inputs = {
    kind: obs.kind,
    glowing: obs.kind === "slab" && obs.background === null,
    glow,
    starColor,
    teff,
    lampColor,
    strong,
    range,
    labels,
  };
  const latest = useRef(inputs);
  /** Brings the still layer up to date after a render; set by the drawing effect. */
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => {
    latest.current = inputs;
    refresh.current?.();
  });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    const layer = document.createElement("canvas");
    const back = layer.getContext("2d");
    if (!el || !ctx || !back) return;
    let width = 0;
    let height = 0;
    let scale = 1;
    const font = getComputedStyle(el).getPropertyValue("--font-mono") || "monospace";
    let drawn: Inputs | null = null;
    let geometry = layout(latest.current.kind, 0, 0);
    /** The still scene into its layer, when it or the canvas changed. */
    const paint = (force = false) => {
      if (!force && drawn && sameScene(drawn, latest.current)) return false;
      drawn = latest.current;
      back.setTransform(scale, 0, 0, scale, 0, 0);
      geometry = drawScene(back, width, height, font, drawn);
      return true;
    };
    const stamp = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      /* A collapsed canvas (a phone held sideways) has nothing to stamp, and drawImage would throw. */
      if (layer.width > 0 && layer.height > 0) ctx.drawImage(layer, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const resize = () => {
      const { quality, antialias } = useSpectroscopy.getState();
      scale = canvasScale(window.devicePixelRatio || 1, quality, antialias);
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = layer.width = Math.round(width * scale);
      el.height = layer.height = Math.round(height * scale);
      paint(true);
      stamp();
    };
    resize();

    const animate = photons && !prefersReducedMotion();
    let visible = true;
    let frame = 0;
    const flock: Photon[] = [];
    let last = 0;
    let carry = 0;

    const observer = new ResizeObserver(resize);
    observer.observe(el);
    /* A new quality or anti-aliasing redraws at its scale, like a resize. */
    const unsubscribe = useSpectroscopy.subscribe((s, before) => {
      if (s.quality !== before.quality || s.antialias !== before.antialias) resize();
    });

    if (!animate) {
      refresh.current = () => {
        if (paint()) stamp();
      };
      return () => {
        refresh.current = null;
        observer.disconnect();
        unsubscribe();
      };
    }

    /* Schematic photons: most cross; at a line's wavelength the gas takes them and sends them
       off in other directions; in the oxygen bands the air takes some too. */
    const inBand = (nm: number) =>
      (nm >= BAND_HEADS.A && nm <= BAND_HEADS.A + 8) ||
      (nm >= BAND_HEADS.B && nm <= BAND_HEADS.B + 4);
    const spawn = (inputs: Inputs) => {
      const [from, to] = inputs.range;
      const { strong: lines, glowing } = inputs;
      const nm =
        lines.length && Math.random() < (glowing ? 1 : 0.35)
          ? lines[Math.floor(Math.random() * lines.length)]!.centre
          : from + Math.random() * (to - from);
      const speed = Math.max(80, width * 0.22);
      const { source, gas, midY } = geometry;
      const angle = glowing
        ? Math.random() < 0.5
          ? (Math.random() - 0.5) * 0.3
          : Math.random() * Math.PI * 2
        : (Math.random() - 0.5) * 0.02;
      flock.push({
        nm,
        rgb: wavelengthColor(nm),
        x: glowing ? gas.x : source.x,
        y: midY + (Math.random() - 0.5) * (glowing ? height * 0.4 : 6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 6,
        scattered: false,
        passedGas: glowing,
        passedAir: false,
      });
    };
    const tauAt = (inputs: Inputs, nm: number) => {
      const tolerance = Math.max(0.05, (inputs.range[1] - inputs.range[0]) / 400);
      let tau = 0;
      for (const l of inputs.strong) if (Math.abs(l.centre - nm) < tolerance) tau += l.tau;
      return tau;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const inputs = latest.current;
      paint();
      stamp();
      carry += dt * 14;
      while (carry > 1 && flock.length < 48) {
        spawn(inputs);
        carry -= 1;
      }
      const { gas, airBand, slit } = geometry;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = flock.length - 1; i >= 0; i--) {
        const p = flock[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (!p.passedGas && p.x >= gas.x) {
          p.passedGas = true;
          if (Math.random() < 1 - Math.exp(-tauAt(inputs, p.nm))) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.scattered = true;
            p.life = Math.min(p.life, 1.2);
          }
        }
        if (inputs.labels.air !== null && !p.passedAir && !p.scattered && p.x >= airBand.x) {
          p.passedAir = true;
          if (inBand(p.nm) && Math.random() < 0.7) p.life = 0;
        }
        if (!p.scattered && p.x >= slit.x) p.life = 0;
        if (p.life <= 0 || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
          flock.splice(i, 1);
          continue;
        }
        /* A short streak with a bright head: its motion reads even at 30 frames a second. */
        const alpha = Math.min(1, p.life / (p.scattered ? 1.2 : 0.4));
        const tail = 0.05;
        ctx.strokeStyle = css(p.rgb, 0.35 * alpha);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * tail, p.y - p.vy * tail);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = css(p.rgb, 0.18 * alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(p.rgb, 0.95 * alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };
    const start = () => {
      if (frame || !visible || document.hidden) return;
      last = performance.now() - FRAME_MS;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    /* Out of sight (scrolled away, a sheet over it, immersive off) or a hidden page: no frames. */
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    });
    sight.observe(el);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    refresh.current = null;
    start();
    return () => {
      stop();
      sight.disconnect();
      observer.disconnect();
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [photons]);

  return <canvas ref={canvas} aria-hidden className="spectroscopy-scene block h-full w-full" />;
}
