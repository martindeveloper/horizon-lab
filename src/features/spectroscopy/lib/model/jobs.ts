import { mysteryAnswerSteps, type Mystery, type MysteryAnswer } from "./scenes";
import { synthesize, type Observation, type Spectrum } from "./spectrum";

/**
 * What the lab hands its worker (`synthesis.ts`): a spectrum, worked out at once, or a
 * mystery's answer, a spectrum at a time. Plain data both ways, and one pure function the
 * worker serves and the page runs where there is none.
 */
export type SpectrumRequest = { obs: Observation; from: number; to: number; samples: number };
export type SynthesisJob =
  | ({ kind: "spectrum" } & SpectrumRequest)
  | { kind: "mystery"; mystery: Mystery; resolution: number; airmass: number };
export type SynthesisResult = Spectrum | MysteryAnswer;

export const synthesisWork = (job: SynthesisJob) =>
  job.kind === "spectrum"
    ? synthesize(job.obs, job.from, job.to, job.samples)
    : mysteryAnswerSteps(job.mystery, job.resolution, job.airmass);
