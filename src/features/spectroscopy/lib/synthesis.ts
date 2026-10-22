import { workerTask } from "@horizon/toolkit/worker";

import {
  synthesisWork,
  type SpectrumRequest,
  type SynthesisJob,
  type SynthesisResult,
} from "./model/jobs";
import type { Mystery, MysteryAnswer } from "./model/scenes";
import { synthesize, type Spectrum } from "./model/spectrum";

export type { SpectrumRequest };

/**
 * Spectra and mysteries' answers are worked out off the main thread, in one module worker
 * (`synthesis.worker.ts`, on `@horizon/toolkit/worker`), so a guide's glide, a slider or a
 * Check never holds up a frame. Each open view's channel holds the worker: its lattices are
 * what make a pan or a new velocity cheap. It ends once the last channel closes and no answer
 * is left, so leaving the lab frees it; a later visit starts afresh. Where no worker starts
 * (Node's tests), the work runs in place.
 */
const synthesis = workerTask<SynthesisJob, SynthesisResult>(
  () => new Worker(new URL("./synthesis.worker.ts", import.meta.url), { type: "module" }),
  synthesisWork,
);

/** A job's result: a spectrum job's is a spectrum, a mystery's an answer. */
function ask(job: Extract<SynthesisJob, { kind: "spectrum" }>): Promise<Spectrum>;
function ask(job: Extract<SynthesisJob, { kind: "mystery" }>): Promise<MysteryAnswer>;
function ask(job: SynthesisJob) {
  return new Promise<SynthesisResult>((resolve, reject) => synthesis.run(job, resolve, reject));
}

/**
 * One view's spectra: one worked out at a time, and of those asked for meanwhile only the
 * latest, which goes next. Each arrives through `show` newer than the one before, so a view
 * keeps its last spectrum only while a newer one is being worked out. The first is worked out
 * here, at once, so a view never waits for the worker to load; the worker is handed it too,
 * which starts it and fills its lattice for the next. A spectrum that cannot be worked out
 * goes to `failed`. The channel holds the worker until it closes.
 */
export function spectrumChannel(
  show: (spectrum: Spectrum, request: SpectrumRequest) => void,
  failed: (error: Error) => void,
) {
  const release = synthesis.hold();
  let first = true;
  let busy = false;
  let open = true;
  let queued: SpectrumRequest | null = null;
  const send = (request: SpectrumRequest) => {
    busy = true;
    const job = { kind: "spectrum", ...request } as const;
    let spectrum: Promise<Spectrum>;
    if (first) {
      first = false;
      /* Only to start the worker: what it answers, or fails with, the copy here shows. */
      synthesis.run(
        job,
        () => {},
        () => {},
      );
      spectrum = Promise.resolve().then(() => synthesize(job.obs, job.from, job.to, job.samples));
    } else spectrum = ask(job);
    void spectrum
      .then(
        (arrived) => {
          if (open) show(arrived, request);
        },
        (error: Error) => {
          if (open) failed(error);
        },
      )
      .finally(() => {
        busy = false;
        const next = queued;
        queued = null;
        if (next && open) send(next);
      });
  };
  return {
    request: (request: SpectrumRequest) => {
      if (busy) queued = request;
      else send(request);
    },
    close: () => {
      open = false;
      queued = null;
      release();
    },
  };
}

/* ─── Mysteries' answers ─── */

type Answer = {
  promise: Promise<MysteryAnswer>;
  /** Someone waits for it (a Check): it is never given up. */
  wanted: boolean;
  start: () => Promise<void>;
  drop: () => void;
};

/** Answers by case and by the settings they were seen under; they go with their deck. */
const answers = new WeakMap<Mystery, Map<string, Answer>>();
/** Answers not yet started, oldest first; one is worked out at a time. */
let queue: Answer[] = [];
let running = false;

function pump() {
  const answer = running ? undefined : queue.shift();
  if (!answer) return;
  running = true;
  void answer.start().finally(() => {
    running = false;
    pump();
  });
}

function answerOf(m: Mystery, resolution: number, airmass: number, wanted: boolean) {
  let seen = answers.get(m);
  if (!seen) answers.set(m, (seen = new Map()));
  const key = `${resolution}|${airmass}`;
  const known = seen.get(key);
  if (known) {
    known.wanted ||= wanted;
    return known.promise;
  }
  /* An answer only looked ahead for, not yet started, gives way to this newer one. */
  for (const queued of queue) if (!queued.wanted) queued.drop();
  queue = queue.filter((queued) => queued.wanted);
  let resolve!: (answer: MysteryAnswer) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<MysteryAnswer>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const answer: Answer = {
    promise,
    wanted,
    start: () =>
      ask({ kind: "mystery", mystery: m, resolution, airmass }).then(resolve, (error: Error) => {
        /* Asked again, it is worked out again. */
        seen.delete(key);
        reject(error);
      }),
    drop: () => seen.delete(key),
  };
  seen.set(key, answer);
  queue.push(answer);
  pump();
  return promise;
}

/** The elements a mystery shows as the visitor sees it; worked out once per case and settings. */
export const mysteryAnswerOf = (m: Mystery, resolution: number, airmass: number) =>
  answerOf(m, resolution, airmass, true);

/** Starts on a mystery's answer while the visitor looks, so Check finds it ready. */
export function prefetchMysteryAnswer(m: Mystery, resolution: number, airmass: number) {
  /* A failure is worked out again, and reported, by the Check that asks for it. */
  answerOf(m, resolution, airmass, false).catch(() => {});
}
