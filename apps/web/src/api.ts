import type { ApiError, Me, Profile } from "@playden/protocol";

export class ApiFailure extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiFailure(response.status, body?.error ?? "Something went wrong");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchMe(): Promise<Me | null> {
  try {
    return await request<Me>("/api/me");
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) return null;
    throw error;
  }
}

export function saveProfile(profile: Profile): Promise<Me> {
  return request<Me>("/api/me/profile", { method: "PUT", body: JSON.stringify(profile) });
}

export async function signOut(): Promise<void> {
  await request<undefined>("/auth/logout", { method: "POST" });
}
