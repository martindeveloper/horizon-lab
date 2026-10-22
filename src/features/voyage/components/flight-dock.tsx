import { Hand, Navigation, Orbit, Rocket } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";

import { RateStepper } from "@/components/simulations/rate-stepper";
import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { asideOpen } from "@/lib/scene-store";
import { IconButton, Kicker, SegmentedControl, Tooltip, cn } from "@horizon/toolkit/ui";

import { anchorNameKey } from "../lib/model/anchors";
import type { FlightPhase } from "../lib/model/autopilot";
import { CLOCK_RATES, DRIVE_IDS } from "../lib/model/parameters";
import type { Regime } from "../lib/model/regime";
import { useVoyage } from "../lib/store";
import {
  NONE,
  formatCalendar,
  formatDuration,
  formatGravity,
  formatIrradiance,
  formatRange,
  formatSpeed,
  formatWarp,
} from "./format";
import { Glide } from "./glide";

/** The console never moves for a side panel; where it reaches the panel column, cards end above it. */
const reachesPanels: DockInTheWay = (dock, stage, rem) => dock.right + 22 * rem > stage.right;

/** In orbit about a body, flown by hand, on autopilot to a destination, or wrecked on a surface. */
type Status = "orbit" | "free" | "flight" | "crash";

/** The nearest clock rate to a rate, as the slider's index. */
const stepOf = (rate: number) => {
  let best = 0;
  for (let i = 0; i < CLOCK_RATES.length; i += 1)
    if (
      Math.abs(Math.log(CLOCK_RATES[i]!.value / rate)) <
      Math.abs(Math.log(CLOCK_RATES[best]!.value / rate))
    )
      best = i;
  return best;
};

function Instrument({
  label,
  value,
  lead = false,
  extra,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  lead?: boolean;
  /** A marker after the reading, in the accent. */
  extra?: ReactNode;
  /** A quiet line under the reading. */
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="font-mono text-[10px] tracking-[0.18em] text-fg-tertiary uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate tabular-nums",
          lead
            ? "font-display text-lg font-medium tracking-tight text-fg-primary lg:text-xl"
            : "font-mono text-xs text-fg-primary",
        )}
      >
        {value}
        {extra ? <span className="ml-1.5 text-accent">{extra}</span> : null}
      </dd>
      {sub ? (
        <dd className="mt-0.5 truncate font-mono text-[10px] text-fg-secondary tabular-nums">{sub}</dd>
      ) : null}
    </div>
  );
}

function StatusMark({
  status,
  phase,
  regime,
  compact = false,
}: {
  status: Status;
  phase: FlightPhase | null;
  regime: Regime;
  compact?: boolean;
}) {
  const t = useTranslations("voyage");
  const doing = phase
    ? t(`hud.phase.${phase}`)
    : status === "free" && regime !== "normal"
      ? t(`hud.regime.${regime}`)
      : null;
  return (
    <p className="flex shrink-0 items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-accent uppercase">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--solar)/0.7)]",
          status !== "orbit" && "motion-safe:animate-pulse",
          status === "crash" && "bg-danger shadow-[0_0_8px_var(--color-danger)]",
        )}
      />
      {doing && compact ? doing : t(`hud.state.${status}`)}
      {doing && !compact ? <span className="text-fg-secondary">· {doing}</span> : null}
    </p>
  );
}

/**
 * The helm: take the ship by hand from orbit, settle into orbit about the nearest body, or
 * take a flight off the autopilot where it is.
 */
function HelmButton({ status }: { status: Status }) {
  const t = useTranslations("voyage");
  const label =
    status === "crash"
      ? t("hud.crash.retry")
      : status === "flight"
        ? t("hud.disengage")
        : status === "free"
          ? t("hud.enterOrbit")
          : t("hud.takeHelm");
  const act = () => {
    const api = useVoyage.getState();
    if (status === "crash") api.recover();
    else if (status === "flight") api.disengage();
    else api.setMode(status === "free" ? "orbit" : "free");
  };
  return (
    <Tooltip label={label} side="top" align="end">
      <IconButton aria-label={label} onClick={act}>
        {status === "flight" || status === "crash" ? (
          <Hand className="size-4" />
        ) : status === "free" ? (
          <Orbit className="size-4" />
        ) : (
          <Rocket className="size-4" />
        )}
      </IconButton>
    </Tooltip>
  );
}

/** Opens the destinations: where the autopilot can take the ship, and how long it takes. */
function CourseButton() {
  const t = useTranslations("voyage");
  const open = useVoyage((s) => s.panel === "objects");
  return (
    <Tooltip label={t("hud.setCourse")} side="top" align="end">
      <IconButton
        aria-label={t("hud.setCourse")}
        aria-expanded={open}
        aria-controls={open ? "voyage-objects" : undefined}
        active={open}
        onClick={() => useVoyage.getState().setPanel(open ? "none" : "objects")}
      >
        <Navigation className="size-4" />
      </IconButton>
    </Tooltip>
  );
}

/** Ship seconds per real second; zero pauses both clocks. */
function TimeWarp({ className }: { className?: string }) {
  const t = useTranslations("voyage");
  const f = useFormatter();
  const compression = useVoyage((s) => s.compression);
  const heldCompression = useVoyage((s) => s.heldCompression);
  const flying = useVoyage((s) => s.flying);
  const manual = useVoyage((s) => s.mode === "free");
  const warp = useVoyage((s) => s.warp);
  const held = compression === 0;
  /* The autopilot and the flight assist set their own warp; the steps are for the orbit. */
  const auto = !held && (flying || manual);
  const fixed = flying || manual;
  const holdLabel = held ? t("hud.run") : t("hud.hold");
  const index = stepOf(held ? heldCompression : compression);
  const last = CLOCK_RATES.length - 1;
  const rate = CLOCK_RATES[index]!.id;
  const go = (next: number) => useVoyage.getState().setCompression(CLOCK_RATES[next]!.value);
  return (
    <RateStepper
      label={t("hud.rate")}
      coach="rate"
      className={className}
      running={!held}
      toggleLabel={holdLabel}
      toggleDisabled={flying}
      onToggle={() => useVoyage.getState().toggleHold()}
      slowerLabel={t("hud.slower")}
      fasterLabel={t("hud.faster")}
      slowerDisabled={fixed || index === 0}
      fasterDisabled={fixed || index === last}
      onSlower={() => go(index - 1)}
      onFaster={() => go(index + 1)}
      readout={auto ? formatWarp(t, f, warp) : t(`ratesShort.${rate}`)}
      spoken={auto ? t("hud.warpAuto", { value: formatWarp(t, f, warp) }) : t(`rates.${rate}`)}
      readoutClassName={auto ? "text-accent" : held ? "text-fg-tertiary" : "text-fg-primary"}
    />
  );
}

export function DriveControl({ className = "" }: { className?: string }) {
  const t = useTranslations("voyage");
  const drive = useVoyage((s) => s.drive);
  return (
    /* The control passes no attributes on: its box carries the tour's anchor. */
    <div data-coach="drive" className={className}>
      <SegmentedControl
        aria-label={t("hud.drive")}
        options={DRIVE_IDS.map((id) => ({ value: id, label: t(`drives.${id}`) }))}
        value={drive}
        onValueChange={(next) => useVoyage.getState().setDrive(next)}
      />
    </div>
  );
}

const panelClass = "voyage-holo pointer-events-auto relative flex flex-col gap-2 px-4 py-2.5";

export function FlightDock() {
  const t = useTranslations("voyage");
  const f = useFormatter();
  const locale = useLocale();
  const shipSeconds = useVoyage((s) => s.shipSeconds);
  const earthSeconds = useVoyage((s) => s.earthSeconds);
  const epochMs = useVoyage((s) => s.epochMs);
  const gamma = useVoyage((s) => s.gamma);
  const aim = useVoyage((s) => s.aim);
  const flying = useVoyage((s) => s.flying);
  const cmbKelvin = useVoyage((s) => s.cmbKelvin);
  const mode = useVoyage((s) => s.mode);
  const phase = useVoyage((s) => s.phase);
  const regime = useVoyage((s) => s.regime);
  const crashed = useVoyage((s) => s.crash !== null);
  const gravityFrom = useVoyage((s) => s.gravityFrom);
  /* The live figures glide between the scene's readouts; the clocks tick as clocks do. */
  const speed = useVoyage((s) => s.speed);
  const range = useVoyage((s) => s.range);
  const closing = useVoyage((s) => s.closing);
  const lightToEarth = useVoyage((s) => s.lightToEarth);
  const irradiance = useVoyage((s) => s.irradiance);
  const gravity = useVoyage((s) => s.gravity);
  const unit = useVoyage((s) => s.distanceUnit);
  const aside = useVoyage(asideOpen);
  const invite = useVoyage((s) => !s.flown && !s.guideOpen);
  const surface = useRef<HTMLDivElement>(null);
  useDockClearance(surface, reachesPanels);
  const status: Status = crashed ? "crash" : flying ? "flight" : mode === "free" ? "free" : "orbit";
  const aimName = t(anchorNameKey(aim));
  const calendar = formatCalendar(f, epochMs, earthSeconds);
  /* The clocks part only at speed; the gap is the lesson, so it reads once it is a second. */
  const apart = earthSeconds - shipSeconds;
  const apartText =
    Math.abs(apart) >= 1 ? (
      <>
        <span className="sr-only">{t("hud.clocksApart")} </span>+
        {formatDuration(t, f, apart, locale)}
      </>
    ) : null;
  const speedText = <Glide value={speed} format={(v) => formatSpeed(t, f, v, gamma)} />;
  const gravityText = (
    <Glide
      value={gravity}
      format={(v) =>
        t("hud.gravityFrom", { value: formatGravity(t, f, v), body: t(anchorNameKey(gravityFrom)) })
      }
    />
  );
  const rangeText = <Glide value={range} format={(v) => formatRange(t, f, { unit, locale }, v)} />;
  const shipClock = formatDuration(t, f, shipSeconds, locale);
  const earthClock = formatDuration(t, f, earthSeconds, locale);
  /* In orbit the ship rides with its body: nothing closes. Receding reads negative. */
  const closingText =
    status === "orbit" ? (
      NONE
    ) : (
      <Glide
        value={closing}
        format={(v) => `${v < 0 ? "−" : ""}${formatSpeed(t, f, Math.abs(v))}`}
      />
    );
  return (
    <footer
      className={cn(
        "pad-hud-bottom pointer-events-none absolute inset-x-0 bottom-0 z-30",
        aside && "not-md:hidden",
      )}
    >
      <div ref={surface} className="voyage-console relative mx-auto w-full max-w-6xl">
        {/*
          Until the ship first leaves orbit, the console invites the pilot to fly; a ship taken
          by hand shows its keys for a few seconds. Phones fly by the lever.
        */}
        {status === "free" ? (
          <p className="voyage-keys voyage-holo absolute bottom-full left-1/2 mb-3 -translate-x-1/2 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] whitespace-nowrap text-fg-secondary uppercase not-md:hidden">
            {t("hud.keys")}
          </p>
        ) : invite ? (
          <p className="voyage-holo absolute bottom-full left-1/2 mb-3 -translate-x-1/2 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] whitespace-nowrap text-fg-primary uppercase">
            <span className="not-md:hidden">{t("hud.invite")}</span>
            <span className="md:hidden">{t("hud.inviteTouch")}</span>
          </p>
        ) : null}

        <div className="voyage-console-grid grid grid-cols-[1fr_17rem_1fr] not-md:hidden">
          <section className={cn(panelClass, "voyage-console-left")}>
            <div className="flex items-center justify-between gap-3">
              <StatusMark status={status} phase={phase} regime={regime} />
              <HelmButton status={status} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <Instrument
                label={t("hud.speed")}
                value={speedText}
                sub={
                  <>
                    <span className="sr-only">{t("hud.gravity")} </span>
                    {gravityText}
                  </>
                }
                lead
                className="col-span-2"
              />
              <Instrument label={t("hud.shipClock")} value={shipClock} />
              <Instrument
                label={t("hud.earthClock")}
                value={earthClock}
                extra={apartText}
                sub={calendar}
              />
            </dl>
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-2">
              <span className="hidden font-mono text-[10px] tracking-[0.18em] text-fg-tertiary uppercase lg:inline">
                {t("hud.rate")}
              </span>
              <TimeWarp />
            </div>
          </section>
          {/* The scanner's place: the engine draws it (lib/scene/cockpit.ts). */}
          <div className="h-[150px] self-end" aria-hidden="true" />
          <section className={cn(panelClass, "voyage-console-right")}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Kicker className="text-[10px] tracking-[0.18em]">{t("hud.target")}</Kicker>
                <p className="mt-0.5 truncate font-display text-base font-medium tracking-tight text-fg-primary">
                  {aimName}
                </p>
              </div>
              <CourseButton />
            </div>
            <dl className="grid grid-cols-2 gap-x-4">
              <Instrument label={t("hud.range")} value={rangeText} lead />
              <Instrument label={t("hud.closing")} value={closingText} lead />
            </dl>
            <dl className="grid grid-cols-3 gap-x-3 border-t border-border pt-2.5">
              <Instrument
                label={t("hud.lightToEarth")}
                value={
                  <Glide value={lightToEarth} format={(v) => formatDuration(t, f, v, locale)} />
                }
              />
              <Instrument
                label={t("hud.sunlight")}
                value={<Glide value={irradiance} format={(v) => formatIrradiance(t, f, v)} />}
              />
              <Instrument
                label={t("hud.cmb")}
                value={t("hud.cmbValue", {
                  value: f.number(cmbKelvin, { maximumSignificantDigits: 3 }),
                })}
              />
            </dl>
            <DriveControl className="mt-auto border-t border-border pt-2.5" />
          </section>
        </div>

        <div className={cn(panelClass, "md:hidden")}>
          <div className="flex items-center gap-2.5">
            <StatusMark status={status} phase={phase} regime={regime} compact />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg-primary">{aimName}</p>
            <span className="shrink-0 font-mono text-xs text-fg-primary tabular-nums">{rangeText}</span>
            <CourseButton />
            <HelmButton status={status} />
          </div>
          <dl className="grid grid-cols-3 gap-x-3 short:hidden">
            <Instrument label={t("hud.speed")} value={speedText} />
            <Instrument label={t("hud.shipClock")} value={shipClock} />
            <Instrument label={t("hud.earthClock")} value={earthClock} extra={apartText} />
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <TimeWarp className="-ml-1.5" />
            <DriveControl className="short:hidden" />
          </div>
        </div>
      </div>
    </footer>
  );
}
