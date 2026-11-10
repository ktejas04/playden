export function roomSocketPath(code: string): string {
  return `/api/rooms/${code}/ws`;
}

export function socketBase(location: { protocol: string; host: string }): string {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.host}`;
}

export function socketUrl(location: { protocol: string; host: string }, code: string): string {
  return socketBase(location) + roomSocketPath(code);
}
