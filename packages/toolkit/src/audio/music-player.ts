import { flag, storageCell, type StorageCell } from "../storage";

export type MusicState = "playing" | "paused";

export type MusicTrack = {
  title: string;
  artist?: string;
  /** In order of preference; the first the browser can play is used. */
  sources: readonly { src: string; type: string }[];
};

export type MusicPlayerOptions = {
  /** Seconds. Play eases in, pause eases out, the loop blends end into start. */
  fadeIn?: number;
  fadeOut?: number;
  crossfade?: number;
  /** Seconds. A skip blends into the next track this quickly. */
  skipFade?: number;
  /** Seconds before a blend that the next track starts to buffer. */
  prefetch?: number;
  /** sessionStorage key that remembers "on" across reloads; null disables it. */
  storageKey?: string | null;
};

/** `track` is the playlist index the deck holds, or -1 while it holds nothing. */
type Deck = { el: HTMLAudioElement; gain: GainNode; track: number };
type Timer = ReturnType<typeof setTimeout> | undefined;

const RESUME_EVENTS = ["pointerdown", "pointerup", "keydown", "touchend"] as const;

/** Equal-power gain curve, so a crossfade keeps constant loudness. */
export function equalPowerCurve(rising: boolean, steps = 64) {
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    curve[i] = rising ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2);
  }
  return curve;
}

/** Seconds until the next deck must start so its fade ends exactly at the track end. */
export function crossfadeDelay(duration: number, position: number, crossfade: number) {
  return Math.max(0, duration - position - crossfade);
}

/**
 * Background music: one track that loops, or a playlist that runs on and wraps.
 * Two streaming <audio> decks crossfade where a track ends, so there is no codec
 * gap; Web Audio gains do the fades (iOS ignores element volume). Only the
 * playing track loads; the next one buffers shortly before its blend or on a
 * skip. A hidden tab fades out and resumes on return. Constructing touches
 * nothing; the audio graph is built on the first play, which must come from a
 * user gesture.
 */
export class MusicPlayer {
  readonly tracks: readonly MusicTrack[];
  readonly fadeIn: number;
  readonly fadeOut: number;
  readonly crossfade: number;
  readonly skipFade: number;
  readonly prefetch: number;
  private readonly memory: StorageCell<boolean> | null;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private decks: Deck[] = [];
  private current = 0;
  private index = 0;
  private state: MusicState = "paused";
  /** True from the start of a blend until the decks settle. */
  private blending = false;
  /** Playing was asked for, but the audible deck is still waiting for data. */
  private buffering = false;
  private loopTimer: Timer;
  private prefetchTimer: Timer;
  private settleTimer: Timer;
  private stopTimer: Timer;
  private ignore: () => Element | null = () => null;
  private disarm = () => {};
  private readonly listeners = new Set<() => void>();

  constructor(tracks: MusicTrack | readonly MusicTrack[], options: MusicPlayerOptions = {}) {
    this.tracks = "sources" in tracks ? [tracks] : tracks;
    if (!this.tracks.length) throw new Error("MusicPlayer needs at least one track");
    this.fadeIn = options.fadeIn ?? 3;
    this.fadeOut = options.fadeOut ?? 1.5;
    this.crossfade = options.crossfade ?? 8;
    this.skipFade = options.skipFade ?? 2.5;
    this.prefetch = options.prefetch ?? 30;
    const storageKey = options.storageKey ?? null;
    this.memory = storageKey ? storageCell({ key: storageKey, codec: flag("on") }) : null;
  }

  /** The track playing, or next to play. */
  get track() {
    return this.tracks[this.index]!;
  }

  /* Arrow properties: stable references for React stores and event handlers. */

  getState = (): MusicState => this.state;

  /** Playlist index of `track`. */
  getTrack = (): number => this.index;

  /** Whether music is wanted but still loading: the first play, a skip, or a stall. */
  getBuffering = (): boolean => this.buffering;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** Call from a user gesture. Resolves false if the browser blocked playback. */
  play = async () => {
    this.remember(true);
    this.emit("playing");
    return this.start();
  };

  pause = () => {
    this.remember(false);
    this.disarm();
    this.emit("paused");
    this.fadeOutAndStop();
  };

  toggle = () => {
    if (this.state === "playing") this.pause();
    else void this.play();
  };

  /**
   * Move to the next track, wrapping at the end. Playing, it blends over in
   * `skipFade` seconds; paused, the next play starts there. A skip while the
   * incoming track is still starting is ignored.
   */
  next = () => {
    if (this.tracks.length < 2) return;
    if (this.state === "playing" && this.ctx) {
      if (this.blending && this.settleTimer === undefined) return;
      this.settle();
      this.blend(this.skipFade);
      return;
    }
    this.index = this.upcoming;
    const deck = this.decks[this.current];
    if (deck) this.load(deck, this.index);
    this.updateMetadata();
    this.notify();
  };

  /** Whether the music was on before this page loaded (same tab session). */
  get remembered() {
    return this.memory?.get() === true;
  }

  /**
   * Browsers only start audio after a gesture. If the music was remembered,
   * resume on the first interaction, except one inside `ignore()` (the
   * controls act themselves). Returns a cleanup.
   */
  resumeOnInteraction(ignore: () => Element | null = () => null) {
    this.ignore = ignore;
    this.armResume();
    return () => this.disarm();
  }

  /** Stop at once and release the audio graph and every listener. */
  dispose() {
    this.disarm();
    for (const timer of [this.loopTimer, this.prefetchTimer, this.settleTimer, this.stopTimer])
      clearTimeout(timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    if ("mediaSession" in navigator) {
      for (const action of ["play", "pause", "nexttrack"] as const)
        navigator.mediaSession.setActionHandler(action, null);
    }
    for (const deck of this.decks) {
      deck.el.pause();
      deck.el.removeAttribute("src");
      deck.el.load();
    }
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.decks = [];
    this.blending = false;
    this.buffering = false;
    this.emit("paused");
  }

  private get upcoming() {
    return (this.index + 1) % this.tracks.length;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private emit(next: MusicState) {
    this.state = next;
    if (next === "paused") this.buffering = false;
    if (typeof navigator !== "undefined" && "mediaSession" in navigator)
      navigator.mediaSession.playbackState = next;
    this.notify();
  }

  private setBuffering(on: boolean) {
    if (this.buffering === on) return;
    this.buffering = on;
    this.notify();
  }

  /** Mark buffering while the deck has no data to play through yet. */
  private awaitData(deck: Deck) {
    this.setBuffering(deck.el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
  }

  private remember(on: boolean) {
    if (!this.memory) return;
    if (on) this.memory.set(true);
    else this.memory.clear();
  }

  private pickSource(track: MusicTrack) {
    const probe = this.decks[0]?.el ?? document.createElement("audio");
    const sources = track.sources;
    return (
      sources.find((source) => probe.canPlayType(source.type) === "probably") ??
      sources.find((source) => probe.canPlayType(source.type) !== "") ??
      sources.at(-1)!
    ).src;
  }

  /** Point a deck at a track and let it buffer; a deck already holding it keeps its data. */
  private load(deck: Deck, track: number) {
    if (deck.track === track) return;
    deck.track = track;
    deck.el.preload = "auto";
    deck.el.src = this.pickSource(this.tracks[track]!);
  }

  private setup() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // Decks start empty: nothing downloads until a track is assigned.
    this.decks = [0, 1].map((index) => {
      const el = new Audio();
      el.preload = "none";
      const gain = ctx.createGain();
      gain.gain.value = index === 0 ? 1 : 0;
      ctx.createMediaElementSource(el).connect(gain).connect(master);
      // A throttled timer must not leave silence: an ended current deck hands over at once.
      el.addEventListener("ended", () => {
        if (this.decks[this.current]?.el === el && this.state === "playing") this.blend();
      });
      // Only the audible deck speaks for loading: a stall shows, a resumed stream clears it.
      const audible = () => this.decks[this.current]?.el === el;
      el.addEventListener("waiting", () => {
        if (audible() && this.state === "playing") this.setBuffering(true);
      });
      el.addEventListener("playing", () => {
        if (audible()) this.setBuffering(false);
      });
      return { el, gain, track: -1 };
    });
    this.current = 0;
    this.load(this.decks[0]!, this.index);
    this.ctx = ctx;
    this.master = master;

    document.addEventListener("visibilitychange", this.onVisibility);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => void this.play());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
      navigator.mediaSession.setActionHandler(
        "nexttrack",
        this.tracks.length > 1 ? () => this.next() : null,
      );
    }
    this.updateMetadata();
    return ctx;
  }

  private updateMetadata() {
    if (!this.ctx || !("mediaSession" in navigator)) return;
    const { title, artist } = this.track;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      ...(artist !== undefined ? { artist } : {}),
    });
  }

  // A hidden tab fades out and returns where it left off; the choice stays "playing".
  private onVisibility = () => {
    if (this.state !== "playing") return;
    if (document.hidden) this.fadeOutAndStop();
    else void this.start();
  };

  private async start() {
    const ctx = this.setup();
    clearTimeout(this.stopTimer);
    const deck = this.decks[this.current]!;
    this.awaitData(deck);
    try {
      // Both calls start inside the gesture; awaiting the first would lose it on iOS.
      const resumed = ctx.resume();
      const playing = deck.el.play();
      await Promise.all([resumed, playing]);
    } catch {
      this.emit("paused"); // Autoplay policy: wait for the next interaction.
      this.armResume();
      return false;
    }
    const gain = this.master!.gain;
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setValueAtTime(gain.value, ctx.currentTime);
    gain.setTargetAtTime(1, ctx.currentTime, this.fadeIn / 4);
    this.setBuffering(false);
    this.scheduleLoop();
    return true;
  }

  private fadeOutAndStop() {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    clearTimeout(this.loopTimer);
    clearTimeout(this.prefetchTimer);
    this.settle();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, this.fadeOut / 4);
    clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(
      () => {
        for (const deck of this.decks) deck.el.pause();
        void this.ctx?.suspend();
      },
      this.fadeOut * 1000 + 250,
    );
  }

  /** Time the blend at the end of the current track, and buffer the next one a little before. */
  private scheduleLoop = () => {
    clearTimeout(this.loopTimer);
    clearTimeout(this.prefetchTimer);
    const el = this.decks[this.current]?.el;
    if (!el || this.state !== "playing") return;
    if (!Number.isFinite(el.duration)) {
      el.addEventListener("loadedmetadata", this.scheduleLoop, { once: true });
      return;
    }
    const wait = crossfadeDelay(el.duration, el.currentTime, this.crossfade);
    this.loopTimer = setTimeout(() => this.blend(), wait * 1000);
    this.prefetchTimer = setTimeout(
      () => {
        const idle = this.decks[1 - this.current];
        if (idle && !this.blending) this.load(idle, this.upcoming);
      },
      Math.max(0, wait - this.prefetch) * 1000,
    );
  };

  /**
   * Start the next track on the idle deck from the top and crossfade into it.
   * The fade waits until the incoming deck actually plays, so a track still
   * buffering never blends in from silence.
   */
  private blend(fade = this.crossfade) {
    const ctx = this.ctx;
    if (!ctx || this.blending) return;
    this.blending = true;
    clearTimeout(this.loopTimer);
    clearTimeout(this.prefetchTimer);
    const out = this.decks[this.current]!;
    const into = this.decks[1 - this.current]!;
    this.load(into, this.upcoming);
    into.gain.gain.cancelScheduledValues(ctx.currentTime);
    into.gain.gain.setValueAtTime(0, ctx.currentTime);
    into.el.currentTime = 0;
    this.current = 1 - this.current;
    this.index = into.track;
    this.updateMetadata();
    this.awaitData(into);
    this.notify();

    const begin = () => {
      if (!this.blending || this.decks[this.current] !== into || this.state !== "playing") return;
      this.setBuffering(false);
      for (const [deck, rising] of [
        [out, false],
        [into, true],
      ] as const) {
        deck.gain.gain.cancelScheduledValues(ctx.currentTime);
        deck.gain.gain.setValueCurveAtTime(equalPowerCurve(rising), ctx.currentTime, fade);
      }
      this.settleTimer = setTimeout(() => this.settle(), fade * 1000 + 100);
      this.scheduleLoop();
    };
    void into.el.play().then(begin, begin);
  }

  /** Finish any crossfade now: the current deck carries on alone. */
  private settle() {
    clearTimeout(this.settleTimer);
    this.settleTimer = undefined;
    this.blending = false;
    const ctx = this.ctx;
    if (!ctx) return;
    this.decks.forEach((deck, index) => {
      deck.gain.gain.cancelScheduledValues(ctx.currentTime);
      deck.gain.gain.setValueAtTime(index === this.current ? 1 : 0, ctx.currentTime);
      if (index !== this.current) {
        deck.el.pause();
        deck.el.currentTime = 0;
      }
    });
  }

  private armResume() {
    this.disarm();
    if (!this.remembered || this.state === "playing") return;
    const handle = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && this.ignore()?.contains(target)) return this.disarm();
      if (!userIsActive()) return;
      this.disarm();
      void this.play();
    };
    for (const type of RESUME_EVENTS) window.addEventListener(type, handle, true);
    this.disarm = () => {
      for (const type of RESUME_EVENTS) window.removeEventListener(type, handle, true);
      this.disarm = () => {};
    };
  }
}

/** A gesture counts once the browser marks this tab as user-activated. Missing API means it does. */
function userIsActive() {
  const activation: unknown = "userActivation" in navigator ? navigator.userActivation : undefined;
  if (typeof activation !== "object" || activation === null || !("isActive" in activation))
    return true;
  return activation.isActive !== false;
}
