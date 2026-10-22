"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { Tooltip, cn } from "@horizon/toolkit/ui";

import { ambientMusic } from "./ambient-music";

const serverState = () => "paused" as const;
const serverTrack = () => 0;
const serverBuffering = () => false;

// An arch, like the sun over the horizon: resting and peak heights, breath period (s).
const BARS = [
  [0.18, 0.32, 2.4],
  [0.26, 0.56, 1.9],
  [0.36, 0.82, 2.8],
  [0.44, 1, 2.2],
  [0.34, 0.74, 2.6],
  [0.24, 0.5, 2.0],
  [0.16, 0.3, 2.5],
] as const;

/** The golden record in its 28 × 28 view. Grooves run from the rim inward, one per track. */
const DISC = { r: 12.5, label: 3.4, outer: 11.3, inner: 5.6 } as const;
const HUB = 14;
/** Cuts on the label, the one mark that shows the disc turning. */
const CUTS = [0, 120, 240];

const TRACKS = ambientMusic.tracks.length;
const groove = (index: number) =>
  TRACKS < 2 ? DISC.outer : DISC.outer - ((DISC.outer - DISC.inner) * index) / (TRACKS - 1);

/** Rounded to a hundredth: server and browser trig differ in the last digits, and would not hydrate. */
const radial = (angle: number, r: number) => {
  const a = (angle * Math.PI) / 180;
  const at = (v: number) => Math.round(v * 100) / 100;
  return { x: at(HUB + r * Math.cos(a)), y: at(HUB + r * Math.sin(a)) };
};

/**
 * The waveform plays and pauses. Playing, a golden record opens beside it: each
 * track is a groove, the first outermost, and a click lights the next one.
 * Prebuffers on hover or focus.
 */
export function MusicToggle({ className }: { className?: string }) {
  const t = useTranslations("shell");
  const ref = useRef<HTMLDivElement>(null);
  const playing =
    useSyncExternalStore(ambientMusic.subscribe, ambientMusic.getState, serverState) === "playing";
  const track = useSyncExternalStore(ambientMusic.subscribe, ambientMusic.getTrack, serverTrack);
  const loading = useSyncExternalStore(
    ambientMusic.subscribe,
    ambientMusic.getBuffering,
    serverBuffering,
  );
  useEffect(() => ambientMusic.resumeOnInteraction(() => ref.current), []);

  const label = playing ? t("pauseMusic") : t("playMusic");
  const next = (track + 1) % TRACKS;
  const nextLabel = t("nextTrack", { title: ambientMusic.tracks[next]!.title });
  const skippable = TRACKS > 1;

  return (
    <div
      ref={ref}
      className={cn("flex h-11 shrink-0 items-center justify-center md:h-8", className)}
    >
      <div className="glass-pill relative flex items-center rounded-full p-0.5">
        <Tooltip label={loading ? t("loadingMusic") : label}>
          <button
            type="button"
            aria-label={label}
            aria-busy={loading}
            onClick={ambientMusic.toggle}
            onPointerEnter={ambientMusic.preload}
            onFocus={ambientMusic.preload}
            className="group relative flex rounded-full after:absolute after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <span
              aria-hidden
              data-playing={playing}
              data-loading={loading}
              className="music-lens header-lens absolute inset-0 rounded-full"
            />
            <span
              className={cn(
                "relative flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-500",
                playing ? "text-accent" : "text-subtle group-hover:text-fg",
              )}
            >
              <span
                className="music-wave"
                data-playing={playing}
                data-loading={loading}
                aria-hidden
              >
                {BARS.map(([rest, peak, period], i) => (
                  <span
                    key={i}
                    style={{
                      "--rest": rest,
                      "--peak": peak,
                      "--dur": `${period}s`,
                      "--delay": `${-period * ((i * 0.37) % 1)}s`,
                      "--i": i,
                    }}
                  />
                ))}
              </span>
            </span>
          </button>
        </Tooltip>
        {skippable ? (
          // Outside the reveal: its overflow clip would hide the tip.
          <Tooltip label={nextLabel} align="end">
            <div className="music-next" data-open={playing} inert={!playing}>
              <div className="min-w-0 overflow-hidden">
                <button
                  type="button"
                  aria-label={nextLabel}
                  aria-busy={loading}
                  onClick={ambientMusic.next}
                  className="music-record relative ml-0.5 flex h-7 w-8 items-center justify-center rounded-full text-subtle transition-colors duration-500 after:absolute after:-inset-y-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  <svg
                    viewBox="0 0 28 28"
                    data-playing={playing}
                    data-loading={loading}
                    className="size-7"
                    aria-hidden
                  >
                    <g className="music-disc">
                      <circle className="music-disc-face" cx={HUB} cy={HUB} r={DISC.r} />
                      {ambientMusic.tracks.map((item, i) => (
                        <circle
                          key={item.title}
                          className="music-groove"
                          data-current={i === track}
                          data-next={i === next}
                          cx={HUB}
                          cy={HUB}
                          r={groove(i)}
                        />
                      ))}
                      <circle className="music-label" cx={HUB} cy={HUB} r={DISC.label} />
                      {CUTS.map((angle) => {
                        const from = radial(angle, DISC.label * 0.35);
                        const to = radial(angle, DISC.label * 0.8);
                        return (
                          <line
                            key={angle}
                            className="music-label-cut"
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                          />
                        );
                      })}
                    </g>
                  </svg>
                </button>
              </div>
            </div>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
