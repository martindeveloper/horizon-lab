// Integrate only inside each small prominence volume. No full-screen pass or procedural noise loop.
#include <horizon/math>
#include "./parameters.generated.glsl"

precision highp sampler3D;
uniform sampler3D densityMap;
uniform float activityTime;
uniform vec3 localCamera;
uniform int activitySteps;
varying vec3 vLocal;
varying vec3 vBox;
varying vec3 vCameraBox;
varying float vPhase;
varying vec3 vMotion;
varying vec2 vBounds;
varying vec4 vWave;

void main() {
  vec3 toPoint = vLocal - localCamera;
  float distance = length(toPoint);
  vec3 ray = toPoint / distance;
  vec3 boxRay = (vBox - vCameraBox) / distance;
  // Slab intersection in box space, with t measured in solar radii for stable optical depth.
  vec3 inverseRay = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), boxRay)) / max(abs(boxRay), vec3(0.00001));
  vec3 first = (vec3(-1.0, 0.0, -1.0) - vCameraBox) * inverseRay;
  vec3 last = (vec3(1.0) - vCameraBox) * inverseRay;
  vec3 near = min(first, last);
  vec3 far = max(first, last);
  float begin = max(0.0, max(near.x, max(near.y, near.z)));
  float end = min(far.x, min(far.y, far.z));

  // Stop at the opaque photosphere, including when a bound straddles the visible limb.
  float b = dot(localCamera, ray);
  float discriminant = b * b - dot(localCamera, localCamera) + 1.0;
  float impact = length(cross(localCamera, ray));
  float limbAA = max(fwidth(impact), 0.001);
  float onDisc = 1.0 - smoothstep(1.0 - limbAA, 1.0 + limbAA, impact);
  if (discriminant >= 0.0) end = min(end, -b - sqrt(discriminant));
  if (end <= begin) discard;

  float muDisc = sqrt(max(0.0, 1.0 - impact * impact));
  // Near the extreme limb (μ < 0.36), chromospheric/prominence emission outshines the
  // limb-darkened photosphere; deeper on the disc, the cool dense spine absorbs upward light.
  float discMask = onDisc * smoothstep(0.12, 0.36, muDisc);

  float span = end - begin;
  int steps = clamp(int(float(activitySteps) * clamp(span * 4.5, 0.25, 1.0)), 6, activitySteps);
  float stepLength = span / float(steps);
  vec3 stepBox = boxRay * stepLength;
  // Static sub-step dither removes visible slice bands without flickering temporal noise.
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 sampleBox = vCameraBox + boxRay * (begin + stepLength * jitter);
  float flowCycles = activityTime * 2.0 / SUN_ACTIVITY_CYCLE_SECONDS + vPhase;
  vec3 light = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < SUN_ACTIVITY_MAX_STEPS; i++) {
    if (i >= steps || alpha > 0.96) break;
    // Inverse deformation follows the density rather than sliding a texture over a rigid arch.
    // Every displacement vanishes at y=0: both footpoints stay attached to the photosphere.
    vec3 q = sampleBox * vec3(vBounds.x, 1.0, vBounds.y);
    float root = smoothstep(0.0, 0.85, q.y);
    float wave = 4.0 * q.y * (1.0 - q.y);
    q.xz -= vMotion.xy * root + wave * (vWave.xy + vWave.zw * (2.0 * q.y - 1.0));
    float twist = vMotion.z * root;
    q.x -= twist * q.z;
    q.z += twist * q.x;
    // Skip 3D texture fetch when the un-sheared sample lies in the expanded proxy margin.
    if (max(abs(q.x), abs(q.z)) < 0.96) {
      vec3 uvw = q * vec3(0.5, 1.0, 0.5) + vec3(0.5, 0.0, 0.5);
      float density = texture(densityMap, uvw).r;
      // Skip flow and colour math across the ~88% empty space inside the bounding box.
      if (density > 0.004) {
        // Coronal-rain condensations drain down both legs toward y=0 while counter-streaming along the spine.
        float rain = abs(fract(abs(uvw.x - 0.5) * 2.2 - uvw.y * 1.1 + uvw.z * 0.4 - flowCycles) * 2.0 - 1.0);
        float stream = abs(fract(uvw.x * 1.6 + uvw.y * 0.5 - uvw.z * 0.6 + flowCycles * 0.5) * 2.0 - 1.0);
        float packet = 0.6 * rain * rain + 0.4 * stream * stream;
        density *= 0.68 + 0.72 * packet;
        float opacity = 1.0 - exp(-density * stepLength * SUN_ACTIVITY_EXTINCTION);
        // Radial illumination from the underlying photosphere brightens the lower arch and dense core.
        float illumination = 1.35 - 0.45 * clamp(uvw.y, 0.0, 1.0);
        float core = smoothstep(0.1, 0.7, density * illumination);
        vec3 offLimb = mix(SUN_ACTIVITY_CRIMSON_RGB, SUN_ACTIVITY_PINK_RGB, core) * (0.85 + 0.35 * illumination);
        // Prominences absorb against the inner disc as slender dark Hα filaments; off-limb and at the grazing limb they emit.
        float spine = smoothstep(0.12, 0.56, density);
        vec3 emission = mix(offLimb, SUN_ACTIVITY_FILAMENT_RGB, discMask);
        opacity *= mix(1.0, 0.42 * spine, discMask);
        light += (1.0 - alpha) * opacity * emission;
        alpha += (1.0 - alpha) * opacity;
      }
    }
    sampleBox += stepBox;
  }
  if (alpha < 0.002) discard;
  gl_FragColor = linearToOutputTexel(vec4(light / max(alpha, 0.001), alpha));
}
