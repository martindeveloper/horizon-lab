// Copies an offscreen frame (uImage, one pixel = uTexel) onto the canvas, encoded
// for the renderer's output. Used after a multisampled frame has been resolved.

uniform sampler2D uImage;
uniform vec2 uTexel;

void main() {
  gl_FragColor = linearToOutputTexel(vec4(texture2D(uImage, gl_FragCoord.xy * uTexel).rgb, 1.0));
}
