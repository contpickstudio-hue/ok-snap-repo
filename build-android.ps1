# PowerShell script to build Android APK
# This ensures a clean build with latest assets

Write-Host "Building Android APK..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "android\gradlew.bat")) {
    Write-Host "ERROR: android\gradlew.bat not found" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory" -ForegroundColor Yellow
    exit 1
}

# Change to android directory
Push-Location android

try {
    Write-Host "Cleaning build..." -ForegroundColor Yellow
    .\gradlew clean
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Clean failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Building debug APK..." -ForegroundColor Yellow
    .\gradlew assembleDebug
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Build completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK location: android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Verify APK: npm run verify-apk" -ForegroundColor White
        Write-Host "2. Install: npm run install-android" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "ERROR: Build failed" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

