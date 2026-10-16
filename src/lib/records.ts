/** Keys and entries without an `as` cast. `Object.keys` returns `string[]`. */

export function keysOf<T extends object>(value: T): (keyof T)[] {
  return Object.keys(value).filter((key): key is keyof T & string => Object.hasOwn(value, key));
}

export function recordFrom<K extends string, V>(
  keys: readonly K[],
  value: (key: K) => V,
): Record<K, V> {
  const out: Partial<Record<K, V>> = {};
  for (const key of keys) out[key] = value(key);
  if (!filled(keys, out)) throw new Error("Record is missing a key.");
  return out;
}

export function partialFrom<K extends string, V>(
  pairs: readonly (readonly [K, V])[],
): Partial<Record<K, V>> {
  const out: Partial<Record<K, V>> = {};
  for (const [key, value] of pairs) out[key] = value;
  return out;
}

function filled<K extends string, V>(
  keys: readonly K[],
  value: Partial<Record<K, V>>,
): value is Record<K, V> {
  return keys.every((key) => value[key] !== undefined);
}

export function includesId<K extends string>(ids: readonly K[], id: string): id is K {
  return ids.some((item) => item === id);
}
