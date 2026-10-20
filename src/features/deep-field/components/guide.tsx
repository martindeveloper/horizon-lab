import { GuideCaption } from "@/components/simulations/guide-caption";
import type { DockInTheWay } from "@/components/simulations/use-dock-clearance";

import { TOUR, TOUR_DWELL } from "../lib/model/tour";
import { useDeepField } from "../lib/store";

/** A caption beside the scene (a phone held sideways) leaves the names below it alone. */
const acrossTheMiddle: DockInTheWay = (caption, stage) => {
  const middle = stage.left + stage.width / 2;
  return caption.left < middle && caption.right > middle;
};

/* The scene's names keep above the caption, as they do above the sightline. */
const clearance = { inTheWay: acrossTheMiddle, property: "--caption-clear" };

/**
 * The journey's caption, on the shared guide caption above the sightline: where we are, one or
 * two lines on what to notice, and the hold before the journey moves on.
 */
export function DeepFieldGuide() {
  const index = useDeepField((s) => s.guideStep);
  const playing = useDeepField((s) => s.guidePlaying);
  const landed = useDeepField((s) => s.guideLanded);
  return (
    <GuideCaption
      namespace="deepField"
      getState={useDeepField.getState}
      tour={TOUR}
      dwell={TOUR_DWELL}
      index={index}
      playing={playing}
      landed={landed}
      hold="deep-field-dwell"
      className="bottom-(--hud-clear,6rem) pb-2"
      clearance={clearance}
    />
  );
}
