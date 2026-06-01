# Affinity Ledger

A desktop app (Electron + React) for tracking company gigs, revenue split, and cash reserves. Data persists in Firebase Firestore. Auth is Google Sign-In via a loopback OAuth flow inside Electron.

## Installing the app

Download the latest installer from the
[**Downloads → Releases**](https://github.com/ccboy5133/affinity-ledger-downloads/releases/latest) page.

| Your computer | File |
|---|---|
| Mac — Apple Silicon (M1–M4) | `Affinity-Ledger-<version>-arm64.dmg` |
| Mac — Intel | `Affinity-Ledger-<version>.dmg` |
| Windows | `Affinity Ledger Setup <version>.exe` |

**macOS:** open the `.dmg` and drag **Affinity Ledger** onto the **Applications** folder.

### "Affinity Ledger is damaged and can't be opened" (macOS)

This is **not** a broken download. The app isn't signed with a paid Apple
certificate, so macOS quarantines it and shows a misleading "damaged" message.
To clear it, open **Terminal** and run:

```bash
xattr -dr com.apple.quarantine "/Applications/Affinity Ledger.app"
```

Then open the app normally. You only have to do this once per install.

> Want to remove this step for everyone? It requires an active **Apple Developer
> membership ($99/yr)** so the app can be code-signed and notarized. Until then,
> the command above is the workaround.

**Windows:** run the `.exe`. SmartScreen may warn (unsigned) — click
**More info → Run anyway** (one time).

### Updating

In the app, go to **Settings → About → Check for updates** (or click the
"Update available" badge in the header). It links to the correct installer for
your platform and architecture. Download it, drag it into Applications, and
choose **Replace** when prompted — your data is stored in the cloud and is not
affected.

## Apple SSO note

You asked: *do I need an Apple Developer account for Apple SSO?* Yes — Sign in with Apple requires a paid Apple Developer membership ($99/yr) plus a Services ID, Team ID, and signing key. Because of that, this build uses **Google Sign-In via Firebase Auth** instead. You can add Apple later by enabling the Apple provider in Firebase Auth once you have a developer account.

## Setup order

1. `npm install`
2. `cp .env.example .env`
3. Do the **one-time setup** below to fill in `.env` (Firebase project + Google OAuth client)
4. `npm run dev`

Skipping step 3 will let the app launch but sign-in will fail — Firebase and Google OAuth both need real credentials.

## One-time setup

### 1. Firebase project
1. Go to <https://console.firebase.google.com/> and create a project.
2. Add a **Web app** (the `</>` icon) to get the `firebaseConfig` values.
3. Copy them into `.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. In **Build → Authentication → Sign-in method**, enable **Google**.
5. In **Build → Firestore Database**, create a database (Production mode is fine).
6. Paste these security rules into Firestore (Rules tab) and click **Publish**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // ── Memberships ──────────────────────────────────────────────────────
       // Each user owns their own membership doc and subcollection.
       match /memberships/{uid} {
         // Legacy flat doc (kept for migration support)
         allow read, write: if request.auth != null && request.auth.uid == uid;

         // New subcollection: /memberships/{uid}/companies/{companyId}
         match /companies/{companyId} {
           allow read, write: if request.auth != null && request.auth.uid == uid;
         }
       }

       // ── Companies ────────────────────────────────────────────────────────
       match /companies/{companyId} {
         function isOwner() {
           return request.auth != null && resource.data.ownerId == request.auth.uid;
         }
         // Legacy: very old data stored the company doc at /companies/{uid}
         function isLegacyOwner() {
           return request.auth != null && companyId == request.auth.uid;
         }
         function isMember() {
           return request.auth != null &&
             exists(/databases/$(database)/documents/memberships/$(request.auth.uid)/companies/$(companyId));
         }
         // Owner check that works inside subcollections (reads the parent doc)
         function ownerByGet() {
           return request.auth != null &&
             get(/databases/$(database)/documents/companies/$(companyId)).data.ownerId == request.auth.uid;
         }

         // Reads: owner or any member. Writes to the company doc itself
         // (employees, permissions, ownerId, settings) are OWNER-ONLY, so
         // members cannot escalate their own permissions or edit the roster.
         allow read:   if isOwner() || isMember() || isLegacyOwner();
         allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
         allow update: if (isOwner() || isLegacyOwner())
                          && request.resource.data.ownerId == resource.data.ownerId;
         allow delete: if isOwner() || isLegacyOwner();

         // Ledger data: owner + members may read/write (this is the shared ledger).
         match /events/{eventId} {
           allow read, write: if ownerByGet() || isMember() || isLegacyOwner();
         }
         match /expenses/{expenseId} {
           allow read, write: if ownerByGet() || isMember() || isLegacyOwner();
         }
         match /tabs/{tabId} {
           allow read, write: if ownerByGet() || isMember() || isLegacyOwner();
         }
       }

       // ── Invitations ──────────────────────────────────────────────────────
       // /invites/{encodedEmail}/pending/{companyId}
       // Read: only the person whose email it is. Create: the inviting owner.
       // Update: the invitee accepting/declining their own invite.
       match /invites/{emailKey}/pending/{companyId} {
         function isInviteOwner() {
           return request.auth != null &&
             get(/databases/$(database)/documents/companies/$(companyId)).data.ownerId == request.auth.uid;
         }
         function isOwnEmail() {
           // NOTE: replace() uses a REGEX — the dot must be escaped as '\\.'
           // ('.' would match any character and corrupt the key).
           return request.auth != null && request.auth.token.email != null
             && emailKey == request.auth.token.email.lower().replace('\\.', ',');
         }
         // list/get by the invitee (their email == the key) — no get() needed,
         // so collection queries from the invited user succeed.
         allow list: if isOwnEmail();
         allow get:  if isOwnEmail() || isInviteOwner();
         allow create: if isInviteOwner();
         allow update: if isOwnEmail() || isInviteOwner();
       }
     }
   }
   ```

### 2. Google OAuth client (separate from Firebase)
Electron can't use Firebase's `signInWithPopup` directly, so we run a Google OAuth flow in a child window and feed the resulting ID token into Firebase Auth.

1. Open <https://console.cloud.google.com/> for the **same project** Firebase created.
2. Go to **APIs & Services → OAuth consent screen**, configure it (External, add your email as a test user).
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Choose **Web application**.
5. Under **Authorized redirect URIs** add `http://127.0.0.1` (the app uses a loopback redirect on a random port — `127.0.0.1` matches any port).
6. Copy the **Client ID** and **Client secret** into `.env`:
   - `VITE_GOOGLE_OAUTH_CLIENT_ID`
   - `VITE_GOOGLE_OAUTH_CLIENT_SECRET`

> Note: Google's client secret for a desktop/Electron app isn't truly secret (it ships in the binary). Google accepts this for installed-app flows; rely on Firestore rules to enforce per-user data isolation.

### 3. Run it

```bash
npm run dev
```

Vite serves the renderer on `http://localhost:5173`; Electron loads it. On first sign-in you'll see an onboarding screen to enter your company name and employees, then land on the dashboard.

## What's where

```
electron/
  main.js     # Window + IPC for OAuth
  preload.js  # contextBridge (window.ledger)
  auth.js     # Google OAuth loopback + PKCE
src/
  App.jsx           # Top-level routing (auth → onboarding → dashboard)
  firebase.js       # Firebase init + signInWithGoogleIdToken
  hooks/
    useAuth.js      # onAuthStateChanged
    useCompany.js   # /companies/{uid}
    useEvents.js    # /companies/{uid}/events + totals
  components/
    Login.jsx
    Onboarding.jsx
    Dashboard.jsx       # KPIs + event list
    AddEventModal.jsx   # New event form (split slider)
    EventDetail.jsx     # Detail + delete
    EmployeeManager.jsx # Add/remove employees
  styles.css
```

## Data model

```
/companies/{uid}
  name: string
  employees: string[]
  createdAt, updatedAt

  /events/{eventId}
    name: string
    date: ISO date string
    grossIncome: number
    savedPct: 0–100
    employees: string[]
    notes: string
    createdAt: epoch ms
```

`reserve = sum(grossIncome * savedPct / 100)` across all events. `salaries = gross - reserve`.

## Building for distribution

This setup runs in dev mode. To ship installers, add `electron-builder`:
```bash
npm i -D electron-builder
```
and add a `build` section to `package.json`. (Not included by default — keep the scope minimal until you actually need installers.)
