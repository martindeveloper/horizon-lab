import { useTranslations } from "next-intl";

import { RailSection, SwitchGroup } from "@/components/simulations/rail";
import { RenderSection, type AntialiasMode } from "@/components/simulations/render-settings";
import { useSelectHole } from "@/features/black-hole/hooks/use-select-hole";
import {
  cameraFloor,
  formatSpin,
  INCLINATION_LIMIT,
  MAX_DIST,
  MAX_SPIN,
} from "@/features/black-hole/lib/physics";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { toLogFraction, fromLogFraction } from "@horizon/toolkit/math";
import type { PassAntialias } from "@horizon/toolkit/rendering";
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

/** The observatory rail's id, for its toggle and for pin cards that keep clear of it. */
export const SETTINGS_PANEL_ID = "observatory-panel";

/** Observatory controls as rail sections: spin, camera, optics and quality. */
export function SettingsBody() {
  const t = useTranslations("blackHole");
  const spin = useBlackHole((s) => s.spin);
  const gravity = useBlackHole((s) => s.gravity);
  const setGravity = useBlackHole((s) => s.setGravity);
  // Whole degrees, so the auto-orbit re-renders this a few times a second, not every frame.
  const heading = useBlackHole((s) => Math.round((s.azimuth * 180) / Math.PI) % 360);
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
  const antialiasing = useBlackHole((s) => s.antialiasing);
  const setAntialiasing = useBlackHole((s) => s.setAntialiasing);
  const applyPreset = useBlackHole((s) => s.applyPreset);
  const presetId = useBlackHole((s) => s.presetId);
  const selectHole = useSelectHole();
  const animationPaused = useBlackHole((s) => s.animationPaused);
  const setAnimationPaused = useBlackHole((s) => s.setAnimationPaused);
  // Negative spin: the hole turns against the disk, which then orbits retrograde.
  const spinText = (a: number) =>
    a < 0 ? `${formatSpin(a)} · ${t("retrogradeDisk")}` : formatSpin(a);
  const degrees = (inclination * 180) / Math.PI;
  const elevationText = `${degrees.toFixed(0)}° · i ≈ ${(90 - Math.abs(degrees)).toFixed(0)}°`;
  const floor = cameraFloor(spin);
  const distanceText =
    distance < 8
      ? `${distance.toFixed(1)} M · ${t("nearHorizon")}`
      : `${distance < 80 ? distance.toFixed(1) : distance.toFixed(0)} M`;

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
            onChange={(v) => setAzimuth((v * Math.PI) / 180)}
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
            text={exposure.toFixed(2)}
            valueText={(v) => v.toFixed(2)}
            min={0.4}
            max={1.8}
            step={0.01}
            value={exposure}
            onChange={(v) => setExposure(v)}
          />
          <SliderRow
            label={t("disk")}
            text={diskBrightness.toFixed(2)}
            valueText={(v) => v.toFixed(2)}
            min={0}
            max={2}
            step={0.01}
            value={diskBrightness}
            onChange={(v) => setDiskBrightness(v)}
          />
          <SliderRow
            label={t("stars")}
            text={starIntensity.toFixed(2)}
            valueText={(v) => v.toFixed(2)}
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
        antialias={antialiasing}
        modes={ANTIALIAS_MODES}
        onAntialias={setAntialiasing}
        note={<p className="text-xs text-muted">{t("modelNotice")}</p>}
        onReset={() => (presetId === "custom" ? selectHole("lensed") : applyPreset(presetId))}
      />
    </>
  );
}
