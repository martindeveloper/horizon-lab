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
  children after `ready`, unmounts them after `exitDelayMs` (default 560 ms), and
  resets when readiness becomes false. Its opacity transition lasts 500 ms.
- `useMediaQuery(query, serverValue = false)`: whether a media query (the environment
  module's `WIDE_QUERY`, `REDUCED_MOTION_QUERY`, …) matches, live; the server sees `serverValue`.
- `ImmersiveScene`, `ImmersiveToggle`, `useImmersive`: one page-wide immersive
  view. The scene fades its children out over 440 ms before unmounting them,
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
  looked up inside the `scope` ancestor, where the ring and the card are drawn) and a glass card
  stands beside it on the desktop, or at the stage's top or foot on the touch layout and with no
  target. `press` presses the target (or its first button) once found and again as the step ends
  if it is still `aria-expanded`. Escape, the close button and a press outside the card, the
  target and any `data-coach-opener` (`COACH_OPENER`) call `onClose`; the arrows step from the
  scene or the card. Next takes focus as it opens and `returnFocus` gets it back. It follows its
  target a frame at a time only while mounted. `coach-model.ts` holds the arithmetic: `playCues`
  runs a step's cues (`{ at, run }`, seconds) on a clock and returns their stop; `placeCard` puts
  the card beside a target.
- `TextReveal` lives at `@horizon/toolkit/ui/motion` to keep Motion optional.
  Reduced motion and `instant` render full text immediately.

Import `theme.css` for Tailwind v4 tokens and `styles.css` for glass materials,
safe-area helpers and animations. HUD helpers pad their sides by `--hud-gutter`
(1rem unless the host sets it). `base.css` changes document-wide styles and
is opt-in. Theme providers, brand-specific status pages and translations remain
in the host application. `Surface` is a visual container; use `Dialog` when
modality and focus management are required.
