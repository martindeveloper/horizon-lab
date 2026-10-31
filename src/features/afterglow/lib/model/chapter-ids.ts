/** The chapters the address names, in the Sun's order; safe for routes (no app imports). */
export const CHAPTER_DEFINITIONS = [
  { id: "young" },
  { id: "today" },
  { id: "oceans" },
  { id: "subgiant" },
  { id: "tip" },
  { id: "flash" },
  { id: "pulses" },
  { id: "nebula" },
  { id: "dwarf" },
] as const satisfies readonly { id: string }[];
export type ChapterId = (typeof CHAPTER_DEFINITIONS)[number]["id"];
export const CHAPTER_IDS = CHAPTER_DEFINITIONS.map(({ id }) => id);
export const DEFAULT_CHAPTER: ChapterId = "today";
