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
  /** sessionStorage key that remembers "on" across reloads; null disables it. */
  storageKey?: string | null;
};

type Deck = { el: HTMLAudioElement; gain: GainNode };
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
 * A looping background track. Two streaming <audio> decks crossfade where the
 * track repeats, so the loop has no codec gap; Web Audio gains do the fades
 * (iOS ignores element volume). A hidden tab fades out and resumes on return.
 * Constructing touches nothing; the audio graph is built on the first play,
 * which must come from a user gesture.
 */
export class MusicPlayer {
  readonly fadeIn: number;
  readonly fadeOut: number;
  readonly crossfade: number;
  private readonly memory: StorageCell<boolean> | null;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private decks: Deck[] = [];
  private current = 0;
  private state: MusicState = "paused";
  private loopTimer: Timer;
  private settleTimer: Timer;
  private stopTimer: Timer;
  private ignore: () => Element | null = () => null;
  private disarm = () => {};
  private readonly listeners = new Set<() => void>();

  constructor(
    readonly track: MusicTrack,
    options: MusicPlayerOptions = {},
  ) {
    this.fadeIn = options.fadeIn ?? 3;
    this.fadeOut = options.fadeOut ?? 1.5;
    this.crossfade = options.crossfade ?? 8;
    const storageKey = options.storageKey ?? null;
    this.memory = storageKey ? storageCell({ key: storageKey, codec: flag("on") }) : null;
  }

  /* Arrow properties: stable references for React stores and event handlers. */

  getState = (): MusicState => this.state;

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

  /** Whether the music was on before this page loaded (same tab session). */
  get remembered() {
    return this.memory?.get() === true;
  }

  /**
   * Browsers only start audio after a gesture. If the music was remembered,
   * resume on the first interaction, except one inside `ignore()` (the toggle
   * acts itself). Returns a cleanup.
   */
  resumeOnInteraction(ignore: () => Element | null = () => null) {
    this.ignore = ignore;
    this.armResume();
    return () => this.disarm();
  }

  /** Stop at once and release the audio graph and every listener. */
  dispose() {
    this.disarm();
    for (const timer of [this.loopTimer, this.settleTimer, this.stopTimer]) clearTimeout(timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
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
    this.emit("paused");
  }

  private emit(next: MusicState) {
    this.state = next;
    if (typeof navigator !== "undefined" && "mediaSession" in navigator)
      navigator.mediaSession.playbackState = next;
    for (const listener of this.listeners) listener();
  }

  private remember(on: boolean) {
    if (!this.memory) return;
    if (on) this.memory.set(true);
    else this.memory.clear();
  }

  private pickSource() {
    const probe = document.createElement("audio");
    const sources = this.track.sources;
    return (
      sources.find((source) => probe.canPlayType(source.type) === "probably") ??
      sources.find((source) => probe.canPlayType(source.type) !== "") ??
      sources.at(-1)!
    ).src;
  }

  private setup() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const src = this.pickSource();
    this.decks = [0, 1].map((index) => {
      const el = new Audio(src);
      el.preload = index === 0 ? "auto" : "metadata";
      const gain = ctx.createGain();
      gain.gain.value = index === 0 ? 1 : 0;
      ctx.createMediaElementSource(el).connect(gain).connect(master);
      // A throttled timer must not leave silence: an ended current deck hands over at once.
      el.addEventListener("ended", () => {
        if (this.decks[this.current]?.el === el && this.state === "playing") this.blend();
      });
      return { el, gain };
    });
    this.ctx = ctx;
    this.master = master;

    document.addEventListener("visibilitychange", this.onVisibility);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.track.title,
        ...(this.track.artist !== undefined ? { artist: this.track.artist } : {}),
      });
      navigator.mediaSession.setActionHandler("play", () => void this.play());
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
    }
    return ctx;
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
    this.scheduleLoop();
    return true;
  }

  private fadeOutAndStop() {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    clearTimeout(this.loopTimer);
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

  private scheduleLoop = () => {
    clearTimeout(this.loopTimer);
    const el = this.decks[this.current]?.el;
    if (!el || this.state !== "playing") return;
    if (!Number.isFinite(el.duration)) {
      el.addEventListener("loadedmetadata", this.scheduleLoop, { once: true });
      return;
    }
    const wait = crossfadeDelay(el.duration, el.currentTime, this.crossfade);
    this.loopTimer = setTimeout(() => this.blend(), wait * 1000);
  };

  /** Start the idle deck from the top and crossfade into it. */
  private blend() {
    const ctx = this.ctx;
    if (!ctx || this.settleTimer !== undefined) return;
    const out = this.decks[this.current]!;
    const into = this.decks[1 - this.current]!;
    into.el.currentTime = 0;
    void into.el.play().catch(() => {});
    for (const [deck, rising] of [
      [out, false],
      [into, true],
    ] as const) {
      deck.gain.gain.cancelScheduledValues(ctx.currentTime);
      deck.gain.gain.setValueCurveAtTime(equalPowerCurve(rising), ctx.currentTime, this.crossfade);
    }
    this.current = 1 - this.current;
    this.settleTimer = setTimeout(() => this.settle(), this.crossfade * 1000 + 100);
    this.scheduleLoop();
  }

  /** Finish any crossfade now: the current deck carries on alone. */
  private settle() {
    clearTimeout(this.settleTimer);
    this.settleTimer = undefined;
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
