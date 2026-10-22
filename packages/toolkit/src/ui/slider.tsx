"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import type { CSSProperties, ComponentProps } from "react";

import { cn } from "./utils";

export type SliderProps = ComponentProps<typeof SliderPrimitive.Root> & {
  /** Human-readable value for assistive tech (aria-valuetext), e.g. the same string the UI shows. */
  valueText?: (value: number, index: number) => string;
  /** Names for each thumb of a multi-thumb slider; defaults to `aria-label`. */
  thumbLabels?: readonly string[];
  /** Styles the track, e.g. a scale painted under the thumb; and the filled range, e.g. hidden over a scale. */
  trackClassName?: string;
  trackStyle?: CSSProperties;
  rangeClassName?: string;
};

/** The thumb's diameter, px (`size-3.5`): its centre travels this much less than the track is long. */
export const SLIDER_THUMB_PX = 14;

/** Where the thumb's centre stands at `share` (0–1) of its travel, as a CSS length along the track: for marks under its stops. */
export const sliderStopAt = (share: number) =>
  `calc(${SLIDER_THUMB_PX / 2}px + ${share} * (100% - ${SLIDER_THUMB_PX}px))`;

export function Slider({
  className,
  "aria-label": label,
  valueText,
  thumbLabels,
  trackClassName,
  trackStyle,
  rangeClassName,
  ...props
}: SliderProps) {
  const values = props.value ?? props.defaultValue ?? [props.min ?? 0];
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex h-8 w-full touch-none items-center select-none not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-1.5",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative h-px w-full grow cursor-pointer overflow-hidden rounded-full bg-fg-primary/20",
          trackClassName,
        )}
        style={trackStyle}
      >
        <SliderPrimitive.Range className={cn("absolute h-full bg-accent", rangeClassName)} />
      </SliderPrimitive.Track>
      {values.map((value, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block size-3.5 cursor-grab rounded-full bg-accent outline-hidden transition-[box-shadow,transform] duration-feedback ease-enter focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary active:scale-95 active:cursor-grabbing"
          aria-label={thumbLabels?.[index] ?? label}
          aria-valuetext={valueText?.(value, index)}
        />
      ))}
    </SliderPrimitive.Root>
  );
}
