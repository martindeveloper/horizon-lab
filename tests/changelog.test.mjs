import assert from "node:assert/strict";
import { test } from "node:test";

import { routing } from "../src/i18n/routing.ts";
import { parseChangelog, readChangelog } from "../src/lib/changelog.ts";

test("a change log reads as releases of grouped changes, their details and inline marks", () => {
  const releases = parseChangelog(
    [
      "## 2026-11-10",
      "",
      "### New labs",
      "",
      "- **Giants**: a ladder, behind the `?` key.",
      "  - Any two side by side.",
      "- The Sun.",
      "",
      "## 2026-10-19",
      "### First",
      "- Shared.",
    ].join("\n"),
  );
  assert.deepEqual(releases, [
    {
      date: "2026-11-10",
      groups: [
        {
          heading: "New labs",
          items: [
            {
              text: [
                { kind: "strong", text: "Giants" },
                { kind: "text", text: ": a ladder, behind the " },
                { kind: "code", text: "?" },
                { kind: "text", text: " key." },
              ],
              details: [[{ kind: "text", text: "Any two side by side." }]],
            },
            { text: [{ kind: "text", text: "The Sun." }], details: [] },
          ],
        },
      ],
    },
    {
      date: "2026-10-19",
      groups: [
        {
          heading: "First",
          items: [{ text: [{ kind: "text", text: "Shared." }], details: [] }],
        },
      ],
    },
  ]);
});

test("a line the page cannot draw fails with its line number", () => {
  const release = "## 2026-11-10\n### Group\n";
  for (const [markdown, line] of [
    ["# Changelog", 1],
    ["## 2026-13-40", 1],
    ["### Group before a release", 1],
    ["## 2026-11-10\n- A change before a group", 2],
    [`${release}  - A detail before a change`, 3],
    [`${release}- A paragraph follows.\nLoose text`, 4],
    [`${release}- An **unclosed mark`, 3],
    [`${release}- An \`unclosed code`, 3],
    [`${release}- One\n## 2026-11-10`, 4],
    [`${release}- One\n## 2026-12-01`, 4],
  ]) {
    assert.throws(() => parseChangelog(markdown), new RegExp(`^Error: Change log line ${line}:`));
  }
});

/** A change log without its words: what every language must share. */
const shape = (releases) =>
  releases.map(({ date, groups }) => ({
    date,
    groups: groups.map(({ items }) =>
      items.map(({ text, details }) => ({
        marks: text.map(({ kind }) => kind).filter((kind) => kind !== "text"),
        details: details.length,
      })),
    ),
  }));

test("every language's change log holds the same releases, groups and changes", () => {
  const [first, ...others] = routing.locales;
  const reference = readChangelog(first);
  assert.ok(reference.length > 0);
  for (const locale of others) {
    assert.deepEqual(shape(readChangelog(locale)), shape(reference), locale);
  }
});
