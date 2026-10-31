"use client";

import { useFormatter, useTranslations } from "next-intl";

import { HrDiagram } from "@/components/simulations/hr-diagram";
import { Rail, RailSection } from "@/components/simulations/rail";
import { hrPointsOf, type HrPoint } from "@/space/hr-diagram";
import { blackbodyColor, cssColor } from "@horizon/toolkit/science";

import { sunAt } from "../lib/model/sun";
import { INNER_IDS, ORBITS_AU, lostBy, orbitAt, type OrbitId } from "../lib/model/worlds";
import { useAfterglow } from "../lib/store";

/** The stars the Sun's dot walks among: a dwarf's end, the giants it will be, a cool neighbour. */
const COMPANY = hrPointsOf(["sirius", "sirius-b", "arcturus", "betelgeuse", "proxima", "vega"]);

/** The map's reach, au, and its box in SVG units. */
const REACH_AU = 1.9;
const SIZE = 240;
const HALF = SIZE / 2;
const SCALE = HALF / REACH_AU;
/** The orbits the map draws, inside its reach. */
const ORBITS: readonly OrbitId[] = ["mercury", "venus", "earth", "mars"];

/** The inner orbits from above, each widened as the Sun loses mass, the Sun's edge closing on them. */
function OrbitMap() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const age = useAfterglow((s) => s.age);
  const sun = sunAt(age);
  const sunPx = Math.min(HALF * 1.2, sun.radiusAu * SCALE);
  const zone = sun.zone;
  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full text-fg-secondary"
        role="img"
        aria-label={t("atlas.mapLabel", {
          radius: f.number(sun.radiusAu, { maximumSignificantDigits: 2 }),
        })}
      >
        {/* The habitable zone, where it lies within the reach. */}
        {zone.inner < REACH_AU ? (
          <circle
            cx={HALF}
            cy={HALF}
            r={Math.min(HALF, ((zone.inner + Math.min(zone.outer, REACH_AU)) / 2) * SCALE)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={Math.max(0, (Math.min(zone.outer, REACH_AU) - zone.inner) * SCALE)}
          />
        ) : null}
        {ORBITS.map((id) => {
          const r = orbitAt(id, sun.mass) * SCALE;
          const lost = lostBy(id, age);
          return (
            <g key={id}>
              <circle
                cx={HALF}
                cy={HALF}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeOpacity={lost ? 0.15 : 0.45}
                strokeDasharray={lost ? "2 3" : undefined}
              />
              <circle
                cx={HALF + r}
                cy={HALF}
                r={2}
                className={lost ? "fill-current opacity-30" : "fill-fg-primary"}
              />
              <text
                x={HALF + r + 4}
                y={HALF - 4}
                className="fill-current font-mono text-[7px]"
                opacity={lost ? 0.4 : 1}
              >
                {t(`names.${id}`)}
              </text>
            </g>
          );
        })}
        <circle
          cx={HALF}
          cy={HALF}
          r={Math.max(1.5, sunPx)}
          fill={cssColor(blackbodyColor(sun.teff))}
          fillOpacity={0.85}
        />
        <text x={6} y={SIZE - 6} className="fill-current font-mono text-[7px]">
          {t("units.auValue", { value: f.number(ORBITS_AU.mars, { maximumSignificantDigits: 2 }) })}
        </text>
      </svg>
      <figcaption className="text-xs text-fg-secondary">{t("atlas.mapNote")}</figcaption>
    </figure>
  );
}

/** The HR diagram with the Sun's dot where the track puts it now. */
function SunOnDiagram() {
  const t = useTranslations("afterglow");
  const age = useAfterglow((s) => s.age);
  const sun = sunAt(age);
  const here: HrPoint = { id: "sun", kelvin: sun.teff, light: sun.luminosity, radius: sun.radius };
  return (
    <HrDiagram
      namespace="afterglow"
      points={[...COMPANY, here]}
      nameOf={(id) => t(`names.${id}`)}
      focus="sun"
      compact
    />
  );
}

/** Behind one toolbar button: the inner orbits from above and the Sun's walk on the HR diagram. */
export function AtlasPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("afterglow");
  const lost = useAfterglow((s) => INNER_IDS.filter((id) => lostBy(id, s.age)).length);
  return (
    <Rail
      id="afterglow-atlas"
      title={t("atlas.title")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <RailSection title={t("atlas.orbits")} count={lost}>
        <OrbitMap />
      </RailSection>
      <RailSection title={t("hr.title")}>
        <SunOnDiagram />
      </RailSection>
    </Rail>
  );
}
