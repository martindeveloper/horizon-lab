import { writeFileSync } from "node:fs";

import { LEDGER, ledger } from "./lib/catalogue-ledger.mjs";

const { current, next } = await ledger();
if (process.argv.includes("--check")) {
  if (current !== next)
    throw new Error("The card catalogue ledger is stale. Run npm run docs:catalogue.");
  console.log("Card catalogue ledger is current.");
} else {
  writeFileSync(LEDGER, next);
  console.log("Wrote the card catalogue into docs/science-sources.md.");
}
