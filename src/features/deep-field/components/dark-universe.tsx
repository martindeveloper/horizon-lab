import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Rail, SwitchGroup } from "@/components/simulations/rail";
import { ZoomFigure } from "@/components/simulations/zoom-figure";
import { SOURCES, type SourceId } from "@/lib/sources";
import lensingSource from "@/space/cosmos/model/data/cosmos-web-source.json";
import {
  DARK_HALO,
  HALO_DRAW_RADIUS_KPC,
  HALO_FACTS,
  HALO_FRAME_LY,
  HALO_INPUTS,
  haloDensity,
  haloVisibility,
} from "@/space/galaxy/model/dark-halo";
import { formatFigure, type Unit } from "@horizon/toolkit/science";
import {
  Action,
  Callout,
  ControlRow,
  DataReadout,
  Disclosure,
  Orb,
  SegmentedControl,
  Slider,
  SwitchRow,
  cn,
  kickerClass,
} from "@horizon/toolkit/ui";

import {
  DARK_SOURCE_STATUS,
  DARK_VIEWS,
  EXPANSION_CURVE,
  EXPANSION_DOMAIN,
  EXPANSION_FACTS,
  expansionAt,
  type DarkView,
} from "../lib/model/dark-universe";
import { useDeepField } from "../lib/store";
import { CaptionKey } from "./header-caption";

/** Below this the halo has faded out of the frame (`haloVisibility`): too far in or out to see. */
const HALO_SEEN = 0.004;
const haloInView = (ly: number) => haloVisibility(ly) > HALO_SEEN;

export function DarkSources({ ids }: { ids: readonly (keyof typeof DARK_SOURCE_STATUS)[] }) {
  const t = useTranslations("deepField");
  return (
    <ul className="grid gap-2 text-xs text-fg-secondary">
      {ids.map((id) => (
        <li key={id}>
          <a
            href={SOURCES[id].link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex gap-1 rounded-compact underline decoration-border underline-offset-4 ui-focus hover:decoration-current"
          >
            {t(`dark.sources.${id}`)}
            <ExternalLink aria-hidden className="mt-0.5 icon size-icon-micro" />
          </a>
          <span className="mt-1 block">{t(`atlas.publication.${DARK_SOURCE_STATUS[id]}`)}</span>
        </li>
      ))}
    </ul>
  );
}

export function HaloEvidence() {
  const t = useTranslations("deepField");
  return (
    <div className="grid gap-3">
      <Callout title={t("detailNotes.measurements")}>
        <p>{t("dark.halo.measured")}</p>
      </Callout>
      <Callout title={t("dark.inferred")}>
        <p>{t("dark.halo.inferred")}</p>
      </Callout>
      <DarkSources ids={["feng2026", "brooks2026", "dado2026"]} />
    </div>
  );
}

/**
 * While the halo is on and in frame, its key in the header's top-left slot, as the atlas's key
 * there: the mark and its status. It opens the halo's evidence.
 */
export function HaloLegend() {
  const t = useTranslations("deepField");
  const halo = useDeepField((s) => s.show.halo);
  const ly = useDeepField((s) => s.viewLy);
  if (!halo || !haloInView(ly)) return null;
  return (
    <CaptionKey
      mark={<Orb look="swarm" color="var(--color-space-muted)" size={10} />}
      onClick={() => useDeepField.getState().openDarkView("halo")}
    >
      {t("dark.inferred")}
    </CaptionKey>
  );
}

/**
 * The halo and its density-radius guide, alike in Settings and in the Dark universe panel. The
 * guide needs the halo; turning the halo on where it cannot be seen flies to the Galaxy.
 */
export function HaloSwitches() {
  const t = useTranslations("deepField");
  const locale = useLocale();
  const halo = useDeepField((s) => s.show.halo);
  const boundary = useDeepField((s) => s.show.haloBoundary);
  const radius = formatFigure(locale, HALO_FACTS.r200, { withUnit: true }).text;
  const showHalo = (on: boolean, extra: { haloBoundary?: boolean } = {}) => {
    const api = useDeepField.getState();
    api.patchShow({ halo: on, ...extra });
    if (on && !haloInView(api.viewLy)) {
      api.setView("galaxy");
      api.seekTo(HALO_FRAME_LY);
    }
  };
  return (
    <SwitchGroup>
      <SwitchRow on={halo} onToggle={() => showHalo(!halo)}>
        {t("toggles.halo")}
      </SwitchRow>
      <SwitchRow
        on={halo && boundary}
        onToggle={() =>
          halo && boundary
            ? useDeepField.getState().patchShow({ haloBoundary: false })
            : showHalo(true, { haloBoundary: true })
        }
      >
        {t("dark.halo.boundary", { radius })}
      </SwitchRow>
    </SwitchGroup>
  );
}

/** What a tab's picture is: inferred, reconstructed or calculated, before the picture itself. */
function Status({ children }: { children: ReactNode }) {
  return (
    <p className={cn(kickerClass, "flex items-center gap-2")}>
      <span aria-hidden className="size-1 shrink-0 rounded-full bg-accent" />
      {children}
    </p>
  );
}

/** The halo figure's box and its log axes, as the expansion figure's. */
const FIG = { left: 22, right: 266, top: 22, bottom: 112 };
const R_LOW = HALO_INPUTS.solarRadius.value / 8;
const R_HIGH = HALO_DRAW_RADIUS_KPC;
const RHO_HIGH = Math.log(haloDensity(R_LOW, DARK_HALO));
const RHO_LOW = Math.log(haloDensity(R_HIGH, DARK_HALO));
const haloX = (r: number) =>
  FIG.left + ((FIG.right - FIG.left) * Math.log(r / R_LOW)) / Math.log(R_HIGH / R_LOW);
const haloY = (r: number) =>
  FIG.bottom -
  ((FIG.bottom - FIG.top) * (Math.log(haloDensity(r, DARK_HALO)) - RHO_LOW)) / (RHO_HIGH - RHO_LOW);
const haloPath = (from: number, to: number) =>
  Array.from({ length: 33 }, (_, i) => from * (to / from) ** (i / 32))
    .map((r, i) => `${i ? "L" : "M"}${haloX(r)},${haloY(r)}`)
    .join(" ");
/** Solid where the stars constrain the model, dashed where it is carried on beyond them. */
const CONSTRAINED = haloPath(R_LOW, HALO_INPUTS.constraintRadius.value);
const EXTRAPOLATED = haloPath(HALO_INPUTS.constraintRadius.value, R_HIGH);

/** The model's density against distance from the centre, the Sun and the density radius marked. */
function HaloView() {
  const t = useTranslations("deepField");
  const locale = useLocale();
  const radius = formatFigure(locale, HALO_FACTS.r200, { withUnit: true }).text;
  const sun = HALO_INPUTS.solarRadius.value;
  const r200 = HALO_FACTS.r200.value;
  return (
    <div className="grid gap-4">
      <figure>
        <ZoomFigure title={t("dark.tabs.halo")} label={<Status>{t("dark.inferred")}</Status>}>
          <svg
            viewBox="0 0 280 135"
            role="img"
            aria-label={t("dark.halo.alt")}
            className="w-full text-accent"
          >
            <path
              d={`M${FIG.left} 12V${FIG.bottom}H${FIG.right}`}
              fill="none"
              className="stroke-fg-secondary/40"
            />
            <path d={CONSTRAINED} fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d={EXTRAPOLATED}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path
              d={`M${haloX(r200)} ${FIG.bottom}V${haloY(r200)}`}
              stroke="currentColor"
              opacity="0.4"
              strokeDasharray="3 4"
            />
            <circle cx={haloX(sun)} cy={haloY(sun)} r="3" fill="currentColor" />
            <text x={haloX(sun) + 6} y={haloY(sun) - 6} className="fill-fg-secondary text-[10px]">
              {t("names.sun")}
            </text>
            <text
              x={haloX(r200)}
              y="130"
              textAnchor="middle"
              className="fill-fg-secondary text-[10px]"
            >
              {radius}
            </text>
          </svg>
        </ZoomFigure>
        <figcaption className="text-ui text-fg-secondary">{t("dark.halo.axes")}</figcaption>
      </figure>
      <p className="text-ui leading-relaxed text-fg-secondary">{t("dark.halo.body")}</p>
      <HaloSwitches />
      <DataReadout
        className="grid-cols-2"
        items={[
          { id: "radius", label: t("dark.halo.radiusLabel"), value: radius },
          {
            id: "mass",
            label: t("dark.halo.massWithin", {
              radius: formatFigure(locale, HALO_INPUTS.constraintRadius, { withUnit: true }).text,
            }),
            value: formatFigure(locale, HALO_INPUTS.enclosedMass, { withUnit: true }).text,
          },
        ]}
      />
      <Disclosure summary={t("dark.evidence")}>
        <HaloEvidence />
      </Disclosure>
    </div>
  );
}

type LensingMap = { width: number; height: number; scale: number; values: (number | null)[] };
function isLensingMap(map: unknown): map is LensingMap {
  return (
    typeof map === "object" &&
    map !== null &&
    "width" in map &&
    map.width === lensingSource.width &&
    "height" in map &&
    map.height === lensingSource.height &&
    "scale" in map &&
    typeof map.scale === "number" &&
    Number.isFinite(map.scale) &&
    map.scale > 0 &&
    "values" in map &&
    Array.isArray(map.values) &&
    map.values.length === lensingSource.width * lensingSource.height &&
    map.values.every((v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v)))
  );
}
let mapPromise: Promise<LensingMap> | undefined;
function readLensingMap() {
  return (mapPromise ??= fetch("/data/deep-field/cosmos-web.json")
    .then(async (response) => {
      if (!response.ok) throw new Error("Lensing map unavailable");
      const map: unknown = await response.json();
      if (!isLensingMap(map)) throw new Error("Invalid lensing grid");
      return map;
    })
    .catch((error: unknown) => {
      mapPromise = undefined;
      throw error;
    }));
}

/** The convergence map as pixels: signed κ in two hues, the unsurveyed exterior transparent. */
function lensingPixels(map: LensingMap) {
  const pixels = new ImageData(map.width, map.height);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const value = map.values[y * map.width + x];
      if (value == null) continue;
      // FITS rows run bottom-to-top. Preserve signed convergence; exterior stays transparent.
      const at = ((map.height - 1 - y) * map.width + x) * 4;
      const kappa = value * map.scale;
      const amount = Math.sqrt(
        Math.min(
          1,
          Math.abs(kappa) / (kappa < 0 ? Math.abs(lensingSource.min) : lensingSource.max),
        ),
      );
      const colour = kappa < 0 ? [118, 160, 184] : [231, 196, 138];
      for (let c = 0; c < 3; c++) pixels.data[at + c] = colour[c]!;
      pixels.data[at + 3] = Math.round(20 + amount * 235);
    }
  return pixels;
}

/** A canvas the map is painted on, once its pixels are in; the card and its enlargement each have one. */
function LensingCanvas({
  pixels,
  label,
  className,
}: {
  pixels: ImageData | null;
  label: string;
  className: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (pixels) canvas.current?.getContext("2d")?.putImageData(pixels, 0, 0);
  }, [pixels]);
  return (
    <canvas
      ref={canvas}
      width={lensingSource.width}
      height={lensingSource.height}
      role="img"
      aria-label={label}
      className={className}
    />
  );
}

/** Native grid in a separate sky projection: never extruded into a fictitious 3D surface. */
export function LensingView({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("deepField");
  const [pixels, setPixels] = useState<ImageData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    readLensingMap()
      .then((map) => {
        if (!active) return;
        setPixels(lensingPixels(map));
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <div className="grid gap-4">
      <figure>
        <ZoomFigure
          title={t("dark.tabs.lensing")}
          label={<Status>{t("dark.reconstructed")}</Status>}
        >
          {(zoomed) => (
            <LensingCanvas
              pixels={pixels}
              label={t("dark.lensing.alt")}
              className={`mx-auto w-full rounded-control bg-space ${compact && !zoomed ? "max-h-36 object-contain" : ""}`}
            />
          )}
        </ZoomFigure>
        <figcaption className="mt-2 text-ui leading-relaxed text-fg-secondary">
          {t("dark.lensing.legend")}
        </figcaption>
      </figure>
      {status === "loading" ? (
        <p role="status" className="text-ui text-fg-secondary">
          {t("dark.loading")}
        </p>
      ) : null}
      {status === "error" ? (
        <Action
          variant="glass"
          onClick={() => {
            setStatus("loading");
            retry(attempt + 1);
          }}
        >
          {t("dark.retry")}
        </Action>
      ) : null}
      <Disclosure summary={t("dark.evidence")}>
        <Callout title={t("dark.reconstructed")}>
          <p>{t("dark.lensing.note")}</p>
        </Callout>
        {!compact ? (
          <Callout title={t("detailNotes.measurements")}>
            <p>{t("dark.lensing.measured")}</p>
          </Callout>
        ) : null}
        <DarkSources ids={["cosmosWeb2026"]} />
      </Disclosure>
    </div>
  );
}

export function ExpansionView({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("deepField");
  const locale = useLocale();
  const [a, setA] = useState(1);
  const current = expansionAt(a);
  const number = (value: number, unit: Unit = "ratio", digits = 3) =>
    formatFigure(
      locale,
      { value, unit, digits, source: "planck2018" satisfies SourceId, status: "derived" },
      { withUnit: unit !== "ratio" },
    ).text;
  const earliest = EXPANSION_CURVE[0]!.age;
  const today = EXPANSION_CURVE.at(-1)!.age;
  const x = (age: number) => 22 + (236 * (age - earliest)) / (today - earliest);
  const y = (scale: number) => 112 - 90 * scale;
  const path = EXPANSION_CURVE.map((p, i) => `${i ? "L" : "M"}${x(p.age)},${y(p.a)}`).join(" ");
  return (
    <div className="grid gap-4">
      <figure>
        <ZoomFigure title={t("dark.tabs.expansion")} label={<Status>{t("dark.model")}</Status>}>
          {(zoomed) => (
            <svg
              viewBox="0 0 280 135"
              role="img"
              aria-label={t("dark.expansion.alt")}
              className={`w-full text-accent ${compact && !zoomed ? "max-h-28" : ""}`}
            >
              <path d="M22 12V112H266" fill="none" className="stroke-fg-secondary/40" />
              <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path
                d={`M${x(current.age)} 112V${y(a)}`}
                stroke="currentColor"
                opacity="0.4"
                strokeDasharray="3 4"
              />
              <circle cx={x(current.age)} cy={y(a)} r="3" fill="currentColor" />
              <text x="22" y="130" className="fill-fg-secondary text-[10px]">
                {t("dark.expansion.past")}
              </text>
              <text x="258" y="130" textAnchor="end" className="fill-fg-secondary text-[10px]">
                {t("dark.expansion.today")}
              </text>
            </svg>
          )}
        </ZoomFigure>
        <figcaption className="text-ui text-fg-secondary">{t("dark.expansion.axes")}</figcaption>
      </figure>
      <ControlRow
        label={t("dark.expansion.epoch")}
        value={t("dark.expansion.redshift", { z: number(current.z) })}
      >
        <Slider
          min={EXPANSION_DOMAIN.min}
          max={EXPANSION_DOMAIN.max}
          step={0.005}
          value={[a]}
          aria-label={t("dark.expansion.epoch")}
          valueText={(value) => t("dark.expansion.redshift", { z: number(1 / value - 1) })}
          onValueChange={([value]) => {
            setA(value ?? 1);
            // Reading the diagram should not lose the Guide step while the visitor interacts.
            const api = useDeepField.getState();
            if (api.guideOpen && api.guidePlaying) api.toggleGuidePlaying();
          }}
        />
      </ControlRow>
      <DataReadout
        className="grid-cols-2"
        items={[
          { id: "separation", label: t("dark.expansion.separation"), value: `${number(a)} ×` },
          {
            id: "hubble",
            label: t("dark.expansion.hubble"),
            value: number(current.hubble, "km/s/Mpc"),
          },
          {
            id: "fraction",
            label: t("dark.expansion.fraction"),
            value: number(current.darkEnergy * 100, "percent"),
          },
          {
            id: "acceleration",
            label: t("dark.expansion.acceleration"),
            value: t(
              current.deceleration < 0
                ? "dark.expansion.accelerating"
                : "dark.expansion.decelerating",
            ),
          },
        ]}
      />
      <Disclosure summary={t("dark.evidence")}>
        <Callout title={t("dark.model")}>
          <p>{t("dark.expansion.note")}</p>
        </Callout>
        {!compact ? (
          <>
            <Callout title={t("detailNotes.measurements")}>
              <p>{t("dark.expansion.measured")}</p>
              <p className="mt-2 font-mono">
                {t("dark.expansion.anchor", {
                  z: formatFigure(locale, EXPANSION_FACTS.redshift).text,
                  radial: formatFigure(locale, EXPANSION_FACTS.radial, { style: "error" }).text,
                  transverse: formatFigure(locale, EXPANSION_FACTS.transverse, { style: "error" })
                    .text,
                })}
              </p>
            </Callout>
            <Callout
              tone="warning"
              title={t(`atlas.publication.${DARK_SOURCE_STATUS.desiExpansion2026}`)}
            >
              <p>{t("dark.expansion.provisional")}</p>
            </Callout>
          </>
        ) : null}
        <DarkSources ids={compact ? ["planck2018"] : ["planck2018", "desiExpansion2026"]} />
      </Disclosure>
    </div>
  );
}

/**
 * Dark matter and dark energy, one tab each kind of evidence, every tab alike: what its picture
 * is, the picture, its figures, then the evidence and limits folded under them.
 */
export function DarkUniversePanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("deepField");
  const tab = useDeepField((s) => s.darkView);
  return (
    <Rail
      id="deep-field-dark"
      title={t("dark.title")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <SegmentedControl
        aria-label={t("dark.title")}
        options={DARK_VIEWS.map((value) => ({ value, label: t(`dark.tabs.${value}`) }))}
        value={tab}
        onValueChange={(darkView: DarkView) => useDeepField.setState({ darkView })}
      />
      {tab === "halo" ? <HaloView /> : tab === "lensing" ? <LensingView /> : <ExpansionView />}
    </Rail>
  );
}
