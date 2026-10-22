"use client";

import { useTranslations } from "next-intl";

import { CameraPad } from "@/components/simulations/camera-pad";
import { Rail, RailSection } from "@/components/simulations/rail";
import {
  BloomSwitch,
  LensSwitch,
  RenderSection,
  SCENE_ANTIALIAS,
  WideColourSwitch,
} from "@/components/simulations/render-settings";
import { SwitchChips } from "@/components/simulations/switch-chips";

import { useSun, type Show } from "../lib/store";

const SWITCHES: (keyof Show)[] = ["fieldLines", "names", "grid"];

/** How the Sun is drawn: what the scene shows, buttons to turn the camera, then rendering. */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("sun");
  const show = useSun((s) => s.show);
  const angles = useSun((s) => s.cameraAngles);
  const antialias = useSun((s) => s.antialias);
  const quality = useSun((s) => s.quality);
  const bloom = useSun((s) => s.bloom);
  const lens = useSun((s) => s.lens);
  const wideColour = useSun((s) => s.wideColour);
  const api = useSun.getState;
  return (
    <Rail id="sun-view" title={t("hud.view")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("hud.show")}>
        <SwitchChips
          list
          keys={SWITCHES}
          values={show}
          label={(key) => t(`toggles.${key}`)}
          onToggle={(key) => api().patchShow({ [key]: !show[key] })}
        />
      </RailSection>
      <RailSection title={t("hud.camera")}>
        <CameraPad namespace="sun" angles={angles} onRotate={(turn) => api().rotate(turn)} />
      </RailSection>
      <RenderSection
        quality={quality}
        onQuality={(level) => api().setQuality(level)}
        antialias={antialias}
        modes={SCENE_ANTIALIAS}
        onAntialias={(mode) => api().setAntialias(mode)}
        onReset={() => api().resetView()}
        note={<p className="text-xs text-muted">{t("panel.qualityNote")}</p>}
      >
        <BloomSwitch on={bloom} onToggle={() => api().setBloom(!bloom)} />
        <LensSwitch on={lens} onToggle={() => api().setLens(!lens)} />
        <WideColourSwitch webgl on={wideColour} onToggle={() => api().setWideColour(!wideColour)} />
      </RenderSection>
    </Rail>
  );
}
