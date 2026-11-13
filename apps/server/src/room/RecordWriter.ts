import type { RecordWrite } from "../db/gameRecords";

/** Tries per write before it's logged and dropped. */
const ATTEMPTS = 3;
const RETRY_AFTER_MS = 250;

/**
 * One room's writes to the permanent record (D58), in order, one at a time. Game play never
 * waits on it: a slow or failing database only delays the record. A write that keeps failing
 * is logged and skipped, so one bad write can't block the rest.
 */
export class RecordWriter {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly write: (write: RecordWrite) => Promise<void>) {}

  add(writes: RecordWrite[]): void {
    for (const write of writes) this.queue = this.queue.then(() => this.attempt(write));
  }

  /** Resolves once everything added so far has been written or given up on. */
  settled(): Promise<void> {
    return this.queue;
  }

  private async attempt(write: RecordWrite): Promise<void> {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        await this.write(write);
        return;
      } catch (error) {
        if (attempt === ATTEMPTS) {
          console.error(`Couldn't record ${write.kind}`, error);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS * attempt));
      }
    }
  }
}
