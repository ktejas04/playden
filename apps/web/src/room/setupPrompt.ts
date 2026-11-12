interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const keyFor = (code: string) => `pd_not_interested_${code}`;

/**
 * Game sessions this tab closed the Join game / Spectate popup for ("not interested"), per
 * room. Kept per tab (sessionStorage), so a reload doesn't pop the same question again; the
 * next session in the room asks afresh.
 */
export function createSetupPromptMemory(store: () => KeyStore | null) {
  function use<T>(action: (s: KeyStore) => T, fallback: T): T {
    try {
      const s = store();
      return s ? action(s) : fallback;
    } catch {
      return fallback;
    }
  }
  return {
    dismiss: (code: string, sessionId: number) =>
      use((s) => s.setItem(keyFor(code), String(sessionId)), undefined),
    dismissed: (code: string, sessionId: number) =>
      use((s) => s.getItem(keyFor(code)) === String(sessionId), false),
  };
}

export const setupPrompt = createSetupPromptMemory(() => window.sessionStorage);
