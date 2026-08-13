# phamlab-website (frontend)

This repo is the **frontend only** — a React + Vite app that talks to the
Convex backend at `../phamlab` via a symlinked `src/_generated` (see
`vite.config.ts`'s `@convex` alias). Trip data itself lives in Convex, not
in this repo — pages/components should stay data-driven, not hardcode any
trip's real content.

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
