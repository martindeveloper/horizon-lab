/**
 * Where the lab names each place in a frame (body frame, R☉): the interior's shells on the cut's
 * meridian at the middle of their layer, the surface's on the featured region, the limb's on
 * the +x limb, the live prominence, loop, line or ejection where the frame has one. A renderer
 * reads them every frame, so they are written into the caller's vector, and what needs a search
 * of the field's lines is searched once per field.
 */
import { CHROMOSPHERE_HEIGHT, SPICULE_HEIGHT } from "@/space/sun/graphics/parameters";
import { LAYERS } from "@/space/sun/model/structure";
import type { Vec3 } from "@horizon/toolkit/math";

import type { LightKind } from "../model/lights";
import type { PlaceId } from "../model/places";
import { EUV_SCALE_HEIGHT_R, OPEN_FADE_FROM, STREAMER_MIN_APEX } from "../parameters";
import { directionOf, parkerOf, poleOf, type Polyline, type SunFrame } from "./frame";
import { featuredProminence, featuredRegion } from "./views";

/**
 * Interior anchors lie on the +z meridian (lon = π/2 in the body frame), where the cut opens when
 * it faces the camera; a renderer turns each onto a face of the cut. Their latitude sets the
 * layers' names apart up the face, enough that neighbours clear each other on a phone.
 */
const CUT_LAT = 0.6;
const CUT_LON = Math.PI / 2;
/** The quiet-surface anchors sit just off the disc's centre. */
const SURFACE_LAT = 0.12;
const SURFACE_LON = 0.2;
/** The limb anchors, on the +x limb (lon = 0) as seen down −z. */
const LIMB_LON = 0;
const CHROMOSPHERE_TOP_R = 1 + CHROMOSPHERE_HEIGHT;
const SPICULE_TOP_R = 1 + SPICULE_HEIGHT;
const CORONA_ANCHOR_R = 1.6;
/** In a band the corona's own light falls on its scale height: its name stands two scale heights up, where it still glows. */
const CORONA_BAND_ANCHOR_R = 1 + 2 * EUV_SCALE_HEIGHT_R;
/** An open line's ribbon fades past this share of its length (and from `OPEN_FADE_FROM` out): the wind is named inside both. */
const OPEN_DRAWN_ALONG = 0.8;

const at = (lat: number, lon: number, radius: number, out: Vec3): Vec3 => {
  directionOf(lat, lon, out);
  out[0] *= radius;
  out[1] *= radius;
  out[2] *= radius;
  return out;
};

const copy = (from: Readonly<Vec3>, out: Vec3): Vec3 => {
  out[0] = from[0];
  out[1] = from[1];
  out[2] = from[2];
  return out;
};

/** A line's point farthest from the centre, as an index. */
function apexOf(line: Polyline) {
  let best = 0;
  let r2 = 0;
  for (let i = 0; i < line.count; i++) {
    const x = line.points[3 * i]!;
    const y = line.points[3 * i + 1]!;
    const z = line.points[3 * i + 2]!;
    const d = x * x + y * y + z * z;
    if (d > r2) {
      r2 = d;
      best = i;
    }
  }
  return { index: best, radius: Math.sqrt(r2) };
}

/** The anchors of the places in a frame, with the line searches kept for as long as its field. */
export function createPlaceAnchors() {
  let searched: SunFrame | null = null;
  let revision = -1;
  /* The highest closed apex high enough to raise a streamer, and the farthest drawn point of the first open line (the wind). */
  const streamer: Vec3 = [0, 0, 0];
  const wind: Vec3 = [0, 0, 0];
  let hasStreamer = false;
  let hasWind = false;
  const search = (frame: SunFrame) => {
    if (frame === searched && frame.fieldRevision === revision) return;
    searched = frame;
    revision = frame.fieldRevision;
    let height = 0;
    hasStreamer = false;
    hasWind = false;
    for (const line of frame.fieldLines) {
      if (line.open) {
        if (hasWind) continue;
        const along = Math.floor(OPEN_DRAWN_ALONG * (line.count - 1));
        for (let i = 0; i <= along; i++) {
          const x = line.points[3 * i]!;
          const y = line.points[3 * i + 1]!;
          const z = line.points[3 * i + 2]!;
          if (Math.hypot(x, y, z) > OPEN_FADE_FROM) break;
          wind[0] = x;
          wind[1] = y;
          wind[2] = z;
          hasWind = true;
        }
        continue;
      }
      const apex = apexOf(line);
      if (apex.radius > STREAMER_MIN_APEX && apex.radius > height) {
        height = apex.radius;
        streamer[0] = line.points[3 * apex.index]!;
        streamer[1] = line.points[3 * apex.index + 1]!;
        streamer[2] = line.points[3 * apex.index + 2]!;
        hasStreamer = true;
      }
    }
  };

  /**
   * Where a place is in this frame, into `out`, as the light draws it (the corona's light falls
   * faster in a band); null when the frame has none of it (no spot, no eruption under way).
   */
  return (frame: SunFrame, place: PlaceId, out: Vec3, light: LightKind = "white"): Vec3 | null => {
    switch (place) {
      /* The star as a whole has no one point to name. */
      case "star":
        return null;
      /* The probe on its orbit at the model's moment, in the world; the body turns under it. */
      case "parker": {
        const [x, y, z] = parkerOf(frame, out);
        const c = Math.cos(frame.surfaceTurn);
        const s = Math.sin(frame.surfaceTurn);
        out[0] = x * c - z * s;
        out[1] = y;
        out[2] = x * s + z * c;
        return out;
      }
      case "core":
        return at(CUT_LAT, CUT_LON, LAYERS.core / 2, out);
      case "radiativeZone":
        return at(CUT_LAT, CUT_LON, (LAYERS.core + LAYERS.tachocline) / 2, out);
      case "tachocline":
        return at(CUT_LAT, CUT_LON, LAYERS.tachocline, out);
      case "convectionZone":
        return at(CUT_LAT, CUT_LON, (LAYERS.tachocline + LAYERS.photosphere) / 2, out);
      case "photosphere":
        return at(CUT_LAT, CUT_LON, LAYERS.photosphere, out);
      case "granule":
        return at(SURFACE_LAT, SURFACE_LON, 1, out);
      case "sunspot": {
        const region = featuredRegion(frame);
        return region ? at(region.lat, region.lon, 1, out) : null;
      }
      case "facula": {
        const region = featuredRegion(frame);
        return region ? poleOf(region, "following", out) : null;
      }
      case "chromosphere":
        return at(0, LIMB_LON, CHROMOSPHERE_TOP_R, out);
      case "spicule":
        return at(SURFACE_LAT, LIMB_LON, SPICULE_TOP_R, out);
      case "prominence": {
        const p = featuredProminence(frame);
        return p ? at(p.lat, p.lon, 1 + p.height * (1 + p.lift), out) : null;
      }
      case "flare": {
        const { eruption } = frame;
        const region = eruption ? featuredRegion(frame) : undefined;
        return eruption && region
          ? at(region.lat, region.lon, 1 + eruption.sheetBottom, out)
          : null;
      }
      case "loops": {
        const region = featuredRegion(frame);
        if (!region) return null;
        const lift = frame.eruption ? frame.eruption.sheetBottom : region.size;
        return at(region.lat, region.lon, 1 + lift, out);
      }
      case "corona":
        return at(0, LIMB_LON, light === "band" ? CORONA_BAND_ANCHOR_R : CORONA_ANCHOR_R, out);
      case "streamer":
        search(frame);
        return hasStreamer ? copy(streamer, out) : null;
      case "ejection": {
        const { eruption } = frame;
        const region = eruption && eruption.cmePresence > 0 ? featuredRegion(frame) : undefined;
        return eruption && region ? at(region.lat, region.lon, eruption.cmeFront, out) : null;
      }
      case "wind":
        search(frame);
        return hasWind ? copy(wind, out) : at(Math.PI / 2, 0, OPEN_FADE_FROM, out);
    }
  };
}

export type PlaceAnchors = ReturnType<typeof createPlaceAnchors>;
