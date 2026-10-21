/**
 * The journey's side of the ship: each step flies the ship to its body (the store bumps the
 * flight as it applies the step); the scene tells the store when the ship has landed, so the
 * caption knows when to start counting. A gesture pauses the journey where it is.
 */
import type { useVoyage } from "../store";
import type { ShipCamera } from "./ship-camera";

export function createGuideDirector(ship: ShipCamera, store: typeof useVoyage) {
  let stepOf = -1;
  let flown = false;
  return {
    /** The viewer moved the camera: the shot is theirs, and the journey waits for them. */
    takeOver() {
      const s = store.getState();
      if (s.guideOpen && s.guidePlaying) s.toggleGuidePlaying();
    },
    /** Call once the ship has stepped. */
    step() {
      const s = store.getState();
      const index = s.guideOpen ? s.guideStep : -1;
      if (index !== stepOf) {
        stepOf = index;
        flown = false;
      }
      if (index < 0) return;
      if (ship.flying) flown = true;
      /* Landed once this step's flight has run (or there was none to run). */
      const landed = !ship.flying && (flown || ship.aim === s.destination);
      if (landed !== s.guideLanded) store.setState({ guideLanded: landed });
    },
  };
}
