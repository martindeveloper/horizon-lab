/**
 * The observatory's grade. The scene's radiance is linear light; display.glsl tone maps it and
 * then encodes it for the screen. These two numbers keep the look the disk was graded with:
 * the gain takes the exposure setting to the tone map's, and the contrast (a power on the tone
 * map's linear output) restores the depth of the shadows, so mid-tones and highlights match
 * the earlier grade within a few per cent in the bench's preset views.
 */
export const TONE_EXPOSURE = 0.72;
export const DISPLAY_CONTRAST = 1.4;

/** The tone map's exposure for the observatory's exposure setting. */
export const toneExposure = (exposure: number) => exposure * TONE_EXPOSURE;
