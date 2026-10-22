import { SOLAR_VIEWS, solarViewById, type SolarViewId } from "@/space/solar-system/model/views";
import { recordFrom } from "@horizon/toolkit/records";

/** Each view's ring in the glyph's 20-unit box: by the log of its distance, the inner view's smallest. */
const LOW = Math.log(SOLAR_VIEWS[0].dist);
const HIGH = Math.log(SOLAR_VIEWS[SOLAR_VIEWS.length - 1]!.dist);
const RING = recordFrom(
  SOLAR_VIEWS.map((v) => v.id),
  (id) => 2.6 + ((Math.log(solarViewById(id).dist) - LOW) / (HIGH - LOW)) * 6.6,
);

/**
 * A view's reach, as a zoom out: the Sun at the centre, the rings of the views inside it faint
 * and its own in gold, spaced by the log of the distance each frames.
 */
export function ScaleGlyph({ id }: { id: SolarViewId }) {
  const reach = RING[id];
  return (
    <svg aria-hidden viewBox="-10 -10 20 20" className="size-5 rounded-full text-accent">
      <circle r={1.2} fill="currentColor" />
      {SOLAR_VIEWS.filter((v) => RING[v.id] < reach).map((v) => (
        <circle
          key={v.id}
          r={RING[v.id]}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={0.7}
        />
      ))}
      <circle r={reach} fill="none" stroke="currentColor" strokeWidth={1.1} />
    </svg>
  );
}
