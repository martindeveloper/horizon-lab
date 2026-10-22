/** Bakes the prominence's density volume off the main thread (`solarActivityDensity`). */
import { serveWorkerTask } from "@horizon/toolkit/worker";

import { createSolarActivityDensity } from "./solar-activity-density";

serveWorkerTask(createSolarActivityDensity);
