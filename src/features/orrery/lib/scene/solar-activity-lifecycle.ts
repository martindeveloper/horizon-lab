import { startEngine, type SimulationEngine } from "@horizon/toolkit/rendering";

export type SolarActivity = {
  update: (dt: number, visible: boolean, animate: boolean) => void;
  /** Ray-march steps through the prominences, as the render quality changes. */
  setSteps: (steps: number) => void;
  dispose: () => void;
};

/** No import, resource construction or frame callbacks until explicitly enabled. */
export function createSolarActivityLifecycle(
  load: () => Promise<() => SolarActivity>,
  invalidate: () => void,
  onError: (error: unknown) => void,
) {
  let current: SolarActivity | null = null;
  let session: SimulationEngine | undefined;
  let disposed = false;
  function stop() {
    const previous = session;
    session = undefined;
    current = null;
    previous?.dispose();
  }
  return {
    get current() {
      return current;
    },
    setEnabled(enabled: boolean) {
      if (disposed || enabled === !!session) return;
      if (!enabled) {
        stop();
        return;
      }
      session = startEngine(async (signal) => {
        const create = await load();
        // A chunk or bake already in flight can finish after Off/navigation. Never attach it.
        if (signal.aborted) return;
        const effect = create();
        current = effect;
        invalidate();
        return {
          dispose() {
            if (current === effect) current = null;
            effect.dispose();
          },
        };
      }, onError);
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
