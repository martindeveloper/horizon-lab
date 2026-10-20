# Storage

`@horizon/toolkit/storage` keeps one value in `sessionStorage` or `localStorage`.
Importing it touches no browser globals. A cell reads and writes only when called.
A missing or blocked store never throws: the value stays for this page and is
forgotten on reload.

- `storageCell({ key, area, lifetime, decay, codec })` returns `{ get, freshness, set, clear }`.
  - `area`: `"session"` (default; this tab, including reloads) or `"local"` (this
    origin, until `clear()`).
  - `lifetime`: milliseconds the value stays at full strength. Omit it and the
    value lasts as long as the area does.
  - `decay`: milliseconds after the lifetime during which `freshness` falls
    linearly from 1 to 0. At 0 the value is removed. Omit it and the value ends
    in one step. A decay with no lifetime starts fading at the moment of the write.
  - `get(now?)` is the value, or null when it is missing or fully decayed.
    Decay does not change the value; it changes its strength, then drops it.
    `set(value, now?)` and `clear()` write through. Pass `now` when a test owns the clock.
- Codecs convert the value. The cell keeps the decoded result, so a later read
  does not parse and does not ask the store again.
  - `text`: the string itself.
  - `flag(token?)`: `true` is stored as `token` (default `"1"`); `false` clears.
  - `oneOf(...)`: one of those strings, stored as itself.
  - `numbers(...)`: a record of finite numbers, as a comma list in key order.
  - `json(guard)`: `JSON.stringify` / `JSON.parse`, kept only when `guard` accepts it.
- A lifetime or a decay also stores the write time as a base-36 prefix in front
  of one newline. Without either, the store holds exactly what the codec wrote.
  A payload that does not decode is removed.

A local cell listens for `storage` events, so another tab's write is visible on
the next read. Session storage belongs to this tab. Use one cell per key.

Cells are long-lived: create each one once, at module level, and keep it for the
life of the page. A cell has no `dispose`, and a local cell's `storage` listener
stays registered as long as the page does, so a cell made per component mount
or per call would accumulate listeners.
