import type { ReactNode } from "react";

import { ANCHOR_IDS } from "@/lib/urls";
import { actionClass, cn } from "@horizon/toolkit/ui";

import { Wordmark } from "../shell/brand";

type Code = "404" | "500" | "WebGL";

/**
 * 404: the sun is below the horizon, nothing to see here.
 * 500 and WebGL: an eclipse, something is in the way. Same ring, same line.
 */
function StatusGlyph({ code }: { code: Code }) {
  return (
    <svg viewBox="0 0 96 96" className="mx-auto size-20" fill="none" aria-hidden="true">
      <circle cx="48" cy="48" r="40" className="stroke-border-strong" />
      {code === "404" ? (
        <>
          <circle cx="48" cy="64" r="16" className="fill-accent/10" />
          <circle cx="48" cy="64" r="9" className="fill-accent/30" />
          <line x1="8" y1="48" x2="88" y2="48" className="stroke-accent" />
        </>
      ) : (
        <>
          <circle
            cx="48"
            cy="48"
            r="15"
            className="horizon-eclipse-corona stroke-accent"
            strokeWidth="3"
            strokeDasharray="4 3"
          />
          <circle
            cx="48"
            cy="48"
            r="14"
            className="fill-surface-primary stroke-accent"
            strokeWidth="1.5"
          />
          <line x1="8" y1="48" x2="30" y2="48" className="stroke-accent" />
          <line x1="66" y1="48" x2="88" y2="48" className="stroke-accent" />
        </>
      )}
    </svg>
  );
}

export function StatusPage({
  code,
  title,
  description,
  children,
  fullPage = false,
  stage = false,
}: {
  code: Code;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  fullPage?: boolean;
  /** Fill a simulation stage, whose opaque scene background hides the shell sky. */
  stage?: boolean;
}) {
  return (
    <main
      id={ANCHOR_IDS.mainContent}
      tabIndex={-1}
      className={cn(
        "horizon-status relative isolate flex flex-col items-center justify-center px-6 py-16 text-center text-fg-primary outline-hidden",
        fullPage
          ? "min-h-dvh"
          : stage
            ? "absolute inset-0 justify-center-safe overflow-y-auto bg-surface-primary"
            : "min-h-[calc(100dvh-var(--app-header-height,0px))]",
      )}
    >
      {fullPage || stage ? (
        <div className="horizon-sky" data-scope="local" aria-hidden="true" />
      ) : null}
      {fullPage ? (
        <div className="absolute inset-x-0 top-0 flex h-11 items-center px-4 sm:px-6">
          <Wordmark />
        </div>
      ) : null}
      <p className="font-mono text-[11px] tracking-[0.3em] text-accent uppercase">{code}</p>
      <div className="my-5">
        <StatusGlyph code={code} />
      </div>
      <h1 className="max-w-xl font-headline text-3xl font-medium tracking-[-0.015em] text-balance sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-fg-secondary">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>
    </main>
  );
}

export const statusActionClass = actionClass("glass");
export const statusPrimaryActionClass = actionClass("solar");
