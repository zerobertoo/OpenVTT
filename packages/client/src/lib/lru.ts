/**
 * Puts `key` at the most recently used end of `cache` (a Map keeps insertion order), then evicts the least
 * recently used entries over `max`, skipping those in `keep`.
 */
export function touchLru<K, V>(cache: Map<K, V>, key: K, value: V, max: number, keep: Set<K>, evict: (value: V) => void) {
  cache.delete(key);
  cache.set(key, value);
  for (const [id, old] of cache) {
    if (cache.size <= max) break;
    if (keep.has(id) || id === key) continue;
    cache.delete(id);
    evict(old);
  }
}
