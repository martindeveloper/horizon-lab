// Small oriented bounds for a 3D prominence density field, anchored to the rotating Sun.
#include <horizon/math>
#include "../shaders/parameters.generated.glsl"

uniform vec4 activityMotion[SUN_ACTIVITY_MAX_REGIONS]; // lift, fade, sway, drained length
uniform vec3 localCamera;
attribute vec3 aAnchor;
attribute vec3 aAlong;
attribute vec4 aShape; // height, half-length, cycle offset, region index
attribute vec2 aMirror;
varying vec3 vLocal;
varying vec3 vBox;
varying vec3 vCameraBox;
varying vec4 vMotion;
varying vec3 vShape; // lifted height, half-length, seed
varying vec2 vMirror;
varying vec2 vAcross; // the bound's depth over the sheet's, and the apex sway in sheet depths

void main() {
  // Cull bounds on the far side of the Sun, wholly behind the photosphere even when erupting.
  if (dot(aAnchor, localCamera) < -0.7 * length(localCamera)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 motion = activityMotion[int(aShape.w)];
  float lift = motion.x;
  float halfSpan = aShape.y;
  // The floor sinks under the photosphere so the sheet stays rooted where the surface curves away.
  float sink = halfSpan * halfSpan * SUN_ACTIVITY_SINK;
  float height = aShape.x * lift;
  float boxHeight = height + sink;
  // The sheet's own depth, widened as it erupts; the bound adds room for the sway.
  float sheetDepth = halfSpan * SUN_ACTIVITY_DEPTH_RATIO * (1.0 + SUN_ACTIVITY_LIFT_WIDENING * (lift - 1.0));
  float halfDepth = sheetDepth + abs(motion.z) * halfSpan;
  vec3 across = cross(aAlong, aAnchor);
  vec3 origin = aAnchor * (1.0 - sink);
  vec3 point = origin + aAlong * position.x * halfSpan + aAnchor * position.y * boxHeight
    + across * position.z * halfDepth;
  vec3 offset = localCamera - origin;
  vCameraBox = vec3(dot(offset, aAlong) / halfSpan, dot(offset, aAnchor) / boxHeight, dot(offset, across) / halfDepth);
  vBox = position;
  vLocal = point;
  vMotion = motion;
  vShape = vec3(height, halfSpan, aShape.z);
  vMirror = aMirror;
  vAcross = vec2(halfDepth / sheetDepth, motion.z * halfSpan / sheetDepth);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
}
