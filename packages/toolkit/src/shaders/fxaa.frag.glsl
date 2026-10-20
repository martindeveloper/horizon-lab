// Fast approximate anti-aliasing (after Lottes' FXAA, NVIDIA 2009) over a finished
// frame: find pixels on a luma edge, measure how far the edge runs each way, and
// resample across it by the share of the edge this pixel covers; a sub-pixel term
// softens single-pixel sparkle. One texture, no history, so it works on moving and
// still frames alike.
//
// uImage is the frame, uTexel one pixel in texture coordinates. It holds display-ready
// values, encoded as the canvas would be, so edges are judged where they are seen and the
// result is written as it is.

uniform sampler2D uImage;
uniform vec2 uTexel;

// Below this local contrast (absolute, or relative to the brightest neighbour) a pixel is left alone.
#define FXAA_EDGE_MIN 0.0312
#define FXAA_EDGE_REL 0.125
// Strength of the sub-pixel softening, 0–1.
#define FXAA_SUBPIXEL 0.75
#define FXAA_SEARCH 10

float fxaaLumaOf(vec3 rgb) {
  return dot(rgb, vec3(0.299, 0.587, 0.114));
}

float fxaaLuma(vec2 uv) {
  return fxaaLumaOf(texture2D(uImage, uv).rgb);
}

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec4 centre = texture2D(uImage, uv);
  float lM = fxaaLumaOf(centre.rgb);
  float lN = fxaaLuma(uv + vec2(0.0, uTexel.y));
  float lS = fxaaLuma(uv - vec2(0.0, uTexel.y));
  float lE = fxaaLuma(uv + vec2(uTexel.x, 0.0));
  float lW = fxaaLuma(uv - vec2(uTexel.x, 0.0));

  float lo = min(lM, min(min(lN, lS), min(lE, lW)));
  float hi = max(lM, max(max(lN, lS), max(lE, lW)));
  float range = hi - lo;
  if (range < max(FXAA_EDGE_MIN, hi * FXAA_EDGE_REL)) {
    gl_FragColor = vec4(centre.rgb, 1.0);
    return;
  }

  float lNE = fxaaLuma(uv + uTexel);
  float lSW = fxaaLuma(uv - uTexel);
  float lNW = fxaaLuma(uv + vec2(-uTexel.x, uTexel.y));
  float lSE = fxaaLuma(uv + vec2(uTexel.x, -uTexel.y));

  // An edge runs horizontally when luma changes most from row to row.
  float rows = 2.0 * abs(lN + lS - 2.0 * lM) + abs(lNE + lSE - 2.0 * lE) + abs(lNW + lSW - 2.0 * lW);
  float cols = 2.0 * abs(lE + lW - 2.0 * lM) + abs(lNE + lNW - 2.0 * lN) + abs(lSE + lSW - 2.0 * lS);
  bool horizontal = rows >= cols;

  // Step towards the neighbour across the steeper side of the edge.
  float lNeg = horizontal ? lS : lW;
  float lPos = horizontal ? lN : lE;
  float gNeg = abs(lNeg - lM);
  float gPos = abs(lPos - lM);
  float across = horizontal ? uTexel.y : uTexel.x;
  float edgeLuma = 0.5 * (lPos + lM);
  float gradient = gPos;
  if (gNeg >= gPos) {
    across = -across;
    edgeLuma = 0.5 * (lNeg + lM);
    gradient = gNeg;
  }

  // Walk along the edge, midway between the two rows, until its luma departs.
  vec2 along = horizontal ? vec2(uTexel.x, 0.0) : vec2(0.0, uTexel.y);
  vec2 onEdge = uv + (horizontal ? vec2(0.0, 0.5 * across) : vec2(0.5 * across, 0.0));
  float limit = 0.25 * gradient;
  vec2 a = onEdge - along;
  vec2 b = onEdge + along;
  float ea = fxaaLuma(a) - edgeLuma;
  float eb = fxaaLuma(b) - edgeLuma;
  bool doneA = abs(ea) >= limit;
  bool doneB = abs(eb) >= limit;
  for (int i = 0; i < FXAA_SEARCH; i++) {
    if (doneA && doneB) break;
    float stride = i < 3 ? 1.0 : (i < 6 ? 2.0 : 4.0);
    if (!doneA) {
      a -= along * stride;
      ea = fxaaLuma(a) - edgeLuma;
      doneA = abs(ea) >= limit;
    }
    if (!doneB) {
      b += along * stride;
      eb = fxaaLuma(b) - edgeLuma;
      doneB = abs(eb) >= limit;
    }
  }

  float da = horizontal ? uv.x - a.x : uv.y - a.y;
  float db = horizontal ? b.x - uv.x : b.y - uv.y;
  bool nearA = da < db;
  float offset = 0.5 - min(da, db) / (da + db);
  // Only blend when the nearer end turns the way the centre does; otherwise this
  // pixel lies on the edge's far side and keeps its colour.
  bool centreDarker = lM < edgeLuma;
  if (((nearA ? ea : eb) < 0.0) == centreDarker) offset = 0.0;

  // Sub-pixel softening: how far this pixel stands out from its 3 × 3 average.
  float average = (2.0 * (lN + lS + lE + lW) + lNE + lNW + lSE + lSW) / 12.0;
  float stand = clamp(abs(average - lM) / range, 0.0, 1.0);
  float soft = (-2.0 * stand + 3.0) * stand * stand;
  offset = max(offset, soft * soft * FXAA_SUBPIXEL);

  vec2 sampleAt = uv + (horizontal ? vec2(0.0, offset * across) : vec2(offset * across, 0.0));
  gl_FragColor = vec4(texture2D(uImage, sampleAt).rgb, 1.0);
}
