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
  The canvas is never remounted. `immersive-state.ts` holds the framework-free
  state, shortcut and Fullscreen API helpers.
- `OrbitPad`: step buttons for a camera without dragging, round a glass dial with
  optional `centre` content. Labels come in props; pair it with `stepOrbit` (or an orbit
  rig's eased `turnBy`) and `ORBIT_STEP` from `@horizon/toolkit/camera`.
- `TextReveal` lives at `@horizon/toolkit/ui/motion` to keep Motion optional.
  Reduced motion and `instant` render full text immediately.

Import `theme.css` for Tailwind v4 tokens and `styles.css` for glass materials,
safe-area helpers and animations. HUD helpers pad their sides by `--hud-gutter`
(1rem unless the host sets it). `base.css` changes document-wide styles and
is opt-in. Theme providers, brand-specific status pages and translations remain
in the host application. `Surface` is a visual container; use `Dialog` when
modality and focus management are required.
