# UI

`@horizon/toolkit/ui` contains presentation and interaction primitives. Pass
translated strings and domain values in props. No component reads application
state or routing. See the repository's `docs/ui-library.md` for the full component
catalogue and `examples/visualization-example.tsx` for composition.

- `Dialog`: `ref` exposes `open()` / `close()`. Native `<dialog>` handles modality,
  focus containment, Escape and focus restoration. Supply title and close label.
  Backdrop clicks dismiss; key events do not reach background simulation shortcuts.
- `TechnicalDetails`: composes Dialog with a plain `TechnicalDocument`. The app
  owns JSON loading, schema validation and translations. Optional `references`
  (`{title, url}[]`) render cited reading links, headed by `labels.references`.
  Optional `ref` (the Dialog handle) opens it from elsewhere, such as a menu row,
  while `triggerClassName` hides its own button; the dialog stays mounted.
- `Equation`, `Sub`: semantic text styling, not a LaTeX parser or equation solver.
- `LoadingScreen`: stateless loading content. `LoadingOverlay` fades supplied
  children after `ready` and unmounts them when the reveal transition finishes;
  optional `exitDelayMs` supplies a minimum hold. It resets when readiness becomes
  false, cancelling the previous exit. Reduced motion completes without an artificial wait.
- `VisualizationOverlay`: `ready` defaults to true. When false, the HUD fades out
  using the reveal timing and becomes inert immediately; callers supply readiness
  without exposing their scene state to the toolkit.
- `StatusBadge`: a quiet glass pill (`label`, `visible`, optional `icon`, `accent`, `delayed`)
  that announces a state politely as it begins and keeps its place while hidden, so nothing
  moves. `LoadingBadge` is one for detail that streams in after the scene is up: the house
  mark's orbiting spark, fading in after 500 ms, so a quick load never shows it.
- `useMediaQuery(query, serverValue = false)`: whether a media query (the environment
  module's `WIDE_QUERY`, `REDUCED_MOTION_QUERY`, …) matches, live; the server sees `serverValue`.
- `ImmersiveScene`, `ImmersiveToggle`, `useImmersive`: one page-wide immersive
  view. The scene fades its children out over the reveal timing before unmounting them,
  makes hidden controls inert immediately, and eases them back in on exit.
  HUD rows slide gently toward the edges; the exit control arrives after the HUD
  starts clearing. Only UI opacity and translation animate, never canvas sizing.
  Reduced motion skips the fade. It sets `data-immersive` on
  the `stage` selector's ancestor (the host CSS owns its viewport layout), owns
  F / Escape and shows the exit control. Fullscreen on that stage is offered only
  where `document.fullscreenEnabled` is true; leaving it leaves immersive view.
  Entry focuses a non-interactive scene container, keeping F / Escape available
  without highlighting the exit button; Tab still reaches the controls normally.
  The canvas is never remounted. `ImmersiveToggle`'s `align` anchors its tooltip
  like `Tooltip`'s (`end` when it ends a toolbar at the viewport's right edge).
  `immersive-state.ts` holds the framework-free state, shortcut and Fullscreen API helpers.
  With `drift` (a scene flying itself, as `active`, `playing`, `onToggle` and labels), the
  exit control becomes its stop, a pause control joins it (Space does the same, away from
  controls that use Space), and the controls fade after three still seconds while it plays;
  an optional `caption` (a clock rate) sits under them, and `music` (on, a toggle and its
  labels) adds a control that silences the music or brings it back without leaving.
- `ExperienceMenu`: one toolbar button for a scene's experiences. With `onDrift` it unfolds
  a column of two round buttons below itself, immersive view and the drift (the drift enters
  immersive view too); without it the button enters immersive view directly, so it keeps
  its place and icon on every scene. Escape, an outside press and tabbing away close the
  column; the button takes focus back when immersive view ends.
- `FrameStats`: a frame-rate readout for any `FrameSource` (in Horizon, the rendering
  module's `frameMeter`, passed in so this module never imports rendering). Without options
  it shows the rate; `graph`, `vsync` and `memory` add a frame-time graph drawn every display
  frame, the display's refresh rate with its vsync windows, and the JavaScript heap where the
  browser reports it. `frame-stats-model.ts` holds its arithmetic (`median`, `refreshRate`,
  `vsyncWindows`).
- `OrbitPad`: step buttons for a camera without dragging, round a glass dial with
  optional `centre` content. Labels come in props; pair it with `stepOrbit` (or an orbit
  rig's eased `turnBy`) and `ORBIT_STEP` from `@horizon/toolkit/camera`.
- `CoachMark`: a guided tour's step over a live scene, never a veil. A gold ring moves onto the
  first of the step's `targets` on screen (elements marked `data-coach="<id>"`, `COACH_TARGET`,
  looked up inside the `scope` ancestor, where the ring and the callout are drawn; a box hidden by
  `visibility` does not count) and a dotted gold leader in right angles (left out where it would
  cross what the step opened) joins it to a small solid callout, the page's colour warmed with
  gold behind a gold edge whose glow breathes with the ring, so it never reads as one of the HUD's
  glass panels. The callout's top edge is the tour's horizon, gold up to the step reached with a
  sun at its head. It stands beside its target, or beside what the step opened, where it covers
  least: never the target or what the step is about (what the target has open, what the step
  brought up), the HUD the step quiets before the page's bars (`avoid`, weighed by `COVER`). A new
  step waits until its page is read, then takes its place and keeps it, for that step and that
  target, until something the step is about comes under it or it no longer fits (`settleCoach`,
  `placeHolds`). While a step shows, the rest of the HUD in the scope (the `avoid` surfaces)
  quiets to a third: the ringed control, what it has open and any surface the step brought up stay
  as they are, and so does the scene (a web animation over each surface, eased both ways). `press`
  presses the target (or its first button) once found and again as the step ends if it is still
  `aria-expanded`. Escape, the close button and a press outside the callout, the target, what the
  target has open (`aria-controls`) and any `data-coach-opener` (`COACH_OPENER`) call `onClose`;
  the arrows step from the scene or the callout. Next takes focus as it opens and `returnFocus`
  gets it back. It reads the page a frame at a time only while mounted. `coach-model.ts` holds the
  arithmetic: `playCues` runs a step's cues (`{ at, run }`, seconds) on a clock and returns their
  stop; `placeCoach` picks the callout's place and `coachLeader` the leader's ends.
- `TextReveal` keeps its `@horizon/toolkit/ui/motion` entry point, using CSS for
  each letter's fade. Its reading cadence and total stagger cap are independent of
  the control fade duration. Reduced motion and `instant` render full text immediately.

## Motion

`theme.css` owns the four UI durations: `feedback` (150 ms), `control` (300 ms),
`reveal` (500 ms) and `scene` (800 ms). Use `duration-feedback`, `duration-control`,
`duration-reveal` and `duration-scene` in Tailwind; CSS uses the corresponding
`--transition-duration-<name>` properties. The easing tokens/utilities are
`--ease-standard` / `ease-standard`, `--ease-enter` / `ease-enter`, and
`--ease-exit` / `ease-exit`. `--motion-stagger` is the 60 ms step for short lists.

`anim-rise`, `anim-sheet` and `anim-rail` are responsive Tailwind utilities over
one `anim-enter` keyframe, with `--enter-from` supplying the starting transform.
Features can use that same keyframe with their own starting transform, duration
and stagger. It ends at the element's own opacity and transform. `anim-fade`
is a control-duration opacity entrance. The shared reduced-motion rule removes
decorative delays as well as movement.

`uiMotion(element, duration, ease = "standard")` reads the mounted element's CSS
tokens for Web Animations (milliseconds or seconds), respecting reduced motion;
it returns `{duration, easing}`. Missing tokens produce immediate motion. It does
not read browser state at import or render time. `controlSpring` names the header's
responsive spring independently of fixed-duration transitions; it needs no Motion import.

`afterMotion(element, onFinish, minimumMs = 0)` waits for the element's current
finite animations/transitions, including delays, and returns a cancellation function.
Use that as effect cleanup so reopening a view cancels its previous removal. It ignores
descendant and infinite animations, settles cancellation as well as completion, and
finishes asynchronously when there is no animation. `minimumMs` is an optional hold,
not an estimate of the animation length. Loading, immersive HUDs and cinematic veils
use completion rather than separately maintained removal timers.

The shell and immersive HUD share `--immersive-enter`, `--immersive-exit`,
`--immersive-step` and `--immersive-controls-delay`. Keep cinematic timelines,
ambient loops, spring/damping constants, live-readout interpolation and simulation
clocks outside the four-duration scale. Waiting before a tooltip/loading badge
appears is also separate (`--tooltip-wait`, `--loading-reveal-delay`).

Import `theme.css` for Tailwind v4 tokens and `styles.css` for glass materials,
safe-area helpers and animations. HUD helpers pad their sides by `--hud-gutter`
(1rem unless the host sets it). `base.css` changes document-wide styles and
is opt-in. Theme providers, brand-specific status pages and translations remain
in the host application. `Surface` is a visual container; use `Dialog` when
modality and focus management are required.
