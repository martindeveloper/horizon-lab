import { useTranslations } from "next-intl";

import { RailSection, SwitchGroup } from "@/components/simulations/rail";
import {
  BloomSwitch,
  LensSwitch,
  RenderSection,
  WideColourSwitch,
  type AntialiasMode,
} from "@/components/simulations/render-settings";
import { usePhysicsFormat } from "@/features/black-hole/hooks/use-physics-format";
import { useSelectHole } from "@/features/black-hole/hooks/use-select-hole";
import { DEFAULT_PRESET_ID } from "@/features/black-hole/lib/holes/routes";
import {
  cameraFloor,
  INCLINATION_LIMIT,
  MAX_DIST,
  MAX_SPIN,
} from "@/features/black-hole/lib/physics";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { toLogFraction, fromLogFraction } from "@horizon/toolkit/math";
import type { PassAntialias } from "@horizon/toolkit/rendering";
import { RAD_PER_DEG } from "@horizon/toolkit/science";
import { ControlRow, Slider, SwitchRow } from "@horizon/toolkit/ui";

/** Every ray is re-traced on the GPU, so anti-aliasing can trace extra rays at edges. */
const ANTIALIAS_MODES: readonly AntialiasMode<PassAntialias>[] = [
  { value: "off", name: "off" },
  { value: "fxaa", name: "fxaa" },
  { value: "supersample", name: "edges" },
];

/** A labelled slider with its value read out, as every observatory control is laid out. */
function SliderRow({
  label,
  text,
  valueText,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  text: string;
  valueText: (v: number) => string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <ControlRow label={label} value={text}>
      <Slider
        aria-label={label}
        valueText={valueText}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
      />
    </ControlRow>
  );
}

/** Below this distance (M) the readout says the camera is near the horizon. */
const NEAR_HORIZON = 8;
/** From this distance (M) the readout drops its decimal. */
const FAR_DISTANCE = 80;

/** The View rail's id, for its toggle and for pin cards that keep clear of it. */
export const SETTINGS_PANEL_ID = "black-hole-view";

/** The View rail's sections: spin, camera, optics and rendering. */
export function SettingsBody() {
  const t = useTranslations("blackHole");
  const { formatNumber, formatSpin } = usePhysicsFormat();
  const spin = useBlackHole((s) => s.spin);
  const gravity = useBlackHole((s) => s.gravity);
  const setGravity = useBlackHole((s) => s.setGravity);
  // Whole degrees, so the auto-orbit re-renders this a few times a second, not every frame.
  const heading = useBlackHole((s) => Math.round(s.azimuth / RAD_PER_DEG) % 360);
  const inclination = useBlackHole((s) => s.inclination);
  const distance = useBlackHole((s) => s.distance);
  const exposure = useBlackHole((s) => s.exposure);
  const diskBrightness = useBlackHole((s) => s.diskBrightness);
  const starIntensity = useBlackHole((s) => s.starIntensity);
  const autoRotate = useBlackHole((s) => s.autoRotate);
  const quality = useBlackHole((s) => s.quality);
  const setSpin = useBlackHole((s) => s.setSpin);
  const setAzimuth = useBlackHole((s) => s.setAzimuth);
  const setInclination = useBlackHole((s) => s.setInclination);
  const setDistance = useBlackHole((s) => s.setDistance);
  const setExposure = useBlackHole((s) => s.setExposure);
  const setDiskBrightness = useBlackHole((s) => s.setDiskBrightness);
  const setStarIntensity = useBlackHole((s) => s.setStarIntensity);
  const setAutoRotate = useBlackHole((s) => s.setAutoRotate);
  const setQuality = useBlackHole((s) => s.setQuality);
  const antialias = useBlackHole((s) => s.antialias);
  const setAntialias = useBlackHole((s) => s.setAntialias);
  const resetRender = useBlackHole((s) => s.resetRender);
  const bloom = useBlackHole((s) => s.bloom);
  const setBloom = useBlackHole((s) => s.setBloom);
  const lens = useBlackHole((s) => s.lens);
  const setLens = useBlackHole((s) => s.setLens);
  const wideColour = useBlackHole((s) => s.wideColour);
  const setWideColour = useBlackHole((s) => s.setWideColour);
  const applyPreset = useBlackHole((s) => s.applyPreset);
  const presetId = useBlackHole((s) => s.presetId);
  const selectHole = useSelectHole();
  const animationPaused = useBlackHole((s) => s.animationPaused);
  const setAnimationPaused = useBlackHole((s) => s.setAnimationPaused);
  // Negative spin: the hole turns against the disk, which then orbits retrograde.
  const spinText = (a: number) =>
    a < 0 ? `${formatSpin(a)} · ${t("retrogradeDisk")}` : formatSpin(a);
  const degrees = inclination / RAD_PER_DEG;
  const elevationText = `${formatNumber(degrees, 0)}° · i ≈ ${formatNumber(90 - Math.abs(degrees), 0)}°`;
  const floor = cameraFloor(spin);
  const distanceValue = `${formatNumber(distance, distance < FAR_DISTANCE ? 1 : 0)} M`;
  const distanceText =
    distance < NEAR_HORIZON ? `${distanceValue} · ${t("nearHorizon")}` : distanceValue;
  const scaleText = (v: number) => formatNumber(v, 2);

  return (
    <>
      <RailSection title={t("spacetime")}>
        <div className="flex flex-col gap-4">
          <SliderRow
            label={t("spin")}
            text={spinText(spin)}
            valueText={spinText}
            min={-MAX_SPIN}
            max={MAX_SPIN}
            step={0.002}
            value={spin}
            onChange={(v) => setSpin(v)}
          />
          <SwitchGroup>
            <SwitchRow on={gravity} onToggle={() => setGravity(!gravity)}>
              {t("gravity")}
            </SwitchRow>
          </SwitchGroup>
          {gravity ? null : <p className="text-xs text-muted">{t("gravityOff")}</p>}
        </div>
      </RailSection>
      <RailSection title={t("camera")}>
        <div className="flex flex-col gap-4">
          <SliderRow
            label={t("azimuth")}
            text={`${heading}°`}
            valueText={(v) => `${v}°`}
            min={0}
            max={359}
            step={1}
            value={heading}
            onChange={(v) => setAzimuth(v * RAD_PER_DEG)}
          />
          <SliderRow
            label={t("elevation")}
            text={elevationText}
            valueText={() => elevationText}
            min={-INCLINATION_LIMIT}
            max={INCLINATION_LIMIT}
            step={0.01}
            value={inclination}
            onChange={(v) => setInclination(v)}
          />
          <SliderRow
            label={t("distance")}
            text={distanceText}
            valueText={() => distanceText}
            min={0}
            max={1}
            step={0.002}
            value={toLogFraction(distance, floor, MAX_DIST)}
            onChange={(v) => setDistance(fromLogFraction(v ?? 0, floor, MAX_DIST))}
          />
          <SwitchGroup>
            <SwitchRow on={autoRotate} onToggle={() => setAutoRotate(!autoRotate)}>
              {t("orbit")}
            </SwitchRow>
          </SwitchGroup>
        </div>
      </RailSection>
      <RailSection title={t("optics")}>
        <div className="flex flex-col gap-4">
          <SliderRow
            label={t("exposure")}
            text={scaleText(exposure)}
            valueText={scaleText}
            min={0.4}
            max={1.8}
            step={0.01}
            value={exposure}
            onChange={(v) => setExposure(v)}
          />
          <SliderRow
            label={t("disk")}
            text={scaleText(diskBrightness)}
            valueText={scaleText}
            min={0}
            max={2}
            step={0.01}
            value={diskBrightness}
            onChange={(v) => setDiskBrightness(v)}
          />
          <SliderRow
            label={t("stars")}
            text={scaleText(starIntensity)}
            valueText={scaleText}
            min={0}
            max={2}
            step={0.01}
            value={starIntensity}
            onChange={(v) => setStarIntensity(v)}
          />
          <SwitchGroup>
            <SwitchRow on={!animationPaused} onToggle={() => setAnimationPaused(!animationPaused)}>
              {t("animation")}
            </SwitchRow>
          </SwitchGroup>
        </div>
      </RailSection>
      <RenderSection<PassAntialias>
        quality={quality}
        onQuality={setQuality}
        antialias={antialias}
        modes={ANTIALIAS_MODES}
        onAntialias={setAntialias}
        note={<p className="text-xs text-muted">{t("modelNotice")}</p>}
        onReset={() => {
          resetRender();
          if (presetId === "custom") selectHole(DEFAULT_PRESET_ID);
          else applyPreset(presetId);
        }}
      >
        <BloomSwitch on={bloom} onToggle={() => setBloom(!bloom)} />
        <LensSwitch on={lens} onToggle={() => setLens(!lens)} />
        <WideColourSwitch webgl on={wideColour} onToggle={() => setWideColour(!wideColour)} />
      </RenderSection>
    </>
  );
}
