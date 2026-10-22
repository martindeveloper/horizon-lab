import { existsSync } from "node:fs";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright-core";

import type { BenchRuntime, InputAction } from "@horizon/toolkit/bench";

import { assetOrigin } from "../src/lib/assets";
import { ROOT } from "./build";

/** Launches the first Chromium-based browser available; GPU flags avoid a software fallback. */
export async function launchBrowser(choice: string | undefined, headed: boolean): Promise<Browser> {
  const args = ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"];
  const attempts = choice ? [choice] : ["chrome", "msedge", "chromium"];
  const failures: string[] = [];
  for (const attempt of attempts) {
    const isPath = attempt.includes("/") || attempt.includes("\\");
    try {
      return await chromium.launch({
        headless: !headed,
        args,
        ...(isPath
          ? { executablePath: attempt }
          : attempt === "chromium"
            ? {}
            : { channel: attempt }),
      });
    } catch (error) {
      failures.push(`${attempt}: ${String(error).split("\n")[0]}`);
    }
  }
  throw new Error(
    `No Chromium-based browser could be launched. Install Chrome or Edge, run ` +
      `"npx playwright-core install chromium", or pass --browser <path>.\n  ${failures.join("\n  ")}`,
  );
}

const ORIGIN = "http://horizon.bench";
const PAGE = `<!doctype html><meta charset="utf-8"><title>Horizon bench</title>
<style>html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style>
<script src="/bench.js"></script>`;

/**
 * Serves the bundle and `public/` from memory and disk: no server, no network. The CDN is
 * served from its local mirror (`cdn/`, `npm run cdn:pull`) where that has the file, so a map
 * or model built but not yet uploaded renders; anything else goes to the CDN itself.
 */
export async function openBenchPage(browser: Browser, bundle: string): Promise<Page> {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const publicDir = path.join(ROOT, "public");
  const mirrorDir = path.join(ROOT, "cdn");
  await page.route(`${assetOrigin}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    const file = path.join(mirrorDir, decodeURIComponent(pathname));
    if (file.startsWith(mirrorDir + path.sep) && existsSync(file))
      return route.fulfill({ path: file, headers: { "access-control-allow-origin": "*" } });
    return route.continue();
  });
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (pathname === "/bench.js")
      return route.fulfill({ contentType: "text/javascript", body: bundle });
    const file = path.join(publicDir, decodeURIComponent(pathname));
    if (file.startsWith(publicDir + path.sep) && existsSync(file))
      return route.fulfill({ path: file });
    return route.fulfill({ status: 404 });
  });
  page.on("pageerror", (error) => process.stderr.write(`page error: ${error.message}\n`));
  page.on("console", (message) => {
    if (message.type() === "error") process.stderr.write(`console: ${message.text()}\n`);
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => "__horizonBench" in globalThis);
  return page;
}

type Method = keyof BenchRuntime;
/** Calls the in-page runtime. Arguments and results cross as JSON. */
export function call<M extends Method>(
  page: Page,
  method: M,
  ...args: Parameters<BenchRuntime[M]>
): Promise<Awaited<ReturnType<BenchRuntime[M]>>> {
  return page.evaluate(
    ([name, params]) => {
      const runtime: unknown = Reflect.get(globalThis, "__horizonBench");
      if (typeof runtime !== "object" || runtime === null)
        throw new Error("Bench runtime is missing");
      const method: unknown = Reflect.get(runtime, name);
      if (typeof method !== "function") throw new Error(`Unknown bench method ${name}`);
      return Reflect.apply(method, runtime, params);
    },
    [method, args] as const,
  );
}

/** Delivers scripted input as trusted browser input on a canvas at the page origin. */
export async function dispatchInput(
  page: Page,
  actions: readonly InputAction[],
  width: number,
  height: number,
) {
  for (const action of actions) {
    if (action.type === "move") await page.mouse.move(action.x * width, action.y * height);
    else if (action.type === "down") await page.mouse.down({ button: action.button });
    else if (action.type === "up") await page.mouse.up({ button: action.button });
    else if (action.type === "wheel") {
      await page.mouse.move(action.x * width, action.y * height);
      await page.mouse.wheel(action.deltaX, action.deltaY);
    } else if (action.type === "click") await page.mouse.click(action.x * width, action.y * height);
    else await page.keyboard.press(action.key);
  }
}
