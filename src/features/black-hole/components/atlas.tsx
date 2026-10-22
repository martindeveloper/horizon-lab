import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { useSelectHole } from "@/features/black-hole/hooks/use-select-hole";
import {
  ATLAS,
  BAR,
  DISK_STARS,
  DISTANCE_ROWS,
  MAP_HALF_KPC,
  R0_KPC,
  SPIRAL_ARMS,
  atlasFor,
  xyToPct,
  type AtlasSite,
} from "@/features/black-hole/lib/atlas";
import { figureArgs } from "@/features/black-hole/lib/figures";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { Kicker, cn, kickerClass, useFocusHandoff } from "@horizon/toolkit/ui";

const SCALE_KPC = 5;
/** The bar's minor over major axis as drawn. */
const BAR_ASPECT = 1.15 / 3.5;

function Marker({
  site,
  active,
  dim,
  onPick,
  onHover,
}: {
  site: AtlasSite;
  active: boolean;
  dim: boolean;
  onPick: (site: AtlasSite) => void;
  onHover: (id: string | null) => void;
}) {
  const t = useTranslations("blackHole");
  const pos = site.x != null && site.y != null ? xyToPct(site.x, site.y) : null;
  if (!pos) return null;
  const hole = Boolean(site.preset);
  const showLabel = site.label === "always" || dim;
  return (
    <button
      type="button"
      onClick={() => onPick(site)}
      onPointerEnter={() => onHover(site.id)}
      onPointerLeave={() => onHover(null)}
      style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
      className={cn(
        "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
        hole ? "cursor-pointer" : "cursor-default",
      )}
      aria-label={hole ? `${t("open")} ${siteName(site, t)}` : siteName(site, t)}
    >
      <span
        className={cn(
          "relative flex items-center justify-center",
          hole ? "size-11 md:size-9" : "size-9 md:size-7",
        )}
      >
        {hole ? (
          <>
            <span
              className={cn(
                "absolute size-3 rounded-full border",
                active ? "border-fg-primary" : "border-accent/80",
              )}
            />
            <span className={cn("size-1.5 rounded-full", active ? "bg-fg-primary" : "bg-accent")} />
          </>
        ) : (
          <span
            className={cn(
              "size-1 rounded-full",
              dim || active ? "bg-fg-primary" : "bg-fg-secondary",
            )}
          />
        )}
      </span>
      {showLabel ? (
        <span
          className={cn(
            "mt-0.5 rounded-full px-1.5 py-0.5 font-mono text-xs tracking-widest uppercase",
            hole ? "glass-hud" : "",
            active || dim ? "text-fg-primary" : "text-fg-secondary",
          )}
        >
          {siteName(site, t)}
        </span>
      ) : null}
    </button>
  );
}

/** A site's lines, its catalogue figures filled in (`figureArgs`). */
function siteCopy(
  site: AtlasSite,
  t: ReturnType<typeof useTranslations>,
  figures: Record<string, string>,
) {
  return {
    name: siteName(site, t),
    found: t(`atlasSites.${site.id}.found`),
    source: t(`atlasSites.${site.id}.source`, figures),
    distance: t(`atlasSites.${site.id}.distance`, figures),
    mass: t(`atlasSites.${site.id}.mass`, figures),
  };
}

function siteName(site: AtlasSite, t: ReturnType<typeof useTranslations>) {
  return t(`atlasSites.${site.id}.name`);
}

function Fact({ site }: { site: AtlasSite }) {
  const t = useTranslations("blackHole");
  const copy = siteCopy(site, t, figureArgs(useLocale()));
  const kindBit =
    site.kind === "lab"
      ? `${t("kindTheory")}  ·  `
      : site.kind === "hole" || site.kind === "extragalactic"
        ? `${t("kindCatalog")}  ·  `
        : "";
  return (
    <div className="anim-fade">
      <Kicker>
        {kindBit}
        {copy.found}
      </Kicker>
      <h3 className="mt-1 font-display text-xl font-medium tracking-tight text-fg-primary">
        {copy.name}
      </h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-xs text-fg-secondary">
        {site.ra !== "-" ? (
          <>
            <dt className="text-fg-tertiary">RA</dt>
            <dd className="text-fg-primary">{site.ra}</dd>
            <dt className="text-fg-tertiary">Dec</dt>
            <dd className="text-fg-primary">{site.dec}</dd>
          </>
        ) : null}
        <dt className="text-fg-tertiary">{t("gal")}</dt>
        <dd className="text-fg-primary">
          {site.lon} · {site.lat}
        </dd>
        <dt className="text-fg-tertiary">D</dt>
        <dd className="text-fg-primary">{copy.distance}</dd>
        <dt className="text-fg-tertiary">M</dt>
        <dd className="text-fg-primary">{copy.mass}</dd>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-fg-tertiary">{copy.source}</p>
    </div>
  );
}

export function AtlasOverlay() {
  const t = useTranslations("blackHole");
  const locale = useLocale();
  const presetId = useBlackHole((s) => s.presetId);
  const selectHole = useSelectHole();
  const setMapOpen = useBlackHole((s) => s.setMapOpen);
  const [inspect, setInspect] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const selected = atlasFor(inspect ?? "") ?? ATLAS.find((s) => s.preset === presetId) ?? ATLAS[0]!;
  const lit = hover ?? inspect;
  const sun = xyToPct(R0_KPC, 0);
  const disk = ATLAS.filter((s) => s.x != null && s.y != null);
  const ids = `arm${useId().replace(/[^\w-]/g, "")}`;

  const dialog = useRef<HTMLDivElement>(null);
  useFocusHandoff(dialog, () => document.querySelector<HTMLElement>('[data-return="atlas"]'));

  function pick(site: AtlasSite) {
    setInspect(site.id);
    if (site.preset) {
      selectHole(site.preset);
      setMapOpen(false);
    }
  }

  function show(site: AtlasSite) {
    setInspect(site.id);
  }

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atlas-title"
      tabIndex={-1}
      className="pad-safe pointer-events-auto absolute inset-0 z-[80] flex anim-fade flex-col bg-surface-primary/80 outline-hidden"
    >
      <header className="flex items-center justify-between gap-3 pb-3 md:px-6 md:py-3">
        <div>
          <Kicker>{t("atlasKicker")}</Kicker>
          <h2
            id="atlas-title"
            className="font-display text-lg font-medium tracking-tight text-fg-primary md:text-xl"
          >
            {t("atlasTitle")}
          </h2>
        </div>
        <button
          type="button"
          className="glass-hud relative flex h-8 shrink-0 items-center rounded-full px-3 text-xs tracking-widest text-fg-primary uppercase not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-1.5"
          onClick={() => setMapOpen(false)}
        >
          <X className="mr-1.5 icon size-icon-compact" />
          {t("close")}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain md:grid-cols-[minmax(0,1.4fr)_20rem] md:gap-4 md:px-6 md:pb-6">
        <section className="glass-panel [container-type:size] relative min-h-[min(calc(100vw-2rem),52dvh)] overflow-hidden rounded-panel md:h-full md:min-h-0">
          <Kicker className="absolute top-3 left-3 z-20">{t("milkyWayMap")}</Kicker>
          {/* One square frame for the map, markers and scale, so they share coordinates. */}
          <div className="absolute top-1/2 left-1/2 size-[min(100cqw,100cqh)] -translate-x-1/2 -translate-y-1/2">
            <svg
              viewBox={`${-MAP_HALF_KPC} ${-MAP_HALF_KPC} ${MAP_HALF_KPC * 2} ${MAP_HALF_KPC * 2}`}
              className="absolute inset-0 size-full text-fg-secondary"
              aria-hidden
            >
              <g transform="scale(1 -1)">
                {/* Bar: the shared Galaxy model's half-length and angle, near end at ℓ > 0. */}
                <ellipse
                  cx="0"
                  cy="0"
                  rx={BAR.halfKpc}
                  ry={BAR.halfKpc * BAR_ASPECT}
                  transform={`rotate(${-BAR.angleDeg})`}
                  fill="currentColor"
                  fillOpacity="0.14"
                />
                <circle
                  r="13.2"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.16"
                  strokeWidth="0.04"
                />
                <circle
                  r={R0_KPC}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.2"
                  strokeWidth="0.03"
                  strokeDasharray="0.18 0.22"
                />
                {DISK_STARS.map((s, i) => (
                  <circle
                    key={i}
                    cx={s.x}
                    cy={s.y}
                    r={s.r}
                    fill="currentColor"
                    fillOpacity="0.28"
                  />
                ))}
                {SPIRAL_ARMS.map((arm) => (
                  <path
                    key={arm.id}
                    d={arm.d}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.38"
                    strokeWidth="0.42"
                    strokeLinecap="round"
                  />
                ))}
              </g>
              {/* Names follow their arms; label paths are already in screen space (Y down). */}
              {SPIRAL_ARMS.map((arm) => (
                <g key={`${arm.id}-label`}>
                  <path id={`${ids}-${arm.id}`} d={arm.label} fill="none" />
                  <text
                    fill="currentColor"
                    fillOpacity="0.5"
                    fontSize="0.48"
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    dy={arm.side === "above" ? -0.36 : 0.7}
                  >
                    <textPath href={`#${ids}-${arm.id}`} startOffset="50%" textAnchor="middle">
                      {t(`spiralArms.${arm.id}`)}
                    </textPath>
                  </text>
                </g>
              ))}
            </svg>

            <span
              className="absolute z-[1] size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-primary"
              style={{ left: `${sun.left}%`, top: `${sun.top}%` }}
            />
            <span
              className="absolute z-[1] -translate-x-1/2 font-mono text-xs tracking-widest text-fg-tertiary uppercase"
              style={{ left: `${sun.left}%`, top: `calc(${sun.top}% + 8px)` }}
            >
              {t("sun")}
            </span>

            {disk.map((site) => (
              <Marker
                key={site.id}
                site={site}
                active={site.preset === presetId || lit === site.id}
                dim={lit === site.id}
                onPick={pick}
                onHover={setHover}
              />
            ))}

            <p className="absolute right-3 bottom-3 flex items-center gap-2 font-mono text-xs text-fg-tertiary">
              <span
                className="inline-block h-px bg-border-strong"
                style={{ width: `${(SCALE_KPC / (2 * MAP_HALF_KPC)) * 100}cqmin` }}
              />
              {SCALE_KPC} kpc
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-3 md:gap-4">
          <section className="glass-panel rounded-panel p-3.5 md:p-4">
            <div className="min-h-[13.5rem]" aria-live="polite">
              <Fact site={selected} />
            </div>
            {selected.preset ? (
              <button
                type="button"
                className="glass-hud mt-4 h-11 rounded-full px-3 font-mono text-xs tracking-widest text-fg-primary uppercase md:h-8"
                onClick={() => pick(selected)}
              >
                {t("open")} {siteName(selected, t)}
              </button>
            ) : (
              <Kicker className="mt-3">{t("landmark")}</Kicker>
            )}
          </section>

          <section className="glass-panel rounded-panel p-3.5 md:p-4">
            <h3 className={kickerClass}>{t("localGroup")}</h3>
            <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
              {t("localGroupBody", figureArgs(locale))}
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {DISTANCE_ROWS.map((row) => {
                const s = atlasFor(row.id)!;
                const fly = Boolean(s.preset);
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={inspect === s.id}
                    onClick={() => show(s)}
                    className={cn(
                      "glass-hud flex min-h-11 items-center justify-between rounded-control px-3 py-2 text-left md:min-h-0",
                      fly ? "cursor-pointer text-fg-primary" : "cursor-default text-fg-secondary",
                      inspect === s.id && "text-fg-primary",
                    )}
                  >
                    <span>{siteName(s, t)}</span>
                    <span className="font-mono text-xs text-fg-tertiary">{row.k}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="glass-panel rounded-panel p-3.5 md:p-4">
            <h3 className={kickerClass}>{t("theorySolutions")}</h3>
            <p className="mt-1 mb-3 text-xs text-fg-secondary">{t("theoryBody")}</p>
            <div className="flex flex-col gap-1.5">
              {ATLAS.filter((s) => s.kind === "lab").map((site) => (
                <button
                  key={site.id}
                  type="button"
                  aria-pressed={inspect === site.id}
                  onClick={() => show(site)}
                  className={cn(
                    "glass-hud min-h-11 rounded-control px-3 py-2 text-left text-sm md:min-h-0",
                    inspect === site.id || presetId === site.preset
                      ? "text-fg-primary"
                      : "text-fg-secondary hover:text-fg-primary",
                  )}
                >
                  {siteName(site, t)}
                  <span className="ml-2 font-mono text-xs text-fg-tertiary">{site.lon}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
