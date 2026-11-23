const NAME_KEY = "family-dhikr:display-name";
const DEVICE_KEY = "family-dhikr:device-id";
const queueKey = (code: string) => `family-dhikr:queue:${code}`;

export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function saveName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim());
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Taps not yet confirmed by the server, kept so they survive reloads. */
export type TapQueue = {
  pending: number;
  inflight: { id: string; delta: number } | null;
};

export function loadQueue(code: string): TapQueue {
  try {
    const raw = localStorage.getItem(queueKey(code));
    if (raw) {
      const q = JSON.parse(raw) as TapQueue;
      return { pending: Number(q.pending) || 0, inflight: q.inflight ?? null };
    }
  } catch {}
  return { pending: 0, inflight: null };
}

export function saveQueue(code: string, q: TapQueue) {
  if (q.pending === 0 && !q.inflight) {
    localStorage.removeItem(queueKey(code));
  } else {
    localStorage.setItem(queueKey(code), JSON.stringify(q));
  }
}
