export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name) cookies.set(name, decodeURIComponent(part.slice(eq + 1).trim()));
  }
  return cookies;
}

interface CookieOptions {
  maxAge?: number;
  path?: string;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  parts.push("HttpOnly", "Secure", "SameSite=Lax");
  return parts.join("; ");
}

export function clearCookie(name: string, path = "/"): string {
  return serializeCookie(name, "", { maxAge: 0, path });
}
