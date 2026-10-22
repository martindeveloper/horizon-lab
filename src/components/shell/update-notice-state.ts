import { PAGE_URLS } from "@/lib/urls";
/** The prerendered file holding the live deployment's ID (`src/app/version.json/route.ts`). */
export const VERSION_PATH = PAGE_URLS.version;

export const CHECK_EVERY = 15 * 60_000;

export function isNewVersion(current: string, seen: unknown): boolean {
  return current !== "" && typeof seen === "string" && seen !== "" && seen !== current;
}

/** The live deployment's ID, past every cache; undefined when it cannot be read. */
export async function loadVersion(): Promise<unknown> {
  const response = await fetch(VERSION_PATH, { cache: "no-store" });
  if (!response.ok) return undefined;
  const body: unknown = await response.json();
  return body && typeof body === "object" && "id" in body ? body.id : undefined;
}

type Page = Pick<Document, "hidden" | "addEventListener" | "removeEventListener">;

/**
 * Calls `onNew` once a newer deployment is live, then stops. Checks when the tab becomes
 * visible again and every `CHECK_EVERY` while it stays visible, never while hidden; failed
 * reads are ignored. Without a `current` ID it does nothing. Returns the stop function.
 */
export function watchVersion(
  current: string,
  onNew: () => void,
  { page = document, load = loadVersion }: { page?: Page; load?: () => Promise<unknown> } = {},
): () => void {
  if (!current) return () => {};
  let timer: ReturnType<typeof setInterval> | undefined;
  let busy = false;
  let stopped = false;

  const check = async () => {
    if (stopped || busy || page.hidden) return;
    busy = true;
    const seen = await load().catch(() => undefined);
    busy = false;
    if (stopped || !isNewVersion(current, seen)) return;
    stop();
    onNew();
  };
  const schedule = () => {
    clearInterval(timer);
    timer = page.hidden ? undefined : setInterval(check, CHECK_EVERY);
  };
  const visibility = () => {
    schedule();
    void check();
  };
  const stop = () => {
    stopped = true;
    clearInterval(timer);
    page.removeEventListener("visibilitychange", visibility);
  };

  page.addEventListener("visibilitychange", visibility);
  schedule();
  return stop;
}
