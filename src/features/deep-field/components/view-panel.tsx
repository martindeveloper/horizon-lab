import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { CameraPad } from "@/components/simulations/camera-pad";
import { DistanceUnitControl } from "@/components/simulations/map-readouts";
import { Rail, RailSection, SwitchGroup } from "@/components/simulations/rail";
import {
  BloomSwitch,
  LensSwitch,
  RenderSection,
  SCENE_ANTIALIAS,
} from "@/components/simulations/render-settings";
import { SwitchChips } from "@/components/simulations/switch-chips";
import { Disclosure, ListItem } from "@horizon/toolkit/ui";

import { useDeepField } from "../lib/store";
import { AtlasModeControl } from "./atlas-mode-control";
import { CmbControl } from "./cmb";
import { HaloSwitches } from "./dark-universe";

const SWITCHES = ["names", "distances", "lightTime"] as const;
const ATLAS_SWITCHES = [
  "cosmicMeasured",
  "cosmicBasins",
  "cosmicVoids",
  "cosmicKnots",
  "cosmicGuides",
] as const;

/**
 * How the map is drawn, controls only: what it shows, the dark matter overlay (its story is the
 * Dark universe panel's), the cosmic map's display and layers (how to read them folded under),
 * the distance unit, buttons to turn the camera, then rendering.
 */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("deepField");
  const show = useDeepField((s) => s.show);
  const mode = show.cosmicMode;
  const unit = useDeepField((s) => s.distanceUnit);
  const angles = useDeepField((s) => s.cameraAngles);
  const antialias = useDeepField((s) => s.antialias);
  const quality = useDeepField((s) => s.quality);
  const bloom = useDeepField((s) => s.bloom);
  const lens = useDeepField((s) => s.lens);
  return (
    <Rail id="deep-field-view" title={t("hud.view")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("hud.show")}>
        <SwitchChips
          list
          keys={SWITCHES}
          values={show}
          label={(key) => t(`toggles.${key}`)}
          onToggle={(key) => useDeepField.getState().patchShow({ [key]: !show[key] })}
        />
      </RailSection>
      <RailSection title={t("dark.title")}>
        <HaloSwitches />
        <SwitchGroup>
          <ListItem
            detail={<ChevronRight aria-hidden className="icon size-icon-compact" />}
            onClick={() => useDeepField.getState().openDarkView("halo")}
          >
            {t("dark.open")}
          </ListItem>
        </SwitchGroup>
      </RailSection>
      <RailSection title={t("atlas.modeTitle")}>
        <AtlasModeControl />
        {mode === "illustration" ? null : (
          <div className="mt-2">
            <SwitchChips
              list
              keys={ATLAS_SWITCHES}
              values={show}
              label={(key) => t(`atlas.layers.${key}`)}
              onToggle={(key) => useDeepField.getState().patchShow({ [key]: !show[key] })}
            />
          </div>
        )}
        <Disclosure className="mt-2" summary={t("atlas.howToRead")}>
          <p>{t(`atlas.modeHints.${mode}`)}</p>
          {mode === "illustration" ? null : (
            <>
              <p>{t("atlas.glyphs")}</p>
              <p>{t("atlas.coverage")}</p>
            </>
          )}
          <p>{t("atlas.experienceModes")}</p>
        </Disclosure>
      </RailSection>
      <RailSection title={t("cmb.title")}>
        <CmbControl />
        <p className="mt-2 text-ui text-fg-secondary">{t("cmb.modeNote")}</p>
      </RailSection>
      <RailSection title={t("hud.units")}>
        <DistanceUnitControl
          namespace="deepField"
          value={unit}
          onChange={(next) => useDeepField.getState().setDistanceUnit(next)}
        />
      </RailSection>
      <RailSection title={t("hud.camera")}>
        <CameraPad
          namespace="deepField"
          angles={angles}
          onRotate={(turn) => useDeepField.getState().rotate(turn)}
        />
      </RailSection>
      <RenderSection
        quality={quality}
        onQuality={(level) => useDeepField.getState().setQuality(level)}
        antialias={antialias}
        modes={SCENE_ANTIALIAS}
        onAntialias={(mode) => useDeepField.getState().setAntialias(mode)}
        onReset={() => useDeepField.getState().resetView()}
      >
        <BloomSwitch on={bloom} onToggle={() => useDeepField.getState().setBloom(!bloom)} />
        <LensSwitch on={lens} onToggle={() => useDeepField.getState().setLens(!lens)} />
      </RenderSection>
    </Rail>
  );
}
