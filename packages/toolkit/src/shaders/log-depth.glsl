// Logarithmic depth, written as three.js writes it when the renderer was made with
// `logarithmicDepthBuffer`: it then defines USE_LOGARITHMIC_DEPTH_BUFFER for every program
// and sets logDepthBufFC = 2 / log2(far + 1), so a scene from a planet's surface to the edge
// of the universe keeps its depth order in one pass. Without the define both macros are
// empty and the shader is the one it was. The scenes' cameras are perspective, so the
// orthographic branch of three's own chunk is left out.
//
// A vertex shader calls logDepthVertex() once gl_Position is set; a fragment shader calls
// logDepthFragment() first thing in main (a discard before it leaves depth unwritten, as it
// should).
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
uniform float logDepthBufFC;
varying float vFragDepth;
#define logDepthVertex() vFragDepth = 1.0 + gl_Position.w
#define logDepthFragment() gl_FragDepth = log2(vFragDepth) * logDepthBufFC * 0.5
#else
#define logDepthVertex() {}
#define logDepthFragment() {}
#endif
