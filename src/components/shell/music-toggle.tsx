"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { Tooltip, cn } from "@horizon/toolkit/ui";

import { ambientMusic } from "./ambient-music";

const serverState = () => "paused" as const;

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

/** Play/pause for the site's ambient track, built like the header's preference rails. */
export function MusicToggle({ className }: { className?: string }) {
  const t = useTranslations("shell");
  const ref = useRef<HTMLButtonElement>(null);
  const playing =
    useSyncExternalStore(ambientMusic.subscribe, ambientMusic.getState, serverState) === "playing";
  useEffect(() => ambientMusic.resumeOnInteraction(() => ref.current), []);
  const label = playing ? t("pauseMusic") : t("playMusic");
  return (
    <Tooltip label={label}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onClick={ambientMusic.toggle}
        className={cn(
          "group flex h-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:h-8",
          className,
        )}
      >
        <span className="glass-pill relative flex rounded-full p-0.5">
          <span
            aria-hidden
            data-playing={playing}
            className="music-lens header-lens absolute inset-0.5 rounded-full"
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
        </span>
      </button>
    </Tooltip>
  );
}
