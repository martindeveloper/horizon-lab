import { useTranslations } from "next-intl";

import { Rail, RailSection } from "@/components/simulations/rail";
import {
  BloomSwitch,
  LensSwitch,
  RenderSection,
  SCENE_ANTIALIAS,
} from "@/components/simulations/render-settings";
import { SwitchChips } from "@/components/simulations/switch-chips";

import { useAfterglow, type Show } from "../lib/store";

const SWITCHES: (keyof Show)[] = ["glare"];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("afterglow");
  const show = useAfterglow((s) => s.show);
  const antialias = useAfterglow((s) => s.antialias);
  const quality = useAfterglow((s) => s.quality);
  const bloom = useAfterglow((s) => s.bloom);
  const lens = useAfterglow((s) => s.lens);
  const api = useAfterglow.getState;
  return (
    <Rail
      id="afterglow-settings"
      title={t("hud.settings")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <RailSection title={t("hud.show")}>
        <SwitchChips
          list
          keys={SWITCHES}
          values={show}
          label={(key) => t(`toggles.${key}`)}
          onToggle={(key) => api().patchShow({ [key]: !show[key] })}
        />
      </RailSection>
      <RenderSection
        quality={quality}
        onQuality={(level) => api().setQuality(level)}
        antialias={antialias}
        modes={SCENE_ANTIALIAS}
        onAntialias={(mode) => api().setAntialias(mode)}
        onReset={() => api().resetView()}
      >
        <BloomSwitch on={bloom} onToggle={() => api().setBloom(!bloom)} />
        <LensSwitch on={lens} onToggle={() => api().setLens(!lens)} />
      </RenderSection>
    </Rail>
  );
}
