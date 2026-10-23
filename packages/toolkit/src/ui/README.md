# UI

`@horizon/toolkit/ui` contains presentation and interaction primitives. Pass
translated strings and domain values in props. No component reads application
state or routing. See the repository's `docs/ui-library.md` for the full component
catalogue and `examples/visualization-example.tsx` for composition.

- `Kicker`: mono uppercase label; `size="compact"` uses the instrument-label role.
  `kickerClass` remains available for labels on other elements.
- `PanelHeader`: standard panel title; `titleSize="section"` gives a selected
  object's name the larger heading and kicker separation without a nested styled span.
- `Callout`: a bordered static note with a required translated `title` and body in
  `children`. `tone="info"` is neutral; `tone="warning"` uses an amber tint and a
  warning icon. Its labelled `note` role does not interrupt screen readers.
  The host chooses the tone and owns any scientific or publication-status logic.
- `Slider`: standard Radix slider with translated labels and optional scientific
  track styling supplied by the caller. Its `slider-thumb` CSS utility also serves
  custom Radix sliders: shared focus ring, feedback transition, rounded shape and
  pressed scale, with dimensions, fill, border, glow and cursor left to the control.
  Transition and easing utilities can override its defaults.
- `Dialog`: `ref` exposes `open()` / `close()`. Native `<dialog>` handles modality,
  focus containment, Escape and focus restoration. Supply title and close label.
  Backdrop clicks dismiss; key events do not reach background simulation shortcuts.
  `size="wide"` widens it for figures. It grows out of the control that opened it
  (`open(from)`, else the focused control) and shrinks back on closing (`ui-dialog`; a fade
  alone under reduced motion). `resize` (two labels) lets its edges and corners drag it larger
  or smaller about its centre and adds header buttons that fill the screen less a 16–40 px
  margin or ease it back to its own size (`dialog-size.ts`); `data-sized` marks a visitor's size.
- `FigureZoom`: a figure headed by its `label` and an enlarge button, opening it in a wide
  Dialog where it zooms up to 8× (wheel, pinch, double tap, + / − / 0, the buttons) and pans by
  drag or the arrows, always covering its frame (`zoom-pan.ts`). The dialog draws `children`
  again from its first opening; pass a function of `zoomed` to draw the two differently.
  Its dialog is resizable, and the figure takes all the room it is given.
  `labels` names the open, close, zoom in, zoom out, whole-figure, fill and own-size controls.
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

## Typography and spacing

`theme.css` owns the interface size/line-height pairs: `text-micro` (10px),
`text-caption` (11px), `text-ui` (12px), `text-detail` (13px), `text-body` (14px),
`text-panel` (16px), `text-section` (20px) and `text-feature` (24px). Values are
stored in rem; these are their nominal sizes at the default root font size.
Body text includes relaxed leading; `text-body/5` keeps a control or menu row's
tighter 20px line. Explicit leading and responsive variants still work normally.
Families, colors and weights are independent: use mono/tabular numerals for data,
and medium display text with tight tracking for panel and guide headings.
Kickers use `tracking-label`, compact kickers use `tracking-instrument`.

Panel headers, bodies and footers share inset tokens: `panel-compact` (14px),
`panel` (16px), `panel-roomy` (20px) and `panel-wide` (28px). Use them as spacing
utilities, for example `px-panel-compact md:px-panel`; `panel-row` is the 12px
vertical inset. `gap-section` / `space-y-section` separate ordinary panel groups
by 16px; `section-roomy` supplies 24px where more room is needed. The class-merging
helper recognizes these tokens, so consumer overrides remain predictable.
`Surface` stays material-only. Keep safe-area gutters, touch targets, calculated
scene geometry, editorial composition, cockpit lettering and plotted labels local
to their existing contracts rather than forcing them onto the interface scale.

## Icons

Use named Lucide imports with `icon` (16px, non-shrinking, standard stroke).
Override size with `size-icon-micro` (12px), `size-icon-compact` (14px),
`size-icon-control` (16px), or `size-icon-feature` (24px); the catalogue's larger
feature variant is `size-icon-feature-large` (28px). `icon-toolbar` shares the
16px phone / 14px desktop pattern. `IconButton` supplies that default to a direct
Lucide child in the component layer; explicit glyph utilities take precedence.
Touch targets are separate and keep their existing dimensions.

`stroke-icon-standard` (2), `stroke-icon-emphasis` (2.5) and `stroke-icon-marker`
(3, tiny status stamps) use SVG viewBox units, scaling with the glyph. All tokens
live in `theme.css`; helpers live in `styles.css`. `cn` understands the size and
stroke roles. Colors, fill, optical offsets and animations stay independent.
Custom brand marks, scientific/cockpit geometry, body orbs and font-relative
editorial symbols retain their own dimensions. Keep icon-only controls labelled
and decorative glyphs hidden from assistive technology.

## Borders, radius and shadows

Use radius roles for interface geometry: `rounded-detail` (4px), `rounded-compact`
(8px), `rounded-control` (12px), `rounded-panel` (16px), `rounded-card` (24px), and
`rounded-overlay` (28px). Sheets use `rounded-t-card`; dialogs and large menus use
the overlay role. `rounded-full` stays appropriate for pills and circles. The old
size names remain aliases; the catalogue's legacy `rounded-3xl` explicitly stays
24px. Scientific frames and cockpit geometry retain their own dimensions.

Ordinary separators keep `border-border` / `divide-border` with a 1px border;
control outlines use `ring-outline ring-border-strong`, with `ring-border-hover`
for their hover color. `ring-outline` is 1px, `ring-focus` is 2px; use the latter as
`focus-visible:ring-focus focus-visible:ring-ring`. Colors, widths, inset placement
and focus offsets stay independently overridable. Glass uses the separate 0.5px
`--stroke-rim`; native CSS can also use `--stroke-outline` and `--stroke-focus`.

`--edge-control`, `--edge-panel` and `--edge-overlay` describe the lit edges of glass.
`--elevation-low`, `--elevation-panel` and `--elevation-overlay` describe its cast
shadow, with dark/light recipes. Existing glass materials compose those layers;
pills and lesson cards retain their specialized rims. Use `shadow-low`,
`shadow-panel` or `shadow-overlay` for an ordinary solid surface, such as a dialog.
Choose a glass material for glass rather than layering an elevation utility over it.

`hover:surface-halo` adds the gold UI halo to the current glass material's shadow.
Its halo is local to that element, and material shadows compose with Tailwind's
outline/focus rings. Keep authored catalogue lighting and tilt shadows, coach-tour
effects, cockpit glows and scientific markers in their existing styles. `Surface`
continues to supply material only; consumers own its radius and layout.

## Colors

`theme.css` owns the palette in both themes. Text uses `fg-primary`, `fg-secondary`
and `fg-tertiary` for main, supporting and quiet copy. Surfaces use
`surface-primary`, `surface-secondary` and `surface-tertiary` for the page, raised
containers and nested fills. Apply them with Tailwind (`text-fg-secondary`,
`bg-surface-primary`) or their `--color-<role>` custom properties.

`accent`, `action`/`action-fg`, `ring`, `danger` and `border`/`border-strong` remain
semantic roles. Prefer the shared glass materials and `action-fill` for controls.
Their highlights, shadows and glass rims use invariant `highlight`, `shadow` and
`glass-ink` pigments with alpha, rather than repeating literal colors.

`space`, `space-fg`, `space-title`, `space-muted`, `solar`, `on-solar` and
`space-danger` stay fixed over astronomical scenes. Canvas UI can read them from
the mounted element with `getComputedStyle`; physical spectra and authored scene
materials keep their own colors. `--solar` is the theme-adaptive decorative RGB
triple; `--scene-solar` is the invariant gold used by `--color-solar`.

The old `fg`/`muted`/`subtle` and `bg`/`surface`/`surface-2` utilities remain as
inline compatibility aliases. New components and scoped theme overrides use the
explicit hierarchy. Theme choice and providers remain the host's responsibility.

## Interaction states

`ui-focus` shares the theme-aware 2px keyboard ring and forced-colour outline;
retain any focus inset/offset locally. `ui-disabled` shares dimming (40%) and a
neutral cursor for native, ARIA and Radix disabled states, without changing hit
areas or focusability. Native `disabled` supplies browser behavior. `IconButton`
additionally blocks activation for `aria-disabled="true"`; other ARIA-disabled
controls must guard their handler.

`enabled-hover:` and `enabled-active:` exclude all disabled forms; hover requires
a hover-capable pointer. Compose `ui-quiet` (label brightening), `ui-press` (held
fill), `ui-row` (hover and held fill), `ui-selected` (persistent fill with stronger
hover), and `ui-outline` (the brightening outline). `ui-glass` preserves the accent
halo; `ui-filled` supplies filled-action brightness feedback. Material actions
transition `filter` along with their colors/shadows. The `state-*` color roles and
brightness/disabled tokens live in `theme.css`.

Selection and pressed state stay separate. Keep the existing semantic attributes,
selection marks, native disabled behavior and touch targets. Sliders dim once at
the root; thumb/track cursors also reflect the disabled state. Catalogue effects,
editorial links, coach styling, cockpit behavior and scientific marks stay local.

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
