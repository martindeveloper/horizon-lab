/**
 * The frame-rate readout's settings: whether it shows, and which of its parts (the frame-time
 * graph, the display's vsync windows, the JavaScript heap). One set for every simulation, kept
 * in memory for the visit to the site; no simulation's reset touches it.
 */
import { create } from "zustand";

export type FrameRatePart = "graph" | "vsync" | "memory";

export const FRAME_RATE_PARTS: readonly FrameRatePart[] = ["graph", "vsync", "memory"];

export type FrameRateState = {
  shown: boolean;
  parts: Readonly<Record<FrameRatePart, boolean>>;
  toggle: () => void;
  togglePart: (part: FrameRatePart) => void;
};

export const useFrameRate = create<FrameRateState>((set) => ({
  shown: false,
  parts: { graph: false, vsync: false, memory: false },
  toggle: () => set((s) => ({ shown: !s.shown })),
  togglePart: (part) => set((s) => ({ parts: { ...s.parts, [part]: !s.parts[part] } })),
}));
