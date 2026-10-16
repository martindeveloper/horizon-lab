// Black-hole fragment shader.
//
// One ray per pixel is marched through a Schwarzschild-like field (with a
// heuristic frame-dragging twist for spin), in geometric units G = c = M = 1,
// so the Schwarzschild radius is Rs = 2. A ray can end in four ways: it is
// captured by the horizon, it crosses the equatorial accretion disk, it
// escapes to the sky, or it runs out of steps and stays dark.
//
// Sections, in order:
//   1. Uniforms and shared snippets
//   2. Sky presets (one per "weather" setting)
//   3. Accretion disk and plunging-region emission
//   4. Ray geometry: acceleration and step size
//   5. main(): march, composite, tone map

precision highp float;

/* ------------------------------------------------- 1. uniforms and snippets */

uniform vec2 uResolution;      // framebuffer size in pixels
uniform sampler2D uDiskProfile; // 512×1 Page–Thorne flux, preintegrated on the CPU
uniform vec3 uCamPos;          // camera position in units of M
uniform vec3 uCamFwd;          // camera basis (unit vectors)
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTime;           // seconds, drives the disk animation
uniform float uSpin;           // dimensionless spin a/M, −0.998–0.998; negative: the disk orbits retrograde
uniform float uInner;          // disk inner radius / M (max of 1.08 r₊ and r_ISCO)
uniform float uOuter;          // disk outer radius / M
uniform float uExposure;       // tone-map exposure
uniform float uDiskBright;     // disk brightness multiplier
uniform float uStars;          // sky brightness multiplier
uniform float uTemp;           // disk temperature multiplier
uniform float uFov;            // vertical field of view, radians
uniform float uSteps;          // step budget per ray (≤ 180)
uniform float uJet;            // jet brightness, 0 = off
uniform float uWeather;        // sky preset: 1 Sgr A*, 2 M87, 3 Cyg X-1, 4 lab, 5 host, else generic

#include <horizon/math>
#include "./parameters.generated.glsl"
#include <horizon/noise>

#include <horizon/temperature>

#include <horizon/stars>

// Angular size of one pixel at the view centre, matching the ray set-up in main():
// one pixel moves uv by 1 / height, scaled by tan(fov / 2).
float skyPixel() {
  return tan(uFov * 0.5) / max(uResolution.y, 1.0);
}

// Sky angles one pixel spans after lensing: x from its area, which decides how
// fine a star grid can resolve, and y along its widest side, which sizes the
// stars. Near the Einstein ring the sky is squeezed across the ring, so a star
// sized by skyPixel() alone falls between pixel centres and shows as a dotted
// arc. Never below skyPixel(); capped where neighbouring rays end on opposite
// sides of the shadow or the disk.
vec2 skyFootprint(vec3 skyDir) {
  float base = skyPixel();
  vec3 dx = dFdx(skyDir);
  vec3 dy = dFdy(skyDir);
  vec2 size = vec2(sqrt(length(cross(dx, dy))), max(length(dx), length(dy)));
  return clamp(size, vec2(base), vec2(base * 4.0));
}

/* ------------------------------------------------------------ 2. sky presets */

// Each sky returns radiance for a view direction `d`; `far` (0–1) is how far
// the camera sits from the hole and lets distant views show a richer sky;
// `pixel` is the lensed pixel footprint from skyFootprint().

// Galactic Centre: the Milky Way band with its dust lane and a warm bulge glow.
vec3 skySgr(vec3 d, float far, vec2 pixel) {
  vec3 galN = normalize(vec3(0.12, 0.99, 0.06));
  float bandY = dot(d, galN);
  float milky = pow(clamp(1.0 - abs(bandY) * 1.05, 0.0, 1.0), 1.6);
  float lane = pow(clamp(1.0 - abs(bandY) * 6.5, 0.0, 1.0), 1.3);

  vec2 suv = vec2(d.x + d.z, bandY);
  float arms = 0.4 + 0.6 * fbm2(suv * vec2(2.0, 3.6));
  float dustN = fbm2(suv * vec2(3.2, 6.5) + 1.3);

  vec3 col = vec3(0.012, 0.007, 0.004) * (0.5 + milky);
  col += vec3(1.0, 0.62, 0.32) * milky * arms * (0.16 + 0.2 * far) * uStars;
  col += vec3(0.85, 0.4, 0.18) * lane * (0.12 + 0.1 * far) * uStars;
  col *= 1.0 - lane * 0.62 * smoothstep(0.48, 0.86, dustN);
  col += vec3(1.0, 0.72, 0.4) * (0.08 + 0.1 * milky) * uStars;
  col += fieldStars(d, 1.15, far, uStars, pixel.x, pixel.y);
  return col;
}

// M87: the giant elliptical's halo and a few neighbouring galaxies.
vec3 skyM87(vec3 d, float far, vec2 pixel) {
  vec3 col = vec3(0.001, 0.0012, 0.0024);

  float r = acos(clamp(d.y, -1.0, 1.0));
  float halo = exp(-r * 1.15) * 0.22;
  col += vec3(1.0, 0.9, 0.72) * halo * uStars * (0.7 + 0.4 * far);

  col += vec3(0.55, 0.62, 0.85) * gaussDir(d, vec3(0.42, 0.18, 0.89), 90.0) * 0.55 * uStars;
  col += vec3(0.7, 0.68, 0.6) * gaussDir(d, vec3(-0.55, 0.12, 0.82), 110.0) * 0.4 * uStars;
  col += vec3(0.6, 0.58, 0.75) * gaussDir(d, vec3(0.15, -0.35, 0.92), 70.0) * 0.35 * uStars;
  col += vec3(0.85, 0.78, 0.55) * gaussDir(d, vec3(-0.2, -0.55, -0.8), 220.0) * 0.45 * uStars;
  col += fieldStars(d, 0.28, far, uStars, pixel.x, pixel.y);
  return col;
}

// Cygnus: the Milky Way through the Cygnus Rift, with a few bright stars.
vec3 skyCyg(vec3 d, float far, vec2 pixel) {
  vec3 galN = normalize(vec3(0.05, 0.998, 0.04));
  float bandY = dot(d, galN) - 0.054;
  float milky = pow(clamp(1.0 - abs(bandY) * 1.15, 0.0, 1.0), 2.0);
  float lane = pow(clamp(1.0 - abs(bandY) * 7.0, 0.0, 1.0), 1.4);

  vec2 suv = vec2(d.x * 1.4 + d.z, bandY);
  float arms = 0.45 + 0.55 * fbm2(suv * vec2(2.2, 3.9));
  float rift = fbm2(suv * vec2(3.6, 6.8));

  vec3 col = vec3(0.0015, 0.0018, 0.004);
  vec3 bandColor = mix(vec3(0.2, 0.32, 0.65), vec3(0.85, 0.8, 1.0), milky);
  col += bandColor * milky * arms * (0.1 + 0.16 * far) * uStars;
  col += vec3(0.55, 0.35, 0.22) * lane * 0.1 * uStars;
  col *= 1.0 - lane * 0.55 * smoothstep(0.5, 0.88, rift);

  col += vec3(0.85, 0.9, 1.0) * gaussDir(d, vec3(0.28, 0.48, 0.83), 260.0) * 1.4 * uStars;
  col += vec3(1.0, 0.92, 0.8) * gaussDir(d, vec3(0.02, 0.22, 0.97), 200.0) * 0.7 * uStars;
  col += vec3(1.0, 0.78, 0.35) * gaussDir(d, vec3(-0.46, 0.12, 0.88), 240.0) * 0.55 * uStars;
  col += fieldStars(d, 0.95, far, uStars, pixel.x, pixel.y);
  return col;
}

// A generic spiral-galaxy host: band, bulge, dust and two emission nebulae.
vec3 skyHost(vec3 d, float far, vec3 galN, float dens, vec2 pixel) {
  float bandY = dot(d, galN);
  float milky = pow(clamp(1.0 - abs(bandY) * 1.08, 0.0, 1.0), 2.15);
  float lane = pow(clamp(1.0 - abs(bandY) * 7.2, 0.0, 1.0), 1.35);

  vec3 coreDir = normalize(cross(galN, vec3(0.22, 0.0, 0.97)));
  coreDir = normalize(coreDir * 0.2 + vec3(0.22, 0.06, 0.97));
  float bulge = pow(max(dot(d, coreDir), 0.0), 6.5);

  float arms = 0.7;
  float dustN = 0.5;
  vec3 col = vec3(0.0012, 0.0015, 0.0032);

  // Noise is only worth evaluating inside the band.
  if (milky > 0.02) {
    vec2 suv = vec2(d.x + d.z, bandY);
    arms = 0.42 + 0.58 * fbm2(suv * vec2(2.1, 3.8));
    dustN = fbm2(suv * vec2(3.4, 7.0) + vec2(1.7, 0.0));
    float nebA = pow(max(fbm2(suv * vec2(1.6, 3.2) + 2.4) - 0.42, 0.0), 1.8) * milky;
    float nebB = pow(max(fbm2(suv * vec2(1.9, 2.6) - 1.8) - 0.48, 0.0), 2.0) * milky;
    col += vec3(0.75, 0.28, 0.42) * nebA * 0.55 * uStars * (0.45 + far);
    col += vec3(0.18, 0.42, 0.72) * nebB * 0.48 * uStars * (0.45 + far);
  }

  vec3 planeGlow = mix(vec3(0.22, 0.32, 0.62), vec3(1.0, 0.78, 0.48), bulge);
  col += planeGlow * milky * arms * (0.07 + 0.16 * far) * uStars;
  col += vec3(1.0, 0.88, 0.62) * bulge * pow(milky, 2.4) * (0.22 + 0.35 * far) * uStars;
  col += vec3(0.62, 0.38, 0.2) * lane * arms * (0.08 + 0.1 * far) * uStars;
  col *= 1.0 - lane * 0.5 * smoothstep(0.52, 0.88, dustN);
  col += fieldStars(d, dens, far, uStars, pixel.x, pixel.y);
  return col;
}

// Laboratory: a sparse field so the lensing itself is the subject.
vec3 skyLab(vec3 d, float far, vec2 pixel) {
  vec3 col = vec3(0.0008, 0.0009, 0.0016);
  col += fieldStars(d, 0.22, far, uStars, pixel.x, pixel.y);
  col += vec3(0.55, 0.5, 0.7) * gaussDir(d, vec3(0.6, 0.2, 0.77), 160.0) * 0.22 * uStars;
  return col;
}

vec3 starfield(vec3 dir, vec2 pixel) {
  vec3 d = normalize(dir);
  float far = smoothstep(28.0, 110.0, length(uCamPos));

  if (uWeather == 1.0) return skySgr(d, far, pixel);
  if (uWeather == 2.0) return skyM87(d, far, pixel);
  if (uWeather == 3.0) return skyCyg(d, far, pixel);
  if (uWeather == 4.0) return skyLab(d, far, pixel);
  if (uWeather == 5.0) return skyHost(d, far, normalize(vec3(0.42, 0.88, 0.22)), 0.7, pixel);
  return skyHost(d, far, vec3(0.0, 1.0, 0.0), 0.85, pixel);
}

/* ------------------------------------------- 3. disk and plunge emission */

// Simple Doppler factor for Keplerian motion, used inside the ISCO where the
// full circular-orbit formula no longer applies.
float keplerDoppler(vec3 hit, vec3 vel, float rho) {
  float vK = clamp(sqrt(1.0 / max(rho, 1.15)), 0.0, 0.88);
  vec3 tangent = normalize(vec3(-hit.z, 0.0, hit.x));
  float ndotv = dot(normalize(-vel), tangent);
  return 1.0 / max(1.0 - vK * ndotv, 0.12);
}

// Display scales at the flux peak (the previous artistic look's peak values).
// DISK_PEAK_K, DISK_PEAK_FLUX, DISK_PROFILE_SIZE/LAST, REDSHIFT_MIN/MAX, LIMB_*, the
// march limits and GAS_* come from parameters.generated.glsl (lib/parameters.ts).

// Peak-normalised Page–Thorne flux at radius r, read from the CPU profile.
float diskFlux(float r) {
  float x = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0) * DISK_PROFILE_LAST;
  float lo = floor(x);
  float f0 = texture2D(uDiskProfile, vec2((lo + 0.5) / DISK_PROFILE_SIZE, 0.5)).r;
  float f1 = texture2D(
    uDiskProfile,
    vec2((min(lo + 1.0, DISK_PROFILE_LAST) + 0.5) / DISK_PROFILE_SIZE, 0.5)
  ).r;
  return mix(f0, f1, fract(x));
}

// g = ν_obs / ν_em for a circular equatorial emitter: g = 1 / (uᵗ (1 − Ω λ)),
// with uᵗ and Ω from the Kerr circular orbit. Bolometric intensity scales as g⁴.
// The ray tangent is exact (E = 1) in the Schwarzschild branch; Kerr is heuristic.
float diskG(vec3 hit, vec3 vel, float rho, float a) {
  float r = max(rho, 1.25);
  float s = sqrt(r);
  float om = 1.0 / (r * s + a);
  float den = pow(r, 0.75) * sqrt(max(s * s * s - 3.0 * s + 2.0 * a, 1e-4));
  float ut = (r * s + a) / max(den, 1e-3);

  vec3 d = -vel;
  float xi = hit.x * d.z - hit.z * d.x; // photon's angular momentum about the spin axis
  return clamp(1.0 / max(ut * (1.0 - om * xi), 0.08), REDSHIFT_MIN, REDSHIFT_MAX);
}

// Noise that wraps around the disk in azimuth.
float wrapFbm(float phi, float rlog, float t, float kPhi, float kR) {
  vec2 q = vec2(cos(phi), sin(phi));
  return fbm2(q * kPhi + vec2(rlog * kR, t));
}

// Value noise on a lattice that repeats every `period` cells along x while
// advancing `period.y` cells along y, so a spiral texture closes at φ = ±π.
float latticeHash(vec2 cell, vec2 period) {
  return hash21(cell - floor(cell.x / period.x) * period);
}

float periodicValue(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = latticeHash(i, period);
  float b = latticeHash(i + vec2(1.0, 0.0), period);
  float c = latticeHash(i + vec2(0.0, 1.0), period);
  float d = latticeHash(i + vec2(1.0, 1.0), period);

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Shear stretches disk turbulence along the orbit into trailing filaments.
// Cells span 1/12 of a turn along a spiral of pitch atan(1/4) ≈ 14° and about
// a tenth of the radius across it: an aspect near 5:1 at every radius.

// One patch of gas texture that shears with differential rotation. Two such
// patches with finite lives are cross-faded so the texture never winds into
// rings. Only evaluated after a ray hits the disk. Screen derivatives are
// undefined inside the divergent march, so frequencies stay low.
float gasPatch(float phi, float rho, float omega, float age, float seed) {
  float angle = phi - omega * age;
  vec2 period = vec2(GAS_TURN_CELLS, GAS_SPIRAL_CELLS);
  vec2 p = vec2(angle, angle + GAS_PITCH * log(rho)) * period / TWO_PI;
  p.y += mod(seed, 16.0) * 7.31; // bounded, so hash precision survives long sessions

  float coarse = periodicValue(p, period);
  vec2 fineP = p * 2.0 + vec2(coarse * 0.8, -coarse * 0.5);
  return coarse * 0.65 + periodicValue(fineP, period * 2.0) * 0.35;
}

// The disk's outer edge is a display window, not a physical wall: fade
// coverage with emissivity so the truncation cannot paint a black silhouette.
float diskCoverage(float rho) {
  float outerCut = uWeather == 2.0 ? 0.58 : 0.78;
  return 1.0 - smoothstep(uOuter * outerCut, uOuter, rho);
}

// Radiance where a ray crosses the disk at cylindrical radius rho.
vec3 diskColor(vec3 hit, vec3 vel, float rho) {
  float phi = atan(hit.z, hit.x);
  float rlog = log(max(rho, 0.3));

  // Gas texture: two cross-faded patches sheared by a teaching-speed rotation.
  float omega = 2.8 / (pow(max(rho, 1.0), 1.5) + uSpin);
  float life = 8.0;
  float ageA = mod(uTime, life);
  float ageB = mod(uTime + life * 0.5, life);
  float weight = 1.0 - abs(2.0 * ageA / life - 1.0);
  weight = weight * weight * (3.0 - 2.0 * weight);
  float patchA = gasPatch(phi, rho, omega, ageA, floor(uTime / life));
  float patchB = gasPatch(phi, rho, omega, ageB, floor((uTime + life * 0.5) / life) + 31.0);
  float structure = mix(patchB, patchA, weight);
  float mu = abs(normalize(vel).y);
  float grazing = smoothstep(0.03, 0.3, mu);
  float gas = 1.0 + (structure - 0.5) * mix(0.35, 0.8, grazing);

  // Physical shape: Page–Thorne flux and the g factor.
  float a = clamp(uSpin, -0.998, 0.998);
  float rin = max(uInner, 1.2);
  float g = diskG(hit, vel, rho, a);
  float fpt = diskFlux(rho); // peak-normalised, zero at the inner edge
  float innerEdge = smoothstep(rin * 0.94, rin * 1.06, rho);
  float outerEdge = diskCoverage(rho);

  // Brightness is proportional to the flux; the effective temperature follows
  // Stefan–Boltzmann, T ∝ F^(1/4), including the local gas fluctuation.
  // DISK_PEAK_K and DISK_PEAK_FLUX are display scales, not accretion rates.
  float tScale = uWeather == 3.0 ? 1.28 : 1.0;
  float tEm = DISK_PEAK_K * pow(fpt * gas, 0.25) * uTemp * tScale;
  vec3 color = blackbody(clamp(tEm * g, 1200.0, 19000.0));
  float flux = DISK_PEAK_FLUX * fpt;
  if (uWeather == 2.0) flux *= 0.72 + 0.85 * exp(-pow((rho - rin) / 1.15, 2.0));
  if (uWeather == 1.0) {
    flux *= 0.48 * (0.72 + 0.28 * wrapFbm(phi, rlog, uTime * 0.22, 0.85, 0.4));
  }

  // Relativistic beaming (g⁴) with a little glare on the approaching side.
  float beam = pow(g, 4.0);
  float glare = pow(max(g - 1.08, 0.0), 2.0);
  color += vec3(1.0, 0.95, 0.84) * glare * 0.15;
  flux += glare * 0.08;

  // A hot spot orbiting just outside the inner edge.
  float rSpot = rin * 1.18;
  float omSpot = 2.9 / (pow(rSpot, 1.5) + a);
  float dphi = atan(sin(phi - uTime * omSpot), cos(phi - uTime * omSpot));
  float spot = exp(-dphi * dphi * 18.0 - pow(rho - rSpot, 2.0) * 2.6);
  color += blackbody(clamp(14000.0 * uTemp * g, 1200.0, 22000.0)) * spot * 0.65;
  flux += spot * 0.25;

  // Limb darkening of an optically thick, electron-scattering atmosphere
  // (Chandrasekhar 1960): I(μ) ∝ 1 + LIMB_DARKENING μ, scaled to an isotropic emitter's
  // flux. μ is measured in the coordinate frame, without orbital aberration.
  float limb = LIMB_NORMALIZATION * (1.0 + LIMB_DARKENING * mu);
  if (uWeather == 2.0) limb *= 1.18;

  return color * flux * gas * beam * innerEdge * outerEdge * limb * uDiskBright * 0.78;
}

// Faint emission from gas spiralling in between the ISCO and the horizon.
vec3 plungeColor(vec3 hit, vec3 vel, float rho) {
  float phi = atan(hit.z, hit.x);
  float fall = clamp((uInner - rho) / max(uInner - 2.2, 0.35), 0.0, 1.0);
  float spiral = 0.75 + 0.25 * sin(3.0 * phi + 2.2 * log(max(rho, 0.5)) - uTime * 1.6);
  float doppler = keplerDoppler(hit, vel, rho);
  float grav = sqrt(max(1.0 - 2.0 / max(rho, 2.2), 0.05));

  vec3 color = blackbody(clamp(3200.0 * grav * pow(doppler, 0.6) * uTemp, 1200.0, 8000.0));
  float fade = (1.0 - fall * 0.7) * smoothstep(2.15, 2.6, rho);
  return color * spiral * fade * grav * pow(doppler, 2.2) * uDiskBright * 0.22;
}

/* ------------------------------------------------------- 4. ray geometry */

// Acceleration of a light ray: the Schwarzschild term −(3/2) Rs L² p / r⁵
// (exact for a = 0), plus a heuristic frame-dragging twist for spin.
vec3 geodesicAcc(vec3 p, vec3 v, float r, float rs) {
  r = max(r, 0.2);
  vec3 L = cross(p, v);
  float L2 = dot(L, L);
  vec3 acc = -1.5 * rs * L2 * p / max(r * r * r * r * r, 1e-5);

  if (abs(uSpin) > 0.002) {
    float omega = uSpin * rs / max(r * r * r, 1e-5);
    acc += omega * vec3(-v.z, 0.0, v.x);
  }
  return acc;
}

// Step length: about 7–10 % of the radius. No artificial slowdown at the
// horizon; affine Schwarzschild rays cross it in a finite number of steps.
float stepSize(float r, vec3 v) {
  return clamp((r < 8.0 ? 0.07 : 0.10) * r / max(length(v), 0.25), 0.012, 48.0);
}

// Bending still owed to a ray leaving p along unit direction d, to infinity.
// In these coordinates the bending term falls as 1/r⁴: along a straight line
// at impact b it adds (1/b)[2 − s(2s² + 3b²)/(b² + s²)^(3/2)], which is the
// weak-field 4M/b over a full pass; the second-order 15πM²/4b² is shared alike.
vec3 lensTail(vec3 p, vec3 d) {
  float s = dot(p, d);
  vec3 toward = s * d - p; // from the line's closest point towards the hole
  float b = length(toward);
  if (b < 1e-3) return d;
  float share = 0.25 * (2.0 - s * (2.0 * s * s + 3.0 * b * b) / pow(b * b + s * s, 1.5));
  float bend = (4.0 / b + 11.780972 / (b * b)) * share;
  return normalize(d * cos(bend) + toward * (sin(bend) / b));
}

#include <horizon/tonemap>

/* ------------------------------------------------------------------ 5. main */

// MAX_STEPS, ESCAPE_R, FAR_FIELD_R, MARCH_B and MARCH_CAM_R: parameters.generated.glsl.

void main() {
  /* Camera ray */
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float tanFov = tan(uFov * 0.5);
  vec3 rd = normalize(uCamFwd + uv.x * uCamRight * tanFov + uv.y * uCamUp * tanFov);
  vec3 pos = uCamPos;
  vec3 vel = rd;

  float rs = 2.0;
  float a = clamp(uSpin, -0.999, 0.999);
  float horizon = 1.0 + sqrt(max(1.0 - a * a, 0.0));

  // Convert the static observer's local direction into an affine spatial
  // tangent with E = 1. Exact for Schwarzschild only; no Kerr tetrad is claimed.
  if (abs(a) <= 0.002 && length(pos) > horizon) {
    vec3 radial = normalize(pos);
    vec3 vr = dot(rd, radial) * radial;
    vel = vr + (rd - vr) / sqrt(1.0 - 2.0 / length(pos));
  }

  /* Inside the horizon: nothing arrives but a dying ember. */
  float camR = length(uCamPos);
  if (camR < horizon) {
    float buried = clamp((horizon - camR) / max(horizon, 0.2), 0.0, 1.0);
    float ember = (1.0 - buried) * (1.0 - buried) * 0.045;
    gl_FragColor = vec4(vec3(0.16, 0.04, 0.015) * ember, 1.0);
    return;
  }

  /* March state */
  vec3 fore = vec3(0.0);        // dust and jet picked up along the way
  vec3 disk = vec3(0.0);        // disk radiance, attenuated by transmission
  vec3 plunge = vec3(0.0);      // plunging-region sample, added if the ray escapes
  float transmission = 1.0;     // how much of what lies beyond still shows
  bool hitDisk = false;
  bool captured = false;
  bool escaped = false;
  bool sampledPlunge = false;

  // Rays that pass far from the hole bend weakly: lensTail() bends them unmarched.
  float bImp = length(cross(uCamPos, rd));
  bool march = bImp < MARCH_B || camR < MARCH_CAM_R;

  if (march) {
    float r = length(pos);
    vec3 acc = geodesicAcc(pos, vel, r, rs);
    // Past the dust cone's far corner, or the jet when one is drawn, an
    // outbound ray collects nothing more; lensTail() finishes its bending.
    float coneSlope = DUST_SLOPE + DUST_CONE;
    float exitR = uJet > 0.02
      ? FAR_FIELD_R
      : min(uOuter * DUST_OUTER * sqrt(1.0 + coneSlope * coneSlope), ESCAPE_R);
    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= uSteps) break;

      if (r < horizon) {
        captured = true;
        break;
      }
      // The background is at infinity: an outbound ray only needs to leave
      // the region with anything left to draw, not return to the camera's radius.
      if (r > exitR && dot(pos, vel) > 0.0) {
        escaped = true;
        break;
      }

      // Velocity Verlet (kick, drift, kick): one acceleration per step, carried
      // into the next. At a = 0 it conserves L exactly, so photon-sphere orbits
      // stay closed and the saved work buys a longer step budget.
      bool farField = r > FAR_FIELD_R;
      vec3 prev = pos;
      float dt = stepSize(r, vel);
      vec3 vMid = vel + 0.5 * dt * acc;
      pos += vMid * dt;
      r = length(pos);
      acc = geodesicAcc(pos, vMid, r, rs);
      vel = vMid + 0.5 * dt * acc;

      // Nothing to sample out here: dust, jet and disk all lie closer in.
      if (farField) continue;

      float cyl = length(pos.xz);
      float ay = abs(pos.y);

      // Dusty wind above and below the disk, in a cone around DUST_SLOPE. Most
      // steps lie outside the cone, where the wall term is under 1 % of its
      // peak: one multiply-add rejects them before any exp or smoothstep.
      if (cyl > uInner * 1.08 && ay > 0.18 && cyl < uOuter * DUST_OUTER
          && abs(ay - DUST_SLOPE * cyl) < DUST_CONE * cyl) {
        float w = (ay / cyl - DUST_SLOPE) / DUST_WIDTH;
        float wall = exp(-w * w);
        float radial = smoothstep(uInner * 1.08, uInner * 1.9, cyl)
          * (1.0 - smoothstep(uOuter * 0.82, uOuter * DUST_OUTER, cyl));
        float dens = wall * radial * exp(-ay * 0.1);
        dens *= (uWeather == 1.0) ? 0.2 : 0.8;
        vec3 dust = mix(vec3(1.0, 0.52, 0.26), vec3(1.0, 0.8, 0.55), clamp(cyl / 14.0, 0.0, 1.0));
        fore += transmission * dust * dens * min(dt, 0.16) * 0.075 * uDiskBright;
      }

      // Jet along the spin axis.
      if (uJet > 0.02 && ay > 2.4 && cyl < 0.22 * ay + 0.45) {
        float core = 1.0 - smoothstep(0.04 * ay, 0.2 * ay + 0.5, cyl);
        float fade = 1.0 / (1.0 + ay * 0.07);
        float lobe = 0.4 + 0.6 * clamp(-vel.y * sign(pos.y), 0.0, 1.0);
        fore += transmission * vec3(0.5, 0.68, 1.12) * core * fade * lobe * uJet * min(dt, 0.2) * 0.35;
      }

      // Crossing the equatorial plane: the disk, or the plunging region inside it.
      if (prev.y * pos.y <= 0.0 && abs(prev.y) + abs(pos.y) > 1e-6) {
        float t = clamp(prev.y / (prev.y - pos.y), 0.0, 1.0);
        vec3 hitp = mix(prev, pos, t);
        float rho = length(hitp.xz);

        // A dormant hole (no disk brightness) has no gas to block the sky behind it.
        if (uDiskBright > 0.0 && rho > uInner && rho < uOuter) {
          disk += transmission * diskColor(hitp, vel, rho);
          transmission *= 1.0 - diskCoverage(rho);
          if (transmission < 0.001) {
            hitDisk = true;
            break;
          }
          // Otherwise keep marching through the display taper so the
          // background matches neighbouring rays outside the disk window.
        }
        if (!sampledPlunge && rho > horizon * 1.08 && rho < uInner) {
          plunge = plungeColor(hitp, vel, rho);
          sampledPlunge = true;
        }
      }
    }
  }

  // Finish the bending analytically: from the escape radius for marched rays,
  // from the camera for rays too far out to march. Every pixel computes it, so
  // its screen derivatives, and with them skyFootprint(), are defined.
  vec3 skyDir = lensTail(pos, normalize(vel));
  vec2 pixel = skyFootprint(skyDir);

  /* Composite */
  vec3 col = fore + disk;
  if (!hitDisk && !captured && (!march || escaped)) {
    col += transmission * plunge;
    col += transmission * starfield(skyDir, pixel);
  }

  /* Artistic pipeline: vignette, the approach to the horizon, tone map, dither */
  float farV = smoothstep(40.0, 160.0, camR);
  float vig = 1.0 - 0.1 * (1.0 - 0.55 * farV) * dot(uv, uv);
  col *= vig;

  float swallow = 1.0 - smoothstep(horizon * 1.08, 11.0, camR);
  if (swallow > 0.0) {
    col *= 1.0 - 0.9 * swallow;
    col = mix(col, col * vec3(1.4, 0.26, 0.08), swallow);
    float tunnel = swallow * swallow;
    col *= 1.0 - tunnel * smoothstep(0.03, 0.7, dot(uv, uv));
  }

  col = tonemap(max(col, vec3(0.0)), uExposure);
  col = pow(col, vec3(0.97)); // keep highlight detail instead of a second clipping boost
  float dither = hash21(gl_FragCoord.xy) - 0.5;
  col += dither * 0.004; // about one 8-bit step: hides banding without visible grain

  gl_FragColor = vec4(col, 1.0);
}
