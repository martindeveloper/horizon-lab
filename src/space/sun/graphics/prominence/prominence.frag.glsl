// Integrate only inside each small prominence bound. No full-screen pass.
#include <horizon/math>
#include <horizon/noise>
#include "../shaders/parameters.generated.glsl"

precision highp sampler3D;
uniform sampler3D densityMap;
uniform vec3 localCamera;
uniform int activitySteps;
// A band's own colour for the emission (rgb, at its brightness) and how much it replaces Hα's
// red; zero, as an unset uniform is, keeps the red.
uniform vec4 emissionHue;
varying vec3 vLocal;
varying vec3 vBox;
varying vec3 vCameraBox;
varying vec4 vMotion;
varying vec3 vShape;
varying vec2 vMirror;
varying vec2 vAcross;

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

  // Against the disc a prominence is a dark Hα filament; past the grazing limb it emits.
  float muDisc = sqrt(max(0.0, 1.0 - impact * impact));
  float discMask = onDisc * smoothstep(0.1, 0.3, muDisc);

  float span = end - begin;
  int steps = clamp(int(float(activitySteps) * clamp(span * 6.0, 0.4, 1.0)), 16, activitySteps);
  float stepLength = span / float(steps);
  vec3 stepBox = boxRay * stepLength;
  // Static sub-step dither (interleaved gradient noise: even-grained, no temporal flicker)
  // removes visible slice bands.
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  // A filament never blacks out the disc: Hα filaments are at most about half as bright as it.
  float alphaLimit = mix(0.96, 0.55, discMask);
  float t = begin + stepLength * jitter;
  vec3 sampleBox = vCameraBox + boxRay * t;
  float fade = vMotion.y;
  float drained = vMotion.w;
  float seed = vShape.z * 37.0;
  vec3 light = vec3(0.0);
  float alpha = 0.0;
  for (int i = 0; i < SUN_ACTIVITY_MAX_STEPS; i++) {
    if (i >= steps || alpha > alphaLimit) break;
    // Height above the photosphere, so the sheet stands on the curving surface, not a flat floor.
    vec3 point = localCamera + ray * t;
    float r = length(point);
    float y = (r - 1.0) / vShape.x;
    if (y > 0.0 && y < 1.0 && abs(sampleBox.x) < 1.0) {
      // The kink sway displaces the apex and nothing at the roots.
      float z = sampleBox.z * vAcross.x - vAcross.y * smoothstep(0.0, 0.7, y);
      if (abs(z) < 1.0) {
        vec3 uvw = vec3(sampleBox.x * vMirror.x * 0.5 + 0.5, y, z * vMirror.y * 0.5 + 0.5);
        float density = texture(densityMap, uvw).r;
        // Skip the flow and colour math across the empty space inside the bound.
        if (density > 0.004) {
          // Fine threads: streaks drain down the hedgerow and counter-stream along its sides.
          float along = clamp(z * 3.0, -1.0, 1.0) * drained * SUN_ACTIVITY_STREAM_RATIO * 55.0 / vShape.y;
          float wave = 1.2 * sin(y * 9.0 + uvw.z * 5.0 + seed);
          vec2 streak = vec2(uvw.x * 110.0 + seed + along + wave, (y * vShape.x - drained) * 70.0);
          // Patches of the hedgerow are denser than others; its fine threads ride on them.
          float clump = value2(vec2(uvw.x * 9.0 + seed, y * 4.0 - drained * 6.0));
          density *= (0.7 + 0.5 * clump) * (0.55 + 0.7 * value2(streak));
          // An erupting body thins as it rises, its top first; a re-forming one condenses.
          density *= fade * (1.0 - 0.6 * (1.0 - fade) * y);
          float opacity = 1.0 - exp(-density * stepLength * SUN_ACTIVITY_EXTINCTION);
          // Photospheric light thins with height: the dilution factor W(r) = ½(1 − √(1 − 1/r²)).
          float dilution = 1.0 - sqrt(max(0.0, 1.0 - 1.0 / (r * r)));
          float shine = mix(0.55, 1.0, dilution) * (1.0 + 0.25 * (1.0 - smoothstep(0.0, 0.3, y)));
          float knot = smoothstep(0.3, 0.85, density);
          vec3 emission = mix(SUN_ACTIVITY_THREAD_RGB, SUN_ACTIVITY_KNOT_RGB, knot) * shine;
          vec3 luma = vec3(0.2126, 0.7152, 0.0722);
          emission = mix(emission, emissionHue.rgb * dot(emission, luma) / max(dot(emissionHue.rgb, luma), 1e-3), emissionHue.a);
          // Against the disc the thin sheet reads as a soft dark ribbon, its barbs fainter.
          float ribbon = smoothstep(0.06, 0.45, density);
          emission = mix(emission, SUN_ACTIVITY_FILAMENT_RGB, discMask);
          opacity *= mix(1.0, 0.5 * ribbon, discMask);
          opacity = min(opacity, alphaLimit - alpha);
          light += (1.0 - alpha) * opacity * emission;
          alpha += (1.0 - alpha) * opacity;
        }
      }
    }
    t += stepLength;
    sampleBox += stepBox;
  }
  if (alpha < 0.002) discard;
  gl_FragColor = linearToOutputTexel(vec4(light / max(alpha, 0.001), alpha));
}
