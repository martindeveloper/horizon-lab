import { defineSimulation } from "../../lib/simulation-manifest";
import { defineRoutes, experiencePath } from "../../lib/simulation-paths";
import { CHAPTER_DEFINITIONS, DEFAULT_CHAPTER } from "./lib/model/chapter-ids";

export const AFTERGLOW_PATH = experiencePath("afterglow");
export const afterglowManifest = defineSimulation({
  id: "afterglow",
  kind: "experience",
  feature: "afterglow",
  routes: defineRoutes({
    base: AFTERGLOW_PATH,
    param: "view",
    defaultId: DEFAULT_CHAPTER,
    entries: CHAPTER_DEFINITIONS,
  }),
  socialSubtitle: "The Sun's whole life, from low orbit",
  artworkLayers: [
    { id: "sky", depth: -1 },
    { id: "sun", depth: -0.5 },
    { id: "sea", depth: 0 },
  ],
  messageKey: "afterglow",
  highlights: ["orbit", "swallow", "dwarf"],
  entryPoints: [
    { id: "young", view: "young" },
    { id: "tip", view: "tip" },
    { id: "dwarf", view: "dwarf" },
  ],
});
