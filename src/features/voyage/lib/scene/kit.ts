/** Shared pieces of the Voyage renderer: the per-engine kit, the per-frame state, label room. */
import type { WorldSelection } from "@/space/galaxy/show";
import type { Looks } from "@/space/solar-system/graphics/looks";
import {
  DEFAULT_INSETS,
  type LabelInsets,
  type SceneKit,
  type Vec3d,
} from "@horizon/toolkit/scene";

import type { AnchorId } from "../model/anchors";
import type { ShipMotion } from "../model/ship";
import type { Show } from "../store";
import type { Lod } from "./lod";

/**
 * What every layer is built with: the host's basics, the shared solar looks (the bodies'
 * materials, lit by the Sun wherever the ship puts it) and the level of detail.
 */
export type VoyageKit = SceneKit<Looks, Lod>;

/** The model state one frame draws. */
export type Frame = {
  /** The date the solar system is drawn at: the epoch plus Earth's clock. */
  now: Date;
  show: Show;
  sel: WorldSelection | null;
  /** The ship's heliocentric position, km (the scene's origin). */
  ship: Vec3d;
  /** The anchor the ship is at or heading for: its name always shows. */
  aim: AnchorId;
  /** The ship's motion: globes are placed where a moving ship sees them. */
  motion: ShipMotion;
};

/**
 * Where labels may sit around the HUD, CSS px: below the header, above the flight dock
 * (`clear`, its height as the dock publishes it) and, while the guide speaks, above its
 * caption too (`caption`, 0 without one).
 */
export function labelInsets(clear: number, caption = 0): LabelInsets {
  return { ...DEFAULT_INSETS, bottom: Math.max(clear, caption) };
}
