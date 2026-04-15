# CoAssembly

CoAssembly is a Firebase-powered workspace for a designer cooperative.

It includes 3 connected modules sharing the same project and member data:

1. Shared task board by project, including owner board views, time estimates, and archive state.
2. Project kanban board with lead/doer/consultant assignments and collaborator count.
3. Meeting notes tied to projects and authors.

It also includes an admin backend at `/admin` for managing members/projects and staffing fields.

## Tech stack

- Next.js (App Router)
- Firebase Authentication (email + password)
- Cloud Firestore (real-time collaboration)
- Firebase Realtime Database (optional for low-latency feeds)
- Firebase Analytics (optional)
- Tailwind v4 + custom CSS
- Vercel hosting

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and fill Firebase keys:

```bash
cp .env.example .env.local
```

3. Run locally:

```bash
npm run dev
```

## Firebase setup

1. Create a Firebase project.
2. Enable Authentication -> Email/Password.
3. Create a Firestore database in production mode.
4. Apply [firestore.rules](firestore.rules).
5. Add your web app config values to `.env.local`.

Required env vars:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional env var:

- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

Collections used:

- `members`
- `projects`
- `tasks`
- `kanbanCards`
- `meetingNotes`

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add all `NEXT_PUBLIC_FIREBASE_*` environment variables in Vercel project settings.
3. Deploy.

After deploy, the app will connect directly to Firebase from the browser.
