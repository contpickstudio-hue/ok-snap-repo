# 🔧 PWA Manifest Troubleshooting Guide

If PWABuilder can't detect your manifest, try these fixes:

## ✅ Checklist:

### 1. **Verify Manifest is Accessible**

Open your browser and go to:
```
https://your-website.com/manifest.json
```

You should see the JSON content. If you get 404, the path is wrong.

### 2. **Check Manifest Path**

In `index.html`, the manifest link should be:
```html
<link rel="manifest" href="/manifest.json" type="application/manifest+json">
```

If your site is in a subdirectory (e.g., `/ok-snap/`), use:
```html
<link rel="manifest" href="/ok-snap/manifest.json" type="application/manifest+json">
```

### 3. **Verify Manifest JSON is Valid**

Go to: https://manifest-validator.appspot.com/
- Enter your website URL
- Click "Validate"
- Fix any errors it finds

### 4. **Check Browser Console**

Open browser DevTools (F12) → Console tab
Look for errors like:
- "Failed to load manifest"
- "Manifest: Line: X, column: Y, Syntax error"

### 5. **Test Direct Access**

Try accessing these URLs directly:
- `https://your-site.com/manifest.json`
- `https://your-site.com/icon-192.png`
- `https://your-site.com/icon-512.png`

All should load without errors.

### 6. **Server Configuration**

Make sure your server serves `manifest.json` with:
- Content-Type: `application/manifest+json`
- Or: `application/json`

If using GitHub Pages or Netlify, this is automatic.

### 7. **Clear Browser Cache**

Sometimes cached files cause issues:
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or clear browser cache

### 8. **Check HTTPS**

PWAs require HTTPS. Make sure your site uses:
- `https://` not `http://`

### 9. **Icons Must Exist**

Even if manifest is valid, missing icons can cause issues:
- `icon-192.png` must exist and be accessible
- `icon-512.png` must exist and be accessible
- Both should be in root directory

### 10. **PWABuilder URL**

When using PWABuilder:
- Use your **deployed URL** (not localhost)
- Use **HTTPS** URL
- Make sure URL is accessible

## 🐛 Common Issues:

### Issue: "manifest.json 404 Not Found"

**Fix:**
- Check file is in root directory
- Verify file name is exactly `manifest.json` (case-sensitive)
- Check path in HTML matches file location

### Issue: "Manifest icons not found"

**Fix:**
- Create `icon-192.png` and `icon-512.png`
- Put both in root directory
- Make sure paths in manifest start with `/` (e.g., `/icon-192.png`)

### Issue: "Manifest validation failed"

**Fix:**
- Check JSON syntax (no trailing commas)
- Validate at: https://manifest-validator.appspot.com/
- Make sure all required fields are present

### Issue: PWABuilder says "no manifest" but it exists

**Fix:**
- Try absolute path: `href="/manifest.json"`
- Add MIME type: `type="application/manifest+json"`
- Clear cache and try again
- Wait a few minutes (sometimes takes time to update)

## 🧪 Testing Steps:

1. **Validate JSON:**
   ```
   Copy manifest.json content
   Paste into: https://jsonlint.com/
   Check for syntax errors
   ```

2. **Test Direct Access:**
   ```
   https://your-site.com/manifest.json
   Should show JSON content
   ```

3. **Check Browser DevTools:**
   ```
   Open DevTools (F12)
   Go to Application tab → Manifest
   Check for errors
   ```

4. **PWABuilder Test:**
   ```
   1. Go to https://www.pwabuilder.com/
   2. Enter your HTTPS URL
   3. Click "Start"
   4. Check analysis results
   ```

## 📋 Quick Fix Checklist:

- [ ] Manifest file exists in root directory
- [ ] Manifest file is valid JSON
- [ ] Manifest link in HTML: `<link rel="manifest" href="/manifest.json" type="application/manifest+json">`
- [ ] Icons exist: `icon-192.png` and `icon-512.png`
- [ ] All files accessible via HTTPS
- [ ] Site deployed (not just local)
- [ ] Browser cache cleared
- [ ] Manifest validated at validator site
- [ ] No console errors in browser DevTools

## 🚀 Still Not Working?

1. Share your website URL
2. Share any console errors
3. Share PWABuilder analysis results
4. Verify all files are in root directory

