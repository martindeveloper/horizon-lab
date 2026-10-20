import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const check = process.argv.includes("--check");

/**
 * Keeps a generated file in step with its sources. Writes `content` to `file` when it
 * differs; with `--check`, leaves the file alone and fails the run instead, naming the
 * `command` that regenerates it. Returns whether the file was already current.
 */
export function syncGenerated({ file, content, command }) {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  const name = relative(process.cwd(), path);
  let current = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {}
  if (current === content) {
    console.log(`${name} is current.`);
    return true;
  }
  if (check) {
    console.error(`${name} is stale: run ${command}.`);
    process.exitCode = 1;
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(`Wrote ${name}.`);
  }
  return false;
}
