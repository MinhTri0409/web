export type LoginRequest = {
  username: string;
  password: string;
};

export function parseLoginRequest(value: unknown): LoginRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.username !== "string" || input.username.trim().length === 0) return null;
  if (typeof input.password !== "string" || input.password.length === 0) return null;
  return { username: input.username, password: input.password };
}

export function isCanonicalSpringRedirect(value: unknown): value is "/admin" | "/dashboard" | null {
  return value === null || value === "/admin" || value === "/dashboard";
}
