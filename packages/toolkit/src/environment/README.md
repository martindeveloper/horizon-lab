# Environment

`@horizon/toolkit/environment` names the media queries simulations share, so
every surface honours the same user preference. No dependencies; importing it
touches no browser globals.

- `REDUCED_MOTION_QUERY`, `FINE_POINTER_QUERY`, `COARSE_POINTER_QUERY`: query
  strings for `window.matchMedia`. Keep the returned list and read `.matches`
  when deciding, so a preference changed while the page is open applies at once.
- `prefersReducedMotion()`: a one-off snapshot, false on the server or where
  `matchMedia` is missing. Use it for decisions made once, such as a store's
  initial state.

Reduced motion stills automatic movement (rotation, drifting, flights, pulses);
it does not disable controls the user drives.
