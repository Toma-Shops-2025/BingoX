# Bingo X - Build signed AAB for Google Play
# Usage: cd Desktop\bingo-x ; .\build-aab.ps1

$ProjectPath  = "$env:USERPROFILE\Desktop\bingo-x"
$KeystorePath = "C:\Keys\bingo-x.jks"
$KeyAlias     = "alias"
$BumpVersion  = $true
$AabPath      = "$ProjectPath\android\app\build\outputs\bundle\release\app-release.aab"

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

Step "Cleaning old build files..."
if (Test-Path $AabPath) { Remove-Item $AabPath -Force }

Step "Switching to project: $ProjectPath"
Set-Location $ProjectPath

Step "npm install"
npm install

Step "Building web app"
npm run build

Step "Clearing old Android icon + splash outputs"
$resPath = "$ProjectPath\android\app\src\main\res"
if (Test-Path -LiteralPath $resPath -PathType Container) {
    Get-ChildItem -LiteralPath $resPath -Directory -Filter "mipmap-*" | ForEach-Object {
        Remove-Item -LiteralPath (Join-Path $_.FullName "ic_launcher*.png") -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $_.FullName "ic_launcher*.xml") -Force -ErrorAction SilentlyContinue
    }
    Get-ChildItem -LiteralPath $resPath -Directory -Filter "drawable*" | ForEach-Object {
        Remove-Item -LiteralPath (Join-Path $_.FullName "splash*.png") -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $_.FullName "ic_launcher*.xml") -Force -ErrorAction SilentlyContinue
    }
}

Step "Regenerating Android launcher icon + splash from assets/"
npm run assets:generate

Step "Capacitor sync (Android)"
npx cap sync android

if ($BumpVersion) {
    Step "Bumping versionCode"
    $gradle = "android/app/build.gradle"
    $content = Get-Content $gradle -Raw
    if ($content -match 'versionCode\s+(\d+)') {
        $old = [int]$Matches[1]
        $new = $old + 1
        $content = $content -replace "versionCode\s+$old", "versionCode $new"
        Set-Content $gradle $content -NoNewline
        Write-Host "    versionCode: $old -> $new" -ForegroundColor Green
    }
}

Step "Keystore credentials (typing is hidden)"
$storePassSecure = Read-Host "Keystore password" -AsSecureString
$keyPassSecure   = Read-Host "Key password (Enter to reuse keystore password)" -AsSecureString

$storePass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePassSecure))
$keyPass   = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPassSecure))
if ([string]::IsNullOrEmpty($keyPass)) { $keyPass = $storePass }

Step "Building signed release AAB"
if (Test-Path -Path "$ProjectPath\android\gradlew.bat") {
    Set-Location "$ProjectPath\android"
    # Run clean before bundle
    & .\gradlew.bat clean

    $gradleArgs = @(
        "bundleRelease",
        "-Pandroid.injected.signing.store.file=$KeystorePath",
        "-Pandroid.injected.signing.store.password=$storePass",
        "-Pandroid.injected.signing.key.alias=$KeyAlias",
        "-Pandroid.injected.signing.key.password=$keyPass"
    )
    & .\gradlew.bat @gradleArgs
} else {
    Write-Error "gradlew.bat not found."
}

$storePass = $null
$keyPass = $null
[System.GC]::Collect()

Set-Location $ProjectPath

if (Test-Path $AabPath) {
    $time = (Get-Item $AabPath).LastWriteTime
    Write-Host "`n  SUCCESS" -ForegroundColor Green
    Write-Host "  Signed AAB: $AabPath" -ForegroundColor Green
    Write-Host "  Timestamp: $time" -ForegroundColor Yellow
    Write-Host "  Upload to Play Console.`n"
    Start-Process explorer.exe "/select,`"$AabPath`""
} else {
    Write-Error "Build finished but AAB not found at $AabPath"
}
