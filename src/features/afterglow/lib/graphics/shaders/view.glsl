// The wide view: a pixel's direction from the camera's axes and its field of view. The sky
// pass draws in it; the vertex shader is the toolkit's full-screen quad (vUv). The Sun's globe
// is drawn by its own camera, which puts the Sun at the same place on the screen, magnified.
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
// tan of half the field of view, across and up.
uniform vec2 uTan;

vec3 viewDirection(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  return normalize(uForward + c.x * uTan.x * uRight + c.y * uTan.y * uUp);
}
