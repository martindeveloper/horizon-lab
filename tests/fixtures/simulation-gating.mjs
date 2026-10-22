import assert from "node:assert/strict";

import { FEATURES } from "../../src/config.ts";
import { simulationMetadata } from "../../src/lib/metadata.ts";
import { simulationOn, simulationStaticParams } from "../../src/lib/simulation-access.ts";
import { slugRoutes } from "../../src/lib/simulation-paths.ts";
import { registered, simulations } from "../../src/lib/simulations.ts";

for (const manifest of registered) {
  const enabled = manifest.feature === undefined || FEATURES[manifest.feature];
  assert.equal(simulationOn(manifest), enabled, manifest.id);
  assert.equal(simulations.includes(manifest), enabled, manifest.id);
  const routes = slugRoutes(manifest.routes);
  assert.deepEqual(simulationStaticParams(manifest)(), enabled ? routes.params() : [], manifest.id);
  let loads = 0;
  const messages = async (locale) => {
    assert.equal(locale, "en", "social metadata stays English");
    loads += 1;
    return { app: "Example", metadataDescription: "Description" };
  };
  for (const id of [undefined, routes.slugs()[0]]) {
    const metadata = simulationMetadata({
      manifest,
      messages,
      ...(id === undefined ? {} : { viewTitle: (_t, view) => view }),
    });
    const params = { locale: "cs", ...(id === undefined ? {} : { [manifest.routes.param]: id }) };
    const result = metadata({ params: Promise.resolve(params) });
    if (enabled) {
      const value = await result;
      assert.equal(
        value.alternates.canonical,
        id === undefined ? manifest.routes.base : routes.pathFor(id),
      );
      assert.equal(value.openGraph.images[0].url, manifest.social);
    } else {
      await assert.rejects(result, /NEXT_HTTP_ERROR_FALLBACK;404/, manifest.id);
    }
  }
  assert.equal(loads, enabled ? 2 : 0, "disabled metadata does not load feature messages");
}
