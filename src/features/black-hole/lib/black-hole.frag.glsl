// Black-hole fragment shader.
//
// One ray per pixel is traced backward from a zero-angular-momentum camera
// along a Kerr null geodesic, in geometric units G = c = M = 1. A camera that
// moves through that hovering frame (riding with the disk gas) sees each ray
// aberrated into it first, and every frequency shifted by its own Doppler factor. A ray can end
// in four ways: it is captured by the hole, it crosses the equatorial
// accretion disk, it escapes to the sky, or it runs out of steps and stays dark.
// With gravity off, rays run straight from a static camera and only a dark
// ball of radius r₊ captures; the disk keeps its orbital Doppler shift.
//
// Sections, in order:
//   1. Uniforms and shared snippets
//   2. Sky presets (one per "weather" setting)
//   3. Accretion disk and plunging-region emission
//   4. Ray geometry: Kerr geodesics in Mino time
//   5. shade(): march, composite → radiance; display() (display.glsl) tone maps it;
//      main() comes from <horizon/supersample>, or with KERR_TRACE writes the march's
//      record for a frame that only turns or animates to replay (lib/trace-cache.ts)

precision highp float;

/* ------------------------------------------------- 1. uniforms and snippets */

uniform vec2 uResolution;      // framebuffer size in pixels
uniform sampler2D uDiskProfile; // 512×1 Page–Thorne flux, preintegrated on the CPU
uniform sampler2D uBlackbody;  // black-body colours, log-spaced in kelvin, read as linear light
uniform mat4 uCamera;          // camera to traced frame: columns right, up, back (−forward), position in M
uniform float uAzimuth;        // the camera's azimuth about the spin axis, turned out of the traced frame (section 5)
uniform vec3 uCamVelocity;     // camera velocity through the hovering observer's frame, traced frame, units of c (0: hovering)
uniform float uTime;           // seconds, drives the disk animation
uniform float uSpin;           // dimensionless spin a/M, within ±MAX_SPIN; negative: the disk orbits retrograde
uniform float uInner;          // disk inner radius / M (max of DISK_INNER_FACTOR r₊ and r_ISCO)
uniform float uOuter;          // disk outer radius / M
uniform float uExposure;       // tone-map exposure
uniform float uDiskBright;     // disk brightness multiplier
uniform float uStars;          // sky brightness multiplier
uniform float uTemp;           // disk temperature multiplier
uniform float uFov;            // vertical field of view, radians
uniform float uSteps;          // step budget per ray: the quality's (lib/quality.ts), ≤ MAX_STEPS
uniform float uJet;            // jet brightness, 0 = off
uniform float uWeather;        // sky preset: 1 Sgr A*, 2 M87, 3 Cyg X-1, 4 lab, 5 host, else generic
uniform float uGravity;        // 1 Kerr; 0 the same scene in flat space, for comparison
uniform float uVignette;       // the lens vignette's depth at this camera distance (frame.ts)

#include <horizon/math>
#include "./parameters.generated.glsl"
#include <horizon/noise>

#include <horizon/temperature>

#include <horizon/stars>

#include <horizon/relativity>

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
  float far = smoothstep(28.0, 110.0, length(uCamera[3].xyz));

  if (uWeather == SKY_SGR) return skySgr(d, far, pixel);
  if (uWeather == SKY_M87) return skyM87(d, far, pixel);
  if (uWeather == SKY_CYG) return skyCyg(d, far, pixel);
  if (uWeather == SKY_LAB) return skyLab(d, far, pixel);
  if (uWeather == SKY_HOST) return skyHost(d, far, normalize(vec3(0.42, 0.88, 0.22)), 0.7, pixel);
  return skyHost(d, far, vec3(0.0, 1.0, 0.0), 0.85, pixel);
}

/* ------------------------------------------- 3. disk and plunge emission */

// Constants of the traced ray, set once per pixel in main(). The ray is the
// arriving photon's path traced backward from the camera, so the photon itself
// carries energy −gE and angular momentum −gL; Carter's gQ is shared.
float gA;      // spin a
float gE;
float gL;
float gQ;
float gK;      // Q + (L − aE)²
float gC;      // a(aE − L)
float gSphere; // Q + L²
float gA2E2;   // a²E²
float gA2;     // a²
float gHorizon; // r₊
vec3 gRay;     // the straight ray's direction, with gravity off
float gCam;    // ν_camera / ν_hovering along this pixel: 1 for a hovering camera
float gCam4;   // gCam⁴, which brightens light at rest in the hovering frame

// Frequency ratio g = ν_camera / ν_emitted for gas on a prograde circular
// orbit at r: g = 1 / (uᵗ(E_photon − Ω L_photon)). The photon's constants are
// normalised to the camera's own frame, so g includes the camera's shift.
// Bolometric intensity scales as g⁴.
float diskG(float r) {
  float s = sqrt(r);
  float om = 1.0 / (r * s + gA);
  float ut = (r * s + gA) / (pow(r, 0.75) * sqrt(max(r * s - 3.0 * s + 2.0 * gA, 1e-6)));
  return 1.0 / max(ut * (-gE + om * gL), 1e-4);
}

// Gravity off: gas circling at the same Ω in flat space, seen along the
// straight ray, has only the special-relativistic Doppler factor
// g = 1 / (γ(1 + v·d)); its rest-frame emission cosine is μ = g |d_y|.
float flatShift(vec3 hit, float rho) {
  float om = 1.0 / (rho * sqrt(rho) + gA);
  vec3 v = om * vec3(-hit.z, 0.0, hit.x);
  float v2 = min(dot(v, v), 0.98);
  return sqrt(1.0 - v2) / max(1.0 + dot(v, gRay), 1e-4);
}

// Gas inside the ISCO plunges on a geodesic that keeps the ISCO's energy and
// angular momentum (Cunningham 1975). udHit is du/dλ of the traced ray there.
float plungeG(float r, float udHit) {
  float ri = uInner;
  float si = sqrt(ri);
  float norm = pow(ri, 0.75) * sqrt(max(ri * si - 3.0 * si + 2.0 * gA, 1e-6));
  float eI = (ri * si - 2.0 * si + gA) / norm;
  float lI = (ri * ri - 2.0 * gA * si + gA * gA) / norm;

  float a2 = gA * gA;
  float delta = r * r - 2.0 * r + a2;
  float bigA = (r * r + a2) * (r * r + a2) - a2 * delta;
  float ut = (bigA * eI - 2.0 * gA * r * lI) / (r * r * delta);
  float uphi = (2.0 * gA * r * eI + (delta - a2) * lI) / (r * r * delta);
  float p = eI * (r * r + a2) - gA * lI;
  float ur = -sqrt(max(p * p - delta * (r * r + (lI - gA * eI) * (lI - gA * eI)), 0.0)) / (r * r);
  // Photon covariant radial momentum: the traced ray's, reversed.
  float kr = udHit * r * r / delta;
  return 1.0 / max(-gE * ut + gL * uphi - kr * ur, 1e-4);
}

// Black-body colour in linear light at full brightness, from the CIE lookup (frame.ts):
// one texture read, the texel centres spanning BLACKBODY_MIN_K to BLACKBODY_MAX_K.
vec3 blackbodyLight(float kelvin) {
  vec3 spec = vec3(BLACKBODY_MIN_K, BLACKBODY_MAX_K, BLACKBODY_LUT_SIZE);
  return texture2D(uBlackbody, vec2(blackbodyLutTexel(kelvin, spec), 0.5)).rgb;
}

// Display scales at the flux peak (the previous artistic look's peak values).
// DISK_PEAK_K, DISK_PEAK_FLUX, DISK_PROFILE_SIZE/LAST, LIMB_*, the march limits
// and GLOW_* come from parameters.generated.glsl (lib/parameters.ts).

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
  float outerCut = uWeather == SKY_M87 ? 0.58 : 0.78;
  return 1.0 - smoothstep(uOuter * outerCut, uOuter, rho);
}

// A crossing of the disk plane that lights a ray is (Boyer–Lindquist radius ρ, its azimuth in
// the traced frame, the gas's frequency factor g before the camera's own shift): diskG,
// flatShift or plungeG, taken where the march met it. Everything below that moves with the
// clock or the camera's azimuth is evaluated from it.

// Radiance where a ray crosses the disk.
vec3 diskColor(vec3 crossing) {
  float rho = crossing.x;
  float phi = crossing.y - uAzimuth;
  float rlog = log(max(rho, 0.3));

  // Physical shape: Page–Thorne flux, the frequency factor g, and the emission
  // angle in the gas's rest frame, μ = g √Q / r on the equator, g |d_y| in flat space.
  float g = crossing.z;
  float mu = uGravity > 0.5
    ? clamp(g * sqrt(max(gQ, 0.0)) / rho, 0.0, 1.0)
    : clamp(g * abs(gRay.y), 0.0, 1.0);
  // The emission angle is the gas's own; its colour and brightness reach a moving camera shifted again.
  g *= gCam;
  float rin = max(uInner, 1.2);
  float fpt = diskFlux(rho); // peak-normalised, zero at the inner edge
  float innerEdge = smoothstep(rin * 0.94, rin * 1.06, rho);
  float outerEdge = diskCoverage(rho);

  // Gas texture: two cross-faded patches sheared by a teaching-speed rotation.
  float omega = GAS_RATE / (pow(max(rho, 1.0), 1.5) + uSpin);
  float life = 8.0;
  float ageA = mod(uTime, life);
  float ageB = mod(uTime + life * 0.5, life);
  float weight = 1.0 - abs(2.0 * ageA / life - 1.0);
  weight = weight * weight * (3.0 - 2.0 * weight);
  float patchA = gasPatch(phi, rho, omega, ageA, floor(uTime / life));
  float patchB = gasPatch(phi, rho, omega, ageB, floor((uTime + life * 0.5) / life) + 31.0);
  float structure = mix(patchB, patchA, weight);
  float grazing = smoothstep(0.03, 0.3, mu);
  float gas = 1.0 + (structure - 0.5) * mix(0.35, 0.8, grazing);

  // Brightness is proportional to the flux; the effective temperature follows
  // Stefan–Boltzmann, T ∝ F^(1/4), including the local gas fluctuation.
  // DISK_PEAK_K and DISK_PEAK_FLUX are display scales, not accretion rates.
  float tScale = uWeather == SKY_CYG ? 1.28 : 1.0;
  float tEm = DISK_PEAK_K * pow(fpt * gas, 0.25) * uTemp * tScale;
  vec3 color = blackbodyLight(clamp(tEm * g, 1200.0, 19000.0));
  float flux = DISK_PEAK_FLUX * fpt;
  if (uWeather == SKY_M87) flux *= 0.72 + 0.85 * exp(-pow((rho - rin) / 1.15, 2.0));
  if (uWeather == SKY_SGR) {
    flux *= 0.48 * (0.72 + 0.28 * wrapFbm(phi, rlog, uTime * 0.22, 0.85, 0.4));
  }

  // An illustrative hot spot orbiting just outside the inner edge, with the gas around it.
  float rSpot = rin * 1.18;
  float omSpot = GAS_RATE / (pow(rSpot, 1.5) + gA);
  float dphi = atan(sin(phi - uTime * omSpot), cos(phi - uTime * omSpot));
  float spot = exp(-dphi * dphi * 18.0 - pow(rho - rSpot, 2.0) * 2.6);
  color += blackbodyLight(clamp(14000.0 * uTemp * g, 1200.0, 22000.0)) * spot * 0.65;
  flux += spot * 0.25;

  // Limb darkening of an optically thick, electron-scattering atmosphere
  // (Chandrasekhar 1960): I(μ) ∝ 1 + LIMB_DARKENING μ, scaled to an isotropic
  // emitter's flux, and bolometric beaming g⁴.
  float limb = LIMB_NORMALIZATION * (1.0 + LIMB_DARKENING * mu);
  if (uWeather == SKY_M87) limb *= 1.18;
  float beam = g * g * g * g;

  return color * flux * gas * beam * innerEdge * outerEdge * limb * uDiskBright * 0.78;
}

// Faint, illustrative emission from gas plunging between the ISCO and the
// horizon r₊; its frequency shift g follows the plunging geodesic. A zero-torque
// disk's flux vanishes at the ISCO, so this glow stays well below the disk's peak.
// It fades with the share of the fall from the disk's inner edge to the horizon.
vec3 plungeColor(vec3 crossing) {
  float rho = crossing.x;
  float phi = crossing.y - uAzimuth;
  float g = crossing.z * gCam;
  float fall = clamp((uInner - rho) / (uInner - gHorizon), 0.0, 1.0);
  float spiral = 0.75 + 0.25 * sin(3.0 * phi + 2.2 * log(max(rho, 0.5)) - uTime * 1.6);
  vec3 color = blackbodyLight(clamp(3200.0 * g * uTemp, 1200.0, 8000.0));
  float fade = 1.0 - fall * 0.7;
  return color * spiral * fade * g * g * g * g * uDiskBright * PLUNGE_GLOW;
}

/* ------------------------------------------------------- 4. ray geometry */

// Kerr null geodesics in Mino time λ (see lib/kerr-rays.ts, which mirrors this
// section for tests and the guide overlay). The radial motion in u = 1/r obeys
//   (du/dλ)² = U(u) = (E + cu²)² − K(u² − 2u³ + a²u⁴),   d²u/dλ² = U′/2;
// the direction s = (sinθ cosφ, cosθ, sinθ sinφ) moves like a free particle on
// the unit sphere with potential −½a²E²cos²θ; frame dragging rotates both
// about the spin axis at dφ/dλ = a u (2E − aLu) / (1 − 2u + a²u²).

// U(u) and d²u/dλ² = U′/2 together: they share u² and E + cu².
vec2 radialU(float u) {
  float uu = u * u;
  float w = gE + gC * uu;
  return vec2(
    w * w - gK * uu * (1.0 - 2.0 * u + gA2 * uu),
    2.0 * gC * u * w - gK * u * (1.0 - 3.0 * u + 2.0 * gA2 * uu)
  );
}

// |ds/dλ|² fixed by Carter's constant: Q + L² + a²E² cos²θ.
float sphereSpeed2(float mu) {
  return gSphere + gA2E2 * mu * mu;
}

vec3 accS(vec3 s) {
  float mu = s.y;
  return -sphereSpeed2(mu) * s + gA2E2 * mu * (vec3(0.0, 1.0, 0.0) - mu * s);
}

float dragRate(float u) {
  return gA * u * (2.0 * gE - gA * gL * u) / max(1.0 - 2.0 * u + gA2 * u * u, 1e-6);
}

// Scene point of Boyer–Lindquist (r, s), on oblate spheroids.
vec3 rayPoint(float r, vec3 s) {
  float w = sqrt(r * r + gA2);
  return vec3(w * s.x, r * s.y, w * s.z);
}

// Direction the ray moves in the scene, for the analytic far-field bend.
vec3 rayDir(float u, float ud, vec3 s, vec3 sd) {
  float r = 1.0 / u;
  float drag = dragRate(u);
  return normalize(-ud * r * r * s + r * sd + r * drag * vec3(-s.z, 0.0, s.x));
}

// Bending still owed to a ray leaving p along unit direction d, to infinity.
// Far out the bending term falls as 1/r⁴: along a straight line at impact b it
// adds (1/b)[2 − s(2s² + 3b²)/(b² + s²)^(3/2)], which is the weak-field 4M/b
// over a full pass; the second-order 15πM²/4b² is shared alike. Spin enters at
// order a/b², below a pixel beyond the hand-off radius.
vec3 lensTail(vec3 p, vec3 d) {
  float s = dot(p, d);
  vec3 toward = s * d - p; // from the line's closest point towards the hole
  float b = length(toward);
  if (b < 1e-3) return d;
  float share = 0.25 * (2.0 - s * (2.0 * s * s + 3.0 * b * b) / pow(b * b + s * s, 1.5));
  float bend = (4.0 / b + 11.780972 / (b * b)) * share;
  return normalize(d * cos(bend) + toward * (sin(bend) / b));
}

/* ----------------------------------------------------------------- 5. shade */

// MAX_STEPS, STEP_*, ESCAPE_R, FAR_FIELD_R, MARCH_B and MARCH_CAM_R: parameters.generated.glsl.

// The march sees the camera turned to azimuth zero about the spin axis (uCamera, frame.ts).
// The hole, its disk, glow and jet are all symmetric about that axis, so the camera's azimuth
// only turns what the rays meet: uAzimuth turns each crossing's azimuth (diskColor,
// plungeColor) and each sky direction (sceneSky) into the scene. A frame that only turns or
// animates can replay the march instead of repeating it (KERR_TRACE, KERR_REPLAY below).

// A traced sky direction in the scene: turned by uAzimuth about the spin axis.
vec3 sceneSky(vec3 d) {
  float c = cos(uAzimuth);
  float s = sin(uAzimuth);
  return vec3(c * d.x + s * d.z, d.y, c * d.z - s * d.x);
}

// Starlight's weight where a ray never reaches the sky, and a recorded march's where the ray
// lit more crossings than the record keeps (the replay marches it again).
#define SKY_HIDDEN -1.0
#define TRACE_OVERFLOW -2.0

// What one ray meets, in the traced frame.
struct Ray {
  vec3 glow;   // glow and jet light picked up along the way: the same at every azimuth and time
  vec3 light;  // disk and plunging-gas light, in the order met (not with KERR_TRACE, which records the crossings)
  vec3 skyDir; // where it leaves for the sky
  float sky;   // starlight's weight there, transmission × (g_sky g_cam)⁴, or SKY_HIDDEN
};

#ifdef KERR_TRACE
// The first TRACE_CROSSINGS lit crossings, in order (ρ = 0: none), and how many there were.
vec3 gCrossing0;
vec3 gCrossing1;
int gCrossings;
#if TRACE_CROSSINGS != 2
#error "The trace records two crossings: update gCrossing0/1, meet() and the replay"
#endif
#endif

// Light from one crossing, in front of everything beyond it; the disk also hides what lies
// behind it as far as its coverage reaches. The trace pass records the crossing instead.
void meet(vec3 crossing, inout vec3 light, inout float transmission) {
  bool onDisk = crossing.x > uInner && crossing.x < uOuter;
#ifdef KERR_TRACE
  if (gCrossings == 0) gCrossing0 = crossing;
  else if (gCrossings == 1) gCrossing1 = crossing;
  gCrossings++;
#else
  if (onDisk) light += transmission * diskColor(crossing);
  else light += transmission * plungeColor(crossing);
#endif
  if (onDisk) transmission *= 1.0 - diskCoverage(crossing.x);
}

// Glow, jet and disk light on one step of the march, from prev to pos. With
// gravity, du/dλ and u at both ends locate the equatorial crossing; without,
// its radius comes from the crossing point. Returns true once the disk is opaque.
bool collect(
  vec3 prev, vec3 pos, vec2 uStep, vec2 udStep,
  inout vec3 glow, inout vec3 light, inout float transmission
) {
  float cyl = length(pos.xz);
  float ay = abs(pos.y);

  // Illustrative glow above and below the disk, in a cone around
  // GLOW_SLOPE. Most steps lie outside the cone, where the wall term is
  // under 1 % of its peak: one multiply-add rejects them before any exp.
  if (cyl > uInner * 1.08 && ay > 0.18 && cyl < uOuter * GLOW_OUTER
      && abs(ay - GLOW_SLOPE * cyl) < GLOW_CONE * cyl) {
    float w = (ay / cyl - GLOW_SLOPE) / GLOW_WIDTH;
    float wall = exp(-w * w);
    float radial = smoothstep(uInner * 1.08, uInner * 1.9, cyl)
      * (1.0 - smoothstep(uOuter * 0.82, uOuter * GLOW_OUTER, cyl));
    float dens = wall * radial * exp(-ay * 0.1);
    dens *= (uWeather == SKY_SGR) ? 0.2 : 0.8;
    float stepLen = length(pos - prev);
    vec3 tint = mix(vec3(1.0, 0.52, 0.26), vec3(1.0, 0.8, 0.55), clamp(cyl / 14.0, 0.0, 1.0));
    glow += transmission * tint * dens * min(stepLen, 0.16) * 0.075 * uDiskBright * gCam4;
  }

  // Jet along the spin axis.
  if (uJet > 0.02 && ay > 2.4 && cyl < 0.22 * ay + 0.45) {
    float core = 1.0 - smoothstep(0.04 * ay, 0.2 * ay + 0.5, cyl);
    float fade = 1.0 / (1.0 + ay * 0.07);
    float stepLen = length(pos - prev);
    // The traced ray runs backward: light reaching the camera moves along prev − pos.
    float lobe = 0.4 + 0.6 * clamp((prev.y - pos.y) * sign(pos.y) / max(stepLen, 1e-6), 0.0, 1.0);
    glow += transmission * vec3(0.5, 0.68, 1.12) * core * fade * lobe * uJet * min(stepLen, 0.2) * 0.35 * gCam4;
  }

  // Crossing the equatorial plane: the disk, or the plunging region inside it.
  // A dormant hole (no disk brightness) has no gas to light or to block the sky behind it.
  if (uDiskBright > 0.0 && prev.y * pos.y <= 0.0 && abs(prev.y) + abs(pos.y) > 1e-6) {
    float t = clamp(prev.y / (prev.y - pos.y), 0.0, 1.0);
    vec3 hitp = mix(prev, pos, t);
    // Without gravity, the Boyer–Lindquist radius of the same equatorial point.
    float rho = uGravity > 0.5
      ? 1.0 / mix(uStep.x, uStep.y, t)
      : sqrt(max(dot(hitp.xz, hitp.xz) - gA2, 0.0));
    float phi = atan(hitp.z, hitp.x);

    if (rho > uInner && rho < uOuter) {
      float g = uGravity > 0.5 ? diskG(rho) : flatShift(hitp, rho);
      meet(vec3(rho, phi, g), light, transmission);
      if (transmission < 0.001) return true;
      // Otherwise keep marching through the display taper so the
      // background matches neighbouring rays outside the disk window.
    }
    // The plunging gas is thin and lies in front of whatever the ray meets
    // next, so it shows whether the ray then escapes, is captured or hits the disk.
    // Without gravity it is drawn unshifted.
    if (rho > gHorizon * DISK_INNER_FACTOR && rho < uInner) {
      float g = uGravity > 0.5 ? plungeG(rho, mix(udStep.x, udStep.y, t)) : 1.0;
      meet(vec3(rho, phi, g), light, transmission);
    }
  }
  return false;
}

// Where a ray starts: the camera and the ray's direction in the traced frame, and with gravity
// the Mino-time state (u = 1/r, du/dλ, the direction s on the unit sphere, ds/dλ).
struct RayStart {
  vec3 cam;
  vec3 rd;
  float rc;
  float u;
  float ud;
  vec3 s;
  vec3 sd;
};

// The ray through fragCoord (pixels) and its constants: gA…, gCam, and gE, gL, gQ… with gravity
// or gRay without. False where the camera has no static frame.
bool launch(vec2 fragCoord, out RayStart start) {
  /* Camera ray */
  vec2 uv = (fragCoord - 0.5 * uResolution) / uResolution.y;
  float tanFov = tan(uFov * 0.5);
  vec3 rd = normalize(mat3(uCamera) * vec3(uv * tanFov, -1.0));
  /* A moving camera: the direction the hovering observer sees this light come from (the boost
     undone, so the sky crowds toward the motion), and the camera's own shift of its frequency. */
  gCam = 1.0;
  float camSpeed2 = dot(uCamVelocity, uCamVelocity);
  if (camSpeed2 > 0.0) {
    float beta = sqrt(camSpeed2);
    vec3 heading = uCamVelocity / beta;
    float gamma = inversesqrt(1.0 - camSpeed2);
    gCam = dopplerFactorObserved(beta, gamma, dot(rd, heading));
    rd = normalize(aberrate(rd, heading, -beta, gamma));
  }
  gCam4 = gCam * gCam * gCam * gCam;

  float a = clamp(uSpin, -SPIN_LIMIT, SPIN_LIMIT);
  float a2 = a * a;
  gA = a;
  gA2 = a2;
  start.cam = uCamera[3].xyz;
  start.rd = rd;
  gHorizon = 1.0 + sqrt(max(1.0 - a2, 0.0));
  gRay = rd;

  /* The camera is a zero-angular-momentum observer at Boyer–Lindquist (r, θ, φ). */
  vec3 cam = start.cam;
  float camR2 = dot(cam, cam) - a2;
  float rc = sqrt(0.5 * (camR2 + sqrt(camR2 * camR2 + 4.0 * a2 * cam.y * cam.y)));
  float delC = rc * rc - 2.0 * rc + a2;
  start.rc = rc;
  if (delC <= 0.0) return false; // no static frame exists there
  if (uGravity < 0.5) return true;

  float muC = clamp(cam.y / rc, -1.0, 1.0);
  float sinC = sqrt(max(1.0 - muC * muC, 1e-8));
  vec2 az = cam.xz / max(length(cam.xz), 1e-6);
  vec3 s = vec3(sinC * az.x, muC, sinC * az.y);
  vec3 eTheta = vec3(muC * az.x, -sinC, muC * az.y);
  vec3 ePhi = vec3(-az.y, 0.0, az.x);

  float sigC = rc * rc + a2 * muC * muC;
  float bigA = (rc * rc + a2) * (rc * rc + a2) - a2 * delC * sinC * sinC;
  float lapse = sqrt(sigC * delC / bigA);
  float frame = 2.0 * a * rc / bigA;
  float lift = sqrt(bigA / sigC); // √g_φφ / sinθ

  // Photon arriving along −rd with unit energy in the camera's frame.
  float nR = dot(rd, s);
  float nTheta = dot(rd, eTheta);
  float nPhi = dot(rd, ePhi);
  gL = lift * sinC * nPhi;
  gE = frame * gL - lapse;
  float pTheta = sqrt(sigC) * nTheta;
  gQ = pTheta * pTheta + muC * muC * (lift * lift * nPhi * nPhi - a2 * gE * gE);
  gK = gQ + (gL - a * gE) * (gL - a * gE);
  gC = a * (a * gE - gL);
  gSphere = gQ + gL * gL;
  gA2E2 = a2 * gE * gE;

  start.u = 1.0 / rc;
  start.ud = -sqrt(sigC * delC) * nR / (rc * rc);
  start.s = s;
  start.sd = pTheta * eTheta + lift * nPhi * ePhi;
  return true;
}

// The march from a launched ray: the light it meets until it is captured, hits the opaque
// disk, escapes to the sky or runs out of steps.
Ray march(RayStart start) {
  vec3 glow = vec3(0.0);        // glow and jet picked up along the way
  vec3 light = vec3(0.0);       // disk and plunging gas, attenuated by transmission
  float transmission = 1.0;     // how much of what lies beyond still shows
  bool hitDisk = false;
  bool captured = false;
  bool escaped = false;
  bool stepped = true;
  vec3 skyDir = start.rd;
  float gSky = 1.0;             // frequency shift of starlight at the camera
  vec3 cam = start.cam;
  vec3 rd = start.rd;

  // Past the glow cone's far corner, or the jet when one is drawn, an
  // outbound ray collects nothing more.
  float coneSlope = GLOW_SLOPE + GLOW_CONE;
  float exitR = uJet > 0.02
    ? FAR_FIELD_R
    : min(uOuter * GLOW_OUTER * sqrt(1.0 + coneSlope * coneSlope), ESCAPE_R);

  if (uGravity < 0.5) {
    /* Flat space: a straight ray from a static camera, marched with the same
       step lengths so the glow and jet collect alike, until it meets the
       ball of radius r₊ or leaves the exit sphere moving outward. */
    float b = dot(cam, rd);
    float c = dot(cam, cam);
    float ballDisc = b * b - c + gHorizon * gHorizon;
    float tBall = ballDisc > 0.0 && b < 0.0 ? -b - sqrt(ballDisc) : 1e9;
    // Nothing lies outside the exit sphere: march only the chord inside it.
    float exitDisc = max(b * b - c + exitR * exitR, 0.0);
    float tExit = -b + sqrt(exitDisc);
    float t = max(-b - sqrt(exitDisc), 0.0);
    escaped = tExit <= t;
    vec3 pos = cam + t * rd;
    for (int i = 0; i < MAX_STEPS; i++) {
      if (escaped || float(i) >= uSteps) break;
      float r = length(pos);
      float frac = r < 8.0 ? STEP_NEAR : STEP_FAR * min(sqrt(r / 8.0), STEP_FAR_GROWTH);
      t = min(t + frac * r, min(tBall, tExit));
      vec3 prev = pos;
      pos = cam + t * rd;
      if (collect(prev, pos, vec2(0.0), vec2(0.0), glow, light, transmission)) {
        hitDisk = true;
        break;
      }
      captured = t >= tBall;
      escaped = t >= tExit;
      if (captured) break;
    }
  } else {
    float a = gA;
    // Inside this radius an ingoing ray cannot turn back: halfway from the
    // horizon to the prograde equatorial photon orbit.
    float rCapture = 0.5 * (gHorizon + 2.0 * (1.0 + cos(acos(-abs(a)) * 2.0 / 3.0)));
    float rc = start.rc;
    float u = start.u;
    float ud = start.ud;
    vec3 s = start.s;
    vec3 sd = start.sd;
    vec3 pos = cam;
    vec3 dir = rayDir(u, ud, s, sd);

    // Light from far away arrives blueshifted by 1 / E_photon at the camera.
    gSky = 1.0 / max(-gE, 1e-3);

    // Rays that pass far from the hole bend weakly: lensTail() bends them unmarched.
    float bImp = sqrt(max(gSphere, 0.0)) / max(-gE, 1e-3);
    stepped = bImp < MARCH_B || rc < MARCH_CAM_R;

    if (stepped) {
      float uCapture = 1.0 / rCapture;
      float uHorizon = 1.0 / (gHorizon * 1.001);
      float kU = radialU(u).y;
      vec3 kS = accS(s);
      float drag = dragRate(u);
      float r = rc;
      float speed2 = sphereSpeed2(s.y); // |ds/dλ|², kept exact below
      for (int i = 0; i < MAX_STEPS; i++) {
        if (float(i) >= uSteps) break;

        if (u > uHorizon || (u > uCapture && ud > 0.0)) {
          captured = true;
          break;
        }
        // The background is at infinity: an outbound ray only needs to leave
        // the region with anything left to draw, not return to the camera's radius.
        if (u * exitR < 1.0 && ud < 0.0) {
          escaped = true;
          break;
        }

        // Velocity Verlet in Mino time; each step moves the ray about STEP_NEAR
        // of its radius inside 8 M and STEP_FAR (growing to STEP_FAR_GROWTH×) beyond.
        float frac = r < 8.0 ? STEP_NEAR : STEP_FAR * min(sqrt(r / 8.0), STEP_FAR_GROWTH);
        float dl = frac * inversesqrt(max(ud * ud * r * r + speed2, 1e-12));
        float udHalf = ud + 0.5 * dl * kU;
        vec3 sdHalf = sd + 0.5 * dl * kS;
        float u1 = u + dl * udHalf;
        vec3 s1 = normalize(s + dl * sdHalf);
        vec2 radial = radialU(u1);
        kU = radial.y;
        float ud1 = udHalf + 0.5 * dl * kU;
        // Unless the ray turned during the step, reset du/dλ to ±√U.
        if (radial.x > 0.0 && ud1 * ud > 0.0) ud1 = sign(ud1) * sqrt(radial.x);
        kS = accS(s1);
        vec3 sd1 = sdHalf + 0.5 * dl * kS;
        // Back onto the sphere's tangent plane, at the speed Carter's constant fixes.
        sd1 -= dot(s1, sd1) * s1;
        speed2 = sphereSpeed2(s1.y);
        sd1 *= sqrt(speed2 / max(dot(sd1, sd1), 1e-18));
        // Frame dragging: a rotation about the spin axis, trapezoidal in u.
        float drag1 = dragRate(u1);
        float turn = 0.5 * dl * (drag + drag1);
        float ct = cos(turn);
        float st = sin(turn);
        mat2 rot = mat2(ct, st, -st, ct);
        s1.xz = rot * s1.xz;
        sd1.xz = rot * sd1.xz;
        kS.xz = rot * kS.xz;

        bool farField = r > FAR_FIELD_R;
        vec2 uStep = vec2(u, u1);
        vec2 udStep = vec2(ud, ud1);
        u = u1;
        ud = ud1;
        s = s1;
        sd = sd1;
        drag = drag1;
        r = 1.0 / u;

        vec3 prev = pos;
        pos = rayPoint(r, s);

        // Nothing to sample out here: glow, jet and disk all lie closer in.
        if (farField) continue;

        if (collect(prev, pos, uStep, udStep, glow, light, transmission)) {
          hitDisk = true;
          break;
        }
      }
      dir = rayDir(u, ud, s, sd);
    }

    // Finish the bending analytically: from the escape radius for marched
    // rays, from the camera for rays too far out to march.
    skyDir = lensTail(pos, dir);
  }

  Ray ray;
  ray.glow = glow;
  ray.light = light;
  ray.skyDir = skyDir;
  ray.sky = !hitDisk && !captured && (!stepped || escaped)
    ? transmission * pow(gSky * gCam, 4.0)
    : SKY_HIDDEN;
  return ray;
}

// A ray from a camera with no static frame: dark.
Ray darkRay(vec3 rd) {
  Ray ray;
  ray.glow = vec3(0.0);
  ray.light = vec3(0.0);
  ray.skyDir = rd;
  ray.sky = SKY_HIDDEN;
  return ray;
}

/* Composite: what the ray met, then the sky it reaches, turned into the scene. */
vec3 composite(Ray ray, vec2 pixel) {
  vec3 col = ray.glow + ray.light;
  if (ray.sky >= 0.0) col += ray.sky * starfield(sceneSky(ray.skyDir), pixel);
  return col;
}

#ifdef KERR_TRACE

// The trace pass (lib/trace-cache.ts): one ray per pixel marched, its record written as raw
// float bits into four RGBA32UI targets, exact to the bit:
//   0: glow (rgb), starlight weight (SKY_HIDDEN, or TRACE_OVERFLOW where the ray lit more
//      crossings than the record keeps)
//   1: sky direction (xyz), pixel footprint x      2: footprint y, first crossing
//   3: second crossing, unused
// The footprint is skyFootprint()'s, whose screen derivatives exist only here, where every
// pixel marches.

layout(location = 0) out highp uvec4 oTrace0;
layout(location = 1) out highp uvec4 oTrace1;
layout(location = 2) out highp uvec4 oTrace2;
layout(location = 3) out highp uvec4 oTrace3;

void main() {
  gCrossing0 = vec3(0.0);
  gCrossing1 = vec3(0.0);
  gCrossings = 0;
  RayStart start;
  Ray ray;
  if (launch(gl_FragCoord.xy, start)) ray = march(start);
  else ray = darkRay(start.rd);
  vec2 pixel = skyFootprint(ray.skyDir);
  float sky = gCrossings > TRACE_CROSSINGS ? TRACE_OVERFLOW : ray.sky;
  oTrace0 = floatBitsToUint(vec4(ray.glow, sky));
  oTrace1 = floatBitsToUint(vec4(ray.skyDir, pixel.x));
  oTrace2 = floatBitsToUint(vec4(pixel.y, gCrossing0));
  oTrace3 = floatBitsToUint(vec4(gCrossing1, 0.0));
}

// That is this pass's main(): the supersample include below adds none.
#define HORIZON_CUSTOM_MAIN

#else

#ifdef KERR_REPLAY
uniform float uReplay;            // 1: this frame shades the march recorded by the trace pass
uniform highp usampler2D uTrace0; // the record, as the KERR_TRACE main() above writes it
uniform highp usampler2D uTrace1;
uniform highp usampler2D uTrace2;
uniform highp usampler2D uTrace3;
#endif

// One ray through fragCoord (pixels), as radiance. The supersample include
// below supplies main(); extra rays it traces near edges pass derivatives = false,
// since screen derivatives are undefined there. With a recorded march to replay, the
// main ray re-evaluates only what moves with the clock and the azimuth, and marches again
// only where the record overflowed (with the recorded footprint).
vec3 shade(vec2 fragCoord, bool derivatives) {
  RayStart start;
  bool launched = launch(fragCoord, start);
  Ray ray;
  bool marching = true;
  bool recorded = false;
  vec2 pixel = vec2(skyPixel());
#ifdef KERR_REPLAY
  recorded = derivatives && uReplay > 0.5;
  if (recorded) {
    ivec2 texel = ivec2(fragCoord);
    vec4 head = uintBitsToFloat(texelFetch(uTrace0, texel, 0));
    vec4 sky = uintBitsToFloat(texelFetch(uTrace1, texel, 0));
    vec4 first = uintBitsToFloat(texelFetch(uTrace2, texel, 0));
    vec4 second = uintBitsToFloat(texelFetch(uTrace3, texel, 0));
    pixel = vec2(sky.w, first.x);
    marching = head.w == TRACE_OVERFLOW;
    if (!marching) {
      ray.glow = head.rgb;
      ray.skyDir = sky.xyz;
      ray.sky = head.w;
      ray.light = vec3(0.0);
      float transmission = 1.0;
      if (first.y > 0.0) meet(first.yzw, ray.light, transmission);
      if (second.x > 0.0) meet(second.xyz, ray.light, transmission);
    }
  }
#endif
  if (marching && launched) ray = march(start);
  else if (marching) ray = darkRay(start.rd);
  // In the main pass every pixel computes skyDir, so its screen derivatives,
  // and with them skyFootprint(), are defined; extra edge rays use one pixel.
  if (derivatives && !recorded) pixel = skyFootprint(ray.skyDir);
  return composite(ray, pixel);
}

#endif

// display() turns that radiance into the pixel's colour; supersample supplies main(), which
// draws either, as createFullscreenPass asks (a bloomed frame keeps the radiance).
#include "./display.glsl"
#include <horizon/supersample>
