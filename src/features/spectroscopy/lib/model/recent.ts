/** Cache up to `size` entries in least-recently-used order; `make` supplies missing values. */
export function recentCache<K, V>(size: number) {
  const kept = new Map<K, V>();
  return (key: K, make: (key: K) => V): V => {
    let value = kept.get(key);
    if (value === undefined) value = make(key);
    else kept.delete(key);
    /* A Map keeps insertion order: re-inserting makes the key the newest, the first the oldest. */
    kept.set(key, value);
    if (kept.size > size) kept.delete(kept.keys().next().value!);
    return value;
  };
}
