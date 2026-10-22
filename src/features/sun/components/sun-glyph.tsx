import { LAYER_ZONES, type LayerId } from "@/space/sun/model/structure";

import type { PlaceId } from "../lib/model/places";
import type { ViewId } from "../lib/model/views";

/**
 * Where a place or a view is on the Sun, drawn small beside its name: a layer as its band of the
 * cut (`LAYER_ZONES`, to scale), the whole star, a feature on its face, spots in both hemispheres
 * (the cycle's belts), an arch over its limb, a shell of its atmosphere, streams leaving it, or
 * the probe out in the corona. Atmospheric shells stand at schematic heights: to scale they
 * would sit on the limb.
 */
type Mark =
  | { kind: "star" | "face" | "belts" | "arch" | "streams" | "probe" }
  | { kind: "layer"; id: LayerId }
  | { kind: "shell"; at: number };

/** Schematic heights of the atmosphere's shells, in radii. */
const CHROMOSPHERE = 1.25;
const CORONA = 1.75;

const MARKS: Readonly<Record<PlaceId, Mark>> = {
  star: { kind: "star" },
  core: { kind: "layer", id: "core" },
  radiativeZone: { kind: "layer", id: "radiativeZone" },
  tachocline: { kind: "layer", id: "tachocline" },
  convectionZone: { kind: "layer", id: "convectionZone" },
  photosphere: { kind: "layer", id: "photosphere" },
  granule: { kind: "face" },
  sunspot: { kind: "face" },
  facula: { kind: "face" },
  chromosphere: { kind: "shell", at: CHROMOSPHERE },
  spicule: { kind: "arch" },
  prominence: { kind: "arch" },
  flare: { kind: "arch" },
  loops: { kind: "arch" },
  corona: { kind: "shell", at: CORONA },
  streamer: { kind: "streams" },
  ejection: { kind: "arch" },
  wind: { kind: "streams" },
  parker: { kind: "probe" },
};

/** Each view by what it shows most: the cut by the core, the eruption by its arch. */
const VIEW_MARKS: Readonly<Record<ViewId, Mark>> = {
  surface: MARKS.star,
  inside: MARKS.core,
  sunspot: MARKS.sunspot,
  chromosphere: MARKS.chromosphere,
  corona: MARKS.corona,
  eruption: MARKS.flare,
  cycle: { kind: "belts" },
  orbit: MARKS.parker,
};

/** The disc's radius in the glyph's 20-unit box, and the thinnest line drawn. */
const R = 5;
const HAIR = 0.9;
const STREAMS = [-150, -90, -30, 30, 90, 150].map((deg) => (deg * Math.PI) / 180);

function markOf(mark: Mark) {
  switch (mark.kind) {
    case "star":
      return <circle r={R} fill="currentColor" />;
    case "layer": {
      const zone = LAYER_ZONES.find((z) => z.id === mark.id)!;
      const width = Math.max(HAIR, (zone.outer - zone.inner) * R);
      return zone.inner === 0 ? (
        <circle r={zone.outer * R} fill="currentColor" />
      ) : (
        <circle
          r={Math.min(R, ((zone.inner + zone.outer) / 2) * R)}
          fill="none"
          stroke="currentColor"
          strokeWidth={width}
        />
      );
    }
    case "face":
      return <circle cx={1.6} cy={-1.4} r={1.3} fill="currentColor" />;
    case "belts":
      return (
        <path
          d="M -2.2 -1.8 h 4.4 M -2.2 1.8 h 4.4"
          stroke="currentColor"
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeDasharray="0.1 2"
        />
      );
    case "arch":
      return (
        <path
          d={`M -2 ${-Math.sqrt(R * R - 4)} C -2.6 -9.4, 2.6 -9.4, 2 ${-Math.sqrt(R * R - 4)}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={HAIR}
        />
      );
    case "shell":
      return <circle r={mark.at * R} fill="none" stroke="currentColor" strokeWidth={HAIR} />;
    case "streams":
      return (
        <path
          d={STREAMS.map(
            (a) =>
              `M ${(R + 1.2) * Math.cos(a)} ${(R + 1.2) * Math.sin(a)} L ${9.6 * Math.cos(a)} ${9.6 * Math.sin(a)}`,
          ).join(" ")}
          stroke="currentColor"
          strokeWidth={HAIR}
          strokeDasharray="1.2 1"
        />
      );
    case "probe":
      return <circle cx={6.8} cy={-6.2} r={1.4} fill="currentColor" />;
  }
}

function SunGlyph({ mark }: { mark: Mark }) {
  return (
    <svg aria-hidden viewBox="-10 -10 20 20" className="size-5 rounded-full text-accent">
      <circle
        r={R}
        fill="currentColor"
        fillOpacity={0.14}
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={0.75}
      />
      {markOf(mark)}
    </svg>
  );
}

export const PlaceGlyph = ({ id }: { id: PlaceId }) => <SunGlyph mark={MARKS[id]} />;

export const ViewGlyph = ({ id }: { id: ViewId }) => <SunGlyph mark={VIEW_MARKS[id]} />;
