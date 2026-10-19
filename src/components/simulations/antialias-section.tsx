"use client";

import { useTranslations } from "next-intl";

import type { SceneAntialias } from "@horizon/toolkit/scene";
import { SegmentedControl } from "@horizon/toolkit/ui";

import { RailSection } from "./rail";

/* Listed here, not imported: the scene module's values would pull the renderer into the page. */
const MODES: readonly SceneAntialias[] = ["off", "msaa", "fxaa"];

/**
 * A scene's anti-aliasing (off, MSAA or FXAA), worded by the shared space copy in
 * `namespace`. Hidden until the engine has published its device's default.
 */
export function AntialiasSection({
  namespace,
  value,
  onChange,
}: {
  namespace: string;
  value: SceneAntialias | null;
  onChange: (mode: SceneAntialias) => void;
}) {
  const t = useTranslations(namespace);
  if (!value) return null;
  return (
    <RailSection title={t("hud.antialiasing")}>
      <SegmentedControl<SceneAntialias>
        aria-label={t("hud.antialiasing")}
        className="gap-2"
        value={value}
        onValueChange={onChange}
        options={MODES.map((mode) => ({ value: mode, label: t(`antialias.${mode}`) }))}
      />
    </RailSection>
  );
}
