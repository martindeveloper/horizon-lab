import { COARSE_POINTER_QUERY } from "../environment";

type Battery = EventTarget & { charging: boolean };
/** Optional capability hint only; callers decide the frame-rate policy. */
export function observePowerPreference() {
  let disposed = false;
  let battery: Battery | null = null;
  const pointer = window.matchMedia(COARSE_POINTER_QUERY);
  const state = { coarsePointer: pointer.matches, onBattery: false };
  const updatePointer = () => {
    state.coarsePointer = pointer.matches;
  };
  const updateBattery = () => {
    state.onBattery = battery ? !battery.charging : false;
  };
  pointer.addEventListener("change", updatePointer);
  const nav = navigator as Navigator & { getBattery?: () => Promise<Battery> };
  void nav
    .getBattery?.()
    .then((value) => {
      if (disposed) return;
      battery = value;
      updateBattery();
      battery.addEventListener("chargingchange", updateBattery);
    })
    .catch(() => {
      /* A denied/unavailable hint must never prevent rendering. */
    });
  return {
    state,
    dispose() {
      disposed = true;
      pointer.removeEventListener("change", updatePointer);
      battery?.removeEventListener("chargingchange", updateBattery);
    },
  };
}
