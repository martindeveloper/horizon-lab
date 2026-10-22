"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

import { keysOf } from "../records";
import { IconButton } from "./icon-button";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

export type OrbitPadDirection = "left" | "right" | "up" | "down";

export type OrbitPadProps = {
  "aria-label": string;
  /** Translated names, used as accessible names and tooltips. */
  labels: Record<OrbitPadDirection, string>;
  /** Signed steps matching a drag: left is `azimuth: 1`, up is `inclination: -1`. */
  onRotate: (turn: { azimuth: number; inclination: number }) => void;
  /** Shown in the middle of the pad, such as the size of one step ("15°"). Decorative. */
  centre?: ReactNode;
  className?: string;
};

const TURNS = {
  up: { azimuth: 0, inclination: -1, Icon: ChevronUp, cell: "col-start-2 row-start-1" },
  left: { azimuth: 1, inclination: 0, Icon: ChevronLeft, cell: "col-start-1 row-start-2" },
  right: { azimuth: -1, inclination: 0, Icon: ChevronRight, cell: "col-start-3 row-start-2" },
  down: { azimuth: 0, inclination: 1, Icon: ChevronDown, cell: "col-start-2 row-start-3" },
} as const;

/**
 * Four step buttons that rotate a camera without dragging (WCAG 2.5.7), round a glass dial:
 * a faint ring for the orbit, the steps at its four points, and `centre` in the middle.
 */
export function OrbitPad({ labels, onRotate, centre, className, ...props }: OrbitPadProps) {
  return (
    <div
      role="group"
      className={cn(
        "relative grid w-fit shrink-0 grid-cols-3 grid-rows-3 place-items-center rounded-full bg-fg-primary/[0.04] p-1 ring-1 ring-border ring-inset not-md:gap-2",
        className,
      )}
      {...props}
    >
      {/* The orbit the steps move along. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[22%] rounded-full border border-dashed border-fg-primary/15"
      />
      {keysOf(TURNS).map((direction) => {
        const { Icon, cell, ...turn } = TURNS[direction];
        return (
          <Tooltip key={direction} label={labels[direction]} className={cell}>
            <IconButton
              aria-label={labels[direction]}
              onClick={() => onRotate(turn)}
              className="transition-[color,background-color,scale] duration-feedback ease-standard hover:bg-fg-primary/[0.06] hover:text-accent active:scale-90"
            >
              <Icon className="size-4" />
            </IconButton>
          </Tooltip>
        );
      })}
      <span
        aria-hidden
        className="col-start-2 row-start-2 font-mono text-micro tracking-wide text-fg-tertiary tabular-nums"
      >
        {centre}
      </span>
    </div>
  );
}
