import type { ComponentProps, ReactNode } from "react";

import { Tooltip } from "./tooltip";
import { cn } from "./utils";

export type ReadoutItem = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  /** An icon that stands for the label in the inline variant. */
  icon?: ReactNode;
  /** Classes for the value, e.g. a width that keeps a running readout from nudging its row. */
  valueClassName?: string;
  className?: string;
};
export type DataReadoutProps = ComponentProps<"dl"> & {
  items: readonly ReadoutItem[];
  /** `grid`: a mono label above each value. `inline`: an icon beside each value, the label its tooltip and its spoken name. */
  variant?: "grid" | "inline";
};

export function DataReadout({ items, variant = "grid", className, ...props }: DataReadoutProps) {
  if (variant === "inline")
    return (
      <dl className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)} {...props}>
        {items.map((item) => (
          <div key={item.id} className={cn("flex items-center", item.className)}>
            <dt className="sr-only">{item.label}</dt>
            <dd>
              <Tooltip label={item.label} side="top">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="flex shrink-0 text-fg-tertiary [&_svg]:size-3.5">
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs whitespace-nowrap text-fg-primary tabular-nums",
                      item.valueClassName,
                    )}
                  >
                    {item.value}
                  </span>
                </span>
              </Tooltip>
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <dl className={cn("grid grid-cols-3 gap-x-4 gap-y-3", className)} {...props}>
      {items.map((item) => (
        <div key={item.id} className={cn("min-w-0", item.className)}>
          <dt className="font-mono text-xs tracking-widest text-fg-tertiary uppercase">{item.label}</dt>
          <dd className={cn("mt-0.5 font-mono text-xs text-fg-primary tabular-nums", item.valueClassName)}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
