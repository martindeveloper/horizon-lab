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
import { ListItem, ListTrack, ListTrackLabel } from "@horizon/toolkit/ui";

import { PLACE_LIST } from "../lib/model/places";
import { useSun, type Show } from "../lib/store";
import { PlaceGlyph } from "./place-glyph";

const SWITCHES: (keyof Show)[] = ["fieldLines", "names", "grid"];

/**
 * Every place from the core out to the wind as one route, each marked where it is on the Sun and
 * staged by the view it is seen in; a pick flies there and opens its card.
 */
export function PlacesPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("sun");
  const selection = useSun((s) => s.selection);
  return (
    <Rail id="sun-places" title={t("hud.finder")} closeLabel={t("hud.close")} onClose={onClose}>
      <ListTrack className="-mx-3">
        {PLACE_LIST.flatMap((place, index) => [
          ...(place.view === PLACE_LIST[index - 1]?.view
            ? []
            : [
                <ListTrackLabel key={`${index}-${place.view}`}>
                  {t(`views.${place.view}`)}
                </ListTrackLabel>,
              ]),
          <ListItem
            key={place.id}
            icon={<PlaceGlyph id={place.id} />}
            selected={selection === place.id}
            onClick={() => useSun.getState().goTo(place.id)}
          >
            {t(`places.${place.id}.title`)}
          </ListItem>,
        ])}
      </ListTrack>
    </Rail>
  );
}

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
        note={<p className="text-ui text-fg-secondary">{t("panel.qualityNote")}</p>}
      >
        <BloomSwitch on={bloom} onToggle={() => api().setBloom(!bloom)} />
        <LensSwitch on={lens} onToggle={() => api().setLens(!lens)} />
        <WideColourSwitch webgl on={wideColour} onToggle={() => api().setWideColour(!wideColour)} />
      </RenderSection>
    </Rail>
  );
}
