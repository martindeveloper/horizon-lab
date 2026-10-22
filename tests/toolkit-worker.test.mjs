import assert from "node:assert/strict";
import test from "node:test";

import { serveWorkerTask, workerTask } from "@horizon/toolkit/worker";

const square = (n) => n * n;
/** The next task: an idle worker ends then. */
const nextTask = () => new Promise((resolve) => setTimeout(resolve));

/** A worker the test answers by hand: its jobs, and whether it was terminated. */
function fakeWorkers() {
  const made = [];
  const spawn = () => {
    const worker = { jobs: [], ended: false, on: {} };
    worker.addEventListener = (type, listener) => (worker.on[type] = listener);
    worker.postMessage = (job) => worker.jobs.push(job);
    worker.terminate = () => (worker.ended = true);
    worker.answer = (job) =>
      worker.on.message({ data: { id: job.id, result: square(job.request) } });
    worker.refuse = (job, error) => worker.on.message({ data: { id: job.id, error } });
    made.push(worker);
    return worker;
  };
  return { made, spawn };
}

test("a task runs in place, before run returns, where no worker can start", () => {
  let spawns = 0;
  const task = workerTask(() => {
    spawns += 1;
    throw new ReferenceError("Worker is not defined");
  }, square);
  const results = [];
  for (const n of [3, 4]) task.run(n, (result) => results.push(result));
  assert.deepEqual(results, [9, 16]);
  assert.equal(spawns, 1, "a worker that cannot start is not tried again");
});

test("a worker answers each request by id, ends when none are left, and a cancel drops one", async () => {
  const { made, spawn } = fakeWorkers();
  const task = workerTask(spawn, () => assert.fail("computed in place"));
  const results = [];
  task.run(2, (result) => results.push(result));
  const cancel = task.run(5, () => assert.fail("a cancelled answer arrived"));
  task.run(7, (result) => results.push(result));
  const [worker] = made;
  assert.equal(made.length, 1, "one worker serves every request");
  const [two, five, seven] = worker.jobs;
  worker.answer(seven);
  cancel();
  worker.answer(five);
  assert.equal(worker.ended, false);
  worker.answer(two);
  assert.deepEqual(results, [49, 4]);
  await nextTask();
  assert.equal(worker.ended, true, "idle once every request is answered");
  task.run(3, () => {})();
  assert.equal(made.length, 2, "the next request starts a new worker");
  await nextTask();
  assert.equal(made[1].ended, true, "a cancel of the last request ends it");
});

test("a held worker serves a stream of requests and ends after its last release", async () => {
  const { made, spawn } = fakeWorkers();
  const task = workerTask(spawn, () => assert.fail("computed in place"));
  const release = task.hold();
  const results = [];
  for (const n of [2, 3]) {
    task.run(n, (result) => results.push(result));
    made[0].answer(made[0].jobs.shift());
    await nextTask();
  }
  task.run(4, () => {})();
  await nextTask();
  assert.deepEqual(results, [4, 9]);
  assert.equal(made.length, 1, "one worker for the whole stream");
  assert.equal(made[0].ended, false, "idle, still held");
  release();
  const remounted = task.hold();
  await nextTask();
  assert.equal(made[0].ended, false, "held again in the same task: kept");
  const other = task.hold();
  remounted();
  remounted();
  await nextTask();
  assert.equal(made[0].ended, false, "a release counts once");
  other();
  await nextTask();
  assert.equal(made[0].ended, true, "the last release ends it");
});

test("a released worker ends once its last request is answered; a later one starts afresh", async () => {
  const { made, spawn } = fakeWorkers();
  const task = workerTask(spawn, () => assert.fail("computed in place"));
  const release = task.hold();
  task.run(2, () => {});
  release();
  await nextTask();
  assert.equal(made[0].ended, false, "a request still pending keeps it");
  made[0].answer(made[0].jobs[0]);
  await nextTask();
  assert.equal(made[0].ended, true);
  task.hold();
  task.run(5, () => assert.fail("a disposed task answered"));
  assert.equal(made.length, 2);
  task.dispose();
  assert.equal(made[1].ended, true, "dispose ends it, held or not");
});

test("a failing worker's requests, and every later one, run in place", () => {
  const { made, spawn } = fakeWorkers();
  const task = workerTask(spawn, square);
  const results = [];
  task.run(6, (result) => results.push(result));
  let handled = false;
  made[0].on.error({ preventDefault: () => (handled = true) });
  assert.deepEqual(results, [36]);
  assert.equal(handled, true, "the error is handled, not reported");
  assert.equal(made[0].ended, true);
  task.run(8, (result) => results.push(result));
  assert.deepEqual(results, [36, 64]);
  assert.equal(made.length, 1);
});

test("the worker side transfers every distinct buffer of a result", () => {
  const posted = [];
  const on = {};
  globalThis.self = {
    addEventListener: (type, listener) => (on[type] = listener),
    postMessage: (message, options) => posted.push({ message, options }),
  };
  try {
    const shared = new ArrayBuffer(16);
    const own = new Float32Array(3);
    const result = { a: new Uint8Array(shared, 0, 8), b: [new Uint8Array(shared, 8), own], n: 1 };
    serveWorkerTask(() => result);
    on.message({ data: { id: 4, request: null } });
    assert.equal(posted.length, 1);
    assert.deepEqual(posted[0].message, { id: 4, result });
    assert.deepEqual(new Set(posted[0].options.transfer), new Set([shared, own.buffer]));
    assert.equal(posted[0].options.transfer.length, 2);
  } finally {
    delete globalThis.self;
  }
});

test("a compute that throws fails its own request, in place or in the worker, and no other", () => {
  const odd = (n) => {
    if (n % 2) throw new RangeError(`${n} is odd`);
    return square(n);
  };
  const here = workerTask(() => {
    throw new ReferenceError("Worker is not defined");
  }, odd);
  const errors = [];
  here.run(
    3,
    () => assert.fail("an odd number squared"),
    (error) => errors.push(error.message),
  );
  assert.deepEqual(errors, ["3 is odd"]);
  assert.throws(() => here.run(5, () => {}), RangeError, "without `failed` it is thrown");

  const { made, spawn } = fakeWorkers();
  const task = workerTask(spawn, () => assert.fail("computed in place"));
  task.hold();
  const results = [];
  task.run(
    3,
    () => assert.fail("a refused request answered"),
    (error) => errors.push(error.message),
  );
  task.run(4, (result) => results.push(result));
  const [three, four] = made[0].jobs;
  made[0].refuse(three, "3 is odd");
  made[0].answer(four);
  assert.deepEqual(errors, ["3 is odd", "3 is odd"]);
  assert.deepEqual(results, [16]);
  assert.equal(made[0].ended, false, "the worker serves on");
  /* With nobody to tell, the error is thrown on a turn of its own, as an uncaught one. */
  const turns = [];
  const queue = globalThis.queueMicrotask;
  globalThis.queueMicrotask = (callback) => turns.push(callback);
  try {
    task.run(5, () => assert.fail("a refused request answered"));
    made[0].refuse(made[0].jobs[2], "5 is odd");
  } finally {
    globalThis.queueMicrotask = queue;
  }
  assert.equal(turns.length, 1);
  assert.throws(turns[0], { message: "5 is odd" });
});

test("a long compute runs in steps: whole in place, between newer requests in the worker", async () => {
  function* countTo(n) {
    for (let i = 1; i < n; i++) yield i;
    return n;
  }
  const work = (request) => (request.steps ? countTo(request.steps) : request.value);
  const here = workerTask(() => {
    throw new ReferenceError("Worker is not defined");
  }, work);
  const results = [];
  here.run({ steps: 3 }, (result) => results.push(result));
  assert.deepEqual(results, [3], "the steps run to the end before run returns");

  const posted = [];
  const on = {};
  globalThis.self = {
    addEventListener: (type, listener) => (on[type] = listener),
    postMessage: (message) => posted.push(message),
  };
  try {
    serveWorkerTask((request) => {
      if (request.fail) throw new Error("no such request");
      return work(request);
    });
    on.message({ data: { id: 1, request: { steps: 4 } } });
    on.message({ data: { id: 2, request: { value: 7 } } });
    on.message({ data: { id: 3, request: { fail: true } } });
    assert.deepEqual(posted, [
      { id: 2, result: 7 },
      { id: 3, error: "no such request" },
    ]);
    while (posted.length < 3) await new Promise((resolve) => setTimeout(resolve, 1));
    on.message({ data: { id: 4, request: { value: 5 } } });
    assert.deepEqual(posted.slice(2), [
      { id: 1, result: 4 },
      { id: 4, result: 5 },
    ]);
  } finally {
    delete globalThis.self;
  }
});
