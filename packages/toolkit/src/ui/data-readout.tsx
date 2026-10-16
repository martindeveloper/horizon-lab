import type { ComponentProps, ReactNode } from "react";

import { cn } from "./utils";

export type ReadoutItem = { id: string; label: ReactNode; value: ReactNode };
export type DataReadoutProps = ComponentProps<"dl"> & {
  items: readonly ReadoutItem[];
};

export function DataReadout({ items, className, ...props }: DataReadoutProps) {
  return (
    <dl className={cn("grid grid-cols-3 gap-x-4 gap-y-3", className)} {...props}>
      {items.map((item) => (
        <div key={item.id} className="min-w-0">
          <dt className="font-mono text-xs tracking-widest text-subtle uppercase">{item.label}</dt>
          <dd className="mt-0.5 font-mono text-xs text-fg tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
