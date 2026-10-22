/** Bakes the prominence's density volume off the main thread (`prominenceDensity`). */
import { serveWorkerTask } from "@horizon/toolkit/worker";

import { createProminenceDensity } from "./density";

serveWorkerTask(createProminenceDensity);
