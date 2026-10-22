import { mkdir, readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { registered } from "../src/lib/simulations.ts";
import { PUBLIC_ASSETS } from "../src/lib/urls.ts";

// Shared composition: warm gold, ink background, serif titles, Horizon's sunrise mark.
// The black-hole illustration is also used by the catalogue, keeping the two in sync.
const publicFile = (path) => new URL(`../public${path}`, import.meta.url);
/** The card's ink, which every artwork's sky must end in. */
const INK = "#08080b";
const escape = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const copy = {
  intro: "Explore the universe.",
  category: "INTERACTIVE SPACE SIMULATIONS",
};
const messages = JSON.parse(
  await readFile(new URL("../src/messages/en.json", import.meta.url), "utf8"),
);

const cards = [
  { path: PUBLIC_ASSETS.social, title: "Horizon", subtitle: copy.intro, art: null },
  ...(await Promise.all(
    registered.map(async ({ artwork, social, socialSubtitle, messageKey }) => ({
      path: social,
      title: messages.catalogue[messageKey].title,
      subtitle: socialSubtitle,
      art: await readFile(publicFile(artwork), "utf8"),
    })),
  )),
];
for (const card of cards) {
  const feature = card.art !== null;
  const { title, subtitle, path } = card;
  /* The artwork paints its own sky, darker at the rim than the card: here it ends in the
     card's ink, and an elliptical mask dissolves its edges, so no square shows. */
  const art = feature
    ? `<defs><radialGradient id="art-fade"><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="art-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="630"><rect x="600" y="40" width="640" height="550" fill="url(#art-fade)"/></mask></defs><g mask="url(#art-edge)"><svg x="640" y="100" width="560" height="430" viewBox="0 0 1000 800" fill="none">${card.art.replace(/<svg[^>]*>|<\/svg>/g, "").replaceAll("#050609", INK)}</svg></g>`
    : `<g fill="none" stroke="#e2c07a"><circle cx="940" cy="315" r="240" opacity=".08"/><circle cx="940" cy="315" r="180" opacity=".12"/><circle cx="940" cy="315" r="120" opacity=".22"/></g><path d="M875 315a65 65 0 0 1 130 0Z" fill="#e2c07a" opacity=".8"/><path d="M680 315h520" stroke="#e2c07a" opacity=".5"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${INK}"/>
${art}
<circle cx="106" cy="108" r="24" fill="none" stroke="#9a9a96" stroke-width="1.5"/>
<path d="M95 108a11 11 0 0 1 22 0Z" fill="#e2c07a"/><path d="M86 108h40" stroke="#e2c07a" stroke-width="1.5"/>
<text x="148" y="119" fill="#ecece8" font-family="Georgia, serif" font-size="34">Horizon</text>
<text x="82" y="308" fill="#ecece8" font-family="Georgia, serif" font-size="${feature ? 72 : 100}" letter-spacing="-2">${escape(title)}</text>
<text x="86" y="366" fill="#b2b2ae" font-family="Arial, sans-serif" font-size="26">${escape(subtitle)}</text>
<path d="M86 466h430" stroke="#ecece8" stroke-opacity=".15"/>
<text x="86" y="508" fill="#9a9a96" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">${escape(copy.category)}</text>
</svg>`;
  await mkdir(new URL(".", publicFile(path)), { recursive: true });
  await writeFile(publicFile(path.replace(/\.png$/, ".svg")), svg);
  await sharp(Buffer.from(svg)).png().toFile(publicFile(path).pathname);
}

// App icons from the favicon mark. Rasters are full-bleed squares: platforms apply
// their own mask, and the mark stays inside the maskable safe zone.
const mark = (await readFile(publicFile(PUBLIC_ASSETS.favicon), "utf8")).replace(/ rx="[^"]*"/, "");
const icon = (size) =>
  sharp(Buffer.from(mark), { density: (72 * size) / 32 })
    .resize(size)
    .png();
for (const [path, size] of [
  [PUBLIC_ASSETS.icon192, 192],
  [PUBLIC_ASSETS.icon512, 512],
  [PUBLIC_ASSETS.appleIcon, 180],
]) {
  await icon(size).toFile(publicFile(path).pathname);
}
// favicon.ico for clients that request it directly: PNG images in an ICO container.
const images = await Promise.all([16, 32, 48].map((size) => icon(size).toBuffer()));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + 16 * index;
  const size = png.readUInt32BE(16);
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(publicFile(PUBLIC_ASSETS.faviconIco), Buffer.concat([header, ...images]));
