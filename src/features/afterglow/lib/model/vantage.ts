/**
 * Where the autoplay stands as the Sun grows: Earth while it is a home, Mars for the giant's
 * sweep through the inner planets, Europa on the horizontal branch when Jupiter's moons get
 * Earth's sunlight, Enceladus as the pulses shed the envelope, Pluto for the nebula and the fade.
 */
import type { ChapterId } from "./chapter-ids";
import type { WorldId } from "./worlds";

export const VANTAGE: Readonly<Record<ChapterId, WorldId>> = {
  young: "earth",
  today: "earth",
  oceans: "earth",
  subgiant: "earth",
  tip: "mars",
  flash: "europa",
  pulses: "enceladus",
  nebula: "pluto",
  dwarf: "pluto",
};
