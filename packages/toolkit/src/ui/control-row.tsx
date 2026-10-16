import type { ComponentProps, ReactNode } from "react";

import { cn } from "./utils";

export type ControlRowProps = ComponentProps<"div"> & {
  label: ReactNode;
  value: ReactNode;
};

/** Presentation for a control. Give the nested input its own accessible label. */
export function ControlRow({ label, value, children, className, ...props }: ControlRowProps) {
  return (
    <div className={cn(className)} {...props}>
      <div className="mb-0.5 flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted">{label}</span>
        <span className="font-mono text-xs text-fg tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}
