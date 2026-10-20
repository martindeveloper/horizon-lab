import { cssColor, wavelengthColor, type Gamut, type Rgb } from "@horizon/toolkit/science";

import { BAND_HEADS } from "../model/telluric";
import type { Geometry } from "./layout";

/** What the photons need to know of the scene: where light starts and what takes it. */
export type FlockScene = {
  /** The window's wavelengths, nm. */
  range: readonly [number, number];
  /** Line centres and their optical depths, for which photons the gas takes. */
  strong: readonly { centre: number; tau: number }[];
  /** The gas shines on its own: photons start in it, in every direction. */
  glowing: boolean;
  /** Earth's air is in the beam. */
  air: boolean;
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

/** Photons spawned per second, and the most in flight at once. */
const RATE = 14;
const MOST = 48;

const inBand = (nm: number) =>
  (nm >= BAND_HEADS.A && nm <= BAND_HEADS.A + 8) || (nm >= BAND_HEADS.B && nm <= BAND_HEADS.B + 4);

/** The gas's optical depth at a wavelength: the strong lines within a pixel or so of it. */
function tauAt(scene: FlockScene, nm: number) {
  const tolerance = Math.max(0.05, (scene.range[1] - scene.range[0]) / 400);
  let tau = 0;
  for (const l of scene.strong) if (Math.abs(l.centre - nm) < tolerance) tau += l.tau;
  return tau;
}

/**
 * Schematic photons: most cross; at a line's wavelength the gas takes them and sends them off
 * in other directions; in the oxygen bands the air takes some too. `step` moves and spawns
 * them, `draw` paints them as short streaks with a bright head.
 */
export function createFlock(gamut: Gamut) {
  const flock: Photon[] = [];
  let carry = 0;

  const spawn = (scene: FlockScene, g: Geometry, width: number, height: number) => {
    const [from, to] = scene.range;
    const { strong: lines, glowing } = scene;
    const nm =
      lines.length && Math.random() < (glowing ? 1 : 0.35)
        ? lines[Math.floor(Math.random() * lines.length)]!.centre
        : from + Math.random() * (to - from);
    const speed = Math.max(80, width * 0.22);
    const { source, gas, midY } = g;
    const angle = glowing
      ? Math.random() < 0.5
        ? (Math.random() - 0.5) * 0.3
        : Math.random() * Math.PI * 2
      : (Math.random() - 0.5) * 0.02;
    flock.push({
      nm,
      rgb: wavelengthColor(nm, gamut),
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

  return {
    /** Advances every photon by `dt` seconds through the scene laid out as `g`. */
    step(dt: number, scene: FlockScene, g: Geometry, width: number, height: number) {
      carry += dt * RATE;
      while (carry > 1 && flock.length < MOST) {
        spawn(scene, g, width, height);
        carry -= 1;
      }
      const { gas, airBand, slit } = g;
      for (let i = flock.length - 1; i >= 0; i--) {
        const p = flock[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (!p.passedGas && p.x >= gas.x) {
          p.passedGas = true;
          if (Math.random() < 1 - Math.exp(-tauAt(scene, p.nm))) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.scattered = true;
            p.life = Math.min(p.life, 1.2);
          }
        }
        if (scene.air && !p.passedAir && !p.scattered && p.x >= airBand.x) {
          p.passedAir = true;
          if (inBand(p.nm) && Math.random() < 0.7) p.life = 0;
        }
        if (!p.scattered && p.x >= slit.x) p.life = 0;
        if (p.life <= 0 || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20)
          flock.splice(i, 1);
      }
    },
    /** Paints the photons, additively: a short streak with a bright head, fading as they go. */
    draw(ctx: CanvasRenderingContext2D) {
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = flock.length - 1; i >= 0; i--) {
        const p = flock[i]!;
        /* A short streak with a bright head: its motion reads even at 30 frames a second. */
        const alpha = Math.min(1, p.life / (p.scattered ? 1.2 : 0.4));
        const tail = 0.05;
        ctx.strokeStyle = cssColor(p.rgb, 0.35 * alpha, gamut);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * tail, p.y - p.vy * tail);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = cssColor(p.rgb, 0.18 * alpha, gamut);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cssColor(p.rgb, 0.95 * alpha, gamut);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

export type Flock = ReturnType<typeof createFlock>;
