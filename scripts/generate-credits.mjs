import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { syncGenerated } from "./lib/generated.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const lock = JSON.parse(read("package-lock.json"));
const fallbacks = {
  "@next/env": "node_modules/next/license.md",
  "babel-plugin-react-compiler": "node_modules/react/LICENSE",
  "client-only": "node_modules/react/LICENSE",
  // The npm tarball omits the upstream repository's licence.
  "@schummar/icu-type-parser": "scripts/licenses/icu-type-parser-LICENSE.txt",
};

function findNotices(directory, relative = "") {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .flatMap((entry) => {
      const path = join(relative, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "node_modules" ? [] : findNotices(join(directory, entry.name), path);
      }
      return entry.isFile() &&
        /^(licen[sc]e|copying|notice|copyright|ofl)([.-]|$)/i.test(entry.name)
        ? [path]
        : [];
    });
}

const noticesSections = [
  `Tanner Helland — blackbody temperature-to-RGB approximation\nSource: https://tannerhelland.com/code.html\nAdapted to GLSL in packages/toolkit/src/shaders/temperature.glsl\n\n${read("scripts/licenses/tanner-helland-LICENSE.txt")}`,
];
for (const [path, meta] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b, "en"),
)) {
  if (!path.includes("node_modules/") || meta.dev || meta.link) continue;
  // Native build/server binaries and the SWC download counter are not browser assets.
  if (meta.os || meta.cpu || meta.optional || path.endsWith("/@swc/counter")) continue;
  if (!existsSync(join(root, path))) throw new Error(`Install dependencies first: ${path}`);
  const pkg = JSON.parse(read(`${path}/package.json`));
  const files = findNotices(join(root, path));
  const texts = files.map((file) => `--- ${file} ---\n${read(`${path}/${file}`)}`);
  if (!texts.length && fallbacks[pkg.name]) texts.push(read(fallbacks[pkg.name]));
  if (!texts.length)
    throw new Error(`Missing licence text for ${pkg.name}; review its upstream terms.`);
  noticesSections.push(
    `${pkg.name}@${pkg.version}\n${path}\nDeclared licence: ${pkg.license ?? meta.license}\n\n${texts.join("\n\n")}`,
  );
}

const { SOURCES } = await import("../src/lib/sources.ts");
const { CONSTANTS } = await import("@horizon/toolkit/science");
const science = [
  {
    title: "Catalogue references",
    text: Object.entries(SOURCES)
      .map(([id, source]) => `${id}: ${source.cite}${source.link ? `\n${source.link}` : ""}`)
      .join("\n\n"),
  },
  {
    title: "Shared constants",
    text: Object.entries(CONSTANTS)
      .map(([id, constant]) => `${id}: ${constant.source}`)
      .join("\n"),
  },
];
const LABS = {
  "black-hole": "Black-hole observatory",
  orrery: "Orrery",
  "deep-field": "Deep Field",
  giants: "Giants",
  spectroscopy: "Stellar Spectra",
  voyage: "Voyage",
};
for (const [slug, title] of Object.entries(LABS)) {
  const { references } = JSON.parse(read(`src/features/${slug}/technical.json`));
  science.push({
    title,
    text: references.map(({ title, url }) => `${title}\n${url}`).join("\n\n"),
  });
}
science.push({
  title: "Measurement provenance ledger",
  text: read("docs/science-sources.md")
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .split("\n")
    .map((line) => (line.startsWith("|") ? line.replace(/ {2,}/g, " ") : line))
    .join("\n"),
});
science.push({
  title: "Scientific data acknowledgements",
  text: read("scripts/licenses/scientific-acknowledgements.txt"),
});
const imagery = read("docs/imagery-credits.md")
  .split(/(?=^## )/m)
  .map((section) => {
    const [title, ...lines] = section.trim().split("\n");
    return { title: title.replace(/^#+ /, ""), text: lines.join("\n").trim() };
  });
const notices = noticesSections.map((section) => {
  const [title, ...lines] = section.split("\n");
  return { title, text: lines.join("\n") };
});
syncGenerated({
  file: join(root, "src/data/credits.generated.json"),
  content: `${JSON.stringify({ imagery, science, notices }, null, 2)}\n`,
  command: "npm run credits:generate",
});
