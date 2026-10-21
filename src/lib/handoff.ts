import type { OrbitPose } from "@horizon/toolkit/camera";
import { clamp } from "@horizon/toolkit/math";
import { json, storageCell } from "@horizon/toolkit/storage";

import type { SolarViewId } from "../space/solar-system/model/views";
import { slugPath } from "./simulation-paths";
import { simulations, type RegisteredSimulation } from "./simulations";

type SolarSimulation = Extract<RegisteredSimulation, { solarSystem: object }>;

/**
 * The simulations that show the shared solar system (their manifests' `solarSystem`), by id.
 * Each names the solar system's views alike, so a view in one is the same view in another.
 */
const SIDES = new Map<string, SolarSimulation>(
  simulations
    .filter((manifest): manifest is SolarSimulation => "solarSystem" in manifest)
    .map((manifest) => [manifest.id, manifest]),
);
export type HandoffSide = SolarSimulation["id"];

/** A solar system view in one of them. */
export function handoffPath(to: HandoffSide, view: SolarViewId) {
  const side = SIDES.get(to);
  return side ? slugPath(side.href, side.solarSystem.defaultView, view) : "/";
}

/** A crossing under way: who it is for, and the camera pose the other side left at. */
export type Crossing = { to: HandoffSide; pose?: OrbitPose };

const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const isCrossing = (value: unknown): value is Crossing => {
  if (typeof value !== "object" || value === null || !("to" in value)) return false;
  const { to, pose } = value as { to: unknown; pose?: Record<string, unknown> };
  const poseOk =
    pose === undefined ||
    (typeof pose === "object" &&
      pose !== null &&
      finite(pose.azimuth) &&
      finite(pose.inclination) &&
      finite(pose.distance));
  return typeof to === "string" && SIDES.has(to) && poseOk;
};

/**
 * A one-shot note that the visitor crossed between two of them at a view they share: the side arrived at opens where the other left off, the same pose, so the swap reads
 * as one place. Read once, then cleared; it lapses after half a minute.
 */
const handoff = storageCell({
  key: "handoff",
  area: "session",
  lifetime: 30_000,
  codec: json(isCrossing),
});

/** A link across was followed. */
export function leaveFor(to: HandoffSide) {
  handoff.set({ to });
}

/** The side being left adds its camera's pose to a crossing under way. */
export function carryPose(from: HandoffSide, pose: OrbitPose) {
  const crossing = handoff.get();
  if (crossing && crossing.to !== from) handoff.set({ to: crossing.to, pose: { ...pose } });
}

/** Reads and clears a crossing addressed to `to`, its pose's distance held inside `limits`. */
export function takeHandoff(
  to: HandoffSide,
  limits: { min: number; max: number },
): Crossing | null {
  const crossing = handoff.get();
  if (crossing?.to !== to) return null;
  handoff.clear();
  const { pose } = crossing;
  return pose
    ? { to, pose: { ...pose, distance: clamp(pose.distance, limits.min, limits.max) } }
    : crossing;
}
