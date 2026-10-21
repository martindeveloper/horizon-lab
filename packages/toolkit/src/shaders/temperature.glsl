/*
Adapted from Tanner Helland (2012), temperature-to-RGB approximation.
https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html
GLSL adaptation uses normalized RGB.

BSD 2-Clause License

Copyright (c) 2018, Tanner Helland
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

#include <horizon/srgb>

// Approximate colour of a black body from its temperature in kelvin, using
// the common piecewise fit to the Planckian locus (Tanner Helland's curve).
// Input is clamped to 1,000–40,000 K. This is a display mapping, not a
// spectral radiance calculation.

vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  vec3 c;

  // Red and green.
  if (t <= 66.0) {
    c.r = 1.0;
    c.g = clamp(0.390081578 * log(t) - 0.631841443, 0.0, 1.0);
  } else {
    float tt = max(t - 60.0, 0.01);
    c.r = clamp(1.292936186 * pow(tt, -0.1332047592), 0.0, 1.0); // 329.698727446 / 255
    c.g = clamp(1.129890861 * pow(tt, -0.0755148492), 0.0, 1.0); // 288.1221695283 / 255
  }

  // Blue.
  if (t >= 66.0) {
    c.b = 1.0;
  } else if (t <= 19.0) {
    c.b = 0.0;
  } else {
    c.b = clamp(0.543206789 * log(t - 10.0) - 1.19625389, 0.0, 1.0);
  }

  return c;
}

// The same colour in linear light: the curve above is encoded sRGB.
vec3 blackbodyLinear(float kelvin) {
  return decodeSrgb(blackbody(kelvin));
}

// How far along `blackbodyLut(size, minK, maxK)` from science/color.ts a temperature lies, 0–1
// (texel i at i / (size − 1)); `range` is (minK, maxK).
float blackbodyLutCoordinate(float kelvin, vec2 range) {
  return clamp(log(kelvin / range.x) / log(range.y / range.x), 0.0, 1.0);
}

// The texture coordinate that reads a temperature from that lookup: the share above on the
// texels' centres. `spec` is (minK, maxK, size).
float blackbodyLutTexel(float kelvin, vec3 spec) {
  return (blackbodyLutCoordinate(kelvin, spec.xy) * (spec.z - 1.0) + 0.5) / spec.z;
}

// Eddington's grey limb darkening, the brightness at μ over the disc's centre: (2 + 3μ) / 5.
float eddingtonLimb(float mu) {
  return 0.4 + 0.6 * mu;
}

// Planck's law in one band, up to a constant: 1 / (e^(hc/λkT) − 1), with `hcOverLambdaK`
// the band's hc/λk in kelvin (26,160 K at 550 nm). Divide two to compare surfaces.
float planckBand(float kelvin, float hcOverLambdaK) {
  return 1.0 / (exp(hcOverLambdaK / max(kelvin, 300.0)) - 1.0);
}

// The temperature seen at `mu` (the cosine between the surface normal and the sightline) on a
// star with a grey atmosphere (Eddington): we see down to optical depth μ, where
// T⁴ = ¾ T⁴ₑ (μ + ⅔), so the limb shows higher, cooler layers.
float greyAtmosphereKelvin(float effectiveKelvin, float mu) {
  return effectiveKelvin * pow(0.75 * (mu + 2.0 / 3.0), 0.25);
}
