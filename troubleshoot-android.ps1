# Android App Troubleshooting Script
Write-Host "=== Android App Troubleshooting ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check source file
Write-Host "1. Checking public/index.html..." -ForegroundColor Yellow
$title = Get-Content "public\index.html" | Select-String "<title>"
Write-Host "   Title: $title" -ForegroundColor $(if ($title -match "Discover Food") { "Green" } else { "Red" })
Write-Host ""

# Step 2: Check if Android assets exist
Write-Host "2. Checking Android assets..." -ForegroundColor Yellow
$androidIndex = "android\app\src\main\assets\public\index.html"
if (Test-Path $androidIndex) {
    $androidTitle = Get-Content $androidIndex | Select-String "<title>"
    Write-Host "   Android assets exist" -ForegroundColor Green
    Write-Host "   Title: $androidTitle" -ForegroundColor $(if ($androidTitle -match "Discover Food") { "Green" } else { "Red" })
    
    # Check API_BASE
    $apiBase = Get-Content $androidIndex | Select-String "ok-snap-identifier"
    if ($apiBase) {
        Write-Host "   API_BASE: Found ok-snap-identifier" -ForegroundColor Green
    } else {
        Write-Host "   API_BASE: NOT FOUND - needs update" -ForegroundColor Red
    }
} else {
    Write-Host "   Android assets NOT FOUND - run: npm run update-android" -ForegroundColor Red
}
Write-Host ""

# Step 3: Check Capacitor config
Write-Host "3. Checking Capacitor config..." -ForegroundColor Yellow
$capConfig = "android\app\src\main\assets\capacitor.config.json"
if (Test-Path $capConfig) {
    $webDir = Get-Content $capConfig | ConvertFrom-Json | Select-Object -ExpandProperty webDir
    Write-Host "   webDir: $webDir" -ForegroundColor $(if ($webDir -eq "public") { "Green" } else { "Red" })
} else {
    Write-Host "   Capacitor config NOT FOUND" -ForegroundColor Red
}
Write-Host ""

# Step 4: Recommendations
Write-Host "=== Recommendations ===" -ForegroundColor Cyan
if (-not (Test-Path $androidIndex)) {
    Write-Host "1. Run: npm run update-android" -ForegroundColor Yellow
}
Write-Host "2. Clean build: cd android; .\gradlew clean" -ForegroundColor Yellow
Write-Host "3. Build: .\gradlew assembleDebug" -ForegroundColor Yellow
Write-Host "4. Install: adb install -r app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Yellow

