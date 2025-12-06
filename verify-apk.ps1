# PowerShell script to verify APK contents before installation
# This ensures the APK contains the latest version

Write-Host "Verifying APK contents..." -ForegroundColor Green

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
$metadataPath = "android\app\build\outputs\apk\debug\output-metadata.json"

# Check if APK exists
if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found at $apkPath" -ForegroundColor Red
    Write-Host "Please build the app first: npm run build-android" -ForegroundColor Yellow
    exit 1
}

# Check metadata
if (Test-Path $metadataPath) {
    $metadata = Get-Content $metadataPath | ConvertFrom-Json
    $versionCode = $metadata.elements[0].versionCode
    $versionName = $metadata.elements[0].versionName
    
    Write-Host "APK Metadata:" -ForegroundColor Cyan
    Write-Host "  Version Name: $versionName" -ForegroundColor White
    Write-Host "  Version Code: $versionCode" -ForegroundColor White
    
            if ($versionName -eq "1.0.17" -and $versionCode -eq 18) {
                Write-Host "Version metadata is correct" -ForegroundColor Green
            } else {
                Write-Host "WARNING: Version metadata doesn't match expected values" -ForegroundColor Yellow
                Write-Host "  Expected: versionName=1.0.17, versionCode=18" -ForegroundColor Yellow
            }
} else {
    Write-Host "WARNING: Metadata file not found" -ForegroundColor Yellow
}

# Check APK file timestamp
$apkFile = Get-Item $apkPath
$timeSinceBuild = (Get-Date) - $apkFile.LastWriteTime
Write-Host ""
Write-Host "APK File Info:" -ForegroundColor Cyan
Write-Host "  Last Modified: $($apkFile.LastWriteTime)" -ForegroundColor White
Write-Host "  File Size: $([math]::Round($apkFile.Length / 1MB, 2)) MB" -ForegroundColor White

if ($timeSinceBuild.TotalMinutes -gt 30) {
    Write-Host "WARNING: APK is older than 30 minutes. Consider rebuilding." -ForegroundColor Yellow
}

# Try to extract and verify index.html from APK (if 7zip or similar is available)
Write-Host ""
Write-Host "Attempting to verify APK contents..." -ForegroundColor Yellow

# Check if we can use Java's jar tool or 7zip to extract
$jarTool = Get-Command jar -ErrorAction SilentlyContinue
$zipTool = Get-Command 7z -ErrorAction SilentlyContinue

if ($jarTool -or $zipTool) {
    $tempDir = Join-Path $env:TEMP "apk-verify-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    # Resolve APK path before changing directories
    $resolvedApkPath = Resolve-Path $apkPath
    
    try {
        if ($jarTool) {
            # APK is a ZIP file, jar can extract it
            Push-Location $tempDir
            jar xf $resolvedApkPath assets/public/index.html 2>&1 | Out-Null
            Pop-Location
        } elseif ($zipTool) {
            Push-Location $tempDir
            7z x $resolvedApkPath "assets/public/index.html" -y 2>&1 | Out-Null
            Pop-Location
        }
        
        $extractedHtml = Join-Path $tempDir "assets\public\index.html"
        if (Test-Path $extractedHtml) {
            $htmlContent = Get-Content $extractedHtml -Raw
                    if ($htmlContent -match '1\.0\.17') {
                        Write-Host "APK contains index.html with version 1.0.17" -ForegroundColor Green
                    } else {
                        Write-Host "ERROR: APK contains old version in index.html" -ForegroundColor Red
                        Write-Host "  The APK needs to be rebuilt after running update-android" -ForegroundColor Yellow
                        Remove-Item $tempDir -Recurse -Force
                        exit 1
                    }
        } else {
            Write-Host "Could not extract index.html from APK for verification" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Could not verify APK contents: $_" -ForegroundColor Yellow
    } finally {
        if (Test-Path $tempDir) {
            Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "Cannot verify APK contents (jar or 7zip not found)" -ForegroundColor Yellow
    Write-Host "  Install Java JDK or 7-Zip for automatic verification" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Verification complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If verification passed, you can install with:" -ForegroundColor Cyan
Write-Host "  npm run install-android" -ForegroundColor White

