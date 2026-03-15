# Ok Snap - Food Identification App

A simple app that identifies food from photos using AI. Upload a food picture and get instant information about the dish, including nutrition facts and calorie tracking.

## ✨ What It Does

- 📸 Upload food photos or use camera
- 🤖 AI identifies what food it is
- 🍲 Special focus on Korean cuisine
- 📊 Shows nutrition info (calories, protein, carbs, fat)
- 📝 Track your daily calories
- ⭐ Save your favorite dishes
- 🌍 Works in 5 languages

## 🚀 Getting Started

## 📋 Quick Overview

1. Install Node.js (free software)
2. Get API keys (OpenAI + Supabase - both free to start)
3. Set up database (copy-paste some code)
4. Start the app (one command)
5. Done! Your app is running

**Total time:** About 30 minutes

## 🌐 Run Locally (Web)

The app is **web-first**: run it in your browser without building a native app.

```bash
npm install
cp .env.example .env
# Edit .env: set OPENAI_API_KEY (and SUPABASE_* if you use blog generation)
npm run dev
```

Open **http://localhost:3000** in your browser.

See [.env.example](.env.example) for all optional variables.

## 🚢 Deploy as a Web App (Vercel)

1. Connect this repo to Vercel.
2. In **Project Settings → General**, set **Output Directory** to `public` (so the app is served at `/`).
3. In **Settings → Environment Variables**, add at least `OPENAI_API_KEY`; for blog generation add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`).
4. Deploy. The API is at `/api/*`; cron for `/api/sync-recipes` is in `vercel.json`.

Details and migration notes: [MIGRATION_WEB_FIRST.md](MIGRATION_WEB_FIRST.md).

## 🔑 What You Need

- Computer (Windows, Mac, or Linux)
- Internet connection
- OpenAI account (free at https://platform.openai.com/)
- Supabase account (free at https://app.supabase.com/)

## 💰 Cost

- **Free to start:** Both OpenAI and Supabase have free tiers
- **Very cheap:** About $0.01 per food identification
- **Estimated:** Less than $5/month for personal use

## 🌐 Domains

- **Scanner (this app):** `scanner.ok-snap.com` — the web app (identify dishes, history, favorites).
- **Recipes site:** `recipes.ok-snap.com` — blog/recipe content; links from the scanner open there.
- **API:** Deployed on Vercel; CORS allows `scanner.ok-snap.com` and `recipes.ok-snap.com` by default.

## 📺 Ads (Google AdSense)

The app is set up for **Google AdSense** for web using publisher ID `ca-pub-9493449427784119`. Each page loads the AdSense script and has a responsive ad unit above the bottom nav. Replace `data-ad-slot="XXXXXXXXXX"` with your ad slot ID from the [AdSense](https://www.google.com/adsense/) dashboard to show ads.

## Version

Current version: 1.0.29
