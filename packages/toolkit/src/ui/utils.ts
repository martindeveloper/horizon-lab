import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: { ease: ["standard", "enter", "exit"] },
    classGroups: {
      duration: [{ duration: ["feedback", "control", "reveal", "scene"] }],
      animate: ["anim-rise", "anim-sheet", "anim-rail", "anim-fade"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
