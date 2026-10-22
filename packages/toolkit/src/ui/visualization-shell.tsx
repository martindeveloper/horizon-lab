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

/** Controls opt in with pointer-events-auto. An unready HUD fades out and is always inert. */
export function VisualizationOverlay({
  ready = true,
  inert,
  className,
  ...props
}: ComponentProps<"div"> & { ready?: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 transition-opacity duration-reveal ease-standard",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
      inert={!ready || inert}
      {...props}
    />
  );
}
