// Full-screen quad: the plane's corners map straight to clip space, so the
// fragment shader covers every pixel. Passes the texture coordinate.

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
