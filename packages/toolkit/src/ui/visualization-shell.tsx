import type { ComponentProps } from "react";

import { cn } from "./utils";

/** Full-viewport positioning context. Render the canvas before overlay children. */
export function VisualizationShell({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn("relative isolate h-dvh w-full overflow-clip bg-space", className)}
      {...props}
    />
  );
}

/** Non-interactive by default; controls opt in with pointer-events-auto. */
export function VisualizationOverlay({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("pointer-events-none absolute inset-0 z-10", className)} {...props} />;
}
