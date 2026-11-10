interface WaitingPerson {
  id: string;
  displayName: string | null;
}

/** People on the waiting list now who weren't there at the last check; none on the first check. */
export function newArrivals<T extends WaitingPerson>(before: Set<string> | null, now: T[]): T[] {
  if (!before) return [];
  return now.filter((person) => !before.has(person.id));
}

export function waitingToast(arrivals: WaitingPerson[]): string {
  const [first] = arrivals;
  if (arrivals.length === 1 && first) {
    return first.displayName
      ? `${first.displayName} is waiting to join`
      : "Someone new is waiting to join";
  }
  return `${arrivals.length} new people are waiting to join`;
}
