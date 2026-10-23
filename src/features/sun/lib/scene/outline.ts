/**
 * The chosen place outlined in the scene, so its card points at something: a thin gold line
 * round what the card is about. A shell by its limb at its height, a layer inside by its band
 * on the cut's faces, a surface feature by a circle on the surface, what stands off the
 * surface by a ring facing the camera, never smaller than `OUTLINE_MIN_PX` across; a circle
 * carries a tick at each quarter, square to the screen. A new place's line draws itself in
 * from the top as it settles onto the place from a little wider, and a gleam then travels
 * round it; the last one leaves the same way first (reduced motion: no draw, settle or
 * gleam). Plain SVG strokes over the stage beneath the names, no filters; what the Sun hides
 * is left out.
 */
import { Vector3, type PerspectiveCamera, type Vector2 } from "three";

import { LAYER_ZONES } from "@/space/sun/model/structure";
import { TAU, smootherstep, type Vec3 } from "@horizon/toolkit/math";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { worldPerPixel } from "@horizon/toolkit/scene";

import type { LightKind } from "../model/lights";
import type { PlaceId } from "../model/places";
import {
  GRANULES_PER_RADIUS,
  OUTLINE_FADE_S,
  OUTLINE_MARGIN,
  OUTLINE_MIN_PX,
  OUTLINE_SEGMENTS,
  OUTLINE_SETTLE,
  OUTLINE_TICK_GAP_PX,
  OUTLINE_TICK_PX,
} from "../parameters";
import { createPlaceAnchors } from "./anchors";
import { directionOf, poleOf, type SunFrame } from "./frame";
import { NAMED_INSIDE_CUT, behindSun } from "./names";
import { featuredProminence, featuredRegion } from "./views";

const SVG = "http://www.w3.org/2000/svg";
/** The line's gradient; one Sun stage is mounted at a time. */
const SHEEN_ID = "sun-outline-sheen";
/** The body's pole: what the surface turns about. */
const POLE = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);

/**
 * What a place's line follows: a sphere's limb (radius, R☉); a layer's band on the cut's faces
 * (radii); a circle on the surface (a body-frame direction and an angular radius); a ring facing
 * the camera (a body-frame centre and radius, R☉).
 */
type Shape =
  | { kind: "shell"; radius: number }
  | { kind: "band"; inner: number; outer: number }
  | { kind: "patch"; centre: Vec3; angle: number }
  | { kind: "ring"; centre: Vec3; radius: number };

const BAND_IDS = new Set<PlaceId>(["core", "radiativeZone", "tachocline", "convectionZone"]);

const length = (v: Readonly<Vec3>) => Math.hypot(v[0], v[1], v[2]);

/**
 * Something standing up from the surface along `axis` (a body-frame point on it) to `top`
 * (R☉), `half` wide either side: the ring round it, centred halfway up.
 */
const column = (axis: Readonly<Vec3>, top: number, half: number): Shape => {
  const r = length(axis);
  const mid = (1 + top) / 2 / r;
  return {
    kind: "ring",
    centre: [axis[0] * mid, axis[1] * mid, axis[2] * mid],
    radius: OUTLINE_MARGIN * Math.max((top - 1) / 2, half),
  };
};

const patch = (centre: Readonly<Vec3>, angle: number): Shape => {
  const r = length(centre);
  return {
    kind: "patch",
    centre: [centre[0] / r, centre[1] / r, centre[2] / r],
    angle: OUTLINE_MARGIN * angle,
  };
};

/** The shapes of the places in a frame, from where the names stand (`anchors.ts`) and how big each place is. */
function createShapes() {
  const anchorOf = createPlaceAnchors();
  const anchor: Vec3 = [0, 0, 0];
  const axis: Vec3 = [0, 0, 0];
  return (frame: SunFrame, place: PlaceId, light: LightKind): Shape | null => {
    if (BAND_IDS.has(place)) {
      const zone = LAYER_ZONES.find((layer) => layer.id === place)!;
      return { kind: "band", inner: zone.inner, outer: zone.outer };
    }
    if (place === "star" || place === "photosphere") return { kind: "shell", radius: 1 };
    const region = featuredRegion(frame);
    switch (place) {
      case "sunspot":
        return region ? patch(directionOf(region.lat, region.lon, axis), region.size) : null;
      /* The bright network round the following spot: that pole's half of the group. */
      case "facula":
        return region ? patch(poleOf(region, "following", axis), region.size / 2) : null;
      case "prominence": {
        const p = featuredProminence(frame);
        return p
          ? column(directionOf(p.lat, p.lon, axis), 1 + p.height * (1 + p.lift), p.length / 2)
          : null;
      }
      /* The flare's loops up to the sheet's foot, as wide as its ribbons stand apart. */
      case "flare": {
        const { eruption } = frame;
        return eruption && region
          ? column(
              directionOf(region.lat, region.lon, axis),
              1 + eruption.sheetBottom,
              eruption.ribbonGap / 2,
            )
          : null;
      }
      case "loops": {
        if (!region) return null;
        const lift = frame.eruption ? frame.eruption.sheetBottom : region.size;
        return column(directionOf(region.lat, region.lon, axis), 1 + lift, region.size);
      }
      /* The bubble inside the ejection's cone, touching its front. */
      case "ejection": {
        const { eruption } = frame;
        if (!eruption || eruption.cmePresence <= 0 || !region) return null;
        const sin = Math.sin(eruption.cmeSpread);
        const radius = (eruption.cmeFront * sin) / (1 + sin);
        const centre = directionOf(region.lat, region.lon, axis);
        const out = eruption.cmeFront - radius;
        return {
          kind: "ring",
          centre: [centre[0] * out, centre[1] * out, centre[2] * out],
          radius: OUTLINE_MARGIN * radius,
        };
      }
    }
    const found = anchorOf(frame, place, anchor, light);
    if (!found) return null;
    switch (place) {
      /* Shells named at their height: the limb there. */
      case "chromosphere":
      case "corona":
        return { kind: "shell", radius: length(found) };
      case "granule":
        return patch(found, 1 / (2 * GRANULES_PER_RADIUS));
      /* A spicule, a streamer's helmet, the wind's line: from the surface up to the name. */
      case "spicule":
      case "streamer":
      case "wind":
        return column(found, length(found), 0);
      /* The probe: as small as a ring may be. */
      case "parker":
        return { kind: "ring", centre: [found[0], found[1], found[2]], radius: 0 };
    }
    return null;
  };
}

/** What the outline is drawn over this frame. */
export type OutlineView = {
  camera: PerspectiveCamera;
  /** The canvas in CSS px. */
  viewport: { width: number; height: number };
  /** The chosen place, while it is drawn (the light shows it, the moment has it); null with none. */
  place: PlaceId | null;
  shown: (place: PlaceId) => boolean;
  light: LightKind;
  /** The wedge as the shader sees it (half-angle, bisector) and how far open it is drawn, 0–1. */
  cut: Vector2;
  cutShown: number;
  reduceMotion: boolean;
};

/** An SVG element in a class. */
const svgOf = <K extends keyof SVGElementTagNameMap>(tag: K, className?: string) => {
  const el = document.createElementNS(SVG, tag);
  if (className) el.setAttribute("class", className);
  return el;
};

export function createPlaceOutline(scope: DisposalScope, root: HTMLElement) {
  const shapeOf = createShapes();
  const svg = svgOf("svg", "sun-outline");
  svg.setAttribute("aria-hidden", "true");
  /* The line's sheen: light caught at its upper left, falling off across it. */
  const defs = svgOf("defs");
  const sheen = svgOf("linearGradient");
  sheen.setAttribute("id", SHEEN_ID);
  for (const [offset, tone] of [
    ["0", "bright"],
    ["0.45", "gold"],
    ["1", "dim"],
  ] as const) {
    const stop = svgOf("stop", `sun-outline-${tone}`);
    stop.setAttribute("offset", offset);
    sheen.append(stop);
  }
  defs.append(sheen);
  /* One path drawn four times, widest first: a halo, a dark under-stroke, the line, a gleam
     travelling round it; each measured as one long so the line can draw itself in. */
  const strokes = ["glow", "shade", "line", "gleam"].map((part) => {
    const stroke = svgOf("path", `sun-outline-${part}`);
    stroke.setAttribute("pathLength", "1");
    return stroke;
  });
  const ticks = svgOf("path", "sun-outline-ticks");
  svg.append(defs, ...strokes, ticks);
  /* Under the names. */
  root.prepend(svg);
  scope.defer(() => svg.remove());

  /** The place drawn and how far its line has come in, 0–1 (linear; eased where it is used). */
  let place: PlaceId | null = null;
  let t = 0;
  let path = "";
  let tickPath = "";
  let drawnIn = "";
  let points = "";
  let marks = "";
  /** A run of drawn points is open; the loop's first point, to join its seam. */
  let open = false;
  let first = "";
  let moving = false;
  /** The point last put on screen, and the circle's centre there (NaN behind the camera). */
  let sx = 0;
  let sy = 0;
  let cx = Number.NaN;
  let cy = Number.NaN;
  const p = new Vector3();
  const centre = new Vector3();
  const u = new Vector3();
  const v = new Vector3();
  const look = new Vector3();
  const up = new Vector3();
  const projected = new Vector3();

  return {
    /** The line is fading in or out, or about to change place. */
    get moving() {
      return moving;
    },
    update(f: SunFrame, view: OutlineView, dt: number) {
      const { camera, viewport, cut } = view;
      const wanted = view.place;
      const step = view.reduceMotion ? 1 : dt / OUTLINE_FADE_S;
      /* Another place: the old line leaves before the new one comes. */
      if (place !== wanted) {
        t = Math.max(0, t - step);
        if (t === 0) place = wanted;
      }
      const shape = place && view.shown(place) ? shapeOf(f, place, view.light) : null;
      if (place === wanted) t = shape ? Math.min(1, t + step) : Math.max(0, t - step);
      moving = place !== wanted || (shape ? t < 1 : t > 0);

      const shown = smootherstep(t);
      points = "";
      marks = "";
      if (shape && shown > 0) {
        const scale = view.reduceMotion ? 1 : 1 + OUTLINE_SETTLE * (1 - shown);
        const worldPx = worldPerPixel(camera.fov, 1, viewport.height);
        const { width, height } = viewport;
        /** `p` on screen into `sx`, `sy`; false behind the camera. */
        const toScreen = () => {
          if (projected.copy(p).applyMatrix4(camera.matrixWorldInverse).z >= 0) return false;
          projected.copy(p).project(camera);
          sx = (projected.x * 0.5 + 0.5) * width;
          sy = (-projected.y * 0.5 + 0.5) * height;
          return true;
        };
        /** A tick at the point on screen, standing out from the circle's centre. */
        const tick = () => {
          const dx = sx - cx;
          const dy = sy - cy;
          const r = Math.hypot(dx, dy);
          if (!(r > 0)) return;
          const from = OUTLINE_TICK_GAP_PX / r;
          const to = (OUTLINE_TICK_GAP_PX + OUTLINE_TICK_PX) / r;
          marks += `M${(sx + dx * from).toFixed(1)} ${(sy + dy * from).toFixed(1)}`;
          marks += `L${(sx + dx * to).toFixed(1)} ${(sy + dy * to).toFixed(1)}`;
        };
        /**
         * A closed loop of `count` points, `at` setting each and saying whether it is in sight:
         * one run per stretch in sight, and with `quarters`, a tick at each quarter in sight.
         */
        const loop = (count: number, at: (i: number) => boolean, quarters = false) => {
          open = false;
          first = "";
          let whole = true;
          for (let i = 0; i < count; i++) {
            if (!at(i) || !toScreen()) {
              open = false;
              whole = false;
              continue;
            }
            const xy = `${sx.toFixed(1)} ${sy.toFixed(1)}`;
            if (i === 0) first = xy;
            points += `${open ? "L" : "M"}${xy}`;
            open = true;
            if (quarters && i % (count / 4) === 0) tick();
          }
          /* Whole, it closes; broken, the last stretch still runs on into the first. */
          if (whole) points += "Z";
          else if (open && first) points += `L${first}`;
          open = false;
        };
        /** A circle in the plane of `u` and `v` about `centre`, from its top on screen round. */
        const circle = (radius: number, visible: (q: Vector3) => boolean) => {
          p.copy(centre);
          if (toScreen()) {
            cx = sx;
            cy = sy;
          } else cx = cy = Number.NaN;
          loop(
            OUTLINE_SEGMENTS,
            (i) => {
              const a = (i / OUTLINE_SEGMENTS) * TAU;
              p.copy(centre)
                .addScaledVector(u, radius * Math.cos(a))
                .addScaledVector(v, radius * Math.sin(a));
              return visible(p);
            },
            true,
          );
        };
        /** Two unit vectors across `axis`, the first toward the top of the screen where it can be. */
        const across = (axis: Vector3) => {
          up.set(0, 1, 0).applyQuaternion(camera.quaternion);
          u.copy(up).addScaledVector(axis, -up.dot(axis));
          if (u.lengthSq() < 1e-6) u.copy(Math.abs(axis.y) < 0.9 ? POLE : X_AXIS).cross(axis);
          u.normalize();
          v.crossVectors(axis, u);
        };
        switch (shape.kind) {
          /* A sphere's limb: the circle where sight lines graze it, r²/d toward the camera. */
          case "shell": {
            const r = shape.radius * scale;
            const d = camera.position.length();
            if (d <= r) break;
            look.copy(camera.position).divideScalar(d);
            centre.copy(look).multiplyScalar((r * r) / d);
            across(look);
            circle(r * Math.sqrt(1 - (r * r) / (d * d)), () => true);
            break;
          }
          /* On each face of the open wedge that faces the camera: the band between the radii, up
             one edge and down the other, as the names' faces are laid out (`names.ts`). */
          case "band": {
            if (view.cutShown <= NAMED_INSIDE_CUT) break;
            const mid = (shape.inner + shape.outer) / 2;
            const inner = Math.max(0, mid - (mid - shape.inner) * scale);
            const outer = mid + (shape.outer - mid) * scale;
            const half = OUTLINE_SEGMENTS / 2;
            for (const side of [-1, 1]) {
              const face = cut.y + side * cut.x;
              const cos = Math.cos(face);
              const sin = Math.sin(face);
              /* The face's normal into the gap: the camera must stand on that side. */
              if (side * (camera.position.z * cos - camera.position.x * sin) >= 0) continue;
              loop(2 * (half + 1), (i) => {
                const outward = i <= half;
                const k = outward ? i : 2 * half + 1 - i;
                const lat = (k / half - 0.5) * Math.PI;
                const r = outward ? outer : inner;
                p.set(r * Math.cos(lat) * cos, r * Math.sin(lat), r * Math.cos(lat) * sin);
                return true;
              });
            }
            break;
          }
          /* A circle on the sphere, foreshortened as the surface turns away; the far side hidden. */
          case "patch": {
            centre.fromArray(shape.centre).applyAxisAngle(POLE, f.surfaceTurn);
            across(centre);
            const distance = Math.max(centre.distanceTo(camera.position), 1e-6);
            const angle = Math.max(shape.angle, (OUTLINE_MIN_PX / 2) * worldPx * distance) * scale;
            const cosA = Math.cos(angle);
            centre.multiplyScalar(cosA);
            circle(Math.sin(angle), (q) => q.dot(camera.position) > 1);
            break;
          }
          /* A ring square to the line of sight, broken where the Sun stands in front. */
          case "ring": {
            centre.fromArray(shape.centre).applyAxisAngle(POLE, f.surfaceTurn);
            look.subVectors(centre, camera.position);
            const distance = Math.max(look.length(), 1e-6);
            across(look.divideScalar(distance));
            const radius =
              Math.max(shape.radius, (OUTLINE_MIN_PX / 2) * worldPx * distance) * scale;
            circle(radius, (q) => !behindSun(q, camera));
            break;
          }
        }
      }
      if (points !== path) {
        path = points;
        for (const stroke of strokes) stroke.setAttribute("d", path);
      }
      if (marks !== tickPath) {
        tickPath = marks;
        ticks.setAttribute("d", tickPath);
      }
      /* The line draws itself in from the top as it settles, and back out as it leaves; it is
         lit through most of that, and out of the page's paint while there is none. */
      const state = path ? `${Math.min(1, 2 * shown).toFixed(2)} ${shown.toFixed(3)}` : "";
      if (state !== drawnIn) {
        drawnIn = state;
        svg.style.display = path ? "" : "none";
        svg.style.opacity = path ? Math.min(1, 2 * shown).toFixed(2) : "0";
        svg.style.strokeDasharray = shown < 1 ? `${shown.toFixed(3)} 1` : "";
        /* The gleam comes once the line is whole. */
        if (shown < 1) delete svg.dataset.settled;
        else svg.dataset.settled = "";
      }
    },
  };
}
