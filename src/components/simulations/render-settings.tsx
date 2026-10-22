"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { RENDER_QUALITIES, type RenderQuality } from "@horizon/toolkit/rendering/quality";
import { ControlRow, SegmentedControl, SwitchRow } from "@horizon/toolkit/ui";

import { FrameRateSwitches } from "./frame-rate";
import { RailSection } from "./rail";
import { useWideGamutScreen } from "./use-wide-gamut";

/** An anti-aliasing mode and the `render.*` copy key that names it. */
export type AntialiasMode<A extends string> = { value: A; name: string };

/** A zoomable scene's modes: the shared scene host's. */
export const SCENE_ANTIALIAS = [
  { value: "off", name: "off" },
  { value: "msaa", name: "msaa" },
  { value: "fxaa", name: "fxaa" },
] as const satisfies readonly AntialiasMode<string>[];

/** A render switch, named by its `render.*` copy key; the visit's settings say how it starts. */
function EffectSwitch({
  name,
  on,
  onToggle,
}: {
  name: "bloom" | "lens" | "glow" | "wideColour";
  on: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("render");
  return (
    <SwitchRow on={on} onToggle={onToggle}>
      {t(name)}
    </SwitchRow>
  );
}

type Switch = { on: boolean; onToggle: () => void };

/** The Rendering section's Bloom switch: bright light glows. */
export const BloomSwitch = (props: Switch) => <EffectSwitch name="bloom" {...props} />;

/** The Rendering section's Lens switch: the brightest light gets diffraction spikes, the corners a colour fringe. */
export const LensSwitch = (props: Switch) => <EffectSwitch name="lens" {...props} />;

/** The Rendering section's Glow switch, for a 2D stage: its lights get a soft blurred layer. */
export const GlowSwitch = (props: Switch) => <EffectSwitch name="glow" {...props} />;

/**
 * The Rendering section's Wide colour switch: the canvas shows Display P3. Offered only where
 * the screen shows it; for a WebGL stage, where the browser's WebGL canvases can switch too;
 * `canvas` adds a stage's own check, asked only on the client once the screen qualifies.
 */
export function WideColourSwitch({
  canvas,
  webgl = false,
  ...props
}: Switch & { canvas?: () => boolean; webgl?: boolean }) {
  const screen = useWideGamutScreen(webgl);
  return screen && (canvas?.() ?? true) ? <EffectSwitch name="wideColour" {...props} /> : null;
}

/** Puts a settings panel back as a visit starts; the last thing in it. */
function ResetButton({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1.5 self-start text-xs tracking-wide text-muted transition-colors duration-feedback ease-standard hover:text-fg md:min-h-6"
      onClick={onReset}
    >
      <RotateCcw className="size-3" />
      {label}
    </button>
  );
}

/**
 * The last section of every simulation's settings, the same in each: render quality, then
 * anti-aliasing (hidden while `antialias` is still unknown), the simulation's own render
 * switches (`children`), the frame-rate readout's switch (one for every simulation), an
 * optional note, then Reset.
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
  children,
}: {
  quality: RenderQuality;
  onQuality: (quality: RenderQuality) => void;
  antialias: A | null;
  modes: readonly AntialiasMode<A>[];
  onAntialias: (mode: A) => void;
  note?: ReactNode;
  children?: ReactNode;
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
            options={RENDER_QUALITIES.map((level) => ({ value: level, label: t(level) }))}
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
        <div className="-mx-3 grid gap-0.5">
          {children}
          <FrameRateSwitches />
        </div>
        {note}
        <ResetButton label={t("reset")} onReset={onReset} />
      </div>
    </RailSection>
  );
}
