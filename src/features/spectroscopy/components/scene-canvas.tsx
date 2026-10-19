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
  lampColor: Rgb | null;
  strong: readonly { centre: number; tau: number }[];
  range: readonly [number, number];
  labels: SceneLabels;
};

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

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  font: string,
  inputs: Inputs,
) {
  const { kind, glowing, glow, starColor, lampColor, range, labels } = inputs;
  const g = layout(kind, width, height);
  const { midY, star, source, gas, airBand, slit, grating } = g;
  ctx.clearRect(0, 0, width, height);
  ctx.font = `10px ${font}`;
  ctx.textBaseline = "top";
  /* Names along the foot, kept inside the canvas and apart: one that would touch a name
     already placed is left out (a narrow phone has room for fewer). */
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

  /* The beam */
  const beamStart = kind === "slab" && glowing ? gas.x : source.x;
  const beam = ctx.createLinearGradient(beamStart, 0, slit.x, 0);
  beam.addColorStop(0, "rgb(255 255 255 / 0.28)");
  beam.addColorStop(1, "rgb(255 255 255 / 0.12)");
  ctx.strokeStyle = beam;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(beamStart, midY);
  ctx.lineTo(slit.x, midY);
  ctx.stroke();

  if (kind === "star" && starColor) {
    /* The star's limb, darker toward the edge as limb darkening makes it, in its own colour. */
    const disc = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r);
    disc.addColorStop(0, css(starColor, 1));
    disc.addColorStop(0.8, css(starColor, 0.92));
    disc.addColorStop(0.97, css(starColor, 0.62));
    disc.addColorStop(1, css(starColor, 0.4));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
    const halo = ctx.createRadialGradient(star.x, star.y, star.r, star.x, star.y, star.r * 1.35);
    halo.addColorStop(0, css(starColor, 0.22));
    halo.addColorStop(1, css(starColor, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r * 1.35, 0, Math.PI * 2);
    ctx.fill();
    /* Its atmosphere: the thin, cooler gas the lines form in. */
    ctx.strokeStyle = "rgb(255 255 255 / 0.18)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r * 1.04, -0.6, 0.6);
    ctx.stroke();
    ctx.setLineDash([]);
    label(labels.source, Math.max(30, star.x + star.r * 0.75));
    label(labels.gas, star.x + star.r * 1.04 + 8, "left");
  } else if (kind === "slab") {
    /* The lamp, glowing at its temperature, or dark when off. */
    if (lampColor) {
      const lamp = ctx.createRadialGradient(
        source.x,
        source.y,
        0,
        source.x,
        source.y,
        height * 0.32,
      );
      lamp.addColorStop(0, css(lampColor, 1));
      lamp.addColorStop(0.18, css(lampColor, 0.75));
      lamp.addColorStop(1, css(lampColor, 0));
      ctx.fillStyle = lamp;
      ctx.beginPath();
      ctx.arc(source.x, source.y, height * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgb(255 255 255 / 0.25)";
      ctx.beginPath();
      ctx.arc(source.x, source.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    label(labels.source, source.x);
    /* The gas: a cell glowing in the colour of its own light. */
    const top = midY - height * 0.3;
    const h = height * 0.6;
    ctx.strokeStyle = "rgb(255 255 255 / 0.22)";
    ctx.strokeRect(gas.x - gas.w / 2, top, gas.w, h);
    if (glow) {
      const cell = ctx.createRadialGradient(gas.x, midY, 0, gas.x, midY, h * 0.7);
      cell.addColorStop(0, css(glow.rgb, 0.55 * glow.level));
      cell.addColorStop(1, css(glow.rgb, 0));
      ctx.fillStyle = cell;
      ctx.fillRect(gas.x - h * 0.7, midY - h * 0.7, h * 1.4, h * 1.4);
    }
    label(labels.gas, gas.x);
  }

  if (labels.air !== null) {
    const band = ctx.createLinearGradient(airBand.x - airBand.w, 0, airBand.x + airBand.w, 0);
    band.addColorStop(0, "rgb(130 170 255 / 0)");
    band.addColorStop(0.5, "rgb(130 170 255 / 0.12)");
    band.addColorStop(1, "rgb(130 170 255 / 0)");
    ctx.fillStyle = band;
    ctx.fillRect(airBand.x - airBand.w, 0, airBand.w * 2, height - 18);
    label(labels.air, airBand.x);
  }

  /* The spectrograph: a slit, then a grating that spreads the light into the ribbon below. */
  ctx.strokeStyle = "rgb(255 255 255 / 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(slit.x, midY - 10);
  ctx.lineTo(slit.x, midY - 2);
  ctx.moveTo(slit.x, midY + 2);
  ctx.lineTo(slit.x, midY + 10);
  ctx.stroke();
  ctx.save();
  ctx.translate(grating.x, grating.y);
  ctx.rotate(-0.5);
  ctx.fillStyle = SCENE_GOLD;
  ctx.fillRect(-1.5, -9, 3, 18);
  ctx.restore();
  ctx.lineWidth = 1;
  label(labels.spectrograph, Math.min(width - 50, slit.x + 10));
  /* The fan of colours toward the ribbon, the window's wavelengths left to right. */
  const [from, to] = range;
  for (let i = 0; i <= 48; i++) {
    ctx.strokeStyle = css(wavelengthColor(from + ((to - from) * i) / 48), 0.07);
    ctx.beginPath();
    ctx.moveTo(grating.x, grating.y);
    ctx.lineTo((width * i) / 48, height);
    ctx.stroke();
  }
  return g;
}

/**
 * The bench or the sky above the spectrum: where the light starts (a star's limb in its true
 * colour, or a lamp), the gas it crosses, Earth's air, and the spectrograph that spreads it
 * into the ribbon below. Optional photons sketch what happens: most cross, those at a line's
 * wavelength are absorbed and sent off in other directions. Schematic, and still under reduced
 * motion or when switched off.
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
    lampColor,
    strong,
    range,
    labels,
  };
  const latest = useRef(inputs);
  /** Redraws the still scene; set while no animation runs. */
  const redraw = useRef<(() => void) | null>(null);
  useEffect(() => {
    latest.current = inputs;
    redraw.current?.();
  });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let width = 0;
    let height = 0;
    const font = getComputedStyle(el).getPropertyValue("--font-mono") || "monospace";
    const resize = () => {
      const scale = Math.min(2, window.devicePixelRatio || 1);
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = Math.round(width * scale);
      el.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const still = () => draw(ctx, width, height, font, latest.current);
    resize();
    let geometry = still();
    const observer = new ResizeObserver(() => {
      resize();
      geometry = still();
    });
    observer.observe(el);
    if (!photons || prefersReducedMotion()) {
      redraw.current = () => {
        geometry = still();
      };
      return () => {
        redraw.current = null;
        observer.disconnect();
      };
    }

    /* Schematic photons: most cross; at a line's wavelength the gas takes them and sends them
       off in other directions; in the oxygen bands the air takes some too. */
    const flock: Photon[] = [];
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

    let last = performance.now();
    let carry = 0;
    let frame = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        const inputs = latest.current;
        carry += dt * 14;
        while (carry > 1 && flock.length < 48) {
          spawn(inputs);
          carry -= 1;
        }
        geometry = draw(ctx, width, height, font, inputs);
        const { gas, airBand, slit } = geometry;
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
          const alpha = Math.min(1, p.life / (p.scattered ? 1.2 : 0.4));
          ctx.fillStyle = css(p.rgb, 0.9 * alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [photons]);

  return <canvas ref={canvas} aria-hidden className="spectroscopy-scene block h-full w-full" />;
}
