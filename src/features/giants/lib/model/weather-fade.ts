/**
 * How the weather of the star the camera rests on comes and goes, without the DOM: in time,
 * not with the camera's distance, so a fast flight never cuts it off or flashes it on. It wakes
 * slowly once the camera is landing on its star and quietens more quickly when the camera
 * leaves. One star's weather shows at a time: the next star's waits until the last one's has
 * faded, and a star the camera only passes through never wakes.
 */
import { WEATHER_FADE_IN_S, WEATHER_FADE_OUT_S } from "../parameters";

/** Whose weather shows (a rung, or −1 for none) and how far it has come in, 0–1. */
export type WeatherFade = { star: number; level: number };

export const NO_WEATHER: WeatherFade = { star: -1, level: 0 };

/** The fade `dt` seconds on, with `wanted` the star whose weather should show (−1: none). */
export function fadeWeather(fade: WeatherFade, wanted: number, dt: number): WeatherFade {
  if (fade.star !== wanted) {
    const level = Math.max(0, fade.level - dt / WEATHER_FADE_OUT_S);
    return level > 0 ? { star: fade.star, level } : { star: wanted, level: 0 };
  }
  if (wanted < 0) return NO_WEATHER;
  return { star: wanted, level: Math.min(1, fade.level + dt / WEATHER_FADE_IN_S) };
}

/** How much of the weather shows at a level: eased at both ends. */
export function weatherShown(level: number) {
  const t = Math.min(1, Math.max(0, level));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
