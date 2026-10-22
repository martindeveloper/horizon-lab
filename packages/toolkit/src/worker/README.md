# Worker

`@horizon/toolkit/worker` runs a pure, deterministic computation on a module worker, so
generating a large array (a painted map, sampled points, a volume) never blocks a frame.
No dependencies; importing it touches no browser globals.

- `workerTask(spawn, compute)` is the main thread's side; `run(request, done)`
  hands the result to `done` and returns a cancel that drops the answer. `dispose()` ends
  the worker and drops every pending answer.
  - `spawn` makes the worker. Write it at the call site as
    `() => new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" })`, so
    the bundler finds the worker's module and emits it as a chunk of its own.
  - `compute` is the same pure function the worker serves. Where `spawn` throws (no
    `Worker`, as in Node; a bundle without worker support, as the bench's single script),
    every request runs in place and `done` is called before `run` returns. A worker that
    fails to load or throws answers its outstanding requests in place, and later requests
    run in place too.
  - The worker starts on the first request and ends when none are left, a cancel included:
    right for an occasional bake, where a worker idling between requests would only hold
    memory. `hold()` keeps it between requests instead, for an owner that sends a stream of
    them (a view while it is open) and should not pay a worker start each; it returns the
    release, and once nothing holds the task and no request is left, the worker ends. An idle
    worker ends a task later, so a request or a hold that follows in the same task (the next
    of a queue, a StrictMode remount, a view swapped for another) keeps it.
  - `run(request, done, failed)`: a `compute` that throws fails only its own request. The
    error goes to `failed`, in place or as the worker's answer, and the worker serves on.
    Without `failed` it is thrown: at once in place, else as an uncaught error on the main
    thread.
- `serveWorkerTask(compute)` is the worker module's whole body. Every typed array in a
  result is transferred, not copied: `compute` returns fresh arrays it does not keep.
- A long computation can return its steps instead of its result: a generator
  (`WorkerSteps<Result>`) that yields between steps and returns the result. The worker takes
  one step per turn, oldest request first, and answers the requests that arrive meanwhile
  between them, so a long answer holds up a quick one by one step at most: yield after every
  stretch of work, not after a batch of them. In place the steps run straight to the end. A
  cancel drops the answer; the steps still run.

Requests and results must be structured-cloneable. A task holds no cache; a caller that
asks for the same result again keeps it itself.
