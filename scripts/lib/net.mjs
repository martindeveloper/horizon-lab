import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** GET `url` as text; a failed status is an error. `reject(body)` names a 200 that is really an error page. */
export async function fetchText(url, { reject } = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = await res.text();
  const problem = reject?.(body);
  if (problem) throw new Error(`${url}: ${problem}`);
  return body;
}

/**
 * Downloads `url` into `dir` once, under the last segment of its path, streaming to disk, and
 * returns the file. `verify(file)` may inspect a fresh download before it is kept; a throw
 * discards it.
 */
export async function fetchCached(url, dir, { verify } = {}) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, path.basename(new URL(url).pathname));
  if (existsSync(file) && statSync(file).size > 0) return file;
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  const part = `${file}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
    await verify?.(part);
  } catch (error) {
    await rm(part, { force: true });
    throw error;
  }
  await rename(part, file);
  return file;
}
