/**
 * A cache of the `size` values used most recently, by key: the model's stars and spectra are
 * asked for again and again while the visitor drags a slider or the window, and a few are all
 * a visit returns to. `make` builds a value the cache does not hold.
 */
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
