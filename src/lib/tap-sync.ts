/** Short flush window — still feels live, cuts DB write pressure a lot. */
export const TAP_FLUSH_MS = 150;

export type TapBroadcast = {
  clientId: string;
  displayName: string;
  delta: number;
  at: number;
};

export function getClientId(): string {
  if (typeof window === "undefined") return "server";
  const key = "family-dhikr:client-id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  sessionStorage.setItem(key, id);
  return id;
}
