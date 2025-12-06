# PowerShell script to install the correct Android APK
# This ensures the latest version is installed on your device

Write-Host "Installing Android APK..." -ForegroundColor Green

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"

if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found at $apkPath" -ForegroundColor Red
    Write-Host "Please build the app first: npm run build-android" -ForegroundColor Yellow
    exit 1
}

# Check if ADB is available
$adbCheck = Get-Command adb -ErrorAction SilentlyContinue
$adbPath = $null

if (-not $adbCheck) {
    # Try to find ADB in common Android SDK locations
    $commonPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe",
        "$env:ANDROID_HOME\platform-tools\adb.exe",
        "${env:ProgramFiles(x86)}\Android\android-sdk\platform-tools\adb.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $adbPath = $path
            Write-Host "Found ADB at: $path" -ForegroundColor Green
            break
        }
    }
    
    if (-not $adbPath) {
        Write-Host "ERROR: ADB not found in PATH or common locations" -ForegroundColor Red
        Write-Host ""
        Write-Host "To fix this:" -ForegroundColor Yellow
        Write-Host "1. Install Android SDK Platform Tools from:" -ForegroundColor White
        Write-Host "   https://developer.android.com/studio/releases/platform-tools" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "2. Or if Android Studio is installed, add to PATH:" -ForegroundColor White
        Write-Host "   %LOCALAPPDATA%\Android\Sdk\platform-tools" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "3. Or set ANDROID_HOME environment variable to your SDK path" -ForegroundColor White
        exit 1
    }
} else {
    $adbPath = "adb"
}

# Check if device is connected
Write-Host "Checking for connected devices..." -ForegroundColor Yellow
if ($adbPath -ne "adb") {
    $deviceList = & $adbPath devices 2>&1
} else {
    $deviceList = adb devices 2>&1
}

$devices = $deviceList | Select-String -Pattern "device$"
if (-not $devices) {
    Write-Host "ERROR: No Android device found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "1. Your device is connected via USB" -ForegroundColor White
    Write-Host "2. USB debugging is enabled (Settings > Developer Options)" -ForegroundColor White
    Write-Host "3. You've accepted the USB debugging prompt on your device" -ForegroundColor White
    Write-Host "4. Run 'adb devices' to verify connection" -ForegroundColor White
    exit 1
}

# Handle multiple devices
$deviceCount = ($devices | Measure-Object).Count
$targetDevice = $null

if ($deviceCount -gt 1) {
    Write-Host ""
    Write-Host "Multiple devices found:" -ForegroundColor Yellow
    $deviceIndex = 1
    $deviceArray = @()
    foreach ($device in $devices) {
        $deviceId = ($device -replace '\s+device$', '').Trim()
        $deviceArray += $deviceId
        
        # Check if it's an emulator
        $isEmulator = $deviceId -match "^emulator-"
        $deviceType = if ($isEmulator) { "Emulator" } else { "Physical Device" }
        
        Write-Host "  $deviceIndex. $deviceId ($deviceType)" -ForegroundColor White
        $deviceIndex++
    }
    
    # Prefer physical devices over emulators
    $physicalDevices = $deviceArray | Where-Object { $_ -notmatch "^emulator-" }
    if ($physicalDevices) {
        $targetDevice = $physicalDevices[0]
        Write-Host ""
        Write-Host "Auto-selecting first physical device: $targetDevice" -ForegroundColor Green
    } else {
        $targetDevice = $deviceArray[0]
        Write-Host ""
        Write-Host "Auto-selecting first device: $targetDevice" -ForegroundColor Green
    }
} else {
    $targetDevice = ($devices[0] -replace '\s+device$', '').Trim()
    if ($targetDevice -and $targetDevice -ne "") {
        Write-Host "Device found: $targetDevice" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Could not determine device ID" -ForegroundColor Red
        Write-Host "Device list output:" -ForegroundColor Yellow
        Write-Host $deviceList -ForegroundColor White
        exit 1
    }
}

# Verify targetDevice is set
if (-not $targetDevice -or $targetDevice.Trim() -eq "") {
    Write-Host "ERROR: No target device selected" -ForegroundColor Red
    exit 1
}

# Create ADB command wrapper that includes device selection if needed
function Invoke-AdbCommand {
    param(
        [string]$Command,
        [string]$DeviceId = $null
    )
    
    # Split command into arguments
    $commandArgs = $Command -split '\s+'
    
    if ($adbPath -ne "adb") {
        if ($DeviceId -and $DeviceId.Trim() -ne "") {
            $allArgs = @("-s", $DeviceId) + $commandArgs
            return & $adbPath $allArgs 2>&1
        } else {
            return & $adbPath $commandArgs 2>&1
        }
    } else {
        if ($DeviceId -and $DeviceId.Trim() -ne "") {
            $allArgs = @("-s", $DeviceId) + $commandArgs
            return adb $allArgs 2>&1
        } else {
            return adb $commandArgs 2>&1
        }
    }
}

# Check APK version
Write-Host ""
Write-Host "Checking APK version..." -ForegroundColor Yellow
$metadataPath = "android\app\build\outputs\apk\debug\output-metadata.json"
$versionName = "unknown"
$versionCode = "unknown"

if (Test-Path $metadataPath) {
    $metadata = Get-Content $metadataPath | ConvertFrom-Json
    $versionCode = $metadata.elements[0].versionCode
    $versionName = $metadata.elements[0].versionName
    Write-Host "APK Version: $versionName (Code: $versionCode)" -ForegroundColor Cyan
} else {
    Write-Host "WARNING: Metadata file not found" -ForegroundColor Yellow
}

# Check if app is already installed and get its version
Write-Host ""
Write-Host "Checking installed app version..." -ForegroundColor Yellow
$installedApp = Invoke-AdbCommand "shell pm list packages" -DeviceId $targetDevice | Select-String "com.oksnap.app"
if ($installedApp) {
    $installedVersion = Invoke-AdbCommand "shell dumpsys package com.oksnap.app" -DeviceId $targetDevice | Select-String "versionCode" | Select-Object -First 1
    if ($installedVersion) {
        Write-Host "Currently installed: $installedVersion" -ForegroundColor Yellow
    }
}

# Force stop the app first
Write-Host ""
Write-Host "Stopping app if running..." -ForegroundColor Yellow
Invoke-AdbCommand "shell am force-stop com.oksnap.app" -DeviceId $targetDevice | Out-Null

# Uninstall old app completely
Write-Host "Uninstalling old app from device..." -ForegroundColor Yellow
$uninstallResult = Invoke-AdbCommand "uninstall com.oksnap.app" -DeviceId $targetDevice
if ($LASTEXITCODE -eq 0) {
    Write-Host "App uninstalled successfully" -ForegroundColor Green
} else {
    Write-Host "App may not have been installed, continuing..." -ForegroundColor Yellow
}

# Clear app data cache (in case uninstall didn't work)
Write-Host "Clearing app data cache..." -ForegroundColor Yellow
Invoke-AdbCommand "shell pm clear com.oksnap.app" -DeviceId $targetDevice | Out-Null

# Small delay to ensure uninstall completes
Start-Sleep -Seconds 2

# Install new APK
Write-Host ""
Write-Host "Installing new APK..." -ForegroundColor Yellow
Write-Host "  File: $apkPath" -ForegroundColor Gray
Write-Host "  Size: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor Gray

$result = Invoke-AdbCommand "install -r $apkPath" -DeviceId $targetDevice

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "APK installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The app should now show version $versionName" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Open the app on your device" -ForegroundColor White
    Write-Host "2. Check Settings > About to verify version" -ForegroundColor White
    Write-Host "3. If you still see old version, restart your device" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host $result -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure USB debugging is enabled" -ForegroundColor White
    Write-Host "2. If multiple devices are connected, disconnect emulators or specify device:" -ForegroundColor White
    $adbCmd = if ($adbPath -ne "adb") { $adbPath } else { "adb" }
    Write-Host "   $adbCmd -s $targetDevice install -r $apkPath" -ForegroundColor Cyan
    Write-Host "3. Try: $adbCmd kill-server; $adbCmd start-server" -ForegroundColor White
    Write-Host "4. Check: $adbCmd devices (should show your device)" -ForegroundColor White
    exit 1
}

