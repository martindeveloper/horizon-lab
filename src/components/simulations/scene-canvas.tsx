"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef } from "react";

import type { SceneMount } from "@horizon/toolkit/scene";

import type { SimulationEngine, StartEngine } from "./engine-lifecycle";
import { useSimulationEngine } from "./use-simulation-engine";

/**
 * The stage of a zoomable scene: its canvas and a layer of DOM labels over it. Hands the
 * engine its mount, with the translated label text and language read live, and disposes it
 * on unmount; a failure surfaces to the route's error boundary.
 */
export function SceneCanvas({
  id,
  label,
  labels,
  create,
  resetReady,
}: {
  /** The simulation's slug, marked on the canvas (`data-scene-canvas`). */
  id: string;
  /** The canvas's accessible name. */
  label: string;
  /** Label text by key, translated. */
  labels: Record<string, string>;
  /** Builds the engine; module-level, so it never changes. */
  create: (mount: SceneMount) => SimulationEngine;
  resetReady: () => void;
}) {
  const locale = useLocale();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const words = useRef({ labels, locale });
  useEffect(() => {
    words.current = { labels, locale };
  }, [labels, locale]);

  const start = useCallback<StartEngine>(
    (_signal, onError) => {
      const host = hostRef.current;
      const canvas = canvasRef.current;
      const labelRoot = labelRef.current;
      if (!host || !canvas || !labelRoot) return;
      return create({
        canvas,
        host,
        labelRoot,
        labels: () => words.current.labels,
        locale: () => words.current.locale,
        onError,
      });
    },
    [create],
  );
  useSimulationEngine(start, resetReady);

  return (
    <div ref={hostRef} className="absolute inset-0 z-0 bg-space">
      <canvas
        ref={canvasRef}
        data-scene-canvas={id}
        className="block size-full"
        role="img"
        aria-label={label}
      />
      {/* Projected names repeat the Objects panel in no reading order; keep them visual. */}
      <div
        ref={labelRef}
        aria-hidden
        data-scene-labels
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />
    </div>
  );
}
