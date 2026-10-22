/**
 * The lab's worker (`synthesis.ts`): spectra, and mysteries' answers a spectrum at a time
 * between them. Its stars' and slabs' lattices stay here between requests (`spectrum.ts`).
 */
import { serveWorkerTask } from "@horizon/toolkit/worker";

import { synthesisWork } from "./model/jobs";

serveWorkerTask(synthesisWork);
