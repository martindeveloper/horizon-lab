/**
 * The cockpit over the scene, drawn by the engine in DOM as the labels are:
 *
 * - the canopy: the glass, the drive's own frame lit from the Sun's side, the dash;
 * - the boresight, with ladders of the ship's speed and closing speed about it;
 * - the aim's marker with its range, and by hand the prograde and retrograde markers;
 * - the scanner between the console's panels: the bodies about the ship on a log scale;
 * - the drive's glow, the flip's sweep, the alarm after a crash;
 * - the HUD's inertia (model/sway.ts): the displays (`[data-voyage-hud]`) trail a turn and
 *   press back under thrust; the cockpit moves less than half as far.
 *
 * The thrust also moves the throttle lever's gauge (`.voyage-push`). In orbit only the canopy
 * and the scanner show; on autopilot the aim too. Hidden instruments cost no work, and the
 * scanner redraws only when a blip moves.
 */
import { Quaternion, Vector3, type PerspectiveCamera } from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";
import type { DistanceText, Vec3d, Viewport } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import type { AnchorId } from "../model/anchors";
import { driveLit, type FlightPhase } from "../model/autopilot";
import {
  blipOnScanner,
  markOnScreen,
  speedFigure,
  type Blip,
  type ScreenMark,
} from "../model/instruments";
import { C_KM_S, type DriveId } from "../model/parameters";
import type { ShipMode } from "../model/ship";
import { createSway, stepSway, swaySettled } from "../model/sway";

/** A body the scanner shows: its heliocentric position, km, as drawn this frame. */
export type ScannerBody = { id: string; pos: Readonly<Vec3d> };

export type CockpitFrame = {
  /** Real seconds since the last frame. */
  dt: number;
  /** The drive, and so the ship whose cockpit this is. */
  drive: DriveId;
  /** The ship lies wrecked on a surface. */
  crashed: boolean;
  /** The ship's speed, km/s, and how fast it closes on its aim (negative receding). */
  speed: number;
  closing: number;
  /** The aim's distance from the ship, km. */
  range: number;
  mode: ShipMode;
  flying: boolean;
  /** What the autopilot is doing, or null. */
  phase: FlightPhase | null;
  show: { canopy: boolean; instruments: boolean; feel: boolean };
  /** How far the autopilot's drive has spooled up while it aligns, 0…1 (the ship's feel). */
  spool: number;
  /** The ship's heliocentric position, km. */
  ship: Readonly<Vec3d>;
  /** The ship's velocity relative to the body it is near, km/s. */
  v: Readonly<Vec3d>;
  /** The anchor the ship is at or heading for, and its offset from the ship, km. */
  aimId: AnchorId;
  aim: Readonly<Vec3d>;
  /** The pilot's hands: −1…1 along the ship's axes, and the boost and the brake, 0…1. */
  axes: { thrust: number; strafe: number; lift: number; boost: number; brake: number };
};

/** How far in from the edge an off-screen marker sits, as a share of the half-size. */
const EDGE = 0.92;
/** The scanner's drawing, CSS px: its size, the disc's squash seen at a slant, the stick's rise. */
const SCANNER_W = 240;
const SCANNER_H = 150;
const SCANNER_SQUASH = 0.4;
const SCANNER_LIFT = 0.55;
/** The HUD's trail: px per radian a second of turn, px per unit of thrust, and its reach. */
const TURN_PX = 6;
const THRUST_PX = 7;
const REACH_PX = 16;
/** How far a full burn presses the displays back, and braking floats them forward, as scale. */
const PRESS = 0.014;
/** The drive's tremble at full thrust, px. */
const TREMBLE_PX = 0.45;
/** The cockpit's own share of the HUD's movement. */
const COCKPIT_SHARE = 0.4;
/** A frame's turn past this (cos of half of 0.3 rad) is a jump, not a turn. */
const JUMP_COS = Math.cos(0.15);
/** The range tag and the ladders' figures are rewritten no more often than this, ms. */
const TAG_MS = 100;
/** With the ship's feel on, the thrust shown builds over about three of these, seconds. */
const SPOOL_TAU_S = 0.05;

/**
 * Each ship's canopy frame, as strokes that keep their width however the stage is sized:
 * Voyager's capsule posts and brace, the sail's shroud lines, the torch ship's two struts.
 * The metal is drawn three times (a shadow, a lit copy, the body), the copies nudged from and
 * towards the Sun, so the bars read as rounded things in the light.
 */
const FRAMES: Readonly<Record<DriveId, string>> = {
  voyager: `<path class="voyage-strut voyage-strut-post" d="M150,-6V606 M850,-6V606 M-6,52H1006"/>`,
  sail: `<path class="voyage-shroud" d="M-6,606L300,-6 M-6,330L420,-6 M1006,606L700,-6 M1006,330L580,-6"/>`,
  torch: `<path class="voyage-strut" d="M-6,-6L214,606 M1006,-6L786,606"/>`,
};
const frameSvg = (ship: DriveId) => {
  const svg = `<svg viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">${FRAMES[ship]}</svg>`;
  const layer = (light: string) =>
    `<div class="voyage-frame-layer" data-light="${light}">${svg}</div>`;
  return ship === "sail" ? layer("body") : layer("shade") + layer("lit") + layer("body");
};
/** How far the lit and shadow copies sit from the body, CSS px, with the Sun full to one side. */
const BEVEL_PX = 2.5;
/** Seconds the light takes to swing round the struts as the Sun moves across the view. */
const BEVEL_EASE_S = 0.12;

/** The ladders' range, km/s: a slow drift to light speed, in decades. */
const LADDER_SLOWEST = 0.1;
const LADDER_DECADES = Math.log10(C_KM_S / LADDER_SLOWEST);
/** The ladders' height, CSS px (styles.css draws them so). */
const LADDER_PX = 120;

/**
 * Each ship's dash along the foot of the view, the same dark metal as its frame: a wing to each
 * edge (drawn for the left, stretched, mirrored for the right) and a pedestal under the scanner
 * that keeps its shape. Each part shows its face, its top seen from above, the lit lip between
 * them with a shadow under it, and the far edge. The torch ship's is faceted, with mounts where
 * its struts land; Voyager's a capsule's stepped panel between its posts, with lamps; the
 * sail's a hairline sill and a light cradle. The displays float over it; the scanner sits on
 * the pedestal, on the house's gold horizon (styles.css).
 */
const DASHES: Readonly<Record<DriveId, { wing: string; pod: string }>> = {
  torch: {
    wing: `<path class="dash-face" d="M0,64V40L326,32L356,27H600V64Z"/>
<path class="dash-top" d="M0,40V31L330,22L360,17H600V27H356L326,32Z"/>
<path class="dash-edge" d="M0,31L330,22L360,17H600"/>
<path class="dash-lip" d="M0,40L326,32L356,27H600"/>
<path class="dash-under" d="M0,43L326,35L356,30H600"/>
<path class="dash-mount" d="M322,64V33L332,24H352L362,30V64Z"/>
<path class="dash-seam" d="M342,30V64M486,27V64"/>`,
    pod: `<path class="dash-face" d="M0,64V27H30L56,15H296L322,27H352V64Z"/>
<path class="dash-top" d="M0,17H44L66,5H286L308,17H352V27H322L296,15H56L30,27H0Z"/>
<path class="dash-edge" d="M0,17H44L66,5H286L308,17H352"/>
<path class="dash-lip" d="M0,27H30L56,15H296L322,27H352"/>
<path class="dash-under" d="M0,30H31L57,18H295L321,30H352"/>
<path class="dash-seam" d="M56,15V64M296,15V64"/>
<circle class="dash-lamp" cx="18" cy="42" r="1.6"/><circle class="dash-lamp" data-dim cx="18" cy="50" r="1.6"/>
<circle class="dash-lamp" cx="334" cy="42" r="1.6"/><circle class="dash-lamp" data-dim cx="334" cy="50" r="1.6"/>`,
  },
  voyager: {
    wing: `<path class="dash-face" d="M0,64V38H232V24H600V64Z"/>
<path class="dash-top" d="M0,30H226V14H600V24H232V38H0Z"/>
<path class="dash-edge" d="M0,30H226V14H600"/>
<path class="dash-lip" d="M0,38H232V24H600"/>
<path class="dash-under" d="M0,41H235V27H600"/>
<path class="dash-mount" d="M218,64V22H252V64Z"/>
<path class="dash-seam" d="M420,24V64"/>
<path class="dash-grille" d="M40,46H180M40,51H180M40,56H180M300,34H380M300,39H380M300,44H380"/>`,
    pod: `<path class="dash-face" d="M0,64V24H22V12H330V24H352V64Z"/>
<path class="dash-top" d="M0,14H18V4Q18,1 21,1H331Q334,1 334,4V14H352V24H330V12H22V24H0Z"/>
<path class="dash-edge" d="M0,14H18V4Q18,1 21,1H331Q334,1 334,4V14H352"/>
<path class="dash-lip" d="M0,24H22V12H330V24H352"/>
<path class="dash-under" d="M0,27H25V15H327V27H352"/>
<path class="dash-seam" d="M22,24V64M330,24V64"/>
<circle class="dash-lamp" cx="11" cy="36" r="2"/><circle class="dash-lamp" data-dim cx="11" cy="45" r="2"/><circle class="dash-lamp" data-dim cx="11" cy="54" r="2"/>
<circle class="dash-lamp" data-dim cx="341" cy="36" r="2"/><circle class="dash-lamp" cx="341" cy="45" r="2"/><circle class="dash-lamp" data-dim cx="341" cy="54" r="2"/>`,
  },
  sail: {
    wing: `<path class="dash-face" d="M0,64V54L600,47V64Z"/>
<path class="dash-lip" d="M0,54L600,47"/>`,
    pod: `<path class="dash-face" d="M0,64V47C66,47 84,26 140,26H212C268,26 286,47 352,47V64Z"/>
<path class="dash-top" d="M40,47C92,47 104,20 146,20H206C248,20 260,47 312,47C286,47 268,26 212,26H140C84,26 66,47 40,47Z"/>
<path class="dash-lip" d="M0,47C66,47 84,26 140,26H212C268,26 286,47 352,47"/>
<path class="dash-edge" d="M40,47C92,47 104,20 146,20H206C248,20 260,47 312,47"/>`,
  },
};
const dashSvg = (ship: DriveId) => {
  const { wing, pod } = DASHES[ship];
  const part = (kind: string, width: number, body: string) =>
    `<svg class="voyage-dash-${kind}" viewBox="0 0 ${width} 64" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
  return part("wing", 600, wing) + part("pod", 352, pod) + part("wing", 600, wing);
};

const el = <T extends "span" | "div" | "canvas">(tag: T, className: string) => {
  const node = document.createElement(tag);
  node.className = className;
  return node;
};

export function createCockpit(
  scope: DisposalScope,
  host: HTMLElement,
  camera: PerspectiveCamera,
  viewport: Pick<Viewport, "width" | "height">,
  deps: {
    reduceMotion: { matches: boolean };
    distanceText: DistanceText;
    /** The bodies the scanner shows. */
    bodies: readonly ScannerBody[];
    /** The words the floating readouts print (`speedWord`, `closingWord`), and the locale. */
    words: () => Partial<Record<"speedWord" | "closingWord", string>>;
    locale: () => string;
  },
) {
  const root = el("div", "voyage-cockpit");
  root.setAttribute("aria-hidden", "true");
  root.dataset.mode = "orbit";
  const canopy = el("div", "voyage-canopy");
  const frameArt = el("div", "voyage-frame");
  frameArt.innerHTML = frameSvg("torch");
  let shipWas: DriveId = "torch";
  root.dataset.ship = shipWas;
  const bevel = { x: 0, y: 0, settled: true };
  const sun = deps.bodies.find((b) => b.id === "sun");
  const dash = el("div", "voyage-dash");
  dash.innerHTML = dashSvg("torch");
  canopy.append(frameArt, dash);
  /* The floating readouts: projected with the HUD, so they ride its whole sway. */
  const floats = el("div", "voyage-floats");
  const ladder = (name: "speed" | "closing") => {
    const rail = el("span", `voyage-ladder voyage-ladder-${name}`);
    const mark = el("span", "voyage-ladder-mark");
    const value = el("span", "voyage-ladder-value");
    const word = el("span", "voyage-ladder-word");
    mark.append(value);
    rail.append(mark, word);
    return { rail, mark, value, word };
  };
  const speedLadder = ladder("speed");
  const closingLadder = ladder("closing");
  floats.append(
    el("span", "voyage-arc voyage-arc-left"),
    el("span", "voyage-arc voyage-arc-right"),
    speedLadder.rail,
    closingLadder.rail,
  );
  const boresight = el("span", "voyage-boresight");
  const prograde = el("span", "voyage-mark voyage-prograde");
  const retrograde = el("span", "voyage-mark voyage-retrograde");
  const alarm = el("span", "voyage-alarm");
  const aim = el("span", "voyage-mark voyage-aim");
  const tag = el("span", "voyage-aim-tag");
  aim.append(tag);
  const scanner = el("canvas", "voyage-scanner");
  const burn = el("span", "voyage-burn");
  root.append(canopy, burn, alarm, boresight, floats, prograde, retrograde, aim, scanner);
  host.append(root);
  const stage = host.closest<HTMLElement>("[data-simulation]") ?? host;
  scope.defer(() => root.remove());

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  scanner.width = Math.round(SCANNER_W * dpr);
  scanner.height = Math.round(SCANNER_H * dpr);
  const ctx = scanner.getContext("2d");
  /* The scanner's inks, the scene's in both themes: gold for the rings and the aim, starlight for the rest. */
  const styles = getComputedStyle(root);
  const accent = styles.color;
  const ink = styles.getPropertyValue("--color-space-fg").trim() || accent;

  const v = new Vector3();
  const mark: ScreenMark = { x: 0, y: 0, off: false, angle: 0 };
  const blip: Blip = { r: 0, u: 0, w: 0, h: 0 };
  const placed = new WeakMap<HTMLElement, string>();
  let pushWas = "";
  let leanWas = "";
  let hudWas = "";
  let floatsWas = "";
  let speedWas = "";
  let closingWas = "";
  let speedMarkWas = "";
  let closingMarkWas = "";
  let wordsWas = "";
  let localeWas = "";
  /** Number formats by fraction digits, for the locale they were made in. */
  let numbers: Intl.NumberFormat[] = [];
  /** A speed as the ladders print it, as the dock does (`speedFigure`). */
  const speedText = (kmPerS: number) => {
    const locale = deps.locale();
    if (locale !== localeWas) {
      localeWas = locale;
      numbers = [];
    }
    const { ofC, value, digits } = speedFigure(kmPerS);
    const format = (numbers[digits] ??= new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
    }));
    return `${format.format(value)} ${ofC ? "c" : "km/s"}`;
  };
  /** Where a speed sits on a ladder, px from its top: log-spaced, the fastest at the top. */
  const rung = (kmPerS: number) => {
    const k = Math.log10(Math.max(LADDER_SLOWEST, kmPerS) / LADDER_SLOWEST) / LADDER_DECADES;
    return `translateY(${((1 - Math.min(1, k)) * LADDER_PX).toFixed(1)}px)`;
  };
  let hud: HTMLElement | null = null;
  let gauge: HTMLElement | null = null;
  /** The HUD's spring, the turn it reads (from last frame's attitude), its target. */
  const sway = createSway();
  const pose = { x: 0, y: 0, s: 1 };
  /* Starts from nowhere, so the first frame reads as a jump. */
  const before = new Quaternion(0, 0, 0, 0);
  const turn = new Quaternion();
  let settling = false;
  let shake = 0;
  /** The projected displays the overlay draws, found again whenever they remount. */
  const findHud = () => {
    if (hud?.isConnected) return hud;
    hudWas = "";
    return (hud = stage.querySelector<HTMLElement>("[data-voyage-hud]"));
  };
  /** The throttle lever's gauge of the thrust, found again whenever it remounts. */
  const findGauge = () => {
    if (gauge?.isConnected) return gauge;
    pushWas = "";
    return (gauge = stage.querySelector<HTMLElement>(".voyage-push"));
  };
  scope.defer(() => {
    if (hud) hud.style.transform = "";
    if (gauge) gauge.style.transform = "";
  });
  let tagWas = "";
  let tagAt = 0;
  let modeWas = "orbit";
  let burnWas = "";
  let flipWas = false;
  let crashWas = false;
  let feelWas = false;
  /** The thrust the gauge, the glow and the tremble show, 0…1. */
  let pushShown = 0;
  let canopyWas = true;
  let instrumentsWas = true;

  const hide = (span: HTMLElement) => {
    if (placed.get(span) === "") return;
    placed.set(span, "");
    delete span.dataset.on;
  };
  /** Moves a marker to a direction from the ship; off-screen ones sit at the edge if `edge`. */
  const place = (span: HTMLElement, dir: Readonly<Vec3d>, edge: boolean) => {
    v.set(dir[0], dir[1], dir[2]);
    if (v.lengthSq() === 0) return hide(span);
    v.applyMatrix4(camera.matrixWorldInverse);
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    markOnScreen(v.x, v.y, v.z, tanHalf, camera.aspect, EDGE, mark);
    if (mark.off && !edge) return hide(span);
    const px = ((mark.x + 1) / 2) * viewport.width;
    const py = ((1 - mark.y) / 2) * viewport.height;
    const next = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) rotate(${mark.angle.toFixed(3)}rad)`;
    if (placed.get(span) === next) return;
    placed.set(span, next);
    span.style.transform = next;
    span.dataset.on = "";
    if (mark.off) span.dataset.off = "";
    else delete span.dataset.off;
  };

  const ring = (cx: number, cy: number, r: number, alpha: number) => {
    if (!ctx) return;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * SCANNER_SQUASH, 0, 0, Math.PI * 2);
    ctx.stroke();
  };

  const cx = SCANNER_W / 2;
  const cy = SCANNER_H * 0.6;
  const R = SCANNER_W / 2 - 4;
  /* Each body's blip as last drawn, quantised to half a pixel: foot x, foot y, top y, look. */
  const blips = new Int32Array(deps.bodies.length * 4);
  const drawn = new Int32Array(blips.length).fill(-1);
  /** Where each body's blip falls this frame, and whether any moved since it was drawn. */
  const scan = (frame: CockpitFrame) => {
    const { ship } = frame;
    let moved = false;
    for (let i = 0; i < deps.bodies.length; i += 1) {
      const body = deps.bodies[i]!;
      v.set(body.pos[0] - ship[0], body.pos[1] - ship[1], body.pos[2] - ship[2]);
      v.applyMatrix4(camera.matrixWorldInverse);
      blipOnScanner(v.x, v.y, v.z, frame.range, blip);
      const sun = body.id === "sun";
      const aimed = body.id === frame.aimId;
      const look =
        blip.r >= 1 && !sun && !aimed ? 0 : (sun ? 1 : aimed ? 2 : 3) + (blip.r >= 1 ? 4 : 0);
      const fy = cy - blip.w * R * SCANNER_SQUASH;
      const j = i * 4;
      blips[j] = Math.round((cx + blip.u * R) * 2);
      blips[j + 1] = Math.round(fy * 2);
      blips[j + 2] = Math.round((fy - blip.h * R * SCANNER_LIFT) * 2);
      blips[j + 3] = look;
      for (let k = j; k < j + 4; k += 1) if (blips[k] !== drawn[k]) moved = true;
    }
    return moved;
  };

  /** The scanner: the disc, its range rings, the ship, and every body within a hundred ranges. */
  const drawScanner = () => {
    if (!ctx) return;
    drawn.set(blips);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SCANNER_W, SCANNER_H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    /* The disc, faintly filled; rings a decade apart: a tenth of the range, the range, ten times it, the rim. */
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * SCANNER_SQUASH, 0, 0, Math.PI * 2);
    ctx.fill();
    ring(cx, cy, R * 0.25, 0.22);
    ring(cx, cy, R * 0.5, 0.7);
    ring(cx, cy, R * 0.75, 0.22);
    ring(cx, cy, R, 0.45);
    /* The ship: a chevron at the centre pointing ahead; a tick on the far rim. */
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 3);
    ctx.lineTo(cx, cy - 4);
    ctx.lineTo(cx + 4, cy + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - R * SCANNER_SQUASH - 5);
    ctx.lineTo(cx, cy - R * SCANNER_SQUASH + 3);
    ctx.stroke();
    for (let j = 0; j < blips.length; j += 4) {
      const look = blips[j + 3]!;
      if (look === 0) continue;
      const fx = blips[j]! / 2;
      const fy = blips[j + 1]! / 2;
      const by = blips[j + 2]! / 2;
      const rim = look >= 4;
      const sun = look % 4 === 1;
      const aimed = look % 4 === 2;
      ctx.strokeStyle = aimed ? accent : ink;
      ctx.fillStyle = aimed ? accent : ink;
      ctx.globalAlpha = rim ? 0.35 : aimed ? 1 : 0.75;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, by);
      ctx.stroke();
      ctx.beginPath();
      if (sun) {
        ctx.arc(fx, by, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.arc(fx, by, aimed ? 2.5 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (aimed) {
        ctx.beginPath();
        ctx.arc(fx, by, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };

  const flag = (name: "canopy" | "instruments" | "flip" | "crash" | "feel", on: boolean) => {
    if (on) root.dataset[name] = "";
    else delete root.dataset[name];
  };
  flag("canopy", true);
  flag("instruments", true);
  const back: Vec3d = [0, 0, 0];

  return {
    /** The HUD is still moving: a spring settling, the drive trembling it, or the light swinging. */
    get settling() {
      return settling || !bevel.settled;
    },
    update(frame: CockpitFrame) {
      const { show, axes, range } = frame;
      if (show.canopy !== canopyWas) flag("canopy", (canopyWas = show.canopy));
      if (show.instruments !== instrumentsWas)
        flag("instruments", (instrumentsWas = show.instruments));
      if (frame.drive !== shipWas) {
        shipWas = frame.drive;
        root.dataset.ship = shipWas;
        frameArt.innerHTML = frameSvg(shipWas);
        dash.innerHTML = dashSvg(shipWas);
      }
      if (frame.crashed !== crashWas) flag("crash", (crashWas = frame.crashed));
      if (show.feel !== feelWas) flag("feel", (feelWas = show.feel));
      /*
       * The frame's light: the lit edge on the side the Sun's light comes from, as far round
       * as the Sun is to the side (nothing dead ahead or behind, where it lights the faces
       * evenly), eased so turning the ship swings the light smoothly round the metal.
       */
      if (sun) {
        v.set(sun.pos[0] - frame.ship[0], sun.pos[1] - frame.ship[1], sun.pos[2] - frame.ship[2]);
        v.applyMatrix4(camera.matrixWorldInverse);
        const len = v.length() || 1;
        const tx = (v.x / len) * BEVEL_PX;
        const ty = (-v.y / len) * BEVEL_PX;
        const k = frame.dt > 0 ? 1 - Math.exp(-frame.dt / BEVEL_EASE_S) : 1;
        const nx = bevel.x + (tx - bevel.x) * k;
        const ny = bevel.y + (ty - bevel.y) * k;
        bevel.settled = Math.abs(tx - nx) < 0.01 && Math.abs(ty - ny) < 0.01;
        if (Math.abs(nx - bevel.x) > 0.01 || Math.abs(ny - bevel.y) > 0.01 || bevel.settled) {
          bevel.x = bevel.settled ? tx : nx;
          bevel.y = bevel.settled ? ty : ny;
          frameArt.style.setProperty("--voyage-bevel-x", `${bevel.x.toFixed(2)}px`);
          frameArt.style.setProperty("--voyage-bevel-y", `${bevel.y.toFixed(2)}px`);
        }
      }
      const mode = frame.flying ? "flight" : frame.mode === "free" ? "free" : "orbit";
      if (mode !== modeWas) root.dataset.mode = modeWas = mode;
      /* The hands' thrust, or the autopilot's drive while it burns or brakes (off through the
         flip, the ship turning end over end): the gauge and the glow read it. */
      const { phase } = frame;
      const braking = phase === "brake";
      let thrust = 0;
      if (mode === "free") {
        thrust = Math.min(1, Math.hypot(axes.thrust, axes.strafe, axes.lift)) || axes.brake;
      } else if (driveLit(phase)) {
        thrust = 1;
      } else if (phase === "align") {
        thrust = frame.spool;
      }
      /* With the ship's feel on, the drive builds rather than snapping on; it always cuts at once. */
      pushShown =
        show.feel && thrust > pushShown && frame.dt > 0
          ? pushShown + (thrust - pushShown) * (1 - Math.exp(-frame.dt / SPOOL_TAU_S))
          : thrust;
      if (thrust - pushShown < 1e-3) pushShown = thrust;
      const push = pushShown;
      const level = `scaleY(${push.toFixed(3)})`;
      const lever = findGauge();
      if (lever && level !== pushWas) lever.style.transform = pushWas = level;
      const burn = push > 0 ? (braking ? "brake" : "ahead") : "";
      if (burn !== burnWas) {
        burnWas = burn;
        if (burn) root.dataset.burn = burn;
        else delete root.dataset.burn;
      }
      const flipping = phase === "flip";
      if (flipping !== flipWas) flag("flip", (flipWas = flipping));
      /*
       * The HUD's inertia: it trails the scene's slide in a turn (the attitude's change since
       * the last frame, in the camera's own axes), leans against the hands' thrust, presses
       * back under a burn and floats forward braking, trembling while the drive burns. Not
       * for reduced motion.
       */
      const { dt } = frame;
      if (deps.reduceMotion.matches || !(dt > 0)) {
        pose.x = pose.y = 0;
        pose.s = 1;
        Object.assign(sway, createSway());
      } else {
        turn.copy(before).invert().multiply(camera.quaternion);
        /* A jump (a snap to a place, the first frame) is no turn the pilot felt. */
        const jumped = Math.abs(turn.w) < JUMP_COS;
        const k = jumped ? 0 : (turn.w < 0 ? -2 : 2) / dt;
        const yaw = Math.max(-3, Math.min(3, turn.y * k));
        const pitch = Math.max(-3, Math.min(3, turn.x * k));
        const flown = mode === "free";
        let ahead = 0;
        if (flown) {
          ahead = axes.thrust;
        } else if (phase === "burn") {
          ahead = 1;
        } else if (braking) {
          ahead = -1;
        }
        const across = flown ? axes.strafe : 0;
        const up = flown ? axes.lift : 0;
        const reach = (v: number) => Math.max(-REACH_PX, Math.min(REACH_PX, v));
        shake += dt;
        const tremble = push * TREMBLE_PX;
        pose.x = reach(yaw * TURN_PX - across * THRUST_PX) + tremble * Math.sin(shake * 53);
        pose.y = reach(pitch * TURN_PX + up * THRUST_PX) + tremble * Math.sin(shake * 37 + 1);
        pose.s = 1 - ahead * PRESS;
        stepSway(sway, pose, dt);
      }
      before.copy(camera.quaternion);
      settling = !swaySettled(sway, pose) || push > 0;
      const shift = (share: number) =>
        `translate3d(${(sway.x * share).toFixed(2)}px, ${(sway.y * share).toFixed(2)}px, 0)`;
      const hudNext = `${shift(1)} scale(${sway.s.toFixed(4)})`;
      const panel = findHud();
      if (panel && hudNext !== hudWas) panel.style.transform = hudWas = hudNext;
      const lean = shift(COCKPIT_SHARE);
      if (lean !== leanWas) root.style.transform = leanWas = lean;
      /* The floating readouts ride the rest of the sway, so they move with the HUD. */
      const floatsNext = shift(1 - COCKPIT_SHARE);
      if (floatsNext !== floatsWas) floats.style.transform = floatsWas = floatsNext;
      if (!show.instruments) {
        drawn.fill(-1);
        return;
      }
      if (scan(frame)) drawScanner();
      if (mode === "orbit") return;
      place(aim, frame.aim, true);
      const speedMark = rung(frame.speed);
      if (speedMark !== speedMarkWas) speedLadder.mark.style.transform = speedMarkWas = speedMark;
      const closingMark = rung(Math.abs(frame.closing));
      if (closingMark !== closingMarkWas)
        closingLadder.mark.style.transform = closingMarkWas = closingMark;
      const at = performance.now();
      if (at - tagAt >= TAG_MS) {
        tagAt = at;
        const text = deps.distanceText(range / AU_KM);
        if (text !== tagWas) tag.textContent = tagWas = text;
        const speed = speedText(frame.speed);
        if (speed !== speedWas) speedLadder.value.textContent = speedWas = speed;
        const closing = `${frame.closing < 0 ? "−" : ""}${speedText(Math.abs(frame.closing))}`;
        if (closing !== closingWas) closingLadder.value.textContent = closingWas = closing;
        const words = deps.words();
        const wordsKey = `${words.speedWord}|${words.closingWord}`;
        if (wordsKey !== wordsWas) {
          wordsWas = wordsKey;
          speedLadder.word.textContent = words.speedWord ?? "";
          closingLadder.word.textContent = words.closingWord ?? "";
        }
      }
      if (mode !== "free") return;
      place(prograde, frame.v, false);
      back[0] = -frame.v[0];
      back[1] = -frame.v[1];
      back[2] = -frame.v[2];
      place(retrograde, back, false);
    },
  };
}
