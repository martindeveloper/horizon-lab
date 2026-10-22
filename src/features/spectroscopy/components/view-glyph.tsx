import { blackbodyColor, cssRgb, wavelengthColor } from "@horizon/toolkit/science";

import { FULL_RANGE } from "../lib/model/scenes";
import { STARS, STAR_IDS } from "../lib/model/stars";
import type { ViewId } from "../lib/model/view-ids";

/** The swatch: 16 slices across the glyph's 20-unit box, 8 tall. */
const SLICES = 16;
const X = 2;
const Y = 6;
const H = 8;
const share = (i: number) => (i + 0.5) / SLICES;

/** The lab's window in its own colours, violet to red. */
const RAINBOW = Array.from({ length: SLICES }, (_, i) =>
  cssRgb(wavelengthColor(FULL_RANGE[0] + share(i) * (FULL_RANGE[1] - FULL_RANGE[0]))),
);
/** The sequence's stars by the colour of their light, hottest first. */
const SEQUENCE = Array.from({ length: SLICES }, (_, i) =>
  cssRgb(blackbodyColor(STARS[STAR_IDS[Math.floor(share(i) * STAR_IDS.length)]!].teff.kelvin)),
);
/** Where the schematic lines fall across the swatch. */
const LINES = [3, 8, 13];

function Swatch({ colours }: { colours: readonly string[] }) {
  return colours.map((fill, i) => (
    <rect key={i} x={X + i} y={Y} width={1.05} height={H} fill={fill} />
  ));
}

function Lines({ colour, at = LINES }: { colour?: string; at?: readonly number[] }) {
  return at.map((i) => (
    <rect key={i} x={X + i} y={Y} width={0.9} height={H} fill={colour ?? RAINBOW[i]} />
  ));
}

/**
 * A view as a small spectrum: the bench's bright lines on black, the Sun's dark lines across its
 * colours, the sequence's run of star colours, and the mystery's lines, shifted and unnamed.
 */
export function ViewGlyph({ id }: { id: ViewId }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5 rounded-full">
      <rect x={X} y={Y} width={SLICES} height={H} rx={1} className="fill-black" />
      {id === "kirchhoff" ? <Lines /> : null}
      {id === "sun" ? (
        <>
          <Swatch colours={RAINBOW} />
          <Lines colour="black" />
        </>
      ) : null}
      {id === "stars" ? <Swatch colours={SEQUENCE} /> : null}
      {id === "mystery" ? (
        <>
          <Swatch colours={RAINBOW} />
          <Lines colour="black" at={LINES.map((i) => i + 1)} />
        </>
      ) : null}
      <rect
        x={X}
        y={Y}
        width={SLICES}
        height={H}
        rx={1}
        fill="none"
        className="stroke-fg-primary/25"
        strokeWidth={0.5}
      />
    </svg>
  );
}
