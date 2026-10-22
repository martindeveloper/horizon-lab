import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      ease: ["standard", "enter", "exit"],
      text: ["micro", "caption", "ui", "detail", "body", "panel", "section", "feature"],
      tracking: ["label", "instrument"],
      radius: ["detail", "compact", "control", "panel", "card", "overlay"],
      shadow: ["low", "panel", "overlay"],
      spacing: [
        "icon-micro",
        "icon-compact",
        "icon-control",
        "icon-feature",
        "icon-feature-large",
        "panel-compact",
        "panel",
        "panel-roomy",
        "panel-wide",
        "panel-row",
        "section",
        "section-roomy",
      ],
    },
    classGroups: {
      "stroke-w": ["stroke-icon-standard", "stroke-icon-emphasis", "stroke-icon-marker"],
      "ring-w": ["ring-outline", "ring-focus"],
      duration: [{ duration: ["feedback", "control", "reveal", "scene"] }],
      animate: ["anim-rise", "anim-sheet", "anim-rail", "anim-fade"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
