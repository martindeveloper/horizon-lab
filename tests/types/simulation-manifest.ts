import { defineSimulation } from "../../src/lib/simulation-manifest";
import { defineRoutes } from "../../src/lib/simulation-paths";

const manifest = defineSimulation({
  id: "example",
  kind: "lab",
  feature: "sun",
  messageKey: "example",
  socialSubtitle: "Example",
  highlights: [],
  routes: defineRoutes({
    base: "/lab/example",
    param: "star",
    defaultId: "home",
    entries: [{ id: "home" }, { id: "far" }],
  }),
  entryPoints: [{ id: "distant", view: "far" }],
});

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

/** The public shape must match the transformed runtime result while keeping discriminants. */
export type ManifestContract = [
  Expect<Equal<keyof (typeof manifest.entryPoints)[number], "id" | "href">>,
  Expect<Equal<typeof manifest.id, "example">>,
  Expect<Equal<typeof manifest.feature, "sun">>,
  Expect<Equal<typeof manifest.routes.param, "star">>,
  Expect<Equal<(typeof manifest.routes.entries)[number]["id"], "home" | "far">>,
];
