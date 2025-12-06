# PowerShell script to update Android assets
# This ensures files from /public are copied to Android project

Write-Host "Updating Android assets..." -ForegroundColor Green

# Ensure target directory exists
$targetDir = "android\app\src\main\assets\public"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# Clean old files first to ensure fresh copy
Write-Host "Cleaning old assets..." -ForegroundColor Yellow
if (Test-Path $targetDir) {
    Remove-Item "$targetDir\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# Copy files from public to Android assets
Write-Host "Copying files from public/ to android/app/src/main/assets/public/" -ForegroundColor Yellow
robocopy public $targetDir /E /NFL /NDL /NJH /NJS /NP

# Copy capacitor.config.json
Write-Host "Copying capacitor.config.json..." -ForegroundColor Yellow
Copy-Item -Path "capacitor.config.json" -Destination "android\app\src\main\assets\capacitor.config.json" -Force

# Verify files were copied correctly
Write-Host ""
Write-Host "Verifying copied files..." -ForegroundColor Yellow
$indexHtml = Join-Path $targetDir "index.html"
if (Test-Path $indexHtml) {
    $content = Get-Content $indexHtml -Raw
            if ($content -match '1\.0\.17') {
                Write-Host "index.html contains version 1.0.17" -ForegroundColor Green
            } else {
                Write-Host "WARNING: index.html may not contain expected version" -ForegroundColor Yellow
            }
} else {
    Write-Host "ERROR: index.html not found after copy!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Android assets updated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Build the app: npm run build-android" -ForegroundColor White
Write-Host "2. Verify APK: npm run verify-apk" -ForegroundColor White
Write-Host "3. Install: npm run install-android" -ForegroundColor White

