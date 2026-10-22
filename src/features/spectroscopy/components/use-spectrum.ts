"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { observationFor, type Settings } from "../lib/model/scenes";
import { formedLines, type Observation, type Spectrum } from "../lib/model/spectrum";
import { useSpectroscopy } from "../lib/store";
import { spectrumChannel } from "../lib/synthesis";

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

/**
 * The observation for some settings, the same object while they stay the same: the scene, the
 * spectrum, the card and the panels all read one observation and one list of its lines per
 * change of settings, rather than each computing its own. Each cache keeps its latest.
 */
function observationCache() {
  let latest: { key: string; obs: Observation } | null = null;
  return (settings: Settings) => {
    const key = JSON.stringify(settings);
    if (latest?.key !== key) latest = { key, obs: observationFor(settings) };
    return latest.obs;
  };
}
const inView = observationCache();
const atRest = observationCache();
const formed = new WeakMap<Observation, ReturnType<typeof formedLines>>();

/** What the current view observes, the same object for every component. */
export function useObservation(): Observation {
  const settings = useSettings();
  return useMemo(() => inView(settings), [settings]);
}

/**
 * The same observation with its source at rest: what a line's strength depends on (its width
 * is measured at rest), unchanged while only the velocity moves.
 */
export function useRestObservation(): Observation {
  const settings = useSettings();
  return useMemo(
    () => (settings.velocity === 0 ? inView(settings) : atRest({ ...settings, velocity: 0 })),
    [settings],
  );
}

/**
 * The lines the observation forms, strongest first. Worked out on a deferred copy of it, so a
 * drag through the settings stays responsive and the lines follow once it pauses.
 */
export function useFormedLines(current: Observation) {
  const obs = useDeferredValue(current);
  return useMemo(() => {
    const cached = formed.get(obs);
    if (cached) return cached;
    const lines = formedLines(obs);
    formed.set(obs, lines);
    return lines;
  }, [obs]);
}

/** A spectrum, with the observation and the window it was worked out for. */
export type ShownSpectrum = {
  spectrum: Spectrum;
  obs: Observation;
  range: readonly [number, number];
};

/**
 * The spectrum in the window at `samples` pixels, worked out off the main thread
 * (`synthesis.ts`); null until the first arrives, or while there is no room to draw it. While a
 * newer one is worked out the last stays up, with what it shows, so whatever is drawn over it
 * (names, markers, readouts) can follow the spectrum on screen rather than the settings. A
 * spectrum that cannot be worked out surfaces to the route's error boundary.
 */
export function useSpectrum(
  obs: Observation,
  range: readonly [number, number],
  samples: number,
): ShownSpectrum | null {
  const [from, to] = range;
  const [shown, setShown] = useState<ShownSpectrum | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const channel = useRef<ReturnType<typeof spectrumChannel>>(null);
  useEffect(() => {
    const open = spectrumChannel(
      (spectrum, request) =>
        setShown({ spectrum, obs: request.obs, range: [request.from, request.to] }),
      setFailure,
    );
    channel.current = open;
    return () => {
      open.close();
      channel.current = null;
    };
  }, []);
  useEffect(() => {
    if (samples >= 2) channel.current?.request({ obs, from, to, samples });
  }, [obs, from, to, samples]);
  if (failure) throw failure;
  return samples >= 2 ? shown : null;
}
