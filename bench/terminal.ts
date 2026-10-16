import path from "node:path";

import type { Report } from "./model";

export const write = (text = "") => process.stdout.write(`${text}\n`);
export const fixed = (value: number, digits = 2) => value.toFixed(digits);

function table(header: string[], rows: string[][]) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)));
  const pad = (cells: string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join("  ");
  write(pad(header));
  write(widths.map((w) => "─".repeat(w)).join("  "));
  for (const row of rows) write(pad(row));
}

export function printReport(report: Report, outDir: string) {
  write();
  write(`GPU: ${report.gpu?.renderer ?? "unknown"}`);
  write();
  table(
    ["run", "median ms", "p90 ms", "submit ms", "ns/px", "timer", "worst ms"],
    report.runs.map((r) => [
      r.key,
      fixed(r.ms),
      fixed((r.gpu ?? r.wall).p90),
      fixed(r.submit.median),
      fixed(r.nsPerPixel, 1),
      r.timer,
      r.sequence ? fixed(r.sequence.worst.ms) : "",
    ]),
  );
  if (report.comparison) {
    write();
    const c = report.comparison;
    const code = c.sameCode === null ? "" : c.sameCode ? ", same code" : ", code changed";
    write(
      `Against ${c.label ?? c.createdAt}: ${c.likeForLike ? "like for like" : "NOT like for like (see warnings)"}${code}`,
    );
    table(
      ["run", "before", "after", "Δ", "pixels changed", "scene"],
      report.comparison.rows.map((row) => [
        row.key,
        fixed(row.beforeMs),
        fixed(row.afterMs),
        `${row.deltaPct >= 0 ? "+" : ""}${fixed(row.deltaPct, 1)}%${row.slower ? " ✗" : ""}`,
        row.image === null
          ? "–"
          : row.image === "size"
            ? "size"
            : `${fixed(row.image.changed * 100, 2)}%${row.changed ? " ✗" : ""}`,
        row.sceneChanged ? "changed ⚠" : row.sceneChanged === null ? "?" : "same",
      ]),
    );
  }
  if (report.findings.length) {
    write();
    for (const finding of report.findings)
      write(
        `${finding.level.padEnd(10)} ${finding.key ? `${finding.key}: ` : ""}${finding.message}`,
      );
  }
  write();
  const rel = path.relative(process.cwd(), outDir) || ".";
  write(
    `Report: ${path.join(rel, "index.html")} · ${path.join(rel, "report.md")} · ${path.join(rel, "summary.json")}`,
  );
}
