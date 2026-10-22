import type { ReactNode } from "react";

/**
 * The dock's labelled rows share one label column, so the strip and the ruler start in line.
 * A label keeps to its row's first line, the height of the dock's chips, where the strip wraps
 * on wide screens and the ruler's switches wrap beneath it on phones.
 */
export const ROWS_CLASS = "grid grid-cols-[auto_minmax(0,1fr)] gap-2";
export const ROW_CLASS = "col-span-2 grid grid-cols-subgrid items-start";

export function RowLabel({ children }: { children: ReactNode }) {
  return <span className="flex h-8 items-center not-md:h-9">{children}</span>;
}
