"use client";

import { Monitor, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { onDesktopNotice } from "@/lib/debug";
import { PHONE_QUERY } from "@horizon/toolkit/environment";
import { IconButton, Surface, afterMotion, cn } from "@horizon/toolkit/ui";

import { dismissNotice, shouldShowNotice } from "./desktop-notice-state";

const SHOW_AFTER = 1500;
const HIDE_AFTER = 7000;

type Phase = "hidden" | "shown" | "leaving";

/** Once per session on phones: a quiet pill suggesting a larger screen. Client-only. */
export function DesktopNotice() {
  const t = useTranslations("shell");
  const [phase, setPhase] = useState<Phase>("hidden");
  const surface = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  // Once per mount even when storage is blocked and the flag cannot stick.
  const shown = useRef(false);

  // Horizon.Debug.desktopNotice() previews it on any device.
  useEffect(() => onDesktopNotice(() => setPhase("shown")), []);

  // Re-checked when the viewport turns phone-sized (rotation, device emulation)
  // and when the page becomes visible; time only runs while it can be seen.
  useEffect(() => {
    const phone = window.matchMedia(PHONE_QUERY);
    let id: number | undefined;
    const arm = () => {
      window.clearTimeout(id);
      if (shown.current || document.hidden || !shouldShowNotice(phone.matches)) return;
      id = window.setTimeout(() => {
        shown.current = true;
        setPhase("shown");
      }, SHOW_AFTER);
    };
    arm();
    phone.addEventListener("change", arm);
    document.addEventListener("visibilitychange", arm);
    return () => {
      window.clearTimeout(id);
      phone.removeEventListener("change", arm);
      document.removeEventListener("visibilitychange", arm);
    };
  }, []);

  useEffect(() => {
    if (phase === "hidden") return;
    if (phase === "leaving") {
      if (surface.current) return afterMotion(surface.current, () => setPhase("hidden"));
      return;
    }
    // Auto-hide counts as dismissal, but never while the page is hidden (an
    // unseen notice is not dismissed) or focus rests on the close button.
    let id: number | undefined;
    const arm = () => {
      window.clearTimeout(id);
      if (document.hidden) return;
      id = window.setTimeout(() => {
        if (focused.current) return;
        dismissNotice();
        setPhase("leaving");
      }, HIDE_AFTER);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [phase]);

  if (phase === "hidden") return null;
  return (
    <div className="desktop-notice pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-[var(--app-gutter)]">
      <Surface
        ref={surface}
        variant="pill"
        role="status"
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
        }}
        className={cn(
          "pointer-events-auto flex items-center gap-2.5 rounded-full py-0.5 pr-0.5 pl-4 text-xs text-fg-primary",
          phase === "leaving"
            ? "opacity-0 transition-opacity duration-control ease-exit"
            : "anim-rise",
        )}
      >
        <Monitor className="size-3.5 shrink-0 text-accent" aria-hidden />
        <span>{t("desktopNotice")}</span>
        <IconButton
          aria-label={t("closeDesktopNotice")}
          className="text-fg-secondary"
          onClick={() => {
            dismissNotice();
            setPhase("leaving");
          }}
        >
          <X className="size-4" aria-hidden />
        </IconButton>
      </Surface>
    </div>
  );
}
