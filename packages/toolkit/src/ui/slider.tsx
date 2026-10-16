"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";

import { cn } from "./utils";

export type SliderProps = ComponentProps<typeof SliderPrimitive.Root> & {
  /** Human-readable value for assistive tech (aria-valuetext), e.g. the same string the UI shows. */
  valueText?: (value: number, index: number) => string;
  /** Names for each thumb of a multi-thumb slider; defaults to `aria-label`. */
  thumbLabels?: readonly string[];
};

export function Slider({
  className,
  "aria-label": label,
  valueText,
  thumbLabels,
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
      <SliderPrimitive.Track className="relative h-px w-full grow overflow-hidden rounded-full bg-fg/20">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      {values.map((value, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block size-3.5 rounded-full bg-accent outline-hidden transition-[box-shadow,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-95"
          aria-label={thumbLabels?.[index] ?? label}
          aria-valuetext={valueText?.(value, index)}
        />
      ))}
    </SliderPrimitive.Root>
  );
}
