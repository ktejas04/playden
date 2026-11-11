import type { Env } from "../env";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  if (octets.some((octet) => !(octet >= 0 && octet <= 255))) return false;
  const [a, b] = octets as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** A machine on this computer or the home network: never a public address. */
export function isLocalHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || isPrivateIPv4(hostname);
}

/** Test-player sign-in exists only with DEV_LOGIN=true, and only for local addresses (D48). */
export function isDevLoginAllowed(env: Env, url: URL): boolean {
  return env.DEV_LOGIN === "true" && isLocalHost(url.hostname);
}

/**
 * Browsers drop `Secure` cookies sent over plain http, except on loopback. So a phone
 * reaching the dev server at http://192.168.x.x needs the session cookie without it.
 */
export function cookieIsSecure(env: Env, url: URL): boolean {
  return !(isDevLoginAllowed(env, url) && url.protocol === "http:");
}

export function devUserSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function devUserEmail(slug: string): string {
  return `${slug}@dev.playden.invalid`;
}
