import type { useFormatter } from "next-intl";

import type { Level, Line } from "../lib/model/atoms";

type Format = ReturnType<typeof useFormatter>;

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};
const SUBSCRIPT: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "/": "/",
};
const sup = (s: string) => s.replace(/[0-9]/g, (c) => SUPERSCRIPT[c] ?? c);
const sub = (s: string) => s.replace(/[0-9/]/g, (c) => SUBSCRIPT[c] ?? c);

/** NIST's "3d6.4s2" as "3d⁶4s²"; parent terms ("4F") as "⁴F". */
function configuration(raw: string) {
  return raw
    .split(".")
    .map((part) => {
      const shell = /^(\d+)([spdfgh])(\d*)$/.exec(part);
      if (shell) return `${shell[1]}${shell[2]}${sup(shell[3] ?? "")}`;
      const parent = /^\(?(\d+)([A-Z])\)?(\*?)$/.exec(part);
      if (parent) return `${sup(parent[1]!)}${parent[2]}${parent[3] ? "°" : ""}`;
      return part;
    })
    .join(" ");
}

/** A term and its J as spectroscopists write it: "²P°₃/₂", "a ⁵D₄". */
function term(level: Level) {
  const m = /^([a-z]\s)?(\d+)([A-Z])(\*)?$/.exec(level.term.trim());
  if (!m) return level.term;
  return `${m[1] ?? ""}${sup(m[2]!)}${m[3]}${m[4] ? "°" : ""}${sub(level.j)}`;
}

/** A level: hydrogen's by its principal quantum number, the rest by configuration and term. */
export function levelName(line: Line, level: Level) {
  if (line.species === "H I" || line.species === "He II") {
    const n = Number.parseInt(level.configuration, 10);
    if (Number.isFinite(n)) return `n = ${n}`;
  }
  return `${configuration(level.configuration)} ${term(level)}`.trim();
}

const GREEK = ["α", "β", "γ", "δ", "ε", "ζ", "η"];

/** Hydrogen's Balmer lines by their Greek letters; others by species and wavelength. */
export function lineName(line: Line, f: Format) {
  if (line.species === "H I") {
    const upper = Number.parseInt(line.upperLevel.configuration, 10);
    const letter = GREEK[upper - 3];
    if (letter) return `H${letter}`;
  }
  return `${line.species} ${f.number(line.wavelength, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}`;
}

/** A wavelength, nm, with as many decimals as the window needs. */
export function wavelength(f: Format, nm: number, digits = 2) {
  return f.number(nm, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Decimals that resolve a pixel in a window `span` nm wide. */
export const digitsFor = (span: number) => (span < 2 ? 3 : span < 30 ? 2 : 1);

export const kelvin = (f: Format, k: number) => f.number(Math.round(k));

export const signed = (f: Format, v: number, digits = 0) =>
  f.number(v, { maximumFractionDigits: digits, signDisplay: "exceptZero" });
