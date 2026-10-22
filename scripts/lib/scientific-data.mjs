import { execFileSync } from "node:child_process";
/** Offline importer utilities; never imported by the application. */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export async function fileSha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/** IEEE round-to-nearest, ties-to-even, matching NumPy/Python scientific exports. */
export function roundEven(value) {
  const lower = Math.floor(value);
  const fraction = value - lower;
  const rounded = fraction === 0.5 ? lower + (lower % 2 !== 0 ? 1 : 0) : Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

export function writeJson(path, value) {
  // Preserve existing bytes/hashes when only the exporting language has changed.
  if (existsSync(path)) {
    const previous = readFileSync(path);
    if (isDeepStrictEqual(JSON.parse(previous), value)) return sha256(previous);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`);
  execFileSync(
    `${root}/node_modules/.bin/oxfmt`,
    ["--config", `${root}/.oxfmtrc.json`, "--write", path],
    { cwd: root, stdio: "pipe" },
  );
  return sha256(readFileSync(path));
}

/** Decimal rounding of the exact binary64 input, ties to even (Python round). */
export function roundDecimal(value, digits) {
  if (!Number.isFinite(value) || !Number.isInteger(digits) || digits < 0 || digits > 10)
    throw new Error("Invalid decimal rounding input");
  const bytes = Buffer.alloc(8);
  bytes.writeDoubleBE(Math.abs(value));
  const bits = bytes.readBigUInt64BE();
  const exponent = Number((bits >> 52n) & 2047n);
  let numerator = (bits & ((1n << 52n) - 1n)) | (exponent ? 1n << 52n : 0n);
  numerator *= 10n ** BigInt(digits);
  const shift = (exponent || 1) - 1023 - 52;
  const denominator = shift < 0 ? 1n << BigInt(-shift) : 1n;
  if (shift > 0) numerator <<= BigInt(shift);
  let result = numerator / denominator;
  const remainder = numerator % denominator;
  if (2n * remainder > denominator || (2n * remainder === denominator && result % 2n !== 0n))
    result++;
  return (Math.sign(value) * Number(result)) / 10 ** digits;
}
