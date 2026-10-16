#include <horizon/noise>

// Procedural directional star field. Depends on noise.glsl (hash13).
//
// Seven nested cubic grids are laid over the sky direction; a cell whose
// hash passes the density threshold holds one star, placed at the cell
// centre. Finer grids give fainter, denser stars. `intensity` is explicit so
// the caller controls brightness; `far` (0–1) lets a distant camera see a
// slightly richer sky. `pixel` is the angular size of one screen pixel in
// radians: stars never shrink below it, so they cannot flicker between
// pixels as the view moves, and grids too fine to resolve fade out.
// `spread` (at least `pixel`) is the widest sky angle a pixel covers once the
// caller's optics squeeze the sky, as lensing does near an Einstein ring.
// Stars widen to it, so a thin stretched image stays a continuous arc instead
// of falling between pixel centres as a dotted line; grids still fade by `pixel`.

vec3 fieldStars(vec3 d, float dens, float far, float intensity, float pixel, float spread) {
  vec3 col = vec3(0.0);

  for (int i = 0; i < 7; i++) {
    float scale = 22.0 + float(i) * 54.0;
    // Pixel footprint in cell units. Cells under ~2 pixels cannot hold a
    // distinct star, so the whole grid fades instead of turning into noise.
    float footprint = pixel * scale;
    float resolved = 1.0 - smoothstep(0.24, 0.45, footprint);
    if (resolved <= 0.0) continue;

    vec3 p = d * scale;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;

    // Does this cell hold a star? A soft threshold lets `far` change smoothly
    // without switching stars on and off.
    float h = hash13(cell);
    float threshold = 0.94 - dens * 0.07 - float(i) * 0.01 - far * 0.03;
    float keep = smoothstep(threshold - 0.012, threshold, h);
    if (keep <= 0.0) continue;

    // Brightness, size and colour of the star. A star smaller than a pixel is
    // spread over one and dimmed in proportion, so it neither pops nor vanishes.
    // It never reaches past its own cell.
    float mag = pow(hash13(cell + 2.1), 3.8 + float(i) * 0.28);
    float core = 0.062 + far * 0.014 - float(i) * 0.005;
    float radius = clamp(0.85 * spread * scale, core, 0.5);
    float spark = smoothstep(radius, 0.0, length(f)) * (core / radius) * keep * resolved;
    vec3 tint = mix(vec3(0.68, 0.8, 1.0), vec3(1.0, 0.86, 0.68), hash13(cell + 5.0));
    tint = mix(tint, vec3(1.0, 0.55, 0.38), step(0.88, hash13(cell + 8.2)) * 0.55);
    col += tint * mag * spark * (6.4 + float(i) * 1.1) * intensity;

    // The rare bright ones get diffraction spikes on the coarse grids.
    if (h > 0.9965 && i < 3) {
      float sx = max(1.0 - abs(f.x) * 55.0, 0.0) * max(1.0 - abs(f.y) * 9.0, 0.0);
      float sy = max(1.0 - abs(f.y) * 55.0, 0.0) * max(1.0 - abs(f.x) * 9.0, 0.0);
      col += tint * (sx + sy) * 1.8 * intensity * (0.6 + far);
    }
  }

  return col;
}

// Unlensed sky: a pixel spans the same angle in every direction.
vec3 fieldStars(vec3 d, float dens, float far, float intensity, float pixel) {
  return fieldStars(d, dens, far, intensity, pixel, pixel);
}

// A soft blob of light around a direction; `tight` is the cosine power.
float gaussDir(vec3 d, vec3 axis, float tight) {
  return pow(max(dot(d, normalize(axis)), 0.0), tight);
}
