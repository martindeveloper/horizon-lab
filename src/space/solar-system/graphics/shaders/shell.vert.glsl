// Vertex shader for the Oort-cloud guide shells. Passes world position and
// normal for the Fresnel rim in shell.frag.glsl.

varying vec3 vNormal;
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * viewMatrix * world;
}
