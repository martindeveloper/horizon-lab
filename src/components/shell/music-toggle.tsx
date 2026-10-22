"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Tooltip, cn } from "@horizon/toolkit/ui";

import { ambientMusic } from "./ambient-music";

const serverState = () => "paused" as const;
const serverTrack = () => 0;
const serverBuffering = () => false;

/**
 * An arch across the pill, like the sun over the horizon: each bar's resting
 * and peak height and breath period (s). Plain arithmetic, so the server and
 * the browser print the same styles.
 */
const BAR_COUNT = 15;
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const x = i / (BAR_COUNT - 1);
  const arch = 4 * x * (1 - x);
  return [0.14 + 0.3 * arch, 0.28 + 0.72 * arch, 1.9 + 0.9 * ((i * 0.37) % 1)] as const;
});

/** How long a tap keeps the controls up on a touch screen. */
const AWAKE_MS = 4000;

const TRACKS = ambientMusic.tracks.length;

/** One slot, as wide as the theme rail's icon buttons. */
const slot = "relative flex h-7 w-[30px] items-center justify-center rounded-full";
const skipClass = cn(
  slot,
  "text-subtle transition-colors duration-300 after:absolute after:-inset-y-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
);

/**
 * Previous, play or pause, next. Playing, the controls fade and the waveform
 * fills the pill; hover or focus brings them back. On a touch screen the first
 * tap wakes them, and they rest again after a few idle seconds. Prebuffers on
 * hover or focus.
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

  // Each touch on the pill restarts the idle wait; zero is asleep.
  const [awake, setAwake] = useState(0);
  const wake = () => setAwake((n) => n + 1);
  useEffect(() => {
    if (!awake) return;
    const timer = setTimeout(() => setAwake(0), AWAKE_MS);
    return () => clearTimeout(timer);
  }, [awake]);

  const label = playing ? t("pauseMusic") : t("playMusic");
  const titleAt = (step: number) => ambientMusic.tracks[(track + step + TRACKS) % TRACKS]!.title;
  const previousLabel = t("previousTrack", { title: titleAt(-1) });
  const nextLabel = t("nextTrack", { title: titleAt(1) });
  const skippable = TRACKS > 1;
  const Icon = playing ? Pause : Play;

  return (
    <div
      ref={ref}
      className={cn("flex h-11 shrink-0 items-center justify-center md:h-8", className)}
    >
      <div
        className="music-transport glass-pill relative flex items-center rounded-full p-0.5"
        data-playing={playing}
        data-awake={awake > 0}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") wake();
        }}
      >
        <div className="music-controls flex items-center">
          {skippable ? (
            <Tooltip label={previousLabel}>
              <button
                type="button"
                aria-label={previousLabel}
                onClick={ambientMusic.previous}
                className={skipClass}
              >
                <SkipBack aria-hidden className="size-3.5" />
              </button>
            </Tooltip>
          ) : null}
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
                  slot,
                  "transition-colors duration-500",
                  playing ? "text-accent" : "text-subtle group-hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-3.5" />
              </span>
            </button>
          </Tooltip>
          {skippable ? (
            <Tooltip label={nextLabel} align="end">
              <button
                type="button"
                aria-label={nextLabel}
                onClick={ambientMusic.next}
                className={skipClass}
              >
                <SkipForward aria-hidden className="size-3.5" />
              </button>
            </Tooltip>
          ) : null}
        </div>
        {/* Over the controls while they rest, so the tap that wakes them presses nothing. */}
        <span className="music-wave-fill" aria-hidden>
          <span className="music-wave" data-playing={playing} data-loading={loading}>
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
      </div>
    </div>
  );
}
