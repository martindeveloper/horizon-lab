"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

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
  className?: string;
};

const TURNS = {
  up: { azimuth: 0, inclination: -1, Icon: ChevronUp, cell: "col-start-2 row-start-1" },
  left: { azimuth: 1, inclination: 0, Icon: ChevronLeft, cell: "col-start-1 row-start-2" },
  right: { azimuth: -1, inclination: 0, Icon: ChevronRight, cell: "col-start-3 row-start-2" },
  down: { azimuth: 0, inclination: 1, Icon: ChevronDown, cell: "col-start-2 row-start-3" },
} as const;

/** Four step buttons that rotate a camera without dragging (WCAG 2.5.7). */
export function OrbitPad({ labels, onRotate, className, ...props }: OrbitPadProps) {
  return (
    <div
      role="group"
      className={cn("grid w-fit grid-cols-3 grid-rows-3 not-md:gap-2", className)}
      {...props}
    >
      {keysOf(TURNS).map((direction) => {
        const { Icon, cell, ...turn } = TURNS[direction];
        return (
          <Tooltip key={direction} label={labels[direction]} className={cell}>
            <IconButton aria-label={labels[direction]} onClick={() => onRotate(turn)}>
              <Icon className="size-4" />
            </IconButton>
          </Tooltip>
        );
      })}
    </div>
  );
}
