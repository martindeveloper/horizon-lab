import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useSelectHole } from "@/features/black-hole/hooks/use-select-hole";
import { formatSpin, horizonOverM } from "@/features/black-hole/lib/physics";
import { MIN_DIST, MAX_DIST, type Quality } from "@/features/black-hole/lib/presets";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { toLogFraction, fromLogFraction } from "@horizon/toolkit/math";
import { ControlRow, SegmentedControl, Slider, SwitchRow } from "@horizon/toolkit/ui";

/** Observatory controls: spin, camera, optics, pace and quality. */
export function SettingsBody() {
  const t = useTranslations("blackHole");
  const spin = useBlackHole((s) => s.spin);
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
  const distanceText =
    distance < horizonOverM(spin)
      ? `${distance.toFixed(2)} M · ${t("inside")}`
      : distance < 8
        ? `${distance.toFixed(1)} M · ${t("infall")}`
        : `${distance < 80 ? distance.toFixed(1) : distance.toFixed(0)} M`;

  return (
    <div className="flex flex-col gap-4">
      <ControlRow label={t("spin")} value={spinText(spin)}>
        <Slider
          aria-label={t("spin")}
          valueText={spinText}
          min={-0.998}
          max={0.998}
          step={0.002}
          value={[spin]}
          onValueChange={([v]) => setSpin(v ?? 0)}
        />
      </ControlRow>
      <ControlRow label={t("azimuth")} value={`${heading}°`}>
        <Slider
          aria-label={t("azimuth")}
          valueText={(v) => `${v}°`}
          min={0}
          max={359}
          step={1}
          value={[heading]}
          onValueChange={([v]) => setAzimuth(((v ?? 0) * Math.PI) / 180)}
        />
      </ControlRow>
      <ControlRow label={t("elevation")} value={elevationText}>
        <Slider
          aria-label={t("elevation")}
          valueText={() => elevationText}
          min={-1.35}
          max={1.35}
          step={0.01}
          value={[inclination]}
          onValueChange={([v]) => setInclination(v ?? 0)}
        />
      </ControlRow>
      <ControlRow label={t("distance")} value={distanceText}>
        <Slider
          aria-label={t("distance")}
          valueText={() => distanceText}
          min={0}
          max={1}
          step={0.002}
          value={[toLogFraction(distance, MIN_DIST, MAX_DIST)]}
          onValueChange={([v]) => setDistance(fromLogFraction(v ?? 0, MIN_DIST, MAX_DIST))}
        />
      </ControlRow>
      <ControlRow label={t("exposure")} value={exposure.toFixed(2)}>
        <Slider
          aria-label={t("exposure")}
          valueText={(v) => v.toFixed(2)}
          min={0.4}
          max={1.8}
          step={0.01}
          value={[exposure]}
          onValueChange={([v]) => setExposure(v ?? 1)}
        />
      </ControlRow>
      <ControlRow label={t("disk")} value={diskBrightness.toFixed(2)}>
        <Slider
          aria-label={t("disk")}
          valueText={(v) => v.toFixed(2)}
          min={0}
          max={2}
          step={0.01}
          value={[diskBrightness]}
          onValueChange={([v]) => setDiskBrightness(v ?? 1)}
        />
      </ControlRow>
      <ControlRow label={t("stars")} value={starIntensity.toFixed(2)}>
        <Slider
          aria-label={t("stars")}
          valueText={(v) => v.toFixed(2)}
          min={0}
          max={2}
          step={0.01}
          value={[starIntensity]}
          onValueChange={([v]) => setStarIntensity(v ?? 1)}
        />
      </ControlRow>

      <div className="-mx-3 grid gap-0.5">
        <SwitchRow on={!animationPaused} onToggle={() => setAnimationPaused(!animationPaused)}>
          {t("animation")}
        </SwitchRow>
        <SwitchRow on={autoRotate} onToggle={() => setAutoRotate(!autoRotate)}>
          {t("orbit")}
        </SwitchRow>
      </div>
      <p className="text-xs text-muted">{t("modelNotice")}</p>
      <SegmentedControl<Quality>
        aria-label={t("renderQuality")}
        value={quality}
        onValueChange={setQuality}
        options={[
          { value: "economy", label: t("qualityEconomy") },
          { value: "standard", label: t("qualityStandard") },
          { value: "cinema", label: t("qualityCinema") },
        ]}
      />

      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-xs tracking-wide text-muted transition-colors duration-300 hover:text-fg md:min-h-6"
        onClick={() => (presetId === "custom" ? selectHole("lensed") : applyPreset(presetId))}
      >
        <RotateCcw className="size-3" />
        {t("reset")}
      </button>
    </div>
  );
}
