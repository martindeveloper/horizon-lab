/**
 * Each place's card: its badge and the figures it prints, all from the Sun's catalogue
 * (`@/space/sun/catalogue`), with the words under `places.<id>` the lab's own. A row's label is
 * `facts.<id>`; its figure prints with its unit, as the catalogue shows it.
 */
import { factRef, figureRow, type Fact, type Row, type StaticCard } from "@/lib/facts";
import { SUN_CATALOGUE } from "@/space/sun/catalogue";

import type { PlaceId } from "../lib/model/places";

/** What the place is drawn from: a measurement, a measurement with a model, or an inference. */
type Badge = "measured" | "mixed" | "inferred";

const { body, rotation } = SUN_CATALOGUE.star;
const { interior, photosphere, chromosphere, corona } = SUN_CATALOGUE.layers;
const { sunspot, field, cycle, eruption } = SUN_CATALOGUE.activity;
const bands = SUN_CATALOGUE.passbands;

const rows = (...entries: [id: string, fact: Fact][]): Row[] =>
  entries.map(([id, fact]) => figureRow(id, factRef(fact)));

const card = (badge: Badge, ...entries: [id: string, fact: Fact][]): StaticCard<Badge> => ({
  badge,
  rows: rows(...entries),
});

export const PLACE_CARDS: Readonly<Record<PlaceId, StaticCard<Badge>>> = {
  core: card(
    "inferred",
    ["coreRadius", interior.coreRadius],
    ["temperature", interior.centralTemperature],
    ["density", interior.centralDensity],
    ["hydrogen", interior.centralHydrogen],
    ["massLoss", body.massLoss],
  ),
  radiativeZone: card(
    "inferred",
    ["outerEdge", interior.tachocline],
    ["walk", interior.photonWalk],
    ["walkLiterature", interior.photonWalkLiterature],
    ["lightTime", body.lightTime],
  ),
  tachocline: card(
    "inferred",
    ["depth", interior.tachocline],
    ["thickness", interior.tachoclineThickness],
    ["interiorPeriod", rotation.interiorPeriod],
    ["equatorPeriod", rotation.equatorPeriod],
    ["polePeriod", rotation.polePeriod],
  ),
  convectionZone: card(
    "mixed",
    ["convectionDepth", interior.convectionDepth],
    ["innerEdge", interior.tachocline],
    ["granuleSize", photosphere.granuleSize],
    ["supergranuleSize", photosphere.supergranuleSize],
  ),
  photosphere: card(
    "measured",
    ["temperature", photosphere.temperature],
    ["thickness", photosphere.thickness],
    ["density", photosphere.density],
    ["scaleHeight", photosphere.scaleHeight],
    ["gravity", body.surfaceGravity],
  ),
  granule: card(
    "measured",
    ["granuleSize", photosphere.granuleSize],
    ["granuleLifetime", photosphere.granuleLifetime],
    ["supergranuleSize", photosphere.supergranuleSize],
    ["scaleHeight", photosphere.scaleHeight],
  ),
  sunspot: card(
    "measured",
    ["temperature", sunspot.umbraTemperature],
    ["intensity", sunspot.umbraIntensity],
    ["diameter", sunspot.diameter],
    ["earthDiameter", sunspot.earthDiameter],
    ["field", sunspot.field],
  ),
  facula: card("measured", ["meanField", field.meanField], ["spotField", field.spotField]),
  chromosphere: card(
    "measured",
    ["thickness", chromosphere.thickness],
    ["temperatureMinimum", chromosphere.temperatureMinimum],
    ["temperature", chromosphere.temperature],
    ["halpha", chromosphere.halpha],
  ),
  spicule: card(
    "measured",
    ["thickness", chromosphere.thickness],
    ["temperature", chromosphere.temperature],
    ["halpha", chromosphere.halpha],
  ),
  prominence: card(
    "mixed",
    ["halpha", chromosphere.halpha],
    ["temperature", chromosphere.temperature],
    ["meanField", field.meanField],
  ),
  flare: card(
    "mixed",
    ["flareIndex", eruption.flareIndex],
    ["flareLine", bands.fe131.temperature],
    ["hotLine", bands.fe94.temperature],
    ["spotField", field.spotField],
  ),
  loops: card(
    "mixed",
    ["quietLine", bands.fe171.temperature],
    ["warmLine", bands.fe193.temperature],
    ["coronaModel", corona.modelTemperature],
  ),
  corona: card(
    "measured",
    ["temperature", corona.temperature],
    ["greenLine", corona.greenLine],
    ["greenLineTemperature", corona.greenLineTemperature],
    ["kCoronaBase", corona.kCoronaBase],
  ),
  streamer: card(
    "mixed",
    ["sourceSurface", corona.sourceSurface],
    ["windSlow", corona.windSlow],
    ["polarField", field.polarField],
  ),
  ejection: card(
    "mixed",
    ["cmeSpeed", eruption.cmeSpeed],
    ["windFast", corona.windFast],
    ["flareIndex", eruption.flareIndex],
  ),
  wind: card(
    "measured",
    ["windSlow", corona.windSlow],
    ["windFast", corona.windFast],
    ["sourceSurface", corona.sourceSurface],
    ["massLoss", body.massLoss],
    ["cyclePeriod", cycle.period],
  ),
};
