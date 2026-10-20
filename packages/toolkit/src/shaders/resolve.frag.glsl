// Copies an offscreen frame (uImage, one pixel = uTexel) onto the canvas. The frame already
// holds display-ready bytes, encoded as the canvas would be. Used after a multisampled frame
// has been resolved.

uniform sampler2D uImage;
uniform vec2 uTexel;

void main() {
  gl_FragColor = vec4(texture2D(uImage, gl_FragCoord.xy * uTexel).rgb, 1.0);
}
