# Firebase Admin

Minimal Next.js app for directly inspecting and editing Firestore data.

## File structure

```text
src/
  app/
    globals.css
    layout.js
    page.js
  firebase.js
  firestore.js
```

## What remains

- Firebase app setup
- Firestore connection
- One page at `/` for:
  - browsing a few collections
  - selecting documents
  - editing raw JSON
  - creating documents
  - deleting documents

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Required env vars

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL` (required for RTDB collaboration channels: cursor/presence/comments/live-editor presence)
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Server-cached dashboard rollup

The app includes a cached server endpoint for dashboard counters:

- Route: `/api/dashboard/rollup`
- Uses `unstable_cache` with 60s revalidation
- Aggregates counts server-side so clients can read compact counters instead of recomputing from raw collections

Server-side Firebase Admin credentials are required in Vercel/project env:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` (store with escaped newlines as `\\n`)

If these are missing, the endpoint returns `503` with an explanatory message.

## Dashboard login

The app now requires login before entering the dashboard.

- Login route: `/login`
- Session uses a signed, `HttpOnly` cookie.
- Passwords are verified using PBKDF2-SHA256 hashes from env vars (not plaintext in code).

Recommended env vars:

- `AUTH_COOKIE_SECRET` (required in production; long random string)
- `DASHBOARD_ACCOUNTS_JSON` (JSON object of `username -> pbkdf2 hash record`)

Generate account hashes:

```bash
npm run auth:hash -- munus:solidarity mor:solidarity tzu:solidarity
```

The command prints:
- Raw JSON for Vercel env vars
- Escaped `DASHBOARD_ACCOUNTS_JSON='...'` for local `.env.local` (important: `$` must be escaped locally)

Add both vars:

```bash
AUTH_COOKIE_SECRET=your-long-random-secret
DASHBOARD_ACCOUNTS_JSON='{\"munus\":\"pbkdf2_sha256$...\",\"mor\":\"pbkdf2_sha256$...\",\"tzu\":\"pbkdf2_sha256$...\"}'
```

For Vercel deployment, set these in Project Settings -> Environment Variables.
They remain server-side only (do not use `NEXT_PUBLIC_` prefix).

## Notes

- The page currently shows these collections by default:
  - `members`
  - `projects`
  - `tasks`
  - `kanbanCards`
  - `meetingNotes`
- Document editing is raw JSON overwrite, not a form UI.
- No Firebase data is deleted unless you explicitly delete a document from the page.
- The repo is plain JavaScript now; TypeScript and lint tooling were removed to keep it minimal.

## Shareable views

Navigation uses readable, stable paths:

- `/tasks?week=2026-10-12` pins the Task board to a specific week. Add `&view=project` for project grouping.
- `/projects/PROJECT_ID` opens a project. `/projects?view=kanban` opens the board.
- `/notes/NOTE_ID` opens a note, including older notes outside the recent list.
- `/finance?year=2026&view=person` selects a year and view.

Only nondefault controls for the current tab appear in the query (`view`, `q`, `group`, `layout`, `year`, `quarter`, `category`). Task weeks are always explicit so links stay on the same date when opened later. Opening a note drops list filters. Switching tabs drops the previous tab’s filters. IDs remain complete and stable when titles change.

The URL schema lives in `src/app/lib/viewUrl.mjs`, with no shortening service or lookup database. Previous `/?tab=...` links still work and are normalized with `replaceState`. Back/Forward and refresh restore the view; typing in search replaces history. Navigation links support opening in a new tab. Login retains the destination and existing access checks still apply. Drafts and edit mode remain local.

Run URL regression checks with `npm test`.

### Fixed short share links

**Copy link** (sidebar or note dialog) saves a view under `/s/<16-character-id>`. IDs derive from a versioned SHA-256 digest of the normalized destination. Identical views reuse one record, and a transaction verifies the full destination before reusing an ID. Saved records are immutable. Navigation itself performs no share writes.

The resolver requires login and opens the saved destination with existing data permissions. Invalid, missing, unsupported, and inaccessible links show a recoverable error. Clipboard failures reveal a selectable link; storage failures keep the readable address-bar URL available. Private query parameters and fragments are excluded. Saved views have no automatic expiry.

Deploy the `sharedViews` rules in `firestore.rules` with the app before using production short links. The app uses the existing Firebase client and needs no additional service or dependency.
