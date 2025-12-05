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

**👉 Start here: [SETUP_GUIDE.md](./SETUP_GUIDE.md)**

The setup guide has step-by-step instructions with no coding knowledge needed!

## 📋 Quick Overview

1. Install Node.js (free software)
2. Get API keys (OpenAI + Supabase - both free to start)
3. Set up database (copy-paste some code)
4. Start the app (one command)
5. Done! Your app is running

**Total time:** About 30 minutes

## 🔑 What You Need

- Computer (Windows, Mac, or Linux)
- Internet connection
- OpenAI account (free at https://platform.openai.com/)
- Supabase account (free at https://app.supabase.com/)

## 💰 Cost

- **Free to start:** Both OpenAI and Supabase have free tiers
- **Very cheap:** About $0.01 per food identification
- **Estimated:** Less than $5/month for personal use

## 📞 Need Help?

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup instructions
- **[KEEPING_SERVER_RUNNING.md](./KEEPING_SERVER_RUNNING.md)** - How to keep server running 24/7

## 📱 Updating Android App

After modifying files in the `/public` folder (which gets copied to `/www`), update the Android app:

1. **Run the update command:**
   ```bash
   npm run update-android
   ```
   This will:
   - Sync Capacitor configuration
   - Clean old assets
   - Copy latest files from `/www` to Android project

2. **Delete the existing app from your device** (if testing on a physical device)

3. **Rebuild and reinstall** via Android Studio or:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

**Important:** Always delete the old app before reinstalling to ensure WebView cache is cleared and new assets are loaded.

## Version

Current version: 1.0.14
