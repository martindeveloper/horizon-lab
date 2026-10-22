/** Resolve the views' framing references only inside the simulation. */
import { COSMIC_VIEW_LY } from "@/space/cosmos/model/cosmos";
import type { Realm } from "@/space/galaxy/show";
import { solarViewById } from "@/space/solar-system/model/views";
import { recordBy } from "@horizon/toolkit/records";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { VIEW_DEFINITIONS, type ViewId } from "./view-definitions";
export type { Realm } from "@/space/galaxy/show";

type View = { id: ViewId; realm: Realm; ly: number; azimuth?: number; inclination?: number };
export const VIEWS: readonly View[] = VIEW_DEFINITIONS.map(
  ({ id, realm, framing, azimuth, inclination }) => {
    const angles = {
      ...(azimuth === undefined ? {} : { azimuth }),
      ...(inclination === undefined ? {} : { inclination }),
    };
    if ("solar" in framing) {
      const {
        dist,
        azimuth: solarAzimuth,
        inclination: solarInclination,
      } = solarViewById(framing.solar);
      return {
        id,
        realm,
        ly: dist / LIGHT_YEAR_AU,
        ...(solarAzimuth === undefined ? {} : { azimuth: solarAzimuth }),
        ...(solarInclination === undefined ? {} : { inclination: solarInclination }),
        ...angles,
      };
    }
    const ly =
      "cosmic" in framing
        ? COSMIC_VIEW_LY[framing.cosmic]
        : "au" in framing
          ? framing.au / LIGHT_YEAR_AU
          : framing.ly;
    return { id, realm, ly, ...angles };
  },
);

export function viewById(id: ViewId): View {
  const view = VIEWS.find((v) => v.id === id);
  if (!view) throw new Error(`Unknown view "${id}"`);
  return view;
}
export const worldDistance = (ly: number) => ly * LIGHT_YEAR_AU;
export const METHOD_OF = recordBy(
  VIEW_DEFINITIONS,
  ({ id }) => id,
  ({ method }) => method,
);
