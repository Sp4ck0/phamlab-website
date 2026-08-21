# phamlab-website (frontend)

This repo is the **frontend only** — a React + Vite app that talks to the
Convex backend at `../phamlab` via a symlinked `src/_generated` (see
`vite.config.ts`'s `@convex` alias). Trip data itself lives in Convex, not
in this repo — pages/components should stay data-driven, not hardcode any
trip's real content.

## Gated features

Every access-gated page (Trips, Boards, `/manage`, Dating Simulator) follows
the same shape — reuse it rather than inventing a new gating mechanism:

1. **Backend**: the permission lives as a field on `access_grants`
   (`tripIds`, `boardIds`, `isAdmin`, `datingAccess`) — a boolean for an
   all-or-nothing page, an id array for a page with multiple selectable
   sub-resources.
2. **Backend**: a `checkXAccess`-style query (e.g. `management.checkManagementAccess`,
   `dating.checkDatingAccess`) re-validates the access code against the
   database on every call — never trust a client-supplied "I'm authorized"
   flag. Any action that hits a paid/external API re-checks access itself,
   rather than assuming the UI already gated it.
3. **Backend**: self-serve toggles for the flag go through `management.ts`'s
   `upsertAccessCode`, so `/manage` stays the single place admins grant
   access — no one-off mutation per feature, unless the flag must stay
   backend-only (like `isAdmin`).
4. **Frontend**: the page component gates itself (loading → not-authorized →
   content) — there's no route-level auth wrapper. See `ManagePage.tsx` /
   `DatingSimulatorPage.tsx`. Because the `checkXAccess` query is called as
   `useQuery(api.x.checkXAccess, code ? { code } : "skip")`, it returns
   `undefined` forever when there's no code (skipped, not loading) — the
   loading check must be `code && isAuthorized === undefined`, not just
   `isAuthorized === undefined`, or a visitor with no code saved gets stuck
   on "Loading…" indefinitely instead of seeing "Not authorized".
5. **Frontend**: `SideNav.tsx` conditionally renders a `navgroup` for the
   feature based on the same `checkXAccess` query, so the link only shows up
   for codes that actually have access.

## Before pushing to git

The app is designed so this repo never needs to contain real trip data —
all names, addresses, confirmation numbers, and hotel/flight details are
fetched from Convex at runtime, gated by access control. Keep it that way:

- Never hardcode real names, addresses, phone numbers, confirmation
  numbers, or other trip-specific PII into components, fixtures, or test
  data in this repo
- Never commit `.env*` files, Convex deploy keys, or other secrets (the
  `.gitignore` already excludes `.env.local` and `*.local` — don't
  override that)
- Never commit `src/_generated` as a real symlink target's contents —
  it's gitignored on purpose; regenerate it locally with
  `ln -s ../../phamlab/convex/_generated src/_generated`

Before every push, run `git status` and `git diff --cached` and actually
read the diff — don't just `git add -A` and push blind. If anything above
shows up in the diff, stop and remove it before committing.
