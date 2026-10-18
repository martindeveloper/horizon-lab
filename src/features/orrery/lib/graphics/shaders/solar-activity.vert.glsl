// Small oriented bounds for a 3D prominence density field, anchored to the rotating Sun.
#include <horizon/math>
#include "./parameters.generated.glsl"

uniform float activityTime;
uniform vec4 activityMotion[SUN_ACTIVITY_REGION_COUNT];
uniform vec3 localCamera;
attribute vec3 aAnchor;
attribute vec3 aAlong;
attribute vec4 aShape; // height, half-span, cycle offset, region index
varying vec3 vLocal;
varying vec3 vBox;
varying vec3 vCameraBox;
varying float vPhase;
varying vec3 vMotion;
varying vec2 vBounds;
varying vec4 vWave;

void main() {
  vec4 motion = activityMotion[int(aShape.w)];
  float height = aShape.x * motion.x;
  vMotion = motion.yzw;
  // Two volume-preserving shears twist x/z. Include their maximum reach and both wave modes.
  float twist = abs(motion.w);
  vBounds = vec2(1.0 - twist * twist + twist, 1.0 + twist)
    + abs(motion.yz) + 2.0 * SUN_ACTIVITY_WAVE_AMPLITUDE;
  float halfSpan = aShape.y * vBounds.x;
  float halfDepth = aShape.y * SUN_ACTIVITY_DEPTH_RATIO * vBounds.y;
  vec3 across = cross(aAlong, aAnchor);
  // Sink roots beneath the photosphere: analytic clipping lets them emerge without a hard seam.
  vec3 origin = aAnchor * (1.0 - aShape.y * aShape.y * 0.3);
  vec3 point = origin + aAlong * position.x * halfSpan + aAnchor * position.y * height
    + across * position.z * halfDepth;
  vec3 offset = localCamera - origin;
  vCameraBox = vec3(dot(offset, aAlong) / halfSpan, dot(offset, aAnchor) / height, dot(offset, across) / halfDepth);
  vBox = position;
  vLocal = point;
  vPhase = aShape.z;
  // Evaluate temporal wave modes per vertex, never noise or trig inside the ray-march for bending.
  float phase = TWO_PI * (activityTime / SUN_ACTIVITY_CYCLE_SECONDS + aShape.z);
  vWave = SUN_ACTIVITY_WAVE_AMPLITUDE * vec4(sin(phase * 8.0), cos(phase * 8.0),
    sin(phase * 11.0 + 1.0), cos(phase * 11.0 + 1.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
}
