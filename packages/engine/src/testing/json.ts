/**
 * Where a value stops being plain JSON, or null if it is plain JSON. Rooms store game
 * state and send views as JSON, so a Date, Map, class instance, NaN or function would be
 * silently changed or lost on the way. Object properties set to undefined are allowed:
 * JSON drops them, which reads back the same for optional fields.
 */
export function firstNonJson(value: unknown, path = "$"): string | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : `${path} is ${value}`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (value[i] === undefined) return `${path}[${i}] is undefined`;
      const problem = firstNonJson(value[i], `${path}[${i}]`);
      if (problem) return problem;
    }
    return null;
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value) as unknown;
    if (proto !== Object.prototype && proto !== null) {
      return `${path} is a ${value.constructor?.name ?? "non-plain object"}`;
    }
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      const problem = firstNonJson(item, `${path}.${key}`);
      if (problem) return problem;
    }
    return null;
  }
  return `${path} is a ${typeof value}`;
}

/** Freezes every object inside `value`, so any change in place throws (ES modules are strict). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

/** Equal as JSON, whatever order object keys were written in. */
export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sorted(item)]),
    );
  }
  return value;
}
