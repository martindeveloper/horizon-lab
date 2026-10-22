"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { FRAME_RATE_PARTS, useFrameRate } from "@/lib/frame-rate";
import { frameMeter } from "@horizon/toolkit/rendering";
import { FrameStats, SwitchRow } from "@horizon/toolkit/ui";

const noChange = () => () => {};
/** Whether the browser reports its JavaScript heap (Chromium): only then is memory offered. */
const useHeapReported = () =>
  useSyncExternalStore(
    noChange,
    () => "memory" in performance,
    () => false,
  );

export function FrameRateReadout() {
  const t = useTranslations("render");
  const { shown, parts } = useFrameRate();
  if (!shown) return null;
  return (
    <FrameStats
      source={frameMeter}
      graph={parts.graph}
      vsync={parts.vsync}
      memory={parts.memory}
      labels={{ idle: t("idle"), heap: t("heap") }}
      className="pointer-events-none absolute top-14 left-(--hud-gutter) z-30"
    />
  );
}

export function FrameRateSwitches() {
  const t = useTranslations("render");
  const { shown, parts, toggle, togglePart } = useFrameRate();
  const heapReported = useHeapReported();
  return (
    <>
      <SwitchRow on={shown} onToggle={toggle} aria-expanded={shown}>
        {t("frameRate")}
      </SwitchRow>
      {shown
        ? FRAME_RATE_PARTS.filter((part) => part !== "memory" || heapReported).map((part) => (
            <SwitchRow
              key={part}
              on={parts[part]}
              onToggle={() => togglePart(part)}
              className="anim-fade pl-7 text-xs md:min-h-8"
            >
              {t(`parts.${part}`)}
            </SwitchRow>
          ))
        : null}
    </>
  );
}
