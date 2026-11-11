import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Locale } from "../i18n/locales";

/**
 * The change log is written once per language, in `src/content/changelog/<locale>.md`, and read
 * when a page is prerendered. The files use a small part of Markdown, and a line outside it
 * fails the build rather than printing its markup:
 *
 *     ## 2026-11-10              a release, newest first, named by its ISO date
 *     ### New labs               a group of changes within it
 *     - **Giants**: a ladder     a change; `**strong**` and `code` are the only inline marks
 *       - Any two side by side   a detail of the change above it
 */
export type ChangelogInline = { kind: "text" | "strong" | "code"; text: string };
export type ChangelogItem = { text: ChangelogInline[]; details: ChangelogInline[][] };
export type ChangelogGroup = { heading: string; items: ChangelogItem[] };
export type ChangelogRelease = { date: string; groups: ChangelogGroup[] };

const RELEASE = /^## (\d{4}-\d{2}-\d{2})$/;
const GROUP = /^### (\S.*)$/;
const ITEM = /^- (\S.*)$/;
const DETAIL = /^ {2}- (\S.*)$/;
const MARK = /\*\*(.+?)\*\*|`([^`]+)`/g;
/** What is left of a mark that never closed. */
const STRAY_MARK = /\*\*|`/;

const isDate = (date: string) => {
  const time = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(date);
};

function parseInline(source: string, fail: (reason: string) => never): ChangelogInline[] {
  const inline: ChangelogInline[] = [];
  const plain = (text: string) => {
    if (STRAY_MARK.test(text)) {
      fail("an inline mark is not closed");
    }
    if (text) {
      inline.push({ kind: "text", text });
    }
  };
  let end = 0;
  for (const match of source.matchAll(MARK)) {
    plain(source.slice(end, match.index));
    const [marked, strong, code] = match;
    if (strong !== undefined) {
      inline.push({ kind: "strong", text: strong });
    } else if (code !== undefined) {
      inline.push({ kind: "code", text: code });
    }
    end = match.index + marked.length;
  }
  plain(source.slice(end));
  return inline;
}

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  markdown.split("\n").forEach((line, index) => {
    const fail = (reason: string): never => {
      throw new Error(`Change log line ${index + 1}: ${reason}`);
    };
    const release = releases.at(-1);
    const group = release?.groups.at(-1);
    const item = group?.items.at(-1);
    const [, date] = RELEASE.exec(line) ?? [];
    const [, heading] = GROUP.exec(line) ?? [];
    const [, change] = ITEM.exec(line) ?? [];
    const [, detail] = DETAIL.exec(line) ?? [];
    if (date !== undefined) {
      if (!isDate(date)) {
        fail(`${date} is not a date`);
      }
      if (release && date >= release.date) {
        fail("releases run newest first");
      }
      releases.push({ date, groups: [] });
    } else if (heading !== undefined) {
      (release ?? fail("a group needs a release above it")).groups.push({ heading, items: [] });
    } else if (change !== undefined) {
      (group ?? fail("a change needs a group above it")).items.push({
        text: parseInline(change, fail),
        details: [],
      });
    } else if (detail !== undefined) {
      (item ?? fail("a detail needs a change above it")).details.push(parseInline(detail, fail));
    } else if (line.trim() !== "") {
      fail("not a release, a group, a change or a detail");
    }
  });
  return releases;
}

/** A language's change log, read from the working directory: build time and the tests. */
export function readChangelog(locale: Locale): ChangelogRelease[] {
  const file = join(process.cwd(), "src", "content", "changelog", `${locale}.md`);
  return parseChangelog(readFileSync(file, "utf8"));
}
