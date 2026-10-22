import assert from "node:assert/strict";
import test from "node:test";

import { createSunModel, equatorialDipoleAt } from "../src/space/sun/frame.ts";
import { weatherAt } from "../src/space/sun/model/activity.ts";
import {
  bipoleAxis,
  blankPolyline,
  fieldAt,
  fieldLines,
  lineLength,
  loopTemperature,
  openness,
  poleOf,
  radialFieldAt,
  setSources,
  surfacePoint,
  traceLine,
} from "../src/space/sun/model/field.ts";
import {
  EQUATORIAL_DIPOLE,
  LOOP_KELVIN_RANGE,
  LOOP_REFERENCE,
  POLAR_FIELD_T,
  SOURCE_SURFACE_R,
  SPOT_FIELD_T,
  TEMPERATURES,
  TRACE_MAX_POINTS,
} from "../src/space/sun/model/parameters.ts";

const TAU = 2 * Math.PI;
const radiusOf = (line, i) =>
  Math.hypot(line.points[3 * i], line.points[3 * i + 1], line.points[3 * i + 2]);

test("the global dipole alone: lines close over the equator and open at the poles, at the source surface", () => {
  setSources({ dipole: 1, regions: [] });
  const low = traceLine(surfacePoint(0.2, 0.3), blankPolyline());
  assert.equal(low.open, false);
  assert.ok(Math.abs(radiusOf(low, low.count - 1) - 1) < 1e-3, "comes back to the surface");
  assert.ok(low.count > 3 && low.count <= TRACE_MAX_POINTS);
  const high = traceLine(surfacePoint(1.3, 2), blankPolyline());
  assert.equal(high.open, true);
  assert.ok(
    Math.abs(radiusOf(high, high.count - 1) - SOURCE_SURFACE_R) < 1e-3,
    "ends on the source surface",
  );
  for (let i = 1; i < high.count; i++)
    assert.ok(radiusOf(high, i) > radiusOf(high, i - 1) - 1e-6, "climbs all the way");
  /* The boundary between the two lies at mid-latitude, the same in both hemispheres. */
  let boundary = 0;
  for (let lat = 0; lat < Math.PI / 2; lat += 0.01) {
    if (traceLine(surfacePoint(lat, 1), blankPolyline()).open) {
      boundary = lat;
      break;
    }
  }
  assert.ok(boundary > 0.5 && boundary < 1.1, `${boundary} rad`);
  assert.equal(openness(boundary + 0.1, 1), 1);
  assert.equal(openness(-(boundary + 0.1), 1), 1);
  assert.equal(openness(boundary - 0.2, 1), 0);
  assert.equal(openness(0, 1), 0);
});

test("the magnetogram's sign and strength: the polar field at the poles, reversed with the dipole, spots far stronger", () => {
  setSources({ dipole: 1, regions: [] });
  assert.ok(Math.abs(radialFieldAt(Math.PI / 2, 0) - POLAR_FIELD_T) < 1e-9);
  assert.ok(Math.abs(radialFieldAt(-Math.PI / 2, 0) + POLAR_FIELD_T) < 1e-9);
  assert.ok(Math.abs(radialFieldAt(0, 1)) < 1e-6 * POLAR_FIELD_T, "none across the equator");
  setSources({ dipole: -0.5, regions: [] });
  assert.ok(Math.abs(radialFieldAt(Math.PI / 2, 0) + 0.5 * POLAR_FIELD_T) < 1e-9);
  /* The field is radial at the source surface: the PFSS condition. */
  const p = [0, 0, SOURCE_SURFACE_R];
  const b = fieldAt(p);
  assert.ok(Math.abs(b[1]) < 1e-12 && Math.abs(b[0]) < 1e-12);

  const region = {
    id: 1,
    lat: 0.3,
    lon: 0.5,
    tilt: 0.1,
    size: 0.05,
    polarity: 1,
    age: 0,
    strength: 1,
    flare: 0,
    facula: 0,
  };
  setSources({ dipole: 1, regions: [region] });
  const leading = poleOf(region, "leading");
  const following = poleOf(region, "following");
  const latOf = (p) => Math.asin(p[1]);
  const lonOf = (p) => Math.atan2(p[2], p[0]);
  const atLeading = radialFieldAt(latOf(leading), lonOf(leading));
  const atFollowing = radialFieldAt(latOf(following), lonOf(following));
  assert.ok(atLeading > 0.2 * SPOT_FIELD_T, `leading pole ${atLeading} T`);
  assert.ok(atFollowing < -0.2 * SPOT_FIELD_T, `following pole ${atFollowing} T`);
  assert.ok(Math.abs(atLeading) > 50 * POLAR_FIELD_T, "a spot dwarfs the polar field");
  /* Joy: the following pole sits poleward of the leading one, the leading pole ahead in rotation. */
  assert.ok(latOf(following) > latOf(leading));
  assert.ok(lonOf(leading) > lonOf(following));
  const axis = bipoleAxis(region);
  assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-9);
  /* Reversed polarity reverses the signs. */
  setSources({ dipole: 1, regions: [{ ...region, polarity: -1 }] });
  assert.ok(radialFieldAt(latOf(leading), lonOf(leading)) < 0);
});

test("a region's loops close from pole to pole, low and hot; a frame's lines fill their slots deterministically", () => {
  const weather = weatherAt(3, 80 * 86_400, 25.4);
  setSources({ dipole: -0.4, regions: weather.regions });
  const lines = Array.from({ length: 120 }, blankPolyline);
  const used = fieldLines(3, 120, lines);
  assert.equal(used, 120);
  const kinds = { open: 0, closed: 0 };
  for (let i = 0; i < used; i++) {
    const line = lines[i];
    assert.ok(line.count >= 2 && line.count <= TRACE_MAX_POINTS);
    assert.ok(Math.abs(radiusOf(line, 0) - 1) < 1e-6, "starts on the surface");
    const end = radiusOf(line, line.count - 1);
    if (line.open) {
      kinds.open++;
      assert.ok(Math.abs(end - SOURCE_SURFACE_R) < 1e-3);
      assert.equal(line.kelvin, TEMPERATURES.coronalHole);
    } else {
      kinds.closed++;
      assert.ok(Math.abs(end - 1) < 1e-3 || line.count === TRACE_MAX_POINTS);
      assert.ok(
        line.kelvin === TEMPERATURES.quietCorona ||
          line.kelvin === TEMPERATURES.flare ||
          (line.kelvin >= LOOP_KELVIN_RANGE[0] && line.kelvin <= LOOP_KELVIN_RANGE[1]),
      );
    }
    assert.ok(line.strength > 0);
  }
  assert.ok(kinds.open > 10 && kinds.closed > 40, JSON.stringify(kinds));
  const again = Array.from({ length: 120 }, blankPolyline);
  fieldLines(3, 120, again);
  for (let i = 0; i < used; i++) {
    assert.equal(again[i].count, lines[i].count);
    assert.deepEqual(
      again[i].points.slice(0, 3 * again[i].count),
      lines[i].points.slice(0, 3 * lines[i].count),
    );
  }
  assert.equal(fieldLines(3, 10, lines), 10, "fewer when asked");
});

test("a region's loops take their own temperatures from the RTV rule: strong, short loops hot, weak fans cool", () => {
  const { kelvin, fieldT, lengthR } = LOOP_REFERENCE;
  assert.equal(loopTemperature(fieldT, lengthR), kelvin, "the anchor loop");
  assert.ok(
    loopTemperature(2 * fieldT, lengthR) > loopTemperature(fieldT, lengthR),
    "stronger field, hotter",
  );
  assert.ok(
    loopTemperature(fieldT, 2 * lengthR) > loopTemperature(fieldT, lengthR),
    "longer at the same field, hotter (RTV)",
  );
  assert.ok(
    loopTemperature(5 * fieldT, lengthR / 10) > loopTemperature(fieldT / 2, 2 * lengthR),
    "a short core loop in strong field outheats a long fan in weak field",
  );
  const ratio = loopTemperature(2 * fieldT, lengthR) / kelvin;
  assert.ok(Math.abs(ratio - 4 ** (2 / 7)) < 1e-9, "T ∝ (B² L)^(2/7)");
  assert.equal(
    loopTemperature(100 * fieldT, lengthR),
    LOOP_KELVIN_RANGE[1],
    "held within the range",
  );
  assert.equal(loopTemperature(fieldT / 100, lengthR), LOOP_KELVIN_RANGE[0]);

  const weather = weatherAt(3, 80 * 86_400, 25.4);
  setSources({ dipole: -0.4, regions: weather.regions });
  const lines = Array.from({ length: 200 }, blankPolyline);
  const used = fieldLines(3, 200, lines);
  const loops = lines
    .slice(0, used)
    .filter((line) => !line.open && line.kelvin !== TEMPERATURES.quietCorona);
  assert.ok(loops.length > 50, `${loops.length} region loops`);
  const kelvins = loops.map((line) => line.kelvin);
  const coolest = Math.min(...kelvins);
  const hottest = Math.max(...kelvins);
  assert.ok(coolest >= LOOP_KELVIN_RANGE[0] && hottest <= LOOP_KELVIN_RANGE[1]);
  assert.ok(hottest - coolest > 1e6, `the loops span ${coolest}–${hottest} K`);
  assert.ok(new Set(kelvins).size > 20, "each loop its own temperature");
  assert.ok(kelvins.filter((k) => k < 1.3e6).length > 5, "fans a 171 Å picture shows");
  assert.ok(kelvins.filter((k) => k > 2e6).length > 5, "hot loops for 211 and 335 Å");
  for (const line of loops) {
    const expected = loopTemperature(line.strength * POLAR_FIELD_T, lineLength(line));
    assert.ok(
      line.kelvin === expected || line.kelvin === TEMPERATURES.flare,
      "the rule, or a flare",
    );
  }
  /* Quiet lines and open lines keep their layer's temperature. */
  for (const line of lines.slice(0, used)) {
    if (line.open) assert.equal(line.kelvin, TEMPERATURES.coronalHole);
  }
  assert.ok(lines.slice(0, used).some((line) => line.kelvin === TEMPERATURES.quietCorona));
});

test("coronal holes follow the cycle: polar caps at minimum, low latitudes at maximum, and the openness map agrees", () => {
  const lon = (i) => (i * TAU) / 12;
  const openAt = (lat) => {
    let n = 0;
    for (let i = 0; i < 12; i++) n += openness(lat, lon(i));
    return n;
  };
  /* Minimum: the axial dipole alone. */
  setSources({ dipole: -1, regions: [], equatorial: { strength: 0, lon: 1 } });
  assert.equal(openAt(1.4), 12);
  assert.equal(openAt(-1.4), 12);
  assert.equal(openAt(0.2), 0);
  /* Maximum: the dipole lies in the equator; its poles open at low latitude and the caps close. */
  setSources({ dipole: 0, regions: [], equatorial: { strength: EQUATORIAL_DIPOLE, lon: 1 } });
  assert.equal(openAt(1.4), 0, "the polar caps close");
  assert.ok(openAt(0) >= 2, "holes on the equator");
  assert.equal(openness(0, 1), 1, "at the equatorial dipole's pole");
  assert.equal(openness(0, 1 + Math.PI), 1, "and its antipode");
  assert.equal(openness(0, 1 + Math.PI / 2), 0, "closed between them");
  /* The seeded lines find those holes. */
  const lines = Array.from({ length: 120 }, blankPolyline);
  const used = fieldLines(9, 120, lines);
  const openLow = lines
    .slice(0, used)
    .filter((line) => line.open && Math.abs(Math.asin(line.points[1])) < 0.7);
  assert.ok(openLow.length >= 10, `${openLow.length} open lines at low latitude`);
  /* A frame carries the equatorial dipole: open field at low latitude near maximum, at the poles near minimum. */
  const latitudesOfOpen = (count) => {
    const frame = createSunModel(9).frameAt({
      time: 0,
      cyclePhase: count,
      light: "white",
      eruptionScrub: null,
      fieldLineCount: 160,
    });
    return frame.fieldLines
      .filter((line) => line.open)
      .map((line) => Math.abs(Math.asin(line.points[1])));
  };
  const atMinimum = latitudesOfOpen(25.0);
  const atMaximum = latitudesOfOpen(25.5);
  /* A region beside the cap's edge may open a few lines of its own; the holes stay polar. */
  const polarShare = atMinimum.filter((lat) => lat > 0.9).length / atMinimum.length;
  assert.ok(atMinimum.length > 20 && polarShare > 0.8, `polar holes at minimum: ${polarShare}`);
  assert.ok(
    atMinimum.every((lat) => lat > 0.5),
    "none at the equator",
  );
  assert.ok(atMaximum.filter((lat) => lat < 0.7).length > 10, "low-latitude holes at maximum");
  assert.ok(
    Math.abs(equatorialDipoleAt(25.5)) === EQUATORIAL_DIPOLE && equatorialDipoleAt(25) < 1e-12,
  );
});
