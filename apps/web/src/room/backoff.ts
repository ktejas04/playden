const FIRST_DELAY_MS = 500;
const MAX_DELAY_MS = 10_000;

export function backoffDelay(attempt: number): number {
  return Math.min(FIRST_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
}
