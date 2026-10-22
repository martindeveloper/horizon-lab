---
title: UI library
description: The shared @horizon/toolkit/ui components, styling contract, visual language, themes and accessibility rules.
sidebar_position: 2
tags: [ui, design-system, accessibility, tailwind, themes]
---

# UI library

The reusable UI entry point of the `@horizon/toolkit` workspace package. Keep
simulation data, stores, routing, units, and translated copy in the application.
See [Toolkit setup](../packages/toolkit/README.md) for reuse in other projects.
It ships source for bundlers and has not been published to a registry.

## Quick start

```tsx
"use client";

import { useState } from "react";

import { ControlRow, Slider, Surface, VisualizationShell } from "@horizon/toolkit/ui";

export function MyVisualization() {
  const [speed, setSpeed] = useState(1);
  return (
    <VisualizationShell>
      {/* Your canvas or scene goes here. */}
      <Surface className="absolute right-4 bottom-4 w-64 rounded-panel p-4">
        <ControlRow label="Speed" value={`${speed.toFixed(1)}×`}>
          <Slider
            aria-label="Speed"
            min={0.1}
            max={3}
            step={0.1}
            value={[speed]}
            onValueChange={([value]) => setSpeed(value ?? 1)}
          />
        </ControlRow>
      </Surface>
    </VisualizationShell>
  );
}
```

A fuller, typechecked example with playback, quality choices, and readouts lives
in `packages/toolkit/src/ui/examples/visualization-example.tsx`. It is not mounted or
included in the application's public exports.

## Components

| Export                    | Purpose and contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VisualizationShell`      | Full-viewport `main`, isolated positioning context; canvas first, overlays after.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `VisualizationOverlay`    | Full-size overlay at z-10; pointer events pass through unless a child opts in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Surface`                 | Glass material: `glass`, `panel` (default), `pill`, `hud`, `popover` (dense, for menus over text), `lesson`. Set radius, padding, position, and semantic wrappers yourself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Toolbar`                 | Rounded HUD surface with `role="group"`; requires `aria-label`. Independent controls use normal Tab navigation. On phones an 8px gap keeps neighbouring touch targets apart.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `Button`                  | Rounded icon-sized button, 44px mobile / 36px desktop; provide an accessible label for icon-only content.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `IconButton`              | Compact HUD action, 36px mobile (inside a 44px touch target) / 32px desktop; requires `aria-label`. Give neighbours an 8px gap on phones. `active` controls appearance; supply `aria-pressed` for toggles or `aria-expanded` for disclosures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Tooltip`                 | Supplemental hover/focus label, hoverable and dismissed with Escape (WCAG 1.4.13), hidden while its control has something open (`aria-expanded`). Never the accessible name; the trigger still needs one. `align="start"` / `"end"` keep a tip at the left / right edge on screen; `side="top"` opens it above a control with a dock or panel just below; `prose` sets a sentence (sentence case, wrapped) rather than a label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ControlRow`              | Label/value line above children. The child input still needs `aria-label` or a real associated label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `LabelledRow`             | A group with a mono label at its start on every screen size (`label` is also its accessible name; `shown` swaps the visible label, null hides it). Its content wraps or scrolls on its own. `ChipRow` is one holding a row of chips that scrolls sideways, its scrollbar hidden; with `wrap` it wraps from `md` up.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `Slider`                  | Radix slider; provide `aria-label` (put on the thumb, not the root) and `valueText` so screen readers hear the same formatted value the UI shows (e.g. "4.6 billion years ago", not 873). `thumbLabels` names multiple thumbs; `trackClassName`, `trackStyle` and `rangeClassName` restyle the track and the filled range (a scale painted under the thumb). `sliderStopAt(share)` is where the thumb's centre stands at a share of its travel, for marks under its stops (`SLIDER_THUMB_PX`, its diameter). 32px tall, with a 44px touch target on phones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `SegmentedControl<T>`     | Controlled exclusive choices with typed values, disabled options, native buttons and `aria-pressed`; requires group label. 32px tall and at least 40px wide on phones, with a taller touch target. Tab then Space/Enter selects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `DataReadout`             | Semantic `dl`, mono labels and tabular values. Pass stable IDs, display labels, and formatted values; override grid columns with `className`. `variant="inline"` sets each value beside its `icon`, the label its tooltip and spoken name, for a dock's running readouts (`valueClassName` gives a value its widest reading's width).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `FrameStats`              | A frame-rate readout for any `FrameSource` (`rate()`, `intervals()`): the rate alone by default; `graph` adds a bar per recent frame, `vsync` the display's refresh rate and its windows across the graph (bars marked by missed windows), `memory` the JavaScript heap where Chromium reports it. Labels in props; position it yourself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ScaleBar`                | A map's scale bar: formatted `text` above a bracket `px` wide that eases to new widths; `label` is the tooltip and screen-reader sentence; `onScene` keeps space colours when it sits on the scene itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Kicker`, `kickerClass`   | Mono uppercase label above titles, sections and readout groups. Use `kickerClass` on spans, headings or animated text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `PanelHeader`             | Kicker, display title and optional close `Button` for panels, cards and sheets; `closeLabel` is required with `onClose`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Chip`                    | Pill choice or toggle, 44px mobile / 32px desktop; `selected` lifts it onto HUD glass; unselected it keeps `outlineClass`, the hairline outline any unmarked button shares, so it reads as a button beside a label. Supply `aria-pressed` or `role="switch"` with `aria-checked`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ListItem`                | Full-width menu or panel row; `selected` tints the row, marks it with a gold notch and sets `aria-current`, `selected={false}` mutes rows beside the current choice. `icon` leads with a mark in a column of its own (an `Orb`, an icon) so names line up; `detail` trails a mono figure or tag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `ListTrack`               | An ordered list read as a route (inside out, small to large, near to far): hairline segments join its rows' `icon` marks, gold up to the current row, whose mark is ringed. `ListTrackLabel` names a stage between rows; the route runs on past it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `Orb`                     | A body's small decorative mark in its own `color`: `lit` (a planet), `glow` (a star), `hole` (a horizon in a gold ring), `swarm` (a belt or bound, dotted), `haze` (a galaxy). Colours are the simulation's scientific ones; without one it takes the quiet foreground.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `SwitchRow`, `SwitchChip` | Every on/off switch: `SwitchMark` (a small track whose knob slides right and turns gold when on; visual only) inside a `ListItem` row in panels, or a `Chip` where a row has no room (a dock). Both carry `role="switch"` and `aria-checked`; pass `on`, `onToggle` and the label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Picker`                  | Controlled HUD pill disclosing a dense glass list of ordinary buttons (disclosure pattern, not a listbox). `aria-label` names the choice and is read before the current label. Escape, outside pointer and Tab-out close it; focus returns to the pill. Mark the current row with `ListItem selected`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `Sheet`                   | Small-screen bottom sheet with scrim, grab handle and `pad-sheet`. While displayed it is modal within its parent: focus moves in, sibling layers turn `inert`, Escape and a focusable close button dismiss it, focus returns. When CSS hides it (e.g. `md:hidden`) it does nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `Dock`                    | The one bottom HUD bar for every simulation: panel glass, `rounded-panel`, centered at one width (full on phones, 56rem max) inside `pad-hud-bottom`, a little tighter on phones. Don't resize it; `className` lays out the content, `footerClassName` clears an open side rail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `ImmersiveScene`          | Canvas-only view: hides its children, marks the `stage` ancestor `data-immersive`, F / Esc, exit control, optional fullscreen. Labels in props. `drift` (`active`, `playing`, `onToggle`, labels) adds a pause control and Space, makes the exit control the drift's stop, and fades the controls while it plays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ExperienceMenu`          | One toolbar button for a scene's experiences: with `onDrift` it unfolds two round buttons below itself (immersive view, the drift); without it the button enters immersive view directly. Same place and icon on every scene; `align` anchors its tooltips.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ImmersiveToggle`         | Toolbar entry for `ImmersiveScene` with shortcut hint; returns focus on exit. `align` anchors its tooltip (`end` at a toolbar's right edge); `icon` replaces the expand arrows. `useImmersive()` reads the state anywhere.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Tilt`                    | Apple TV–style hover tilt: compositor-only (transform, translate, opacity), frame-rate independent easing, a small pointer glare and a moved (not repainted) lift shadow; mark children with `data-tilt-depth` for parallax (a signed depth times `TILT_TRAVEL` px at the edge, negative behind, positive in front, nested layers add up; they only move, so glass inside keeps its blur; never give them opacity, filter, mask or a translate of their own). Mouse and pen only; reduced motion is honoured live. Give it the card's radius.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `OrbitPad`                | A round glass dial of four labelled step buttons, with optional `centre` content (such as the step size), (spaced on phones so touch targets never overlap) (left/right turn, up/down tilt) with tooltips, a non-drag camera alternative (WCAG 2.5.7). Emits signed `{ azimuth, inclination }` steps; apply them with `stepOrbit` from `@horizon/toolkit/camera`, which snaps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CoachMark`               | A tour's coach mark, with no veil over the scene: a gold ring (`coach-ring`) glides onto the control marked `data-coach="<id>"` (the first of `targets` on screen, inside the `scope` ancestor) and a dotted gold leader in right angles, left out where it would cross what the step opened, runs to a small solid callout (the page's colour warmed with gold in either theme, a gold edge whose glow breathes with the ring; never one of the glass panels): the step count, title, one line, Back, Next and close, its top edge a horizon that fills with gold as the tour goes on. The callout stands where it covers least of `avoid` (the HUD's glass, `COACH_AVOID`, plus whatever else covers the stage) and never its target (`placeCoach`); within a step it stays put until what the step is about comes under it (`placeHolds`). The rest of the HUD quiets to a third while a step shows; the ringed control, what it has open, what the step brought up and the scene stay at full strength. `press` opens a target such as a picker (and closes it as the step ends). Escape, close and a press outside the card, the target and the `data-coach-opener` close it; the arrows step; Next takes focus, focus returns through `returnFocus`. `playCues` plays a step's timed moves and stops them with the step. |
| `useFocusHandoff`         | Hook for panels opened on demand: a displayed element (`tabIndex={-1}`) takes focus on mount and hands it back (or to `fallback()`) on unmount.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `isSceneShortcut`         | Guard for window-level scene shortcuts: false for modifier chords, IME, handled keys, open dialogs, and (unless `controls: true`) keys aimed at a focused control, so Space still presses buttons and arrows still move sliders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `cn`                      | Conditional classes plus Tailwind conflict resolution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Native attributes (including refs) pass through on the native-element wrappers.
Interactive primitives declare their own client boundaries. Presentational
primitives also work from Server Components; stateful compositions belong in a
`"use client"` component. No component imports Next.js routing, Three.js, a simulation
store, or a translation dictionary.

## Styling contract

The root app imports `src/styles.css` once. It includes:

1. Tailwind CSS.
2. `packages/toolkit/src/ui/theme.css`: the single source of truth for colors, fonts,
   radii, and border shadows. It also redefines `md` as the desktop layout: at least
   48rem wide **and** 30rem tall, so landscape phones keep the touch layout ("mobile"
   sizes below). Use `not-md:` for phone-only rules, not `max-md:`, and the same
   pair of conditions in hand-written CSS. `short:` (under 30rem tall, a phone held
   sideways) trims docks and captions to their essentials so the scene keeps some height.
3. Optional `packages/toolkit/src/ui/base.css`: document-wide defaults, enabled by this app.
4. `packages/toolkit/src/ui/styles.css`: shared glass materials, HUD gradients, safe-area
   spacing, tooltip treatment, transitions, and reduced-motion rules.
   Simulation styles load only from their feature layouts, not the root stylesheet,
   and contain no Tailwind utilities of their own: the root stylesheet compiles
   utilities for every feature once, so the cascade order holds on every page.

Use Tailwind classes for ordinary layout and named CSS classes for materials,
effects and shared visual behavior. Inline styles supply calculated values such
as positions, dimensions, scientific colors and simulation durations; pass CSS
variables when the stylesheet composes those values into an effect.

`slider-thumb` shares the thumb's rounded shape, focus ring, feedback transition
and pressed scale across the standard Slider and custom Radix sliders. Keep each
control's dimensions, fill, border, glow and cursor in its own classes. Transition
and easing utilities can override the defaults when a control needs them.

A stage over a scene bright enough to wash out the glass (the Sun's photosphere close up) marks
itself `data-scene-tone="bright"`: its panels, pills and HUD take the popover's denser glass in
either theme, and scene names sit on a dark plate instead of their halo.

Write only the standard `backdrop-filter` in CSS. The build adds the `-webkit-`
prefix itself, and a hand-written prefixed duplicate makes the compiler drop the
standard declaration, which silently turns every glass surface opaque.

Use semantic utilities instead of new hex colors:

| Role                            | Utilities                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| Page / raised / nested surfaces | `bg-surface-primary`, `bg-surface-secondary`, `bg-surface-tertiary`                  |
| Main / supporting / quiet text  | `text-fg-primary`, `text-fg-secondary`, `text-fg-tertiary`                           |
| Accent / focus / danger         | `text-accent`, `ring-ring`, `text-danger`                                            |
| Filled actions                  | `bg-action`, `text-action-fg` (prefer the `action-fill` material)                    |
| Borders                         | `border-border`, `border-border-strong`                                              |
| Over the dark scene or artwork  | `bg-space`, `text-space-fg`, `text-space-muted`, `text-solar` (theme-invariant gold) |
| Body / editorial titles / data  | `font-sans`, `font-display`, `font-mono tabular-nums`                                |
| Hero and tile titles (30px+)    | `font-headline` (Bodoni Moda, weight 500, optical sizing)                            |

`theme.css` owns these colors and their light-theme overrides. Primary, secondary,
and tertiary describe hierarchy separately for text and surfaces; accent, action,
focus, and danger keep their own meanings. Use opacity modifiers for faint edges
and fills, or `color-mix(in srgb, var(--color-…), transparent)` in CSS. Glass
materials compose shared `highlight`, `shadow`, and `glass-ink` pigments; choose
the existing glass material before inventing another fill or shadow.

The old `fg`/`muted`/`subtle` and `bg`/`surface`/`surface-2` utilities remain
compatibility aliases. New code uses the explicit hierarchy, including scoped
palettes such as Voyage's holographic display. Direct canvas labels read the
invariant `--color-space-*` and `--color-solar` tokens after mounting. `--solar`
is decorative gold that adapts to the theme; `--scene-solar` is its fixed scene
counterpart. Scientific color maps, spectra, body colors, and authored cockpit
materials stay with their simulation. Static browser metadata and numeric WebGL
scene constants retain their serialized forms; neither depends on a browser theme.

The app layout loads IBM Plex Sans, IBM Plex Mono, and Bodoni Moda. Bodoni Moda
is the headline voice, after the engraved star atlases: only the catalogue hero,
catalogue tile titles, the About sign-off and signature, and status-page titles, never UI, panels or simulations.
Its italic carries the emphasis in the hero line (`<em>` in the message). The library provides
fallback font stacks but does not fetch fonts itself; the app bundles them from
Fontsource packages in the locale layout, with no font CDN. Preserve the quiet neutral
palette, thin borders, frosted glass, tight sans headings, and mono data.

Shared CSS helpers: `pad-safe`, `pad-sheet`, `pad-hud-top`, `pad-hud-bottom`
(side padding from `--hud-gutter`, 1rem unless the host sets it; the bottom inset is 0.75rem on phones),
`no-scrollbar`, `scroll-thin` (quiet thin bar for scrolled panels), `hud-top` (a short scrim under the HUD row; no bottom padding needed), `hud-bottom`, `hud-title`, and `anim-fade`, `anim-rise`,
`anim-sheet`, `anim-rail`. Language helpers: `horizon-sky` (fixed page backdrop;
add `data-scope="local"` inside an isolated stage; the shell layers `sky-layer`,
`sky-twinkle`, and `sky-meteor` on top), `hairline-solar` (a gold
horizon line along the bottom edge of a positioned header, footer, or popover), and
`solar-ring` (gold hover/focus halo for glass tiles and pills). `glass-edge` adds a light-catching rim to large glass (positioned, rounded consumers). The `--solar`
RGB triple drives all of them. Reduced motion and non-backdrop-filter fallbacks live
with the shared styles. The catalogue scrolls normally. Simulation stages constrain overflow locally.

Position and visibility stay with the visualization. A `Surface` is not a modal:
it does not trap focus, dismiss itself, or imply dialog semantics. Use the shared `Dialog` for modality, Escape handling and focus containment.

Simulations share one panel language through these primitives: panel glass
with `rounded-panel`, display titles, mono kickers, HUD-glass chips for the current
choice, bottom sheets on phones, and gold only for small markers. Build a
feature's chrome from them before adding local classes.

### Typography and panel spacing

Use the shared roles from `theme.css` for ordinary interface text. Sizes are rem-based;
the table gives their nominal pixel sizes at the default root font size. Families,
colors and weights remain separate so a role can serve both prose and mono readouts.

| Utility        | Size | Use                                         |
| -------------- | ---- | ------------------------------------------- |
| `text-micro`   | 10px | Compact instrument labels and kickers       |
| `text-caption` | 11px | Secondary metadata and small readouts       |
| `text-ui`      | 12px | Control labels, notes and ordinary readouts |
| `text-detail`  | 13px | Fact rows and compact supporting copy       |
| `text-body`    | 14px | Explanatory prose, with relaxed leading     |
| `text-panel`   | 16px | Panel headings                              |
| `text-section` | 20px | Prominent object names and guide headings   |
| `text-feature` | 24px | Expanded guide and dialog headings          |

`text-body/5` retains a control or menu row's tighter 20px line. Explicit line heights
and responsive variants are supported. Use `font-mono tabular-nums` for live values,
and medium `font-display` with tight tracking for ordinary headings. `Kicker` keeps
the 12px standard label; `size="compact"` uses 10px with `tracking-instrument`.
The standard `tracking-label` and compact tracking replace repeated letter-spacing
literals. `PanelHeader titleSize="section"` supplies a selected object's larger
heading and kicker separation without nesting a styled title inside it.

Align each panel's header, body and footer with the same inset utilities:
`panel-compact` (14px) for compact phone cards, `panel` (16px) for ordinary rails,
and `panel-roomy` / `panel-wide` (20px / 28px) for dialogs. For example, selected
cards use `px-panel-compact md:px-panel`, while dialog sections use
`px-panel-roomy sm:px-panel-wide`. `py-panel-row` is the 12px vertical row inset.
Use `gap-section` or `space-y-section` (16px) for ordinary panel groups and
`section-roomy` (24px) when the composition needs more room. `Surface` continues
to own material only; its consumers choose padding and layout.

Preserve the catalogue and editorial reading rhythm, brand lettering, cockpit
type, small scientific axes and projected scene labels. Their existing sizes,
spacing and optical adjustments are intentional exceptions. Safe-area gutters,
touch targets and computed simulation geometry also keep their own rules.

### Borders, radius and shadows

Interface corners use semantic roles with the existing dimensions:

| Role              | Radius | Use                                                  |
| ----------------- | ------ | ---------------------------------------------------- |
| `rounded-detail`  | 4px    | Tiny details                                         |
| `rounded-compact` | 8px    | Compact fields, prose tooltips and link focus shapes |
| `rounded-control` | 12px   | Buttons and selectable rows                          |
| `rounded-panel`   | 16px   | Rails, docks, menus and ordinary cards               |
| `rounded-card`    | 24px   | Guides and sheet tops (`rounded-t-card`)             |
| `rounded-overlay` | 28px   | Dialogs and large menus                              |

Pills and circular controls keep `rounded-full`. The earlier size names remain
compatible aliases. Catalogue artwork keeps its existing 24px `rounded-3xl`,
explicitly defined so it no longer relies on Tailwind's default. Cockpit brackets,
scientific frames and projected scene geometry keep their local shapes.

Borders already have shared colors: `border-border` / `divide-border` for ordinary
1px separators, `ring-outline ring-border-strong` for control outlines, and
`hover:ring-border-hover` for their stronger hover edge. `ring-outline` uses the
1px `--stroke-outline`; `focus-visible:ring-focus focus-visible:ring-ring` uses the
2px `--stroke-focus`. Keep color, width, inset placement and offsets independent.
Decorative glass rims use the finer 0.5px `--stroke-rim`.

Glass shadows compose an edge (`--edge-control`, `--edge-panel`, `--edge-overlay`)
with depth (`--elevation-low`, `--elevation-panel`, `--elevation-overlay`). Both
follow the theme. Existing material names remain the way to choose glass; pills
and lesson cards keep their own rim treatments. A solid container can use the
equivalent `shadow-low`, `shadow-panel` or `shadow-overlay` utility. Dialogs use
the overlay shadow. `Surface` still leaves radius, spacing and layout to its caller.

`hover:surface-halo` adds gold around the current glass material while preserving
its own edge, depth and keyboard focus ring. It does not inherit into nested
surfaces. Catalogue rims and tilt lighting, the breathing coach tour, cockpit
displays and scientific glows remain authored effects with their current styling.

### Motion contract

Use the toolkit's four duration categories throughout ordinary UI:

| Role     | Utility             | Duration | Uses                                                     |
| -------- | ------------------- | -------- | -------------------------------------------------------- |
| Feedback | `duration-feedback` | 150 ms   | Hover colors, presses, tooltip fades                     |
| Control  | `duration-control`  | 300 ms   | Switches, selection indicators, compact menus            |
| Reveal   | `duration-reveal`   | 500 ms   | Panels, sheets, guide entrances, readiness/loading fades |
| Scene    | `duration-scene`    | 800 ms   | Immersive chrome and broad UI changes                    |

`packages/toolkit/src/ui/theme.css` is the single source. Plain CSS uses
`var(--transition-duration-feedback)` (and the other three names). Pair durations with
`ease-standard` for state changes, `ease-enter` for arrivals and `ease-exit` for departures;
CSS uses the same `--ease-*` properties. Small list entrances step by `--motion-stagger`
(60 ms). Choose durations by purpose rather than by distance to an old hardcoded value.

`anim-rise`, `anim-sheet` and `anim-rail` share `anim-enter`, with a local
`--enter-from` transform; each ends at the element's own opacity and transform. They
support responsive variants, such as `anim-sheet md:anim-rail`. Compact menus,
guide lines and spectral labels also use this pattern, preserving their own direction
and travel. `anim-fade` is the shared control-duration fade.

`VisualizationOverlay ready={ready}` owns the HUD's reveal fade and inert state.
`uiMotion(element, "control", "exit")` reads the same CSS tokens for Web Animations
inside client effects/handlers. `afterMotion` waits for actual finite animation completion
and returns cleanup; reopening cancels the previous removal. The loading overlay,
immersive HUD, notice and cinematic curtain use this instead of duplicated timers.
Reduced motion removes decorative waits and completes exits promptly. The header's
`controlSpring` retains its existing physical response.

Preserve authored exceptions: the catalogue intro, slow artwork zoom/drift and sky,
the music rest/wake choreography and waveform, the drift curtain, and Voyage's flip,
impact and alarms. Simulation clocks, guide holds, pointer damping, the black-hole
clock pulses, Giants' light lap and Deep Field's 240 ms readout smoothing retain their
own timing. Tooltip intent and loading-badge waiting periods are separate from fade
durations. Do not apply the four UI durations to these clocks or sequences.

### Accessibility contract

Every simulation:

- has an `h1` in every state (sr-only is fine);
- keeps the HUD `inert` until the scene is ready;
- lets panels and sheets take focus and return it (`useFocusHandoff`, `Sheet`);
- routes window shortcuts through `isSceneShortcut`; single-letter shortcuts act
  only with focus in the stage;
- lets anything that moves on its own be paused;
- gives sliders formatted, spoken values;
- offers a control alternative to dragging the camera (a slider or `OrbitPad`);
- marks canvas overlays of projected labels `aria-hidden`, with their content
  reachable in a panel;
- draws focus with `outline-hidden` and a ring, so it survives forced colours.

`npm test` checks every text token against every glass over the scene in both themes.

## Adding a visualization

- Compose the shell, a scene, and shared controls; pass formatted values and
  localized labels in props. Keep units and physics outside the library.
- Reuse existing tokens before adding variants. Extend a shared primitive only
  when it represents a reusable pattern, not a particular simulation's state.
- Keep 44px touch targets (a smaller control on phones extends its hit area with
  an invisible `after:` inset), visible focus, accessible names, safe-area padding,
  and mobile overflow handling. Interactive overlay descendants must opt into
  pointer events (`Toolbar` already does).
- Place browser-only scenes behind a client-only boundary, as `ObservatoryClient`
  and `OrreryClient` do. Do not initialize browser-dependent state on a server.
- Give each simulation its own feature directory and App Router layout below
  `[locale]/lab/<slug>` (`[locale]/experience/<slug>` for an experience). Mount the scene in that layout to preserve it between presets;
  the root locale layout owns shared navigation and never mounts simulations.
- Render inside `.simulation-stage` and use `VisualizationShell className="h-full"`
  for a full-viewport canvas behind the shared chrome. Keep HUDs within the
  header/footer insets using the shared immersive wrapper. Do not hide page
  overflow globally.
- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`, then
  check the visuals and keyboard use in a browser.

## Themes and translations

`ThemeSwitch` is an application adapter in `src/components/shell/theme-switch.tsx`, backed by `next-themes`.
It accepts a `label` and `labels: {dark, light, system}` so the library never
imports application translations. `AppThemeProvider` wraps the locale layout,
sets the default to dark, persists the preference, and supports system changes.
The shared `AppHeader` supplies localized labels using `next-intl`.

The `:root.light` block in `theme.css` overrides UI colors and material variables.
Light is stone paper and ink: glass becomes pearl (a translucent fill under a
top-lit `--glass-sheen`, a white inner edge and an ink rim), still dense enough for
ink text over the scene. `--sky-wash` and `--sky-glow` give the page something for
the glass to refract. Filled calls to action use `action-fill` (`--color-action`):
solar in the dark, ink glass with solar text in light; gold otherwise stays on lines
and `text-accent`. `bg-space`, `text-space-fg`, and `text-space-muted` are invariant:
use them for space canvases and text drawn directly over space. `hud-title` also
stays light (`--color-space-title`). Use `fg-primary`/`fg-secondary`/`fg-tertiary` for panel contents.
`VisualizationShell` uses `bg-space`. Do not invert canvas pixels or shaders.
The theme is class-based; Tailwind's `dark:` variant follows the same class.

Use `useTranslations` in visualization components and pass strings into the UI
library. Store shared messages in `src/messages/en.json` and `src/messages/cs.json`, and feature
messages under `src/features/<slug>/messages/`; use ICU
arguments instead of manually replacing placeholders. Catalogs compile at build time
(next-intl `precompile`), so `t.raw` returns compiled messages, not ICU text. Route navigation must use
`@/i18n/navigation`; URLs never carry the language. Browser-only scenes still
need a client boundary, but language comes from the provider (set by the locale
cookie) rather than browser storage. The example remains intentionally language-neutral sample
code; translate its labels when adapting it to a real visualization.

## Shared application chrome

`AppShell` in `src/components/shell/` wraps catalogue pages and simulations. It
renders the fixed sky (`shell/sky.tsx`), a glass header and a footer.

### Sky

The sky is the real one: `src/space/star-catalogue.ts` holds the ~200 brightest naked-eye stars (J2000
coordinates, magnitude, B−V), shared with the orrery's sky, and `space/observer-sky.ts`
computes their altitude and azimuth over
Ondřejov Observatory from sidereal time, with precession applied. The canvas
draws the view toward south at equal degrees per pixel, the page's horizon
hairline being the horizon, with atmospheric extinction and spectral tints,
redrawn once a minute so the drift is sidereal motion. The DOM root carries
`data-observer`, `data-sidereal-time`, and `data-visible-stars`; the twelve
brightest visible stars breathe (`data-star` names them). A faint seeded filler
stands in for stars below the catalogue limit, a meteor crosses now and then,
and the field eases after the pointer (up to ±12 px for the real stars). With a
mouse, the nearest star within 22 px of the pointer gets a gold ring and its
name and magnitude (`shell.starNames` holds the Czech forms), with brightness breaking
exact distance ties, unless page content
has the pointer; and scrolling runs the sky forward four seconds per pixel, so
the top of every page is the present and the sky wheels at its true sidereal
rate as you read down. Transform, opacity, and one canvas repaint per minute
(per frame only while scrolling); reduced motion gets a still sky at the
present, pointer effects need a fine pointer, and nothing runs over a simulation.

### Header and footer

The glass header (40px on phones, 44px on desktop) sits on a solar hairline and
carries the brand mark and wordmark (`brand.tsx`), the current app name when a
simulation is open, the music toggle, and on `md` a glass "Catalogue" pill back to
the index and the language and theme rails. Below `md` one menu button
(`phone-menu.tsx`) drops a solid panel from the bar over a dimmed page instead: the
simulations (the current one marked), language and appearance, then About, Credits,
GitHub and the sidereal clock, in two columns from 640px. Scene-specific tools remain
inside the feature, so no simulation uses the menu icon for its own panels. Header
sizing is defined by `--app-header-height` and includes the top safe-area inset. A
28px `AppFooter` closes every page: the mark, the name, About and Credits links, a
GitHub link from 640px up, and the local sidereal time at Ondřejov (`SiderealClock`,
client-only). Below `md` the menu carries those, so over a simulation the footer is
gone and `--app-footer-height` is 0: the scene takes its line.

On phones (coarse pointer on the touch layout) `DesktopNotice` shows one glass pill,
once per session, suggesting a larger screen: above the footer on pages, under the
HUD's top row over a simulation, hidden in the immersive view.

The header and footer (`app-bar`) span the window on every page, so the brand,
nav and preferences never move between the catalogue and a simulation. Every
edge sits on one gutter, `--app-gutter` (1rem, 1.5rem from 640px, 2rem from
1024px, never less than the safe area): content uses `app-container` (the same
gutter, 1440px max), and simulation HUDs get it as `--hud-gutter`, so a sub-app's
top, bottom and side-rail controls line up under the header. Position side rails
with `--hud-gutter`, not a fixed inset.

Simulation stages with `data-simulation` stay fixed at full viewport size behind
the header and footer. The canvas keeps the same size and position when immersive
mode changes; only the UI fades and slides. The shared immersive wrapper insets
normal HUDs by `--app-header-height` and `--app-footer-height`, keeping controls
clear of the bars. Loading placeholders without `data-simulation` still fit
between the bars. The catalogue scrolls normally over the sky and uses the same
typography, tokens, materials, and theme system.

### Catalogue

The catalogue opens on a full-bleed panorama over Ondřejov facing south, the
brand mark at landscape scale: today's solar path as a faint dashed arc with
sunrise and sunset marked on the horizon hairline, and a frosted sun standing
where the real Sun stands (`sunPosition` in `space/observer-sky.ts`, placed once a
minute and on resize by `catalogue/hero-sun.tsx`). The real sky blurs through
it; at night it sinks under the line, leaving a glow at its bearing. The Moon
follows its own silver arc (`moonPosition`: Meeus ch. 47 with the 32 + 20
largest terms, ~0.01°, topocentric parallax), lit to its real phase with the
bright limb turned toward the Sun: a glass disc in the Sun's language, a silver
rim and a soft silver glow on the lit part, a soft terminator and a trace of
earthshine, faded by day and in front of the Sun in an eclipse. Gold stays the
Sun's. The title sits large above the line; below it the ground hides the stars
and carries one readout with the Sun's and Moon's altitudes and the illuminated
fraction.

A fresh load plays a short intro (`.catalogue-intro` in
`src/features/catalogue/styles.css`, about 4 s): first the sky alone (the
horizon line draws out, the Sun rises, its path sweeps across, the Moon follows),
then the header settles in, then the title and the tiles. Navigation back and
reduced motion skip it.

Below the hero (`src/features/catalogue`) sits a bento grid of tiles: pairs alternate 7/5 and
5/7 columns on wide screens (6/6 on laptops), a lone last tile spans the row,
and phones stack tall full-bleed tiles. Artwork fills each tile; the category
and a large mono plate number sit on the scene; a frosted panel resting on the
art carries the title, one sentence, a highlights readout, the one solar action
and the numbered entry points. With a mouse the tile tilts toward the pointer
(`Tilt`) and its layers part in parallax: the artwork's own layers behind (the far sky drifts
most, the bodies nearer less; `artworkLayers` in the manifest), the category, panel, title and
plate number in front (`TILE_DEPTH`), and light catches the glass. The whole tile is the link. No pills: labels are readouts with
hairline rules. A new simulation only needs a manifest and its copy, never a new layout.

## Loading and recovery

`LoadingScreen` from `@horizon/toolkit/ui` accepts `title`, `status`, and optional
`className`. It is deliberately quiet: the house mark with one orbiting spark,
the name, and a short status, all in CSS. A polite status announcement and
reduced-motion support are built in. The app's
`SimulationLoading` wrapper supplies localized shared copy; pass the simulation
title. Use it for the dynamic-import fallback and renderer initialization overlay.
Do not add artificial delays or fabricated percentages. Detail that streams in after the
scene is up (a close-up map) never blocks it: show `LoadingBadge` while the view would miss
that detail, not while it is merely loading.

The app's `StatusPage` in `src/components/status/status-page.tsx` accepts `code`, `title`,
`description`, action children, and `fullPage` for documents without the header
(it then draws its own sky and wordmark). The glyph follows the code: 404 shows
the sun below the horizon, 500 an eclipse. `statusPrimaryActionClass` (solar) is
for the one recommended action and `statusActionClass` (glass) for the rest.
Error pages show translated recovery copy rather than raw exceptions. These
components must not import simulation state or rendering libraries.

`DriftVeil` is the curtain a scene shows while its drift gathers its music and timing: the
scene fades to black behind a hairline horizon that draws out and breathes, and once the
drift begins the curtain holds a beat and lifts slowly. It is opaque once drawn in, so a
drift cuts its camera to the opening shot behind it (the camera module's `cut`) and the first
image the visitor sees is that shot, already in motion. It takes no pointer events, so the
immersive controls stay in reach; `label` is read to assistive technology only.

## Additional shared components

`Callout` groups a short title and explanatory body in a bordered inset. Its
`info` tone uses neutral materials; `warning` uses the theme's gold accent and a
triangle icon. Both are static, labelled notes. Pass translated `title` and
`children`; choose `tone` in the feature. Deep Field's detail cards use it for
measurement and reconstruction limits, with preprint warnings selected from the
source manifest. `SelectionSheet` accepts this treatment through `cautionCallout`
and keeps the card's existing caveat text as its body.

`Equation` and `Sub` format mathematical text without a parser. `Dialog` provides
native focus management through an `open()` / `close()` handle. `TechnicalDetails`
uses it to render a translated document. `LoadingScreen` supplies the loading
visual, and `LoadingOverlay` owns its ready-to-hidden lifecycle. `TextReveal`
is exported separately from `@horizon/toolkit/ui/motion` and respects reduced motion.
Their API contracts are in [UI README](../packages/toolkit/src/ui/README.md).

`RateStepper` (`src/components/simulations/rate-stepper.tsx`) is a dock's clock: play or
pause (lit while it runs, its tooltip what a press does), a step slower, the rate in mono
figures, announced as it changes, and a step faster. Voyage's time warp and the Sun's clock use it.

Every simulation's header uses `SimulationToolbar`
(`src/components/simulations/simulation-toolbar.tsx`), so the tools sit in one order
and look alike everywhere, icons with tooltips, from what is most the simulation's own to
what every scene shares: the simulation's own tools (the Orrery's reading guide, the black
hole's clocks), the finder (the Objects, Elements or atlas list of what to look at), the
guide (graduation cap), its settings panel (sliders), technical details (Σ), the
experiences, then help (`?`, the tour of these controls). Each button carries `data-return` and `data-coach` with its id, so what it opens can hand
focus back and a tour can ring it. Every settings panel ends with `RenderSection`
(`src/components/simulations/render-settings.tsx`): quality levels, anti-aliasing, the
render switches (bloom, lens or glow, the frame-rate readout), then Reset, worded by the shared `render`
copy.

Below `md` the toolbar keeps the finder, the guide, the settings, the experiences and help and
folds the rest (the simulation's own tools, then technical details) into
`SceneMoreMenu` (`src/components/simulations/more-menu.tsx`): an ellipsis button at
the toolbar's end that drops a short list of named tools (`MoreItem`: label, icon,
`onSelect`, optional `active`). Escape, an outside tap and tabbing away close it, and
a choice leaves focus on the button, so a dialog it opens returns there. The folded
buttons stay in the toolbar for `md` (`not-md:hidden md:contents`). The feature's technical
details render only their dialog (their own trigger hidden); the toolbar's Σ button and the
More row open it through its handle.
