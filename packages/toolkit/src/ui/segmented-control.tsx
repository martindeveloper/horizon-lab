"use client";

import type { ReactNode } from "react";

import { cn } from "./utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
  "aria-label": string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
};

/** Exclusive choices represented by native pressed buttons, navigated with Tab. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  disabled,
  "aria-label": label,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("flex gap-3", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled || option.disabled}
          aria-pressed={value === option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "relative min-h-8 ui-disabled ui-press px-1 text-ui tracking-wide underline-offset-[6px] ui-focus transition-colors duration-feedback ease-standard not-md:min-w-10 not-md:after:absolute not-md:after:-inset-x-1 not-md:after:-inset-y-1.5 md:min-h-6",
            value === option.value
              ? "text-accent underline decoration-accent decoration-2"
              : "text-fg-tertiary ui-quiet",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
