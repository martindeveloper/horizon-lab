/** Small cached textures; all integration and atmosphere interpolation happen off the GPU. */
import { DataTexture, FloatType, RGBAFormat } from "three";

import { atmosphereProfile, continuumTable } from "@/space/sun/graphics/atmosphere";
import { PROFILE_SAMPLES, SPECTRUM_SAMPLES } from "@/space/sun/graphics/parameters";

import { RUNG_FACTS, drawn } from "../model/catalogue";
import type { Look } from "../model/looks";
import { RUNG_IDS } from "../model/rungs";
import { MAX_DISCS } from "../parameters";

export function stellarTables(looks: readonly Look[]) {
  const spectrumData = continuumTable();
  const spectrum = new DataTexture(spectrumData, SPECTRUM_SAMPLES, 1, RGBAFormat, FloatType);
  spectrum.needsUpdate = true;
  const rows = looks.map((look, j) => {
    const facts = RUNG_FACTS[RUNG_IDS[j]!];
    // Atmosphere grid excludes compact objects. Missing giant masses use the low-gravity
    // boundary as an explicit display assumption, not a claimed surface-gravity measurement.
    const stellar = look.style === "convective" || look.style === "radiative";
    const logg = stellar ? (facts.gravity ? Math.log10(drawn(facts.gravity) * 100) : 0) : null;
    return atmosphereProfile((look.equatorK + look.poleK) / 2, logg, look.temperatures);
  });
  const data = new Float32Array(PROFILE_SAMPLES * 4 * MAX_DISCS);
  const profiles = new DataTexture(data, PROFILE_SAMPLES, MAX_DISCS, RGBAFormat, FloatType);
  const holder = new Int32Array(MAX_DISCS).fill(-1);
  function assign(slot: number, rung: number) {
    if (holder[slot] === rung) return;
    holder[slot] = rung;
    data.set(rows[rung]!, slot * PROFILE_SAMPLES * 4);
    profiles.needsUpdate = true;
  }
  return {
    spectrumData,
    uniforms: { uSpectrum: { value: spectrum }, uProfiles: { value: profiles } },
    assign,
    dispose() {
      spectrum.dispose();
      profiles.dispose();
    },
  };
}
