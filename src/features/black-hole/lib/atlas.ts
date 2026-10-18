/** Sky catalog for the atlas. Epoch J2000. Positions as of 2026. */
import { keysOf } from "@/lib/records";
import { RAD_PER_DEG as DEG } from "@horizon/toolkit/science";

export type AtlasKind = "hole" | "body" | "extragalactic" | "lab";

/** Positions only; names, distances, masses and notes live in the message catalogs. */
export type AtlasSite = {
  id: string;
  kind: AtlasKind;
  /** If set, tapping opens this observatory preset. */
  preset?: string;
  ra: string;
  dec: string;
  lon: string;
  lat: string;
  label: "always" | "hover";
  /** Galactocentric X, Y in kpc, seen from the north Galactic pole (see xyFromGalactic). */
  x?: number;
  y?: number;
};

/** GRAVITY Collaboration, A&A 657 L12 (2022): R0 = 8277 pc */
export const R0_KPC = 8.277;
export const MAP_HALF_KPC = 14;

/**
 * Face-on map seen from the north Galactic pole, Y up: the Sun sits at +R0 on X,
 * ℓ = 90° points to −Y, and the Galaxy turns clockwise.
 */
export function xyFromGalactic(
  lonDeg: number,
  latDeg: number,
  dKpc: number,
): { x: number; y: number } {
  const l = (lonDeg * Math.PI) / 180;
  const b = (latDeg * Math.PI) / 180;
  const cb = Math.cos(b);
  return {
    x: R0_KPC - dKpc * cb * Math.cos(l),
    y: -dKpc * cb * Math.sin(l),
  };
}

export function xyToPct(x: number, y: number): { left: number; top: number } {
  const h = MAP_HALF_KPC;
  return {
    left: ((x + h) / (2 * h)) * 100,
    top: ((h - y) / (2 * h)) * 100,
  };
}

function site(
  partial: Omit<AtlasSite, "x" | "y"> & {
    lonDeg?: number;
    latDeg?: number;
    dKpc?: number;
    x?: number;
    y?: number;
  },
): AtlasSite {
  const xy =
    partial.x != null && partial.y != null
      ? { x: partial.x, y: partial.y }
      : partial.lonDeg != null && partial.dKpc != null
        ? xyFromGalactic(partial.lonDeg, partial.latDeg ?? 0, partial.dKpc)
        : {};
  const { lonDeg: _l, latDeg: _b, dKpc: _d, ...rest } = partial;
  return { ...rest, ...xy };
}

// ℓ and b are computed from the J2000 RA/Dec. Map distances follow the catalog copy.
export const ATLAS: AtlasSite[] = [
  // GRAVITY Collaboration, A&A 657, L12 (2022)
  site({
    id: "sgr-a",
    kind: "hole",
    preset: "sgr-a",
    ra: "17h 45m 40.04s",
    dec: "-29° 00′ 28.1″",
    lon: "ℓ = 359.94°",
    lat: "b = -0.05°",
    label: "always",
    x: 0,
    y: 0,
  }),
  // Miller-Jones et al., Science 371, 1046 (2021)
  site({
    id: "stellar",
    kind: "hole",
    preset: "stellar",
    ra: "19h 58m 21.68s",
    dec: "+35° 12′ 05.8″",
    lon: "ℓ = 71.34°",
    lat: "b = +3.07°",
    label: "always",
    lonDeg: 71.34,
    latDeg: 3.07,
    dKpc: 2.22,
  }),
  // Gaia Collaboration (Panuzzo et al.), A&A 686, L2 (2024)
  site({
    id: "gaiabh3",
    kind: "hole",
    preset: "gaia-bh3",
    ra: "19h 39m 18.71s",
    dec: "+14° 55′ 54″",
    lon: "ℓ = 51.67°",
    lat: "b = -3.49°",
    label: "hover",
    lonDeg: 51.67,
    latDeg: -3.49,
    dKpc: 0.591,
  }),
  // Reid & Miller-Jones, ApJ 959, 85 (2023)
  site({
    id: "grs1915",
    kind: "body",
    ra: "19h 15m 11.6s",
    dec: "+10° 56′ 44″",
    lon: "ℓ = 45.37°",
    lat: "b = -0.22°",
    label: "always",
    lonDeg: 45.37,
    latDeg: -0.22,
    dKpc: 9.4,
  }),
  // Blundell & Bowler, ApJ 616, L159 (2004)
  site({
    id: "ss433",
    kind: "body",
    ra: "19h 11m 49.6s",
    dec: "+04° 58′ 58″",
    lon: "ℓ = 39.69°",
    lat: "b = -2.24°",
    label: "hover",
    lonDeg: 39.69,
    latDeg: -2.24,
    dKpc: 5.5,
  }),
  // Kounkel et al., ApJ 834, 142 (2017); Maíz Apellániz et al., A&A 657, A131 (2022)
  site({
    id: "orion",
    kind: "body",
    ra: "05h 35m 17s",
    dec: "-05° 23′ 28″",
    lon: "ℓ = 209.01°",
    lat: "b = -19.38°",
    label: "hover",
    lonDeg: 209.01,
    latDeg: -19.38,
    dKpc: 0.39,
  }),
  // η Carinae; Göppl & Preibisch, A&A 660, A11 (2022)
  site({
    id: "carina",
    kind: "body",
    ra: "10h 45m 03s",
    dec: "-59° 41′ 04″",
    lon: "ℓ = 287.60°",
    lat: "b = -0.63°",
    label: "always",
    lonDeg: 287.6,
    latDeg: -0.63,
    dKpc: 2.35,
  }),
  // Centre of Cygnus OB2; Rygl et al., A&A 539, A79 (2012)
  site({
    id: "cygx",
    kind: "body",
    ra: "20h 33m 12s",
    dec: "+41° 19′ 00″",
    lon: "ℓ = 80.22°",
    lat: "b = +0.80°",
    label: "hover",
    lonDeg: 80.22,
    latDeg: 0.8,
    dKpc: 1.4,
  }),
  // Negueruela et al., A&A 664, A146 (2022); Navarete et al., MNRAS 516, 1289 (2022)
  site({
    id: "wd1",
    kind: "body",
    ra: "16h 47m 04s",
    dec: "-45° 51′",
    lon: "ℓ = 339.55°",
    lat: "b = -0.40°",
    label: "hover",
    lonDeg: 339.55,
    latDeg: -0.4,
    dKpc: 4.1,
  }),
  // Baumgardt & Vasiliev, MNRAS 505, 5957 (2021)
  site({
    id: "omegacen",
    kind: "hole",
    preset: "omega-cen",
    ra: "13h 26m 47s",
    dec: "-47° 28′ 46″",
    lon: "ℓ = 309.10°",
    lat: "b = +14.97°",
    label: "hover",
    lonDeg: 309.1,
    latDeg: 14.97,
    dKpc: 5.43,
  }),
  // EHT Collaboration (2019, 2025)
  site({
    id: "m87",
    kind: "extragalactic",
    preset: "m87",
    ra: "12h 30m 49.42s",
    dec: "+12° 23′ 28.0″",
    lon: "ℓ = 283.78°",
    lat: "b = +74.49°",
    label: "always",
  }),
  // SIMBAD (Gaia ICRS); z = 2.219, Shemmer et al., ApJ 614, 547 (2004)
  site({
    id: "ton618",
    kind: "extragalactic",
    preset: "ton-618",
    ra: "12h 28m 24.97s",
    dec: "+31° 28′ 37.6″",
    lon: "ℓ = 170.64°",
    lat: "b = +83.36°",
    label: "always",
  }),
  // LVK, ApJL 993, L25 (2025): two-detector event, no precise position
  site({
    id: "gw231123",
    kind: "extragalactic",
    preset: "gw231123",
    ra: "-",
    dec: "-",
    lon: "z ≈ 0.40",
    lat: "≈ 1,700 deg²",
    label: "always",
  }),
  // Li et al., ApJ 920, 84 (2021); Bender et al., ApJ 631, 280 (2005)
  site({
    id: "m31",
    kind: "extragalactic",
    ra: "00h 42m 44s",
    dec: "+41° 16′ 09″",
    lon: "ℓ = 121.17°",
    lat: "b = -21.57°",
    label: "always",
  }),
  // Pietrzyński et al., Nature 567, 200 (2019)
  site({
    id: "lmc",
    kind: "extragalactic",
    ra: "05h 23m 35s",
    dec: "-69° 45′",
    lon: "ℓ = 280.46°",
    lat: "b = -32.89°",
    label: "always",
  }),
  {
    id: "lensed",
    kind: "lab",
    preset: "lensed",
    ra: "-",
    dec: "-",
    lon: "a/M ≈ 0.82",
    lat: "i ≈ 80°",
    label: "always",
  },
  {
    id: "schwarzschild",
    kind: "lab",
    preset: "schwarzschild",
    ra: "-",
    dec: "-",
    lon: "a = 0",
    lat: "Q = 0",
    label: "always",
  },
  {
    id: "kerr",
    kind: "lab",
    preset: "kerr",
    ra: "-",
    dec: "-",
    lon: "a/M ≈ 0.998",
    lat: "Thorne limit",
    label: "always",
  },
];

export function atlasFor(id: string): AtlasSite | undefined {
  return ATLAS.find((s) => s.id === id);
}

/**
 * One spiral arm from the maser-parallax fit of Reid et al. (2019), ApJ 885, 131,
 * Table 2. β is the Galactocentric azimuth: 0 toward the Sun, growing in the
 * direction of rotation. ln(R / Rkink) = −(β − βkink) tan ψ, with ψ< before
 * the kink and ψ> after it.
 */
export type ArmFit = {
  betaMin: number;
  betaMax: number;
  betaKink: number;
  rKink: number;
  psiBefore: number;
  psiAfter: number;
};

/** The fit assumes R0 = 8.15 kpc; radii are rescaled to this map's R0. */
const FIT_R0_KPC = 8.15;

export function armPoint(fit: ArmFit, betaDeg: number): { x: number; y: number } {
  const psi = betaDeg < fit.betaKink ? fit.psiBefore : fit.psiAfter;
  const r =
    fit.rKink *
    Math.exp(-(betaDeg - fit.betaKink) * DEG * Math.tan(psi * DEG)) *
    (R0_KPC / FIT_R0_KPC);
  return { x: r * Math.cos(betaDeg * DEG), y: -r * Math.sin(betaDeg * DEG) };
}

function polyline(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
    .join(" ");
}

function sample(fit: ArmFit, from: number, to: number) {
  const n = Math.max(2, Math.ceil(Math.abs(to - from) / 1.5));
  return Array.from({ length: n + 1 }, (_, i) => armPoint(fit, from + (i / n) * (to - from)));
}

export function armPath(fit: ArmFit): string {
  return polyline(sample(fit, fit.betaMin, fit.betaMax));
}

/** A stretch of arm in screen space (Y down), running left to right for a text path. */
function labelPath(fit: ArmFit, [from, to]: [number, number]): string {
  const points = sample(fit, from, to).map(({ x, y }) => ({ x, y: -y }));
  if (points[0]!.x > points.at(-1)!.x) points.reverse();
  return polyline(points);
}

// β ranges span the parallax data, except that the fourth-quadrant ends run on to
// the CO tangencies the fits were constrained by (ℓ ≈ 328°, 306°, 286°).
const ARM_FITS = {
  norma: { betaMin: -57, betaMax: 54, betaKink: 18, rKink: 4.46, psiBefore: -1.0, psiAfter: 19.5 },
  scutum: {
    betaMin: -51,
    betaMax: 104,
    betaKink: 23,
    rKink: 4.91,
    psiBefore: 14.1,
    psiAfter: 12.1,
  },
  sagittarius: {
    betaMin: -33,
    betaMax: 97,
    betaKink: 24,
    rKink: 6.04,
    psiBefore: 17.1,
    psiAfter: 1.0,
  },
  orion: { betaMin: -8, betaMax: 34, betaKink: 9, rKink: 8.26, psiBefore: 11.4, psiAfter: 11.4 },
  perseus: {
    betaMin: -23,
    betaMax: 115,
    betaKink: 40,
    rKink: 8.87,
    psiBefore: 10.3,
    psiAfter: 8.7,
  },
  outer: { betaMin: -16, betaMax: 71, betaKink: 18, rKink: 12.24, psiBefore: 3.0, psiAfter: 9.4 },
} satisfies Record<string, ArmFit>;

export type ArmId = keyof typeof ARM_FITS;

/** Where each name runs along its arm: β range in degrees, and which side of the arm. */
const LABELS: Record<ArmId, { beta: [number, number]; side: "above" | "below" }> = {
  norma: { beta: [-55, 10], side: "above" },
  scutum: { beta: [30, 104], side: "above" },
  sagittarius: { beta: [32, 97], side: "above" },
  orion: { beta: [-8, 4], side: "below" },
  perseus: { beta: [-23, 6], side: "below" },
  outer: { beta: [-14, 70], side: "above" },
};

/** Measured arm segments only; the far side of the Galaxy is left blank. */
export const SPIRAL_ARMS: {
  id: ArmId;
  d: string;
  label: string;
  side: "above" | "below";
}[] = keysOf(ARM_FITS).flatMap((id) => {
  const fit = ARM_FITS[id];
  const label = LABELS[id];
  if (fit === undefined || label === undefined) return [];
  return [
    {
      id,
      d: armPath(fit),
      label: labelPath(fit, label.beta),
      side: label.side,
    },
  ];
});

export function diskStars(count = 110): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const u = Math.sin(i * 12.9898) * 43758.5453;
    const v = Math.sin(i * 78.233) * 24634.634;
    const a = u - Math.floor(u);
    const b = v - Math.floor(v);
    const rad = 2.4 + 11.2 * a ** 0.62;
    const th = b * Math.PI * 2;
    out.push({
      x: rad * Math.cos(th),
      y: rad * Math.sin(th),
      r: 0.035 + a * b * 0.07,
    });
  }
  return out;
}

export const DISK_STARS = diskStars();
