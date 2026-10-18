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

  float stepLength = (end - begin) / float(activitySteps);
  vec3 stepBox = boxRay * stepLength;
  // Static sub-step dither removes visible slice bands without flickering temporal noise.
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 sampleBox = vCameraBox + boxRay * (begin + stepLength * jitter);
  float flowPhase = TWO_PI * (activityTime * 6.0 / SUN_ACTIVITY_CYCLE_SECONDS + vPhase);
  vec3 light = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < SUN_ACTIVITY_MAX_STEPS; i++) {
    if (i >= activitySteps || alpha > 0.98) break;
    // Inverse deformation follows the density rather than sliding a texture over a rigid arch.
    // Every displacement vanishes at y=0: both footpoints stay attached to the photosphere.
    vec3 q = sampleBox * vec3(vBounds.x, 1.0, vBounds.y);
    float root = smoothstep(0.0, 0.8, q.y);
    float wave = 4.0 * q.y * (1.0 - q.y);
    q.xz -= vMotion.xy * root + wave * (vWave.xy + vWave.zw * (2.0 * q.y - 1.0));
    float twist = vMotion.z * root;
    q.x -= twist * q.z;
    q.z += twist * q.x;
    vec3 uvw = q * vec3(0.5, 1.0, 0.5) + vec3(0.5, 0.0, 0.5);
    float density = texture(densityMap, uvw).r;
    // Bright clumps travel along the threads, including during the descent. No whole-loop fade.
    float packet = 0.5 + 0.5 * sin(TWO_PI * uvw.x * 3.0 - flowPhase);
    packet *= packet;
    density *= 0.65 + 0.85 * packet * packet;
    float opacity = 1.0 - exp(-density * stepLength * SUN_ACTIVITY_EXTINCTION);
    vec3 emission = mix(SUN_ACTIVITY_CRIMSON_RGB, SUN_ACTIVITY_PINK_RGB, density);
    // Prominences absorb against the disc; the illustrative emission is visible off-limb.
    emission = mix(emission, SUN_ACTIVITY_FILAMENT_RGB, onDisc);
    opacity *= mix(1.0, 0.18, onDisc);
    light += (1.0 - alpha) * opacity * emission;
    alpha += (1.0 - alpha) * opacity;
    sampleBox += stepBox;
  }
  if (alpha < 0.002) discard;
  gl_FragColor = linearToOutputTexel(vec4(light / max(alpha, 0.001), alpha));
}
