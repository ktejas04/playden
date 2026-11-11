interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const keyFor = (code: string) => `pd_replaced_${code}`;

/**
 * Rooms whose seat this tab handed to another device (D49). Kept per tab (sessionStorage),
 * so a reload of this tab, or the phone restoring a discarded tab, doesn't quietly take the
 * seat back; only Play here does. A new tab or a deliberate Join starts fresh.
 */
export function createReplacedMemory(store: () => KeyStore | null) {
  function use<T>(action: (s: KeyStore) => T, fallback: T): T {
    try {
      const s = store();
      return s ? action(s) : fallback;
    } catch {
      return fallback;
    }
  }
  return {
    mark: (code: string) => use((s) => s.setItem(keyFor(code), "1"), undefined),
    has: (code: string) => use((s) => s.getItem(keyFor(code)) === "1", false),
    clear: (code: string) => use((s) => s.removeItem(keyFor(code)), undefined),
  };
}

export const replacedHere = createReplacedMemory(() => window.sessionStorage);
