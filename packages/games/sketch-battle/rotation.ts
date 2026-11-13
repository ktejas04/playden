/**
 * The next drawer (spec section 8): walk the rotation from the current drawer, wrapping round
 * and skipping anyone unavailable (away or departed). If nobody else can draw, the same
 * drawer goes again.
 */
export function nextConnected(
  rotation: readonly string[],
  current: string,
  unavailable: ReadonlySet<string>,
): string {
  const start = rotation.indexOf(current);
  for (let step = 1; step < rotation.length; step++) {
    const candidate = rotation[(start + step) % rotation.length];
    if (candidate !== undefined && !unavailable.has(candidate)) return candidate;
  }
  return current;
}

/** A team's players who are here: neither away nor departed. */
export function connectedIn(
  rotation: readonly string[],
  unavailable: ReadonlySet<string>,
): string[] {
  return rotation.filter((id) => !unavailable.has(id));
}
