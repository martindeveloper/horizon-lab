/**
 * What the Orrery selects and flies to: the solar system's objects and, near Earth, its great
 * observatories. The close-up rules are the shared solar system's
 * (`@/space/solar-system/model/close-up`).
 */
import { closeUpKey } from "@/space/solar-system/model/close-up";
import {
  isObservatorySelection,
  type ObservatorySelection,
} from "@/space/solar-system/model/observatories";
import type { SolarSelection } from "@/space/solar-system/model/selection";

export {
  EARTH,
  canFlyTo,
  sameSystem,
  upFrom,
  type CloseUpSelection,
} from "@/space/solar-system/model/close-up";

export type OrrerySelection = SolarSelection | ObservatorySelection;

/** The solar system's own part of a selection, for the layers that draw it. */
export const solarPart = (sel: OrrerySelection | null): SolarSelection | null =>
  sel && !isObservatorySelection(sel) ? sel : null;

/** A selection as one string: equal for the same object. */
export const orreryKey = (sel: OrrerySelection) => closeUpKey(sel);
