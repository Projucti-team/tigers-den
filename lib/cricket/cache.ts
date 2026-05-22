import { CACHE_TTL_MS } from "@/lib/cricket/constants";

const store = new Map<string, { expires: number; value: unknown }>();

export async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value as T;
  }

  const value = await fn();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function clearCricketCache() {
  store.clear();
}

export { CACHE_TTL_MS };
