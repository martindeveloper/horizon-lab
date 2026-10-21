/**
 * How the weather of the star the camera rests on comes and goes (`hand-over.ts`): it wakes
 * slowly once the camera is landing on its star and quietens more quickly when the camera
 * leaves. One star's weather shows at a time, and a star the camera only passes through never
 * wakes.
 */
import { WEATHER_FADE_IN_S, WEATHER_FADE_OUT_S } from "../parameters";
import { eased, handOver } from "./hand-over";

/** Whose weather shows (a rung, or −1 for none) and how far it has come in, 0–1. */
export type WeatherFade = { star: number; level: number };

export const NO_WEATHER: WeatherFade = { star: -1, level: 0 };

/** The fade `dt` seconds on, with `wanted` the star whose weather should show (−1: none). */
export function fadeWeather(fade: WeatherFade, wanted: number, dt: number): WeatherFade {
  const next = handOver(
    { owner: fade.star, level: fade.level },
    wanted,
    dt,
    WEATHER_FADE_IN_S,
    WEATHER_FADE_OUT_S,
  );
  return { star: next.owner, level: next.level };
}

/** How much of the weather shows at a level: eased at both ends. */
export const weatherShown = eased;
