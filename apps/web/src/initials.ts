export function initials(name: string): string {
  const words = name.match(/\p{L}[\p{L}\p{M}]*/gu) ?? [];
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? "");
  return letters.join("").toUpperCase() || "?";
}
