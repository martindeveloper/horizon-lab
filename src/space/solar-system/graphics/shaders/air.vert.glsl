// Atmosphere shell vertex shader. The fragment marches in the shell's own space, where the
// shell is the unit sphere and the body a smaller sphere inside it, so it needs the camera
// and the Sun there: both come as uniforms, written each frame from the shell's world matrix
// in double precision (float32 world positions are coarser than a body tens of au out). The
// clip position comes from the camera-relative model-view matrix for the same reason.

varying vec3 vObject;

#include <horizon/log-depth>

void main() {
  vObject = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  logDepthVertex();
}
