import { GUESS_BURST, GUESS_WINDOW_MS, MAX_GUESS_LENGTH } from "./config";

/**
 * Guess matching (spec section 6): strip accents, lowercase, then keep only letters and
 * digits, so "X-Ray!" and "xray" both match "x-ray".
 */
export function normalizeGuess(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function isCorrectGuess(guess: string, word: string): boolean {
  const normalized = normalizeGuess(guess);
  return normalized.length > 0 && normalized === normalizeGuess(word);
}

/** Why this guess text can't be sent, or null. */
export function guessProblem(text: string): string | null {
  if (text.trim().length === 0) return "Type a guess first";
  if (text.length > MAX_GUESS_LENGTH) return `Guesses are at most ${MAX_GUESS_LENGTH} characters`;
  return null;
}

/** True when this player already sent GUESS_BURST guesses in the last GUESS_WINDOW_MS. */
export function tooManyGuesses(recent: readonly number[], now: number): boolean {
  return recent.filter((at) => now - at < GUESS_WINDOW_MS).length >= GUESS_BURST;
}

/** The guess times worth keeping for the limit: the latest GUESS_BURST. */
export function rememberGuess(recent: readonly number[], now: number): number[] {
  return [...recent, now].slice(-GUESS_BURST);
}

/** The word as blanks: every letter or digit becomes "_"; spaces and punctuation stay. */
export function blanksFor(word: string): string {
  return word.replace(/[\p{L}\p{N}]/gu, "_");
}
