// A flat line in one colour, behind the globes it passes.

uniform vec3 color;
uniform float opacity;

#include <horizon/log-depth>

void main() {
  logDepthFragment();
  gl_FragColor = linearToOutputTexel(vec4(color, opacity));
}
