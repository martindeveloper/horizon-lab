/** Paints the Milky Way's maps and grains off the main thread (`paintSky`, for `createMilkyWay`). */
import { serveWorkerTask } from "@horizon/toolkit/worker";

import { paintSky } from "./band";

serveWorkerTask(paintSky);
