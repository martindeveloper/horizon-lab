"use client";

import { Minus, Pause, Play, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton, Tooltip, cn } from "@horizon/toolkit/ui";

/**
 * A clock's rate as a dock control: play or pause, a step slower, the rate, a step faster. The
 * play button is lit while the clock runs and says what a press does; the rate reads in mono
 * figures and is announced as it changes.
 */
export function RateStepper({
  label,
  running,
  toggleLabel,
  onToggle,
  toggleDisabled = false,
  slowerLabel,
  fasterLabel,
  onSlower,
  onFaster,
  slowerDisabled = false,
  fasterDisabled = false,
  readout,
  spoken,
  readoutClassName,
  className,
  coach,
}: {
  /** The group's name. */
  label: string;
  running: boolean;
  toggleLabel: string;
  onToggle: () => void;
  toggleDisabled?: boolean;
  slowerLabel: string;
  fasterLabel: string;
  onSlower: () => void;
  onFaster: () => void;
  slowerDisabled?: boolean;
  fasterDisabled?: boolean;
  /** The rate as shown, and as spoken when it differs. */
  readout: ReactNode;
  spoken?: ReactNode;
  readoutClassName?: string;
  className?: string | undefined;
  coach?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-coach={coach}
      className={cn("flex items-center", className)}
    >
      <Tooltip label={toggleLabel} side="top" align="start">
        <IconButton
          aria-label={toggleLabel}
          active={running}
          disabled={toggleDisabled}
          onClick={onToggle}
        >
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
        </IconButton>
      </Tooltip>
      <IconButton aria-label={slowerLabel} disabled={slowerDisabled} onClick={onSlower}>
        <Minus className="size-3.5" />
      </IconButton>
      <output
        aria-live="polite"
        className={cn("min-w-16 text-center font-mono text-[11px] tabular-nums", readoutClassName)}
      >
        {spoken === undefined ? (
          readout
        ) : (
          <>
            <span aria-hidden="true">{readout}</span>
            <span className="sr-only">{spoken}</span>
          </>
        )}
      </output>
      <IconButton aria-label={fasterLabel} disabled={fasterDisabled} onClick={onFaster}>
        <Plus className="size-3.5" />
      </IconButton>
    </div>
  );
}
