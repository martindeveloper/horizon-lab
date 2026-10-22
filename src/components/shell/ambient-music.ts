import { assetUrl } from "@/lib/assets";
import { AUDIO_ASSETS } from "@/lib/urls";
import { MusicPlayer } from "@horizon/toolkit/audio";

/** Playback levels: the everyday bed, and the lift a drift gives it (`useDriftMusic`). */
export const MUSIC_LEVEL = { ambient: 0.75, drift: 1 } as const;

/**
 * The site's ambient playlist. Session-scoped memory: a reload or language switch
 * keeps the music, a new visit starts silent. See docs/architecture.md to add a track.
 */
export const ambientMusic = new MusicPlayer(
  [
    {
      title: "Interstellar Drift",
      artist: "Horizon",
      sources: [
        { src: assetUrl(AUDIO_ASSETS.interstellarDrift.opus), type: 'audio/webm; codecs="opus"' },
        {
          src: assetUrl(AUDIO_ASSETS.interstellarDrift.aac),
          type: 'audio/mp4; codecs="mp4a.40.2"',
        },
      ],
      map: assetUrl(AUDIO_ASSETS.interstellarDrift.map),
    },
    {
      title: "Aeolian Static",
      artist: "Horizon",
      sources: [
        { src: assetUrl(AUDIO_ASSETS.aeolianStatic.opus), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl(AUDIO_ASSETS.aeolianStatic.aac), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
      map: assetUrl(AUDIO_ASSETS.aeolianStatic.map),
    },
    {
      title: "Drifting Probe",
      artist: "Horizon",
      sources: [
        { src: assetUrl(AUDIO_ASSETS.driftingProbe.opus), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl(AUDIO_ASSETS.driftingProbe.aac), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
      map: assetUrl(AUDIO_ASSETS.driftingProbe.map),
    },
    {
      title: "Low Drone Rises",
      artist: "Horizon",
      sources: [
        { src: assetUrl(AUDIO_ASSETS.lowDroneRises.opus), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl(AUDIO_ASSETS.lowDroneRises.aac), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
      map: assetUrl(AUDIO_ASSETS.lowDroneRises.map),
    },
    {
      title: "Vast Empty Space",
      artist: "Horizon",
      sources: [
        { src: assetUrl(AUDIO_ASSETS.vastEmptySpace.opus), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl(AUDIO_ASSETS.vastEmptySpace.aac), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
      map: assetUrl(AUDIO_ASSETS.vastEmptySpace.map),
    },
    {
      title: "The Star Rings",
      artist: "Horizon",
      sources: [
        { src: assetUrl(AUDIO_ASSETS.theStarRings.opus), type: 'audio/webm; codecs="opus"' },
        { src: assetUrl(AUDIO_ASSETS.theStarRings.aac), type: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
      map: assetUrl(AUDIO_ASSETS.theStarRings.map),
    },
  ],
  { storageKey: "music", level: MUSIC_LEVEL.ambient },
);
