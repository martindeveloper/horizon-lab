/**
 * The cockpit over the scene, drawn by the engine each frame in DOM as the labels are: the
 * canopy (the glass darkening to the corners, two pillars with lit edges), a boresight, the
 * prograde and retrograde markers of the ship's velocity relative to the body it is near,
 * the aim's marker with its range (a chevron at the edge when the aim is beside or behind),
 * the scanner disc between the console's panels with the bodies about the ship on a log
 * scale, the throttle, a glow while the drive burns, and a lean of the whole panel against
 * the thrust. A parked ship shows the canopy and the scanner; a flight the aim too; free
 * flight all of it. The View panel's switches hide the canopy and the instruments; hidden
 * instruments cost no work.
 */
import { Vector3, type PerspectiveCamera } from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";
import type { DistanceText, Vec3d, Viewport } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import type { AnchorId } from "../model/anchors";
import { blipOnScanner, markOnScreen, type Blip, type ScreenMark } from "../model/instruments";
import type { ShipMode } from "../model/ship";

/** A body the scanner shows: its heliocentric position, km, as drawn this frame. */
export type ScannerBody = { id: string; pos: Readonly<Vec3d> };

export type CockpitFrame = {
  mode: ShipMode;
  flying: boolean;
  show: { canopy: boolean; instruments: boolean };
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
/** Pixels the panel leans per unit of thrust across and up. */
const LEAN_PX = 6;
/** The range tag is rewritten no more often than this, ms. */
const TAG_MS = 250;

/**
 * The canopy: two pillars rising from the dash, their inner edges lit. Drawn once; the
 * viewBox stretches to the stage.
 */
const CANOPY_SVG = `<svg viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
<polygon class="voyage-pillar" points="0,0 22,0 58,600 0,600"/>
<polygon class="voyage-pillar" points="1000,0 978,0 942,600 1000,600"/>
<line class="voyage-pillar-edge" x1="22" y1="0" x2="58" y2="600"/>
<line class="voyage-pillar-edge" x1="978" y1="0" x2="942" y2="600"/>
</svg>`;

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
  },
) {
  const root = el("div", "voyage-cockpit");
  root.setAttribute("aria-hidden", "true");
  root.dataset.mode = "parked";
  const canopy = el("div", "voyage-canopy");
  canopy.innerHTML = CANOPY_SVG;
  const boresight = el("span", "voyage-boresight");
  const prograde = el("span", "voyage-mark voyage-prograde");
  const retrograde = el("span", "voyage-mark voyage-retrograde");
  const aim = el("span", "voyage-mark voyage-aim");
  const tag = el("span", "voyage-aim-tag");
  aim.append(tag);
  const throttle = el("span", "voyage-throttle");
  const fill = el("span", "voyage-throttle-fill");
  throttle.append(fill);
  const scanner = el("canvas", "voyage-scanner");
  const burn = el("span", "voyage-burn");
  root.append(canopy, burn, boresight, prograde, retrograde, aim, throttle, scanner);
  host.append(root);
  scope.defer(() => root.remove());

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  scanner.width = Math.round(SCANNER_W * dpr);
  scanner.height = Math.round(SCANNER_H * dpr);
  const ctx = scanner.getContext("2d");
  /* The scanner's inks: the accent for the rings and the aim, the foreground for the rest. */
  const styles = getComputedStyle(root);
  const accent = styles.color;
  const ink = styles.getPropertyValue("--color-fg").trim() || accent;

  const v = new Vector3();
  const mark: ScreenMark = { x: 0, y: 0, off: false, angle: 0 };
  const blip: Blip = { r: 0, u: 0, w: 0, h: 0 };
  const placed = new WeakMap<HTMLElement, string>();
  let fillWas = "";
  let leanWas = "";
  let tagWas = "";
  let tagAt = 0;
  let modeWas = "parked";
  let burnWas = false;
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

  /** The scanner: the disc, its range rings, the ship, and every body within a hundred ranges. */
  const drawScanner = (frame: CockpitFrame, range: number) => {
    if (!ctx) return;
    const cx = SCANNER_W / 2;
    const cy = SCANNER_H * 0.6;
    const R = SCANNER_W / 2 - 4;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SCANNER_W, SCANNER_H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    /* The disc, faintly filled; three rings: a tenth of the range, the range, ten times it. */
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
    const { ship } = frame;
    for (const body of deps.bodies) {
      v.set(body.pos[0] - ship[0], body.pos[1] - ship[1], body.pos[2] - ship[2]);
      v.applyMatrix4(camera.matrixWorldInverse);
      blipOnScanner(v.x, v.y, v.z, range, blip);
      const sun = body.id === "sun";
      const aimed = body.id === frame.aimId;
      if (blip.r >= 1 && !sun && !aimed) continue;
      const fx = cx + blip.u * R;
      const fy = cy - blip.w * R * SCANNER_SQUASH;
      const by = fy - blip.h * R * SCANNER_LIFT;
      ctx.strokeStyle = aimed ? accent : ink;
      ctx.fillStyle = aimed ? accent : ink;
      ctx.globalAlpha = blip.r >= 1 ? 0.35 : aimed ? 1 : 0.75;
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

  const flag = (name: "canopy" | "instruments" | "burn", on: boolean) => {
    if (on) root.dataset[name] = "";
    else delete root.dataset[name];
  };
  flag("canopy", true);
  flag("instruments", true);
  const back: Vec3d = [0, 0, 0];

  return {
    update(frame: CockpitFrame) {
      const { show, axes } = frame;
      if (show.canopy !== canopyWas) flag("canopy", (canopyWas = show.canopy));
      if (show.instruments !== instrumentsWas)
        flag("instruments", (instrumentsWas = show.instruments));
      const mode = frame.flying ? "flight" : frame.mode === "free" ? "free" : "parked";
      if (mode !== modeWas) root.dataset.mode = modeWas = mode;
      if (!show.instruments) return;
      const range = Math.hypot(frame.aim[0], frame.aim[1], frame.aim[2]);
      drawScanner(frame, range);
      if (mode === "parked") return;
      place(aim, frame.aim, true);
      const at = performance.now();
      if (at - tagAt >= TAG_MS) {
        tagAt = at;
        const text = deps.distanceText(range / AU_KM);
        if (text !== tagWas) tag.textContent = tagWas = text;
      }
      if (mode !== "free") return;
      place(prograde, frame.v, false);
      back[0] = -frame.v[0];
      back[1] = -frame.v[1];
      back[2] = -frame.v[2];
      place(retrograde, back, false);
      const push = Math.min(1, Math.hypot(axes.thrust, axes.strafe, axes.lift)) || axes.brake;
      const level = `scaleY(${(push * (axes.boost > 0 ? 1 : 0.5)).toFixed(3)})`;
      if (level !== fillWas) fill.style.transform = fillWas = level;
      const burning = push > 0;
      if (burning !== burnWas) flag("burn", (burnWas = burning));
      /* The panel leans against the thrust, as the pilot's head would; not for reduced motion. */
      const lean = deps.reduceMotion.matches
        ? ""
        : `translate(${(-axes.strafe * LEAN_PX).toFixed(1)}px, ${(axes.lift * LEAN_PX).toFixed(1)}px)`;
      if (lean !== leanWas) root.style.transform = leanWas = lean;
    },
  };
}
