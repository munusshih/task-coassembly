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

**Copy link** (bottom navigation’s More menu or note dialog) saves a view under `/s/<16-character-id>`. IDs derive from a versioned SHA-256 digest of the normalized destination. Identical views reuse one record, and a transaction verifies the full destination before reusing an ID. Saved records are immutable. Navigation itself performs no share writes.

The resolver requires login and opens the saved destination with existing data permissions. Invalid, missing, unsupported, and inaccessible links show a recoverable error. Clipboard failures reveal a selectable link; storage failures keep the readable address-bar URL available. Private query parameters and fragments are excluded. Saved views have no automatic expiry.

Deploy `firestore.rules` with collection changes; running the local app does not update cloud permissions. These rules include `backlogItems` (Wishes), `reimbursements` (Requests), `financeConfig`, and immutable `sharedViews` records.

```sh
firebase deploy --only firestore:rules --project coassembl
```

Use `firebase login --reauth` if the deployment session has expired. The app uses the existing Firebase client and needs no additional service or dependency.

## Interface

The interface uses Helvetica with Arial and sans-serif fallbacks, flat white surfaces, and a shared neutral palette. Font loading, theme controls, stored style preferences, and paper texture selection have been removed. Notes keep date/project grouping with grid/list layouts; resources retain their category/board views, and requests retain receipt-style field grouping in plain cards. Help is available from navigation without an automatic walkthrough.

### Typography and TASK time

The interface uses Helvetica with a shared 16px base for body text, labels, controls, legends, and metadata. Use the semantic tokens in `globals.css`: page (36px), heading (20px), body (16px), and metric (32px), with regular/medium weights. There is no smaller caption style. Clock display (40 SVG units) and dial labels (12 SVG units) scale with their SVG viewport. Charts keep readable text values alongside color; the common pool uses purple, while payees keep stable category colors across comparisons. Financial breakdowns include every category in their totals and legends.

TASK captures time while its view stays open, including background browser tabs. A per-member browser journal preserves unlogged fragments; idle starts after five minutes. Focus time replaces automatic capture for the same interval. The automatic clock defaults to the full local day, with a Last hour zoom; older fragments remain available for review. Its center shows current local time, with selectable activity sectors and a moving marker for now. Focus shows current-session progress outside and today’s focused time by task inside. Its task menu stays visible during a session: switching finishes the old session with time attributed to its original task, then prepares the chosen task for Start focus.

Logging writes per-fragment ledger entries under the member and task counters in one Firestore transaction. Retrying a fragment cannot increment its task twice; ordinary task replacement preserves these counters. Unlogged time stays on this device, and abrupt browser termination recovers only through the last saved heartbeat. Focus pauses on browser close; alerts require the app to be running. Existing finance/payroll accounting is unchanged.

### Real local data

Run `npm run dev -- --hostname 127.0.0.1 --port 3010` and open `http://localhost:3010`. This runs the real Next.js/Firebase app using `.env.local`; it does not seed or substitute sample records. Use localhost rather than the old 127.0.0.1 fixture preview to keep its saved sample tasks and timer fragments in a separate browser origin. Sign in with the Google account linked to an active member. Changes in this app persist to the configured Firebase project.

Google sign-in now exchanges the Firebase ID token for the existing signed, HTTP-only workspace cookie. The server validates the token with Firebase and checks membership using the same token under Firestore rules; it needs no Admin credentials for sign-in. Existing password sessions remain supported. Sign-out clears both Firebase authentication and the workspace cookie.

The added page-title visualizations have been removed from Projects, Members, Wishes, Requests, Notes, Resources, and Finance. TASK retains its time visualization and tracking controls.

### Resource cover cache

Resource visits register the current resource URL and a stable edit revision in the local, git-ignored `.cache/resource-previews/` directory. Covers are fetched from the site's OG/Twitter image or icon, converted to WebP, and served through the authenticated preview endpoint. Missing images use a deterministic coloured title cover. Unchanged resources, including missing-image results, reuse the disk cache; editing a resource creates a new cache key.

`npm run build` checks the registered covers before compiling. Run `npm run resources:previews` to warm that same cache separately. New resources record the submitting member; older records without authorship display “Unknown contributor.”

### Decision and deletion reasons

Task and request approvals/rejections require a reason and append it, the actor, and timestamp to `decisionHistory`. Deletion dialogs also require a reason. `deleteDocument` commits the reason to `<collection>/<document>/activity/<event>` and removes the parent in the same Firestore batch; the activity subcollection survives the deletion. Existing recursive collection rules apply to these events.
