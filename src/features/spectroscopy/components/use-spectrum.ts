"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { observationFor, type Settings } from "../lib/model/scenes";
import { formedLines, synthesize, type Observation } from "../lib/model/spectrum";
import { useSpectroscopy } from "../lib/store";

/** The settings a spectrum depends on, compared field by field. */
export function useSettings(): Settings {
  return useSpectroscopy(
    useShallow((s) => ({
      view: s.view,
      star: s.star,
      sequenceTemperature: s.sequenceTemperature,
      /* Only the Sun and the stars move their source; a mystery's velocity moves only the
         laboratory markers, so it must not recompute the spectrum. */
      velocity: s.view === "sun" || s.view === "stars" ? s.velocity : 0,
      air: s.air,
      resolution: s.resolution,
      bench: s.bench,
      mystery: s.mystery,
    })),
  );
}

/* The scene, the spectrum, the card and the panels all read one observation and one list of
   its lines per change of settings, rather than each computing its own. */
const shared = new Map<string, Observation>();
const formed = new WeakMap<Observation, ReturnType<typeof formedLines>>();

/** What the current view observes, the same object for every component. */
export function useObservation(): Observation {
  const settings = useSettings();
  return useMemo(() => {
    const key = JSON.stringify(settings);
    const known = shared.get(key);
    if (known) return known;
    const obs = observationFor(settings);
    shared.clear();
    shared.set(key, obs);
    return obs;
  }, [settings]);
}

/** The lines the observation forms, strongest first. */
export function useFormedLines(obs: Observation) {
  return useMemo(() => {
    const cached = formed.get(obs);
    if (cached) return cached;
    const lines = formedLines(obs);
    formed.set(obs, lines);
    return lines;
  }, [obs]);
}

/** The spectrum in the window at `samples` pixels; null until there is room to draw it. */
export function useSpectrum(obs: Observation, range: readonly [number, number], samples: number) {
  const [from, to] = range;
  return useMemo(
    () => (samples >= 2 ? synthesize(obs, from, to, samples) : null),
    [obs, from, to, samples],
  );
}
