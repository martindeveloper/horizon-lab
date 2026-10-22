// What a full-screen pass's shader writes for a pixel's radiance. createFullscreenPass sets
// uHdrOutput: 1 while it finishes the frame itself (bloom or the lens on half-float targets),
// and the shader then writes its radiance; 0 otherwise, and the shader writes
// display(radiance, fragCoord), which the including shader defines before this include.

uniform float uHdrOutput;

vec3 passOutput(vec3 radiance, vec2 fragCoord) {
  return uHdrOutput > 0.5 ? radiance : display(radiance, fragCoord);
}
