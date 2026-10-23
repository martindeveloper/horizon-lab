/**
 * The Sun's weather as a pure function of its seed, the model time and the cycle count:
 * active regions emerge at Spörer's latitudes with Hale's polarities and Joy's tilt, grow for a
 * few days and decay over weeks (Gnevyshev–Waldmeier), carry faculae and flares whose GOES class
 * follows the observed power law; the largest flares erupt; prominences hang in filament
 * channels, long-lived at high latitude, short-lived over regions. A forecast writes into fixed
 * slots each call (`createForecast`), so a frame allocates nothing, and any moment replays from
 * `(seed, time, cycleCount)`.
 */
import { TAU, clamp01, smoothstep } from "@horizon/toolkit/math";

import type { Prominence, Region } from "./contract";
import { activityAt, cycleNumberOf, cyclePhaseOf, wolfNumber } from "./cycle";
import { between, dice, gaussDice } from "./dice";
import type { ObservedRegion } from "./observed";
import {
  ACTIVE_PROMINENCE_HEIGHT_R,
  ACTIVE_PROMINENCE_LENGTH,
  CHANNEL_TILT_SCATTER_RAD,
  DAY_S,
  ERUPTING_FLUX,
  ERUPTION_SECONDS,
  ERUPTION_STAGES,
  FACULA_AT_PRIME,
  FACULA_FADE_SHARE,
  FLARE_CHANCE_PER_WINDOW,
  FLARE_DECAY_POWER,
  FLARE_DECAY_S,
  FLARE_MAX_FLUX,
  FLARE_MIN_FLUX,
  FLARE_POWER_INDEX,
  FLARE_RISE_S,
  FLARE_UNIT_FLUX,
  FLARE_WINDOWS_BACK,
  FLARE_WINDOW_S,
  GNEVYSHEV_WALDMEIER_DAYS_PER_MSH,
  GOES_CLASSES,
  GOES_CLASS_FLUX,
  GROUP_VISIBLE_STRENGTH,
  JOY_SCATTER_RAD,
  JOY_SLOPE,
  MSH_PER_RAD2,
  OBSERVED_MIN_AREA_MSH,
  OBSERVED_START_SHARE,
  POLAR_CROWN_SPREAD_RAD,
  PROMINENCE_FADE_SHARE,
  PROMINENCE_LIFT,
  PROMINENCE_SLOTS,
  QUIESCENT_HEIGHT_R,
  QUIESCENT_LATITUDES_RAD,
  QUIESCENT_LENGTH_R,
  QUIESCENT_LIFE_D,
  QUIESCENT_LIFE_SPREAD,
  QUIESCENT_PRESENCE,
  QUIESCENT_SLOTS,
  REGIONS_AT_MAXIMUM,
  REGIONS_AT_MINIMUM,
  REGION_EMERGENCE_SHARE,
  REGION_LATITUDE_MIN_RAD,
  REGION_LIFE_MIN_D,
  REGION_SIZE_MAX_RAD,
  REGION_SIZE_MEDIAN_RAD,
  REGION_SIZE_SIGMA,
  REGION_SLOTS,
  REGION_WINDOW_D,
  SPORER_END_RAD,
  SPORER_SPREAD_RAD,
  SPORER_START_RAD,
  SPOTS_PER_REGION,
} from "./parameters";
import { lagBehindEquator } from "./rotation";

/** The eruption under way: its region's slot and id, where it is on its timeline, its flare's peak flux (W/m²). Slot −1: none. */
export type Outbreak = { slot: number; regionId: number; s: number; flux: number };

export type Weather = {
  regions: Region[];
  prominences: Prominence[];
  outbreak: Outbreak;
  /** Groups and spots on the whole sphere, and Wolf's number from them. */
  groups: number;
  spots: number;
  wolfNumber: number;
};

const blankRegion = (): Region => ({
  id: 0,
  lat: 0,
  lon: 0,
  tilt: 0,
  size: 0,
  polarity: 1,
  age: 0,
  strength: 0,
  flare: 0,
  facula: 0,
});
const blankProminence = (): Prominence => ({
  lat: 0,
  lon: 0,
  tilt: 0,
  length: 0,
  height: 0,
  lift: 0,
  fade: 0,
  erupting: 0,
});

/** An empty slot, field for field, so a replay compares equal. */
function clearRegion(region: Region) {
  Object.assign(region, blankRegion());
}
function clearProminence(prominence: Prominence) {
  Object.assign(prominence, blankProminence());
}

/** Empty slots to write a forecast into. */
export const blankWeather = (): Weather => ({
  regions: Array.from({ length: REGION_SLOTS }, blankRegion),
  prominences: Array.from({ length: PROMINENCE_SLOTS }, blankProminence),
  outbreak: { slot: -1, regionId: 0, s: 0, flux: 0 },
  groups: 0,
  spots: 0,
  wolfNumber: 0,
});

/* Salts, so each throw is its own. */
const SALT = {
  window: 1,
  active: 2,
  flare: 3,
  flux: 4,
  onset: 5,
  size: 6,
  birth: 7,
  hemisphere: 8,
  latitude: 9,
  longitude: 10,
  tilt: 11,
  present: 12,
  life: 13,
  channel: 14,
  length: 15,
  height: 16,
  demo: 17,
} as const;

/* ------------------------------------------------------------------- flares */

/** The flare power law dN/dF ∝ F^−α between the model's smallest and largest, inverted: a throw to a peak flux, W/m². */
export function flareFlux(throw_: number) {
  const k = 1 - FLARE_POWER_INDEX;
  const ratio = (FLARE_MAX_FLUX / FLARE_MIN_FLUX) ** k;
  return FLARE_MIN_FLUX * (1 - throw_ * (1 - ratio)) ** (1 / k);
}

/** The flux of a GOES class and multiplier: (3, 5.2) is M5.2, W/m². */
export const goesFlux = (classIndex: number, multiplier: number) =>
  multiplier *
  GOES_CLASS_FLUX[
    GOES_CLASSES[Math.min(GOES_CLASSES.length - 1, Math.max(0, Math.round(classIndex)))]!
  ];

/** A flux's GOES class, "M5.2": the letter of its decade and one decimal; X runs past 10. */
export function goesClassOf(flux: number) {
  let index = Math.floor(Math.log10(flux / GOES_CLASS_FLUX.A));
  index = Math.min(GOES_CLASSES.length - 1, Math.max(0, index));
  const letter = GOES_CLASSES[index]!;
  const multiplier = flux / GOES_CLASS_FLUX[letter];
  return `${letter}${multiplier.toFixed(1)}`;
}

/** A flare's decay time grows slowly with its size, seconds. */
const flareDecay = (flux: number) =>
  FLARE_DECAY_S * (flux / GOES_CLASS_FLUX.C) ** FLARE_DECAY_POWER;

/** The soft X-ray light curve `t` seconds after onset, 0–1 of its peak: a fast rise, a slow decay. */
export function flareCurve(t: number, flux: number) {
  if (t <= 0) return 0;
  const decay = flareDecay(flux);
  const peakAt = FLARE_RISE_S * Math.log((FLARE_RISE_S + decay) / FLARE_RISE_S);
  const peak = (1 - Math.exp(-peakAt / FLARE_RISE_S)) * Math.exp(-peakAt / decay);
  return ((1 - Math.exp(-t / FLARE_RISE_S)) * Math.exp(-t / decay)) / peak;
}

/* ------------------------------------------------------------------ regions */

/** Spörer's law: the mean spot latitude drifts from near 30° to near 8° over a cycle. */
export const sporerLatitude = (phase: number) =>
  SPORER_START_RAD + (SPORER_END_RAD - SPORER_START_RAD) * clamp01(phase);

/**
 * The leading pole's polarity in the northern hemisphere: Hale's law, flipping each cycle. It
 * is the sign the north pole had at the cycle's minimum: positive for cycle 25 (the north pole
 * turned positive at the 2013 reversal and stayed so through the 2019 minimum), so odd cycles
 * lead positive in the north.
 */
export const haleLeadingNorth = (cycleNumber: number): 1 | -1 =>
  ((cycleNumber % 2) + 2) % 2 === 1 ? 1 : -1;

/** A region's strength at a share of its life: a quick emergence, then a linear decay of area. */
export function regionStrength(share: number) {
  if (share <= 0 || share >= 1) return 0;
  return share < REGION_EMERGENCE_SHARE
    ? smoothstep(0, REGION_EMERGENCE_SHARE, share)
    : 1 - (share - REGION_EMERGENCE_SHARE) / (1 - REGION_EMERGENCE_SHARE);
}

/** A group's life, seconds, from its angular radius (Gnevyshev–Waldmeier), within the slot's window. */
export function regionLife(size: number) {
  const msh = MSH_PER_RAD2 * size * size;
  const days = GNEVYSHEV_WALDMEIER_DAYS_PER_MSH * msh;
  return Math.min(0.9 * REGION_WINDOW_D, Math.max(REGION_LIFE_MIN_D, days)) * DAY_S;
}

/** Slots in use at an activity level. */
const slotsInUse = (activity: number) =>
  REGIONS_AT_MINIMUM + (REGIONS_AT_MAXIMUM - REGIONS_AT_MINIMUM) * clamp01(activity);

type Birth = { id: number; birth: number; life: number; size: number; windowStart: number };

/** The region slot `slot` holds at `time`: who it is and when it lives, or null for an empty window. */
function birthOf(seed: number, slot: number, time: number, activity: number): Birth | null {
  const window = REGION_WINDOW_D * DAY_S;
  const offset = dice(seed, SALT.window, slot) * window;
  const epoch = Math.floor((time + offset) / window);
  if (dice(seed, SALT.active, slot, epoch) * REGION_SLOTS >= slotsInUse(activity)) return null;
  const size = Math.min(
    REGION_SIZE_MAX_RAD,
    REGION_SIZE_MEDIAN_RAD * Math.exp(REGION_SIZE_SIGMA * gaussDice(seed, SALT.size, slot, epoch)),
  );
  const life = regionLife(size);
  const windowStart = epoch * window - offset;
  const birth = windowStart + dice(seed, SALT.birth, slot, epoch) * (window - life);
  const id = (epoch & 0xfffff) * REGION_SLOTS + slot + 1;
  return { id, birth, life, size, windowStart };
}

/** A region's place and polarity, fixed at birth; its longitude drifts with its latitude's rotation. */
function placeRegion(
  seed: number,
  slot: number,
  who: Birth,
  phase: number,
  cycleNumber: number,
  out: Region,
) {
  const hemisphere = dice(seed, SALT.hemisphere, slot, who.id) < 0.5 ? 1 : -1;
  const latitude = Math.max(
    REGION_LATITUDE_MIN_RAD,
    sporerLatitude(phase) + SPORER_SPREAD_RAD * gaussDice(seed, SALT.latitude, slot, who.id),
  );
  out.id = who.id;
  out.lat = hemisphere * latitude;
  out.lon = TAU * dice(seed, SALT.longitude, slot, who.id) + lagBehindEquator(out.lat, out.age);
  out.size = who.size;
  const leadingNorth = haleLeadingNorth(cycleNumber);
  out.polarity = hemisphere === 1 ? leadingNorth : leadingNorth === 1 ? -1 : 1;
  out.tilt = JOY_SLOPE * latitude + JOY_SCATTER_RAD * gaussDice(seed, SALT.tilt, slot, who.id);
}

type FlareSum = { light: number; eruptingOnset: number; eruptingFlux: number };
const flareSum: FlareSum = { light: 0, eruptingOnset: -Infinity, eruptingFlux: 0 };

/** The flares of a region up to its age: their light now, and the onset of the latest erupting one. */
function flaresOf(seed: number, who: Birth, age: number, out: FlareSum) {
  out.light = 0;
  out.eruptingOnset = -Infinity;
  out.eruptingFlux = 0;
  const current = Math.floor(age / FLARE_WINDOW_S);
  for (let w = Math.max(0, current - FLARE_WINDOWS_BACK); w <= current; w++) {
    const start = w * FLARE_WINDOW_S;
    const chance =
      FLARE_CHANCE_PER_WINDOW *
      regionStrength(start / who.life) *
      (who.size / REGION_SIZE_MEDIAN_RAD);
    if (dice(seed, SALT.flare, who.id, w) >= chance) continue;
    const flux = flareFlux(dice(seed, SALT.flux, who.id, w));
    const onset = start + dice(seed, SALT.onset, who.id, w) * FLARE_WINDOW_S;
    out.light += (flux / FLARE_UNIT_FLUX) * flareCurve(age - onset, flux);
    if (flux >= ERUPTING_FLUX && onset <= age && onset > out.eruptingOnset) {
      out.eruptingOnset = onset;
      out.eruptingFlux = flux;
    }
  }
}

/** The flare's onset sits at the X-point of the eruption's timeline. */
const ERUPTION_LEAD_S = ERUPTION_STAGES.rise * ERUPTION_SECONDS;

/** Observed regions carry their NOAA number above every statistical id. */
const OBSERVED_ID_BASE = 20_000_000;

/**
 * An observed region in its slot at `time` (model seconds from the visit's start, the map's
 * epoch): in its prime at the start, then decaying by the usual rule; false once it has died.
 */
function placeObserved(
  observed: ObservedRegion,
  time: number,
  cycleNumber: number,
  out: Region,
): boolean {
  const life = regionLife(observed.size);
  const age = time + OBSERVED_START_SHARE * life;
  if (age < 0 || age > life) return false;
  const hemisphere = observed.lat >= 0 ? 1 : -1;
  const leadingNorth = haleLeadingNorth(cycleNumber);
  out.id = OBSERVED_ID_BASE + observed.number;
  out.age = age;
  out.lat = observed.lat;
  out.lon = observed.lon + lagBehindEquator(observed.lat, time);
  out.size = observed.size;
  out.polarity = hemisphere === 1 ? leadingNorth : leadingNorth === 1 ? -1 : 1;
  out.tilt = JOY_SLOPE * Math.abs(observed.lat);
  out.strength = regionStrength(age / life);
  return true;
}

/** When an observed region dies, model seconds: its slot then returns to the statistical weather. */
const observedDeath = (observed: ObservedRegion) =>
  regionLife(observed.size) * (1 - OBSERVED_START_SHARE);

/** An observed region's strength at the map's epoch: what the photographed spots show. */
const PHOTOGRAPHED_STRENGTH = regionStrength(OBSERVED_START_SHARE);

/**
 * How much of its photographed spots a region keeps, 0–1: an observed region's strength over
 * its strength at the map's epoch, so its spots in the photograph fade as it decays; 0 for a
 * statistical region, which the photograph never showed.
 */
export const photographedShare = (region: Region) =>
  region.id > OBSERVED_ID_BASE ? clamp01(region.strength / PHOTOGRAPHED_STRENGTH) : 0;

/** The life of the smallest reported group, seconds: how long spots no seeded region claims last. */
const LONE_SPOT_LIFE = regionLife(Math.sqrt(OBSERVED_MIN_AREA_MSH / MSH_PER_RAD2));

/**
 * How much the photograph keeps of the spots no seeded region claims (the groups too small to
 * seed), `time` model seconds after the map's epoch: they decay as the smallest reported group.
 */
export const lonePhotographedShare = (time: number) =>
  clamp01(
    regionStrength(OBSERVED_START_SHARE + Math.max(0, time) / LONE_SPOT_LIFE) /
      PHOTOGRAPHED_STRENGTH,
  );

/** A stand-in region for the eruption timeline when the Sun is quiet: large, in its prime, at Spörer's latitude. */
function demoRegion(seed: number, phase: number, cycleNumber: number, out: Region) {
  const size = 2 * REGION_SIZE_MEDIAN_RAD;
  const life = regionLife(size);
  const who: Birth = { id: 1, birth: 0, life, size, windowStart: 0 };
  out.age = REGION_EMERGENCE_SHARE * life;
  placeRegion(seed, SALT.demo, who, phase, cycleNumber, out);
  out.lon = TAU * dice(seed, SALT.demo);
  out.strength = 1;
  out.facula = FACULA_AT_PRIME;
  out.flare = 0;
}

/* -------------------------------------------------------------- prominences */

function quiescentProminence(
  seed: number,
  slot: number,
  time: number,
  phase: number,
  out: Prominence,
) {
  const window = QUIESCENT_LIFE_D * 1.5 * DAY_S;
  const offset = dice(seed, SALT.window, 100 + slot) * window;
  const epoch = Math.floor((time + offset) / window);
  out.lift = 0;
  out.erupting = 0;
  if (dice(seed, SALT.present, slot, epoch) >= QUIESCENT_PRESENCE) return clearProminence(out);
  const life =
    QUIESCENT_LIFE_D * DAY_S * between(QUIESCENT_LIFE_SPREAD, dice(seed, SALT.life, slot, epoch));
  const birth =
    epoch * window - offset + dice(seed, SALT.birth, 100 + slot, epoch) * (window - life);
  const share = (time - birth) / life;
  if (share <= 0 || share >= 1) return clearProminence(out);
  out.fade =
    smoothstep(0, PROMINENCE_FADE_SHARE, share) *
    (1 - smoothstep(1 - PROMINENCE_FADE_SHARE, 1, share));
  /* The polar crown climbs poleward through the cycle (Hathaway 2015, §4.6). */
  const crown = between(QUIESCENT_LATITUDES_RAD, clamp01(phase));
  const hemisphere = dice(seed, SALT.hemisphere, 100 + slot, epoch) < 0.5 ? 1 : -1;
  out.lat =
    hemisphere *
    (crown + POLAR_CROWN_SPREAD_RAD * gaussDice(seed, SALT.latitude, 100 + slot, epoch));
  out.lon =
    TAU * dice(seed, SALT.longitude, 100 + slot, epoch) + lagBehindEquator(out.lat, time - birth);
  out.tilt = CHANNEL_TILT_SCATTER_RAD * gaussDice(seed, SALT.channel, slot, epoch);
  out.length = between(QUIESCENT_LENGTH_R, dice(seed, SALT.length, slot, epoch));
  out.height = between(QUIESCENT_HEIGHT_R, dice(seed, SALT.height, slot, epoch));
}

/** A prominence along a region's neutral line; lifted away when its region erupts. */
function activeProminence(region: Region, outbreak: Outbreak, slot: number, out: Prominence) {
  out.lat = region.lat;
  out.lon = region.lon;
  out.tilt = region.tilt + Math.PI / 2;
  out.length = ACTIVE_PROMINENCE_LENGTH * region.size;
  out.height = ACTIVE_PROMINENCE_HEIGHT_R;
  out.lift = 0;
  out.erupting = 0;
  out.fade = region.strength;
  if (outbreak.slot !== slot) return;
  const { s } = outbreak;
  out.erupting = s;
  out.lift = PROMINENCE_LIFT * smoothstep(ERUPTION_STAGES.storage, ERUPTION_STAGES.breakaway, s);
  out.fade *= 1 - smoothstep(ERUPTION_STAGES.rise, 1, s);
}

/* ----------------------------------------------------------------- forecast */

/**
 * A forecast writes the weather at any moment into the same slots each call. `scrub`, when
 * given, puts the eruption at that point of its timeline over the strongest region (or a
 * stand-in in the first slot when the Sun is quiet).
 */
export function createForecast(weather = blankWeather(), observed: readonly ObservedRegion[] = []) {
  function at(seed: number, time: number, cycleCount: number, scrub: number | null = null) {
    const phase = cyclePhaseOf(cycleCount);
    const cycleNumber = cycleNumberOf(cycleCount);
    const activity = activityAt(phase);
    const { outbreak } = weather;
    outbreak.slot = -1;
    outbreak.regionId = 0;
    outbreak.s = 0;
    outbreak.flux = 0;
    let latestOnset = -Infinity;
    let groups = 0;
    let spots = 0;

    weather.regions.forEach((region, slot) => {
      const seen = observed[slot];
      let who: Birth | null = null;
      if (seen && placeObserved(seen, time, cycleNumber, region)) {
        /* Its flares and faculae follow the same rules as a statistical region's. */
        const life = regionLife(seen.size);
        who = { id: region.id, birth: time - region.age, life, size: seen.size, windowStart: 0 };
      } else {
        who = birthOf(seed, slot, time, activity);
        /* A slot an observed region held opens to the statistical weather once it has died. */
        if (who && seen && who.birth < observedDeath(seen)) who = null;
        const age = who ? time - who.birth : -1;
        if (!who || age < 0 || age > who.life) return clearRegion(region);
        region.age = age;
        placeRegion(seed, slot, who, phase, cycleNumber, region);
        region.strength = regionStrength(age / who.life);
      }
      const age = region.age;
      const share = age / who.life;
      region.facula =
        smoothstep(0, REGION_EMERGENCE_SHARE, share) *
        (FACULA_AT_PRIME + (1 - FACULA_AT_PRIME) * (1 - region.strength)) *
        (1 - smoothstep(FACULA_FADE_SHARE, 1, share));
      flaresOf(seed, who, age, flareSum);
      region.flare = flareSum.light;
      const since = age - flareSum.eruptingOnset + ERUPTION_LEAD_S;
      if (
        flareSum.eruptingFlux > 0 &&
        since < ERUPTION_SECONDS &&
        flareSum.eruptingOnset > latestOnset
      ) {
        latestOnset = flareSum.eruptingOnset;
        outbreak.slot = slot;
        outbreak.regionId = region.id;
        outbreak.s = since / ERUPTION_SECONDS;
        outbreak.flux = flareSum.eruptingFlux;
      }
      if (region.strength > GROUP_VISIBLE_STRENGTH) {
        groups++;
        spots +=
          1 +
          Math.round(SPOTS_PER_REGION * region.strength * (region.size / REGION_SIZE_MEDIAN_RAD));
      }
    });

    if (scrub !== null) {
      let slot = -1;
      let best = 0;
      weather.regions.forEach((region, k) => {
        const weight = region.strength * region.size;
        if (weight > best) {
          best = weight;
          slot = k;
        }
      });
      if (slot < 0) {
        slot = 0;
        demoRegion(seed, phase, cycleNumber, weather.regions[0]!);
      }
      outbreak.slot = slot;
      outbreak.regionId = weather.regions[slot]!.id;
      outbreak.s = clamp01(scrub);
      outbreak.flux = 2 * ERUPTING_FLUX;
    }

    weather.prominences.forEach((prominence, slot) => {
      if (slot < QUIESCENT_SLOTS) return quiescentProminence(seed, slot, time, phase, prominence);
      const regionSlot = slot - QUIESCENT_SLOTS;
      const region = weather.regions[regionSlot];
      if (!region || region.strength <= 0) return clearProminence(prominence);
      activeProminence(region, outbreak, regionSlot, prominence);
    });

    weather.groups = groups;
    weather.spots = spots;
    weather.wolfNumber = wolfNumber(groups, spots);
    return weather;
  }

  return { at, weather };
}

/** The weather at one moment, in slots of its own. */
export const weatherAt = (
  seed: number,
  time: number,
  cycleCount: number,
  scrub: number | null = null,
) => createForecast().at(seed, time, cycleCount, scrub);
