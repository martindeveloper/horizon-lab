/**
 * A pure computation off the main thread: a module worker answers requests by message, the
 * typed arrays of its results transferred, not copied. Where no worker can start, the same
 * computation runs in place. No dependencies; importing it touches no browser globals.
 */

/**
 * A long computation in steps: after each `yield` the worker answers the requests that came
 * meanwhile before it takes the next step, and the generator's return value is the result.
 */
export type WorkerSteps<Result> = Generator<unknown, Result, undefined>;

/** What a task's `compute` gives back: its result, or the steps that end in it. */
export type WorkerComputed<Result> = Result | WorkerSteps<Result>;

type Job<Request> = { id: number; request: Request };
type Answer<Result> = { id: number; result: Result } | { id: number; error: string };

export type WorkerTask<Request, Result> = {
  /**
   * Hands `request`'s result to `done`: before returning where the task runs in place,
   * otherwise when the worker answers. A `compute` that throws hands its error to `failed`
   * and the worker serves on; without `failed` the error is thrown, at once in place, else
   * as an uncaught error on the main thread. Returns a cancel that drops the answer.
   */
  run(
    request: Request,
    done: (result: Result) => void,
    failed?: (error: Error) => void,
  ): () => void;
  /**
   * Keeps the worker between requests while held, for an owner that sends a stream of them (a
   * view while it is open) and should not start a worker for each. Returns the release; once
   * nothing holds the task and no request is left, the worker ends.
   */
  hold(): () => void;
  /** Ends the worker and drops every pending answer; a later request starts a new one. */
  dispose(): void;
};

/** Whether `compute` gave steps rather than a result: no result clones as a generator. */
const isSteps = <Result>(value: WorkerComputed<Result>): value is WorkerSteps<Result> =>
  Object.prototype.toString.call(value) === "[object Generator]";

/** The result, its steps (if any) taken to the end at once. */
function finish<Result>(computed: WorkerComputed<Result>): Result {
  if (!isSteps(computed)) return computed;
  for (;;) {
    const step = computed.next();
    if (step.done) return step.value;
  }
}

const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/**
 * The main thread's side of a task. `spawn` makes the worker, written at the call site as
 * `new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" })` so the bundler
 * finds it; that worker calls `serveWorkerTask(compute)`. `compute` is the same pure function,
 * run in place when `spawn` throws (no `Worker`, or a bundle without worker support) and for
 * the requests a failing worker leaves. The worker starts on the first request and ends when
 * none are left and nothing holds it.
 */
export function workerTask<Request, Result>(
  spawn: () => Worker,
  compute: (request: Request) => WorkerComputed<Result>,
): WorkerTask<Request, Result> {
  type Pending = {
    request: Request;
    done: (result: Result) => void;
    failed: ((error: Error) => void) | undefined;
  };
  let worker: Worker | null = null;
  /** No worker could start, or one failed: requests from then on run in place. */
  let inPlace = false;
  let next = 0;
  const pending = new Map<number, Pending>();
  /** Owners holding the worker between requests (`hold`). */
  let holds = 0;
  /** The end of an idle worker, waiting its task. */
  let ending: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(ending);
    ending = undefined;
    worker?.terminate();
    worker = null;
  };
  const unused = () => pending.size === 0 && holds === 0;
  /*
   * An idle worker ends a task later, not at once: a request or a hold that follows in the same
   * task (the next of a queue, a view remounted by StrictMode or swapped for another in one
   * commit) keeps it rather than paying for a new one.
   */
  const idle = () => {
    if (!worker || ending !== undefined || !unused()) return;
    ending = setTimeout(() => {
      ending = undefined;
      if (unused()) stop();
    });
  };
  const here = ({ request, done, failed }: Pending) => {
    let result: Result;
    try {
      result = finish(compute(request));
    } catch (error) {
      if (!failed) throw error;
      failed(asError(error));
      return;
    }
    done(result);
  };
  const fail = () => {
    inPlace = true;
    stop();
    const left = [...pending.values()];
    pending.clear();
    for (const job of left) here(job);
  };
  const start = () => {
    try {
      const made = spawn();
      made.addEventListener("message", ({ data }: MessageEvent<Answer<Result>>) => {
        const job = pending.get(data.id);
        if (!job) return;
        pending.delete(data.id);
        idle();
        if (!("error" in data)) job.done(data.result);
        else if (job.failed) job.failed(new Error(data.error));
        else
          /* Nobody waits for it: it surfaces as an uncaught error, as it would in place. */
          queueMicrotask(() => {
            throw new Error(data.error);
          });
      });
      made.addEventListener("error", (event) => {
        /* Handled: the requests are answered in place instead. */
        event.preventDefault();
        fail();
      });
      made.addEventListener("messageerror", fail);
      return made;
    } catch {
      inPlace = true;
      return null;
    }
  };
  return {
    run(request, done, failed) {
      if (!inPlace) worker ??= start();
      if (!worker) {
        here({ request, done, failed });
        return () => {};
      }
      const id = next++;
      pending.set(id, { request, done, failed });
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- A worker's postMessage takes no origin.
      worker.postMessage({ id, request } satisfies Job<Request>);
      return () => {
        if (pending.delete(id)) idle();
      };
    },
    hold() {
      holds += 1;
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        holds -= 1;
        idle();
      };
    },
    dispose() {
      pending.clear();
      stop();
    },
  };
}

/** Adds every `ArrayBuffer` under the typed arrays in `value` to `found`. */
function collectBuffers(value: unknown, found: Set<ArrayBuffer>) {
  if (ArrayBuffer.isView(value)) {
    if (value.buffer instanceof ArrayBuffer) found.add(value.buffer);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectBuffers(item, found);
  }
}

/**
 * The worker's side of a task: answers each request with `compute`. Every typed array in the
 * result is transferred, so `compute` returns fresh arrays it does not keep. A `compute` that
 * throws is answered with its error, and the worker serves on. Steps run one per turn, the
 * oldest request's first, and the requests that arrive meanwhile are answered between them.
 */
export function serveWorkerTask(compute: (request: never) => unknown) {
  const answer = (id: number, result: unknown) => {
    const transfer = new Set<ArrayBuffer>();
    collectBuffers(result, transfer);
    self.postMessage({ id, result } satisfies Answer<unknown>, { transfer: [...transfer] });
  };
  const failure = (id: number, error: unknown) =>
    self.postMessage({ id, error: asError(error).message } satisfies Answer<unknown>, {
      transfer: [],
    });
  /** Requests under way in steps, oldest first. */
  const long: { id: number; steps: WorkerSteps<unknown> }[] = [];
  /** A turn of their own for the steps, behind the messages already waiting; open while any are left. */
  let turn: MessageChannel | null = null;
  const step = () => {
    const job = long[0];
    if (!job || !turn) return;
    try {
      const next = job.steps.next();
      if (next.done) {
        long.shift();
        answer(job.id, next.value);
      }
    } catch (error) {
      long.shift();
      failure(job.id, error);
    }
    if (long.length) turn.port2.postMessage(null);
    else {
      turn.port1.close();
      turn = null;
    }
  };
  /* A message carries no type: the request is whatever its task's `run` was given. */
  self.addEventListener("message", ({ data }: MessageEvent<Job<never>>) => {
    let computed: WorkerComputed<unknown>;
    try {
      computed = compute(data.request);
    } catch (error) {
      failure(data.id, error);
      return;
    }
    if (!isSteps(computed)) {
      answer(data.id, computed);
      return;
    }
    long.push({ id: data.id, steps: computed });
    if (turn) return;
    turn = new MessageChannel();
    turn.port1.addEventListener("message", step);
    /* A port listened to with addEventListener delivers only once started. */
    turn.port1.start();
    turn.port2.postMessage(null);
  });
}
