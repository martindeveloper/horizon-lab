/** Codecs: how a cell writes its value as a string and reads it back. */

export type StorageCodec<T> = {
  encode(value: T): string;
  /** Null when `payload` is not a value of this codec. */
  decode(payload: string): T | null;
};

/** The payload is the string itself. */
export const text: StorageCodec<string> = {
  encode: (value) => value,
  decode: (payload) => payload,
};

/**
 * A presence bit. `true` is stored as `token` (default `"1"`); `false` clears the cell.
 * Any other payload is rejected.
 */
export function flag(token = "1"): StorageCodec<boolean> {
  if (token === "") throw new TypeError("Expected a flag token");
  return {
    encode: (value) => (value ? token : ""),
    decode: (payload) => (payload === token ? true : null),
  };
}

/** One of a fixed set of strings, stored as itself. */
export function oneOf<const T extends string>(...values: readonly T[]): StorageCodec<T> {
  if (values.length === 0) throw new TypeError("Expected at least one value");
  return {
    encode(value) {
      if (!values.includes(value)) throw new TypeError(`Unexpected value ${value}`);
      return value;
    },
    decode: (payload) => {
      for (const value of values) if (value === payload) return value;
      return null;
    },
  };
}

type NumberRecord<K extends readonly string[]> = { [P in K[number]]: number };

/**
 * A record of finite numbers, stored as a comma list in key order.
 * Faster than JSON and rejected unless every field is present and finite.
 */
export function numbers<const K extends readonly [string, ...string[]]>(
  ...keys: K
): StorageCodec<NumberRecord<K>> {
  return {
    encode(value) {
      const parts: string[] = [];
      for (const key of keys) {
        if (!isField(keys, key)) continue;
        const n = value[key];
        if (typeof n !== "number" || !Number.isFinite(n))
          throw new TypeError(`Expected a finite number for ${key}`);
        parts.push(String(n));
      }
      return parts.join(",");
    },
    decode(payload) {
      const parts = payload.split(",");
      if (parts.length !== keys.length) return null;
      const value: Partial<NumberRecord<K>> = {};
      let index = 0;
      for (const key of keys) {
        const part = parts[index];
        index += 1;
        if (
          !isField(keys, key) ||
          part === undefined ||
          part === "" ||
          !Number.isFinite(Number(part))
        )
          return null;
        value[key] = Number(part);
      }
      return completeNumbers(value, keys) ? value : null;
    },
  };
}

function isField<K extends readonly string[]>(keys: K, key: string): key is K[number] & string {
  return keys.some((item) => item === key);
}

function completeNumbers<K extends readonly string[]>(
  value: Partial<NumberRecord<K>>,
  keys: K,
): value is NumberRecord<K> {
  for (const key of keys) {
    if (!isField(keys, key) || typeof value[key] !== "number") return false;
  }
  return true;
}

/** JSON, accepted only when `guard` says the parsed value is a `T`. */
export function json<T>(guard: (value: unknown) => value is T): StorageCodec<T> {
  return {
    encode(value) {
      const payload = JSON.stringify(value);
      if (payload === undefined) throw new TypeError("Value cannot be stored as JSON");
      return payload;
    },
    decode(payload) {
      try {
        const value: unknown = JSON.parse(payload);
        return guard(value) ? value : null;
      } catch {
        return null;
      }
    },
  };
}
