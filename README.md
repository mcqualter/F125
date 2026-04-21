# F1 25 Pit Wall

Lap times + championship league tracker for F1 25, built for a group of mates.
Shared data across everyone's devices via Netlify Blobs — no external database,
no signups, no config.

## Stack

- **Vite 5** + **React 18**
- **Tailwind CSS 3** for utilities (custom styling inline for racing visuals)
- **`lucide-react`** for icons
- **Netlify Functions** + **Netlify Blobs** for shared persistence
- **localStorage** for offline cache

## Run locally

```bash
npm install
npm run dev
```

This starts Vite on http://localhost:5173. The function isn't available in
regular `vite dev` mode — see below for how to run the full stack locally.

### Running with the Netlify Function locally

Install the Netlify CLI:

```bash
npm install -g netlify-cli
```

Then run:

```bash
netlify dev
```

This spins up Vite + the serverless function together, on a single port. The
Blobs store is emulated locally — when you deploy, the same code talks to
Netlify's hosted Blobs.

## Deploy to Netlify

### One-time setup (GitHub + Netlify)

1. Create a new repo on GitHub (e.g. `f1-pit-wall`)
2. From this folder:

   ```bash
   git init
   git add .
   git commit -m "Pit Wall"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/f1-pit-wall.git
   git push -u origin main
   ```

3. Go to https://app.netlify.com → **Add new site → Import existing project**
4. Connect GitHub, pick the `f1-pit-wall` repo
5. Netlify auto-detects config from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
6. Hit **Deploy**

That's it. No env vars, no API keys, no Blobs setup needed — Netlify Blobs
is automatically available to every site on the platform.

Every `git push` to `main` will trigger a redeploy.

### Custom domain

In Netlify: **Site configuration → Domain management → Add custom domain**.
HTTPS is automatic via Let's Encrypt.

## How data works

### The architecture

- One serverless function at `/api/pitwall` (`netlify/functions/pitwall.js`)
  - `GET` returns the full championship state
  - `POST` overwrites the full championship state with the body
- State is stored as a single JSON blob under the key `state` in a Blobs store
  called `pitwall`
- The client fetches state on load, then calls `POST` after every mutation
  (optimistically — the UI updates immediately)
- `localStorage` keeps a local cache so the app loads instantly and works
  offline

### Concurrency note

The app uses a simple "last write wins" model. If Mick and Ty both open the
site at the same moment and both add a lap in the same ~second, the second
save will overwrite the first. In practice this won't matter for a group
chat-driven league (people say "I'm adding my lap" before they do). If you
ever need something more robust, the function could be extended to do
optimistic concurrency with a version number — but don't build it until
you hit the problem.

### Refresh button

The header shows a **SYNCED** pill that doubles as a refresh button. Click
it to pull the latest state from the server — useful if someone else just
added a lap and you want it on your screen without waiting.

### Limits

Netlify free tier: 125k function invocations/month, 100 GB Blobs storage.
A lap-time app for three mates uses well under 1% of that.

## Project structure

```
.
├── index.html
├── netlify.toml              # build + function + redirect config
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── netlify/
│   └── functions/
│       └── pitwall.js        # API function (GET/POST state)
└── src/
    ├── App.jsx               # the whole app
    ├── index.css             # Tailwind directives
    └── main.jsx              # React entry
```

## Adding or removing drivers mid-season

The app supports this natively. Hit the "Drivers" tab, add whoever, and
their stats start counting from races logged after they're added. Deleting
a driver preserves their historical lap times and race results — they just
show as "(deleted)" where they appear.

## Seed data

`netlify/functions/pitwall.js` contains `INITIAL_STATE` — the data served on
first load when the Blobs store is empty. It includes the 18 lap times from
the original spreadsheet. Once anyone saves anything, that becomes the stored
state and the initial data is never seen again.

If you ever want to wipe everything and start fresh, delete the Blobs store
via the Netlify dashboard (Site → Blobs → `pitwall` → delete key `state`)
and the next page load will serve the initial data again.

## License

Yours. Fork it, mod it, share it with your league.
