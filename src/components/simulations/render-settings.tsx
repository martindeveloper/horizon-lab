"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import type { SceneAntialias } from "@horizon/toolkit/scene";
import { ControlRow, SegmentedControl, type SegmentedOption } from "@horizon/toolkit/ui";

import { RailSection } from "./rail";

/** A simulation's anti-aliasing choices under their label, the same in every settings panel. */
export function AntialiasRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (mode: T) => void;
}) {
  return (
    <ControlRow label={label} value={null}>
      <SegmentedControl<T>
        aria-label={label}
        value={value}
        onValueChange={onChange}
        options={options}
      />
    </ControlRow>
  );
}

/** Puts a settings panel back as a visit starts; the last thing in it. */
export function ResetButton({ label, onReset }: { label: string; onReset: () => void }) {
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

/* Listed here, not imported: the scene module's values would pull the renderer into the page. */
const SCENE_MODES: readonly SceneAntialias[] = ["off", "msaa", "fxaa"];

/**
 * A zoomable scene's render quality, worded by the shared space copy in `namespace`: its
 * anti-aliasing (once the engine has published the device's default) and the View panel's reset.
 */
export function SceneRenderSection({
  namespace,
  antialias,
  onAntialias,
  onReset,
}: {
  namespace: string;
  antialias: SceneAntialias | null;
  onAntialias: (mode: SceneAntialias) => void;
  onReset: () => void;
}) {
  const t = useTranslations(namespace);
  return (
    <RailSection title={t("hud.renderQuality")}>
      <div className="flex flex-col gap-3">
        {antialias ? (
          <AntialiasRow<SceneAntialias>
            label={t("hud.antialiasing")}
            value={antialias}
            onChange={onAntialias}
            options={SCENE_MODES.map((mode) => ({ value: mode, label: t(`antialias.${mode}`) }))}
          />
        ) : null}
        <ResetButton label={t("hud.reset")} onReset={onReset} />
      </div>
    </RailSection>
  );
}
