# Ok Snap Public Website

This is the public-facing website for Ok Snap, containing the recipe blog and SEO-oriented content.

## Structure

- `index.html` - Homepage
- `about.html` - About page
- `contact.html` - Contact page
- `blog.html` - Blog index and single-post view (`?slug=`). Pretty paths `/blogs/:slug` rewrite here via `vercel.json`.
- `recipes.json` - Optional static metadata (legacy); live listings use the main API `/api/blogs`.
- `styles.css` - Shared stylesheet
- `scripts.js` - Shared JavaScript

## Blog content source

Posts are stored in **Supabase** (see main app `api-handlers/generate-blog.js` and `blogs` table). This site loads them through the **Ok Snap API** (`/api/blogs`, `/api/blogs/:slug`). For crawlers and plain HTML, the API also serves **`GET /api/blog-html/:slug`** on the same deployment as the router.

## Deployment

This site is static HTML/CSS/JS and can be deployed to Netlify, GitHub Pages, Vercel, or similar.

### Vercel (recipes subdomain)

1. **Project Settings:** Root Directory = `public-site`, no build command, output `.`
2. **`vercel.json`** in this folder rewrites `/blogs/:slug` to `blog.html?slug=:slug`
3. Set **`meta name="oksnap-api-base"`** on `blog.html` (optional) to your API origin if it differs from the default API origin used after config load.

### API and env

The recipe site needs a reachable API with `SUPABASE_*` configured. See the main repo `.env.example` and `lib/config.js` (`API_BASE_URL`, `PUBLIC_SITE_URL`).

## Recipes JSON

If present, `recipes.json` can list metadata. The scanner and blog listing primarily use the **`/api/blogs`** JSON API.

## Domain configuration

Public recipe URLs use **`PUBLIC_SITE_URL`** (default `https://recipes.ok-snap.com`) in server config. Blog canonical links point at `blog.html?slug=` on that host.
