import { ambientMusic } from "@/components/shell/ambient-music";
import { loadAudioMap, type AudioMap } from "@horizon/toolkit/audio";

/**
 * The published audio maps, fetched once per track and kept for the session; a camera timed
 * to a track (`timeShots` in `@/lib/drift`) meets the music by the cues they hold. A track
 * without a map resolves null and the camera keeps the timing it was written with; a load that
 * fails resolves null too, and is tried again on the next ask.
 */
const loads = new Map<string, Promise<AudioMap | null>>();
const settled = new Map<string, AudioMap>();

const mapUrl = (title: string) => ambientMusic.tracks.find((t) => t.title === title)?.map;

/** The map of the playlist track titled `title`, fetched on first use. */
export function audioMapFor(title: string): Promise<AudioMap | null> {
  const url = mapUrl(title);
  if (!url) return Promise.resolve(null);
  let load = loads.get(url);
  if (!load) {
    load = loadAudioMap(url).then((map) => {
      if (map) settled.set(url, map);
      else loads.delete(url);
      return map;
    });
    loads.set(url, load);
  }
  return load;
}

/** The map of the track titled `title` if it has loaded (`audioMapFor`), without waiting. */
export function audioMapNow(title: string | undefined): AudioMap | null {
  const url = title === undefined ? undefined : mapUrl(title);
  return url === undefined ? null : (settled.get(url) ?? null);
}

/** Seeds the map of the track titled `title` as if it had loaded: a bench replays a fixture through it. */
export function provideAudioMap(title: string, map: AudioMap | null) {
  const url = mapUrl(title);
  if (!url) return;
  if (map) settled.set(url, map);
  else settled.delete(url);
}
