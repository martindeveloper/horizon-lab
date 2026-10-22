import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Action } from "@horizon/toolkit/ui";

import { anchorNameKey } from "../lib/model/anchors";
import { useVoyage } from "../lib/store";
import { formatSpeed } from "./format";

/**
 * After a crash: a projected display in the danger red over the blacked-out cockpit. Its alarm
 * light blinks; the word holds steady so it reads; beneath, the body struck and how fast, and
 * the one way out, back to orbit about it (Escape too). Takes focus, so the key works at once
 * and a screen reader hears it.
 */
export function CrashCard() {
  const t = useTranslations("voyage");
  const f = useFormatter();
  const crash = useVoyage((s) => s.crash);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus({ preventScroll: true });
  }, []);
  if (!crash) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="voyage-crash-title"
      aria-describedby="voyage-crash-body"
      className="voyage-holo voyage-holo-danger pointer-events-auto absolute top-1/2 left-1/2 z-50 flex w-[min(22rem,calc(100%-2rem))] -translate-1/2 anim-fade flex-col items-center gap-4 px-8 pt-6 pb-7 text-center"
    >
      <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.24em] text-danger uppercase">
        <span
          aria-hidden="true"
          className="voyage-blink size-1.5 rounded-full bg-danger shadow-[0_0_10px_var(--color-danger)]"
        />
        {t("hud.crash.alarm")}
      </p>
      <p
        id="voyage-crash-title"
        className="voyage-crash-title font-display text-4xl font-medium tracking-[0.22em] uppercase md:text-5xl"
      >
        {t("hud.crash.title")}
      </p>
      <p
        id="voyage-crash-body"
        className="font-mono text-xs tracking-[0.14em] text-fg uppercase tabular-nums"
      >
        {t("hud.crash.body", {
          body: t(anchorNameKey(crash.body)),
          speed: formatSpeed(t, f, crash.speed),
        })}
      </p>
      <Action
        ref={button}
        variant="solar"
        className="mt-2"
        onClick={() => useVoyage.getState().recover()}
      >
        {t("hud.crash.retry")}
      </Action>
    </div>
  );
}
