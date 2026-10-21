/** What the Galaxy's and the nearest stars' layers are built with: the host's basics, their looks and the world's level of detail. */
import type { SceneKit } from "@horizon/toolkit/scene";

import type { GalaxyLooks } from "../graphics/looks";
import type { Lod } from "./lod";

export type GalaxyKit = SceneKit<GalaxyLooks, Lod>;
