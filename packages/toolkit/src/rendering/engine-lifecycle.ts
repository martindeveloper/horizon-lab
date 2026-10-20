import { DisposalScope } from "./disposal";

/** A simulation engine as its page owns it: created lazily, disposed once. */
export type SimulationEngine = { dispose: () => void };

/**
 * An engine's resources on one disposal scope: `build` owns them there, and the engine returned
 * lets them go; a build that throws lets go of whatever it had made before rethrowing.
 */
export function withScope(build: (scope: DisposalScope) => void): SimulationEngine {
  const scope = new DisposalScope();
  try {
    build(scope);
  } catch (error) {
    scope.dispose();
    throw error;
  }
  return { dispose: () => scope.dispose() };
}

/** Makes an engine, now or later; `signal` aborts when the page leaves before it is ready. */
export type StartEngine = (
  signal: AbortSignal,
  onError: (error: unknown) => void,
) => SimulationEngine | undefined | Promise<SimulationEngine | undefined>;

/**
 * Owns a lazy engine across navigation, including engines that resolve after unmount: one
 * that arrives after `dispose()` is disposed at once, and errors after it are dropped.
 */
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
