"use client";

import { useEffect } from "react";

import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { ease, moveDuration, poseBetween, poseOf } from "../lib/model/guide-motion";
import { useSpectroscopy } from "../lib/store";

/**
 * Runs the guide's move to each step: frame by frame from where the visitor is to the step's
 * pose, the spectrum recomputed on the way, then lands it (the step's line opens). A new step,
 * the guide's end or leaving the page stops it where it is; the next move starts from there.
 * Under reduced motion every step lands at once.
 */
export function useGuideMotion() {
  const open = useSpectroscopy((s) => s.guideOpen);
  const step = useSpectroscopy((s) => s.guideStep);
  const target = useSpectroscopy((s) => s.guideTarget);
  useEffect(() => {
    const api = useSpectroscopy.getState;
    if (!open || !target || api().guideLanded) return;
    const from = poseOf(api());
    const duration = prefersReducedMotion() ? 0 : moveDuration(from, target);
    if (duration === 0) {
      api().landGuide();
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / duration;
      if (t >= 1) {
        api().landGuide();
        return;
      }
      const pose = poseBetween(from, target, ease(t));
      useSpectroscopy.setState((s) => ({
        range: pose.range,
        velocity: pose.velocity,
        sequenceTemperature: pose.sequenceTemperature,
        bench: { ...s.bench, lamp: pose.lamp, gas: pose.gas, column: pose.column },
      }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, step, target]);
}
