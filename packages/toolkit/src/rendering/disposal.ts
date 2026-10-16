/** Own resources in acquisition order; release all of them in reverse order, once. */
export class DisposalScope {
  private callbacks: (() => void)[] = [];
  private disposed = false;
  defer(dispose: () => void) {
    if (this.disposed) dispose();
    else this.callbacks.push(dispose);
  }
  own<T extends { dispose: () => void }>(resource: T): T {
    this.defer(() => resource.dispose());
    return resource;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (const callback of this.callbacks.reverse()) {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    }
    this.callbacks = [];
    if (errors.length) throw new AggregateError(errors, "Resource cleanup failed");
  }
}
