/**
 * Runs tasks one at a time per key; tasks with different keys run concurrently, and a key costs nothing once
 * everything queued for it has finished. In-process only: with several app instances each one serialises its own
 * tasks, which still bounds how far a burst can overshoot to (instances − 1).
 */
export class KeyedMutex {
  /** For each key with work queued: a promise that settles (never rejects) when the last queued task is done. */
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const current = previous.then(task);
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    try {
      return await current;
    } finally {
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    }
  }
}
