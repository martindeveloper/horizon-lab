export type SimulationEngine = { dispose: () => void };
export type StartEngine = (
  signal: AbortSignal,
  onError: (error: unknown) => void,
) => SimulationEngine | undefined | Promise<SimulationEngine | undefined>;

/** Own a lazy engine across navigation, including engines that resolve after unmount. */
export function startEngine(create: StartEngine, onError: (error: unknown) => void) {
  const controller = new AbortController();
  let engine: SimulationEngine | undefined;
  const report = (error: unknown) => {
    if (!controller.signal.aborted) onError(error);
  };
  void Promise.resolve()
    .then(() => (controller.signal.aborted ? undefined : create(controller.signal, report)))
    .then((created) => {
      if (controller.signal.aborted) created?.dispose();
      else engine = created;
    })
    .catch(report);
  return {
    dispose() {
      controller.abort();
      const current = engine;
      engine = undefined;
      current?.dispose();
    },
  };
}
