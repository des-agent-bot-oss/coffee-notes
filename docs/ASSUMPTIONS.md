# Coffee Notes — material assumptions

Recorded by the coordinator (default profile) on 2026-10-12, before implementation, because the
owner was asleep and asked for sensible decisions to be made and recorded rather than questioned.

1. **Single local user, no authentication.** The app is bound to `127.0.0.1` and reached over an SSH
   tunnel, so no login, accounts, multi-user isolation or CSRF tokens are implemented. Consequence:
   anyone with local shell/tunnel access can read and edit all notes.
2. **Wall-clock local time, no timezone handling.** `brewed_at` is stored as the literal
   `YYYY-MM-DDTHH:MM` string the browser's `datetime-local` control produced. The brief's "do not
   shift the displayed time unexpectedly through UTC conversion" is met by never converting at all.
   `created_at`/`updated_at` are UTC ISO strings used only for auditing order of changes.
3. **Times are not normalised across machines.** A note created while the Windows host is in a
   different timezone than the VM would display the same wall-clock value; the VM and the browser
   both report Asia/Kuala_Lumpur in normal use.
4. **Zero runtime dependencies.** Node 26 `node:sqlite` covers the database, `node:http` covers the
   server, `node:test` covers tests, and the frontend is plain ES modules with no bundler. This keeps
   the VM's disk/RAM footprint and the maintenance surface small. Playwright is a dev-only tool used
   by the coordinator for browser evidence and is not needed to run the app.
5. **`is_demo` flag separates sample notes from user content.** The demo seed is only ever run by an
   explicit action, and demo rows are deleted only by the explicit clear action.
6. **Grinder presets are convenience only.** Notes store a grinder *name snapshot* alongside an
   optional foreign key, so removing a preset can never damage history.
7. **Deleting notes is permanent** (no trash/undo). A confirmation dialog is the only safeguard; this
   matches the brief's "safe deletion confirmation" and avoids building a recycle bin nobody asked for.
8. **Migration strategy** is a linear, idempotent list of DDL statements applied at startup with a
   `schema_migrations` table. No down-migrations, no ORM, no external migration tool.
9. **Port 4317** on loopback was chosen to avoid the Hermes dashboard and common dev ports.
10. **Fonts are vendored.** DM Sans woff2 files are committed under `public/fonts/` (SIL OFL) so the
    app needs no external CDN; the CSS declares a system fallback stack.
11. **Out of scope** (explicitly not built): brew timers, bean inventory, water chemistry, charts and
    statistics, sharing/export, cloud sync, notifications, multi-device accounts, coffee-platform
    features beyond the brief.
12. **Acceptance evidence** is captured against the final commit with synthetic data only; no real
    personal note content appears in screenshots or in the repository.
