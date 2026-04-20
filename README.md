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
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## Dashboard password gate

The app now requires login before entering the dashboard.

- Default password: `solidarity`
- Login route: `/login`
- Session uses a signed, `HttpOnly` cookie.

Recommended env vars:

- `DASHBOARD_PASSWORD` (override default password)
- `AUTH_COOKIE_SECRET` (required in production; long random string)

Example:

```bash
DASHBOARD_PASSWORD=solidarity
AUTH_COOKIE_SECRET=your-long-random-secret
```

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
