"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";

import { DEBUG, DEPLOYMENT_ID } from "@/config";
import { onUpdateNotice } from "@/lib/debug";
import { IconButton, Surface, useImmersive } from "@horizon/toolkit/ui";

import { watchVersion } from "./update-notice-state";

const never = () => () => {};

/**
 * A quiet pill once a newer deployment is live. It never reloads by itself: that would
 * wipe a running simulation. Off without a deployment ID (debug builds still mount it for
 * `Horizon.Debug.updateNotice()`); nothing renders on the server.
 */
export function UpdateNotice() {
  const t = useTranslations("shell");
  const immersive = useImmersive();
  const mounted = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
  const [state, setState] = useState<"waiting" | "shown" | "dismissed">("waiting");

  useEffect(() => watchVersion(DEPLOYMENT_ID, () => setState("shown")), []);
  // Horizon.Debug.updateNotice() previews it, even in a build without a deployment ID.
  useEffect(() => onUpdateNotice(() => setState("shown")), []);

  if (!mounted || (!DEPLOYMENT_ID && !DEBUG)) return null;
  // The polite region is in place before its text arrives, so screen readers hear it.
  return (
    <div
      role="status"
      className="update-notice pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-[var(--app-gutter)]"
    >
      {state === "shown" && !immersive ? (
        <Surface
          variant="pill"
          className="update-notice-pill pointer-events-auto relative flex max-w-full min-w-0 anim-rise items-center gap-1.5 rounded-full py-0.5 pr-0.5 pl-3.5 text-xs text-fg"
        >
          <span
            className="update-notice-dot size-1.5 shrink-0 rounded-full bg-accent"
            aria-hidden
          />
          <span className="min-w-0 truncate">{t("updateNotice")}</span>
          <span className="text-subtle" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="relative h-9 shrink-0 rounded-full px-2 font-medium text-accent underline-offset-2 not-md:after:absolute not-md:after:-inset-1 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:h-8"
          >
            {t("updateAction")}
          </button>
          <IconButton
            aria-label={t("closeUpdateNotice")}
            className="shrink-0 text-muted"
            onClick={() => setState("dismissed")}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </Surface>
      ) : null}
    </div>
  );
}
