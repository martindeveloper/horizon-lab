import { LEDGER, ledger } from "./lib/catalogue-ledger.mjs";
import { syncGenerated } from "./lib/generated.mjs";

const { next } = await ledger();
syncGenerated({ file: LEDGER, content: next, command: "npm run docs:catalogue" });
