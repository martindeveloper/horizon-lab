"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Tooltip, cn } from "@horizon/toolkit/ui";

import { ambientMusic } from "./ambient-music";

const serverState = () => "paused" as const;
const serverTrack = () => 0;

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

/** Each track has its hour on the dial: the first rises in the east, the last sets in the west. */
const SPAN = 110;
const TRACKS = ambientMusic.tracks.length;
const hour = (index: number) => (TRACKS < 2 ? 0 : -SPAN / 2 + (SPAN * index) / (TRACKS - 1));

/**
 * The site's ambient music, built like the header's preference rails. The
 * waveform plays and pauses. Playing, a sun dial opens beside it: each track
 * is an hour on a day arc, and skipping carries the sun on to the next, over
 * the length of the crossfade. Past the last track it sets and rises again.
 */
export function MusicToggle({ className }: { className?: string }) {
  const t = useTranslations("shell");
  const ref = useRef<HTMLDivElement>(null);
  const playing =
    useSyncExternalStore(ambientMusic.subscribe, ambientMusic.getState, serverState) === "playing";
  const track = useSyncExternalStore(ambientMusic.subscribe, ambientMusic.getTrack, serverTrack);
  useEffect(() => ambientMusic.resumeOnInteraction(() => ref.current), []);

  // Turns of the dial: wrapping to the first track goes on round, under the horizon.
  const [dial, setDial] = useState({ track, days: 0 });
  if (dial.track !== track) setDial({ track, days: dial.days + (track < dial.track ? 1 : 0) });
  const angle = hour(track) + dial.days * 360;

  const label = playing ? t("pauseMusic") : t("playMusic");
  const upcoming = ambientMusic.tracks[(track + 1) % TRACKS]!;
  const nextLabel = t("nextTrack", { title: upcoming.title });
  const skippable = TRACKS > 1;

  return (
    <div
      ref={ref}
      className={cn("flex h-11 shrink-0 items-center justify-center md:h-8", className)}
    >
      <div className="glass-pill relative flex items-center rounded-full p-0.5">
        <Tooltip label={label}>
          <button
            type="button"
            aria-label={label}
            onClick={ambientMusic.toggle}
            className="group relative flex rounded-full after:absolute after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <span
              aria-hidden
              data-playing={playing}
              className="music-lens header-lens absolute inset-0 rounded-full"
            />
            <span
              className={cn(
                "relative flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-500",
                playing ? "text-accent" : "text-subtle group-hover:text-fg",
              )}
            >
              <span className="music-wave" data-playing={playing} aria-hidden>
                {BARS.map(([rest, peak, period], i) => (
                  <span
                    key={i}
                    style={{
                      "--rest": rest,
                      "--peak": peak,
                      "--dur": `${period}s`,
                      "--delay": `${-period * ((i * 0.37) % 1)}s`,
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
                  onClick={ambientMusic.next}
                  className="music-dial group relative ml-0.5 flex h-7 w-10 items-center justify-center rounded-full text-subtle transition-colors duration-500 after:absolute after:-inset-y-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                >
                  <svg viewBox="0 0 28 18" className="h-[18px] w-7 overflow-visible" aria-hidden>
                    <defs>
                      <clipPath id="music-dial-sky">
                        <rect x="-4" y="-4" width="36" height="19" />
                      </clipPath>
                    </defs>
                    <path className="music-dial-arc" d="M4 15A10 10 0 0 1 24 15" />
                    <path className="music-dial-horizon" d="M1 15H27" />
                    {ambientMusic.tracks.map((item, i) => (
                      <circle
                        key={item.title}
                        className="music-dial-hour"
                        cx="14"
                        cy="5"
                        r="0.9"
                        style={{ rotate: `${hour(i)}deg` }}
                      />
                    ))}
                    <g clipPath="url(#music-dial-sky)">
                      <g className="music-dial-orbit" style={{ rotate: `${angle}deg` }}>
                        <g className="music-dial-nudge">
                          <circle className="music-dial-halo" cx="14" cy="5" r="4" />
                          <circle className="music-dial-sun" cx="14" cy="5" r="2.1" />
                        </g>
                      </g>
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
