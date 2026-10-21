import { dopplerWavelengthRatio } from "@horizon/toolkit/science";

import { LINES, NAMED, markWeight, type ElementId, type Line } from "../../lib/model/atoms";
import { depthAt, emissionAt, type Spectrum } from "../../lib/model/spectrum";
import { BAND_HEADS } from "../../lib/model/telluric";
import type { ViewId } from "../../lib/model/view-ids";

/** A formed line in the window: where it sits and how strongly it shows, 0–1. */
export type Visible = { line: Line; centre: number; strength: number };

/** The formed lines inside the window that show at all, by wavelength. */
export function visibleLines(
  formed: readonly { line: Line; centre: number }[],
  spectrum: Spectrum,
  from: number,
  to: number,
  glowing: boolean,
): Visible[] {
  const out: Visible[] = [];
  for (const { line, centre } of formed) {
    if (centre < from || centre > to) continue;
    const strength = glowing ? emissionAt(spectrum, centre) : depthAt(spectrum, centre);
    if (strength > 0.015) out.push({ line, centre, strength });
  }
  return out.sort((a, b) => a.centre - b.centre);
}

/** The visible line within `tolerance` nm of a wavelength, the nearest if several. */
export function nearestVisible(visible: readonly Visible[], nm: number, tolerance: number) {
  let best: Visible | null = null;
  for (const v of visible)
    if (
      Math.abs(v.centre - nm) <= tolerance &&
      (!best || Math.abs(v.centre - nm) < Math.abs(best.centre - nm))
    )
      best = v;
  return best;
}

export type LineLabel = { key: string; x: number; text: string; letter: boolean };

/**
 * Names over the lines: Fraunhofer's letters on the Sun (and the air's bands), species when
 * zoomed in. `x` is the fraction of the window. Labels that would touch an earlier one (the
 * strongest, or Fraunhofer's order) are left out.
 */
export function lineLabels(input: {
  visible: readonly Visible[];
  letters: boolean;
  view: ViewId;
  velocity: number;
  air: boolean;
  identify: boolean;
  span: number;
  width: number;
  xOf: (nm: number) => number;
  name: (line: Line) => string;
}): LineLabel[] {
  const { visible, letters, view, velocity, air, identify, span, width, xOf, name } = input;
  const out: LineLabel[] = [];
  if (letters && view === "sun") {
    const formedIds = new Set(visible.map((v) => v.line.id));
    for (const named of NAMED) {
      if (!named.letter || !formedIds.has(named.line.id)) continue;
      const centre = named.line.wavelength * dopplerWavelengthRatio(velocity);
      out.push({ key: named.line.id, x: xOf(centre), text: named.letter, letter: true });
    }
    if (air)
      for (const [letter, head] of Object.entries(BAND_HEADS))
        out.push({ key: letter, x: xOf(head), text: letter, letter: true });
  } else if (identify && span < 25) {
    for (const v of [...visible].sort((a, b) => b.strength - a.strength).slice(0, 10))
      out.push({ key: v.line.id, x: xOf(v.centre), text: name(v.line), letter: false });
  }
  const placed: LineLabel[] = [];
  const room = width > 0 ? (out.some((l) => !l.letter) ? 56 : 14) / width : 0;
  for (const label of out)
    if (label.x >= 0 && label.x <= 1 && placed.every((p) => Math.abs(p.x - label.x) > room))
      placed.push(label);
  return placed;
}

/** A laboratory line under the spectrum: its place in the window and how boldly it is drawn. */
export type Marker = { line: Line; x: number; weight: number };

/**
 * The lab lines of the marked elements in the window, shifted by `markerShift` (λ/λ₀): the
 * element in focus in full weight, the others faint.
 */
export function markerLines(
  marked: readonly ElementId[],
  focus: ElementId | null,
  markerShift: number,
  xOf: (nm: number) => number,
): Marker[] {
  return marked.flatMap((element) =>
    LINES.filter((l) => l.element === element)
      .map((l) => ({
        line: l,
        x: xOf(l.wavelength * markerShift),
        weight: markWeight(l) * (element === focus ? 1 : 0.3),
      }))
      .filter(({ x }) => x >= 0 && x <= 1),
  );
}

/** The focused element's strongest lines in view, named under the ribbon, at most six apart. */
export function markerLabels(
  markers: readonly Marker[],
  focus: ElementId | null,
  width: number,
  name: (line: Line) => string,
) {
  if (!focus) return [];
  const out: { key: string; x: number; text: string }[] = [];
  const room = width > 0 ? 76 / width : 0;
  for (const m of markers
    .filter((m) => m.line.element === focus)
    .sort((a, b) => b.weight - a.weight)) {
    if (out.length >= 6) break;
    if (out.every((o) => Math.abs(o.x - m.x) > room))
      out.push({ key: m.line.id, x: m.x, text: name(m.line) });
  }
  return out;
}
