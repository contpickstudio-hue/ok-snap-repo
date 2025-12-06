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

After modifying files in the `/public` folder, update the Android app:

### Quick Workflow (Recommended)

```bash
# 1. Update assets
npm run update-android

# 2. Build the app
npm run build-android

# 3. Verify APK contains latest version
npm run verify-apk

# 4. Install on device (automatically uninstalls old version)
npm run install-android
```

### Detailed Steps

1. **Update assets:**
   ```bash
   npm run update-android
   ```
   - Copies files from `/public` to Android project
   - Updates Capacitor configuration
   - Verifies files were copied correctly

2. **Build the app:**
   ```bash
   npm run build-android
   ```
   Or manually:
   ```powershell
   cd android
   .\gradlew clean assembleDebug
   cd ..
   ```
   Or in Android Studio:
   - **Build > Clean Project**
   - **File > Invalidate Caches / Restart**
   - **Build > Rebuild Project**

3. **Verify APK (recommended):**
   ```bash
   npm run verify-apk
   ```
   - Checks APK version metadata
   - Verifies `index.html` contains latest version
   - Shows APK file timestamp and size

4. **Install on device:**
   ```bash
   npm run install-android
   ```
   - Automatically uninstalls old app
   - Clears app data cache
   - Installs new APK
   - Verifies installation success

### Troubleshooting

**If you still see the old version:**

1. **Force clean build:**
   ```bash
   Remove-Item android\app\build -Recurse -Force
   Remove-Item android\.gradle -Recurse -Force -ErrorAction SilentlyContinue
   cd android
   ./gradlew clean assembleDebug
   ```

2. **Verify APK contents:**
   ```bash
   npm run verify-apk
   ```
   This will tell you if the APK actually contains the new version.

3. **Manual uninstall:**
   ```bash
   adb uninstall com.oksnap.app
   adb shell pm clear com.oksnap.app
   ```

4. **Check device:**
   - Settings > Apps > OK-Snap > Check version
   - If still old, uninstall manually from device settings
   - Restart device if needed

**Why uninstall?** Android WebView caches files aggressively. Even with cache disabled, completely removing the app ensures no stale files remain.

## Version

Current version: 1.0.16
