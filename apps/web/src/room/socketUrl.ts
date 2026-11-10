export function socketUrl(location: { protocol: string; host: string }, code: string): string {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.host}/api/rooms/${code}/ws`;
}
