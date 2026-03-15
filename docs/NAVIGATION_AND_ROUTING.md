# Navigation and Routing

This doc summarizes the app’s page structure and routing so every visible or expected destination works.

## Page structure (scanner app – `public/`)

| Path | Purpose |
|------|--------|
| `/` or `/index.html` | Discover (main scanner) |
| `/history.html` | Scan history |
| `/favorites.html` | Saved favorites |
| `/browse.html` | Browse recipes |
| `/settings.html` | Settings, account, legal links |
| `/privacy.html` | Privacy policy |
| `/terms.html` | Terms of service |
| `/about.html` | About Ok Snap |
| `/contact.html` | Contact |

All internal links use relative paths (e.g. `settings.html`, `privacy.html`). The recipe/blog site is separate (`recipes.ok-snap.com`); links to full posts use `getPublicSiteUrl()` and `/blog.html?slug=...`.

## Entry and rewrites

- **Root:** `vercel.json` rewrites `/` → `/index.html` so the app loads at the bare domain.
- **Vercel:** If the project uses a root/output directory, set it to `public` so these paths resolve.
- **Local:** `server.js` serves `public/` at the root, so `/`, `/index.html`, `/settings.html`, etc. work as above.

## Navigation and links

- **Bottom nav (all main pages):** Discover → `index.html`, History → `history.html`, Favorites → `favorites.html`, Browse → `browse.html`, Settings → `settings.html`.
- **Settings:** “Legal & support” and footer link to `privacy.html`, `terms.html`, `about.html`, `contact.html`.
- **Legal pages:** “← Back” goes to `settings.html`; “Ok Snap” and “Back to app” go to `index.html`. Footer links repeat Privacy / Terms / About / Contact.
- **Dynamic links:** “View Full Blog Post” and “Find Nearby Restaurants” start as `javascript:void(0)` and are set in JS when a result is ready, so early clicks don’t navigate to `#`.

## Service worker

`public/service-worker.js` precaches the main and legal pages and `legal.css` so they work offline. Cache version is bumped with app version.

## Authentication and legal compliance

- **Login modal:** Shows a short data notice (“We use your account to save and sync…”) with links to [Privacy Policy](privacy.html) and [Terms of Service](terms.html). Links open in a new tab.
- **Sign-up form:** Includes consent text above the Sign Up button: “By creating an account you agree to our Terms of Service and Privacy Policy” with links to `terms.html` and `privacy.html`.
- **Privacy Policy:** States that creating an account confirms acceptance of the Privacy Policy and Terms.
- **Terms of Service:** States that creating an account indicates agreement to the Terms and Privacy Policy.

## API routes (Vercel)

API is under `/api/*` and routed by `api/index.js`. Used routes:

- `GET /api/config`
- `POST /api/identify`
- `POST /api/generate-blog`
- `GET /api/recipes-json`, `GET|POST /api/recipes-store`, `GET|POST /api/sync-recipes`
- `GET /api/scan-limit`, `POST /api/decrement-scan-count`
- `GET /api/blogs`, `GET /api/blogs/:slug`, `GET /api/blog-exists/:slug`

Frontend uses `getApiBase()` (from `/api/config` or fallback) so the same code works on localhost and production.
