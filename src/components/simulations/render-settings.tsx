"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { RenderQuality } from "@horizon/toolkit/rendering";
import { ControlRow, SegmentedControl } from "@horizon/toolkit/ui";

import { RailSection } from "./rail";

/* Listed here, not imported: the rendering module's values would pull the renderer into the page. */
const QUALITIES: readonly RenderQuality[] = ["economy", "standard", "cinema", "max"];

/** An anti-aliasing mode and the `render.*` copy key that names it. */
export type AntialiasMode<A extends string> = { value: A; name: string };

/** A zoomable scene's modes: the Orrery and Deep Field. */
export const SCENE_ANTIALIAS = [
  { value: "off", name: "off" },
  { value: "msaa", name: "msaa" },
  { value: "fxaa", name: "fxaa" },
] as const satisfies readonly AntialiasMode<string>[];

/** Puts a settings panel back as a visit starts; the last thing in it. */
function ResetButton({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1.5 self-start text-xs tracking-wide text-muted transition-colors duration-300 hover:text-fg md:min-h-6"
      onClick={onReset}
    >
      <RotateCcw className="size-3" />
      {label}
    </button>
  );
}

/**
 * The last section of every simulation's settings, the same in each: render quality, then
 * anti-aliasing (hidden while `antialias` is still unknown), an optional note, then Reset.
 * Copy is the shared `render` namespace; each simulation decides what its levels and modes do.
 */
export function RenderSection<A extends string>({
  quality,
  onQuality,
  antialias,
  modes,
  onAntialias,
  note,
  onReset,
}: {
  quality: RenderQuality;
  onQuality: (quality: RenderQuality) => void;
  antialias: A | null;
  modes: readonly AntialiasMode<A>[];
  onAntialias: (mode: A) => void;
  note?: ReactNode;
  onReset: () => void;
}) {
  const t = useTranslations("render");
  return (
    <RailSection title={t("title")}>
      <div className="flex flex-col gap-3">
        <ControlRow label={t("quality")} value={null}>
          <SegmentedControl<RenderQuality>
            aria-label={t("quality")}
            value={quality}
            onValueChange={onQuality}
            options={QUALITIES.map((level) => ({ value: level, label: t(level) }))}
          />
        </ControlRow>
        {antialias ? (
          <ControlRow label={t("antialiasing")} value={null}>
            <SegmentedControl<A>
              aria-label={t("antialiasing")}
              value={antialias}
              onValueChange={onAntialias}
              options={modes.map(({ value, name }) => ({ value, label: t(name) }))}
            />
          </ControlRow>
        ) : null}
        {note}
        <ResetButton label={t("reset")} onReset={onReset} />
      </div>
    </RailSection>
  );
}
