# Bingo X - Build signed AAB for Google Play
# Usage: cd Desktop\BingoX ; .\build-aab.ps1

$ProjectPath  = "$env:USERPROFILE\Desktop\BingoX"
$KeystorePath = "C:\Keys\bingo-x.jks"
$KeyAlias     = "alias"
$AabPath      = "$ProjectPath\android\app\build\outputs\bundle\release\app-release.aab"
$Password     = "Custom.247"

# Relax error handling for background cleanup tasks
$ErrorActionPreference = "Continue"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

Step "Cleaning old build files..."
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
if (Test-Path $AabPath) { Remove-Item $AabPath -Force }

Step "Switching to project: $ProjectPath"
Set-Location $ProjectPath

Step "npm install"
npm install

Step "Building web app"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Web build failed!" -ForegroundColor Red
    exit 1
}

Step "Regenerating Android launcher icon + splash from resources/"
npm run assets:generate

Step "Capacitor sync (Forcing fresh public assets)"
if (Test-Path "android/app/src/main/assets/public") {
    Remove-Item "android/app/src/main/assets/public" -Recurse -Force
}
npx cap sync android

Step "Bumping versionCode..."
$gradle = "android/app/build.gradle"
$content = Get-Content $gradle -Raw
if ($content -match 'versionCode\s+(\d+)') {
    $old = [int]$Matches[1]
    $new = $old + 1
    $content = $content -replace "versionCode\s+$old", "versionCode $new"
    Set-Content $gradle $content -NoNewline
    Write-Host "    versionCode: $old -> $new" -ForegroundColor Green
}

Step "Building signed release AAB"
if (Test-Path -Path "$ProjectPath\android\gradlew.bat") {
    Set-Location "$ProjectPath\android"

    # Stop old daemons to prevent file locking, ignore the "failure" message it generates
    & .\gradlew.bat --stop 2>$null
    & .\gradlew.bat clean 2>$null

    $gradleArgs = @(
        "bundleRelease",
        "-Pandroid.injected.signing.store.file=$KeystorePath",
        "-Pandroid.injected.signing.store.password=$Password",
        "-Pandroid.injected.signing.key.alias=$KeyAlias",
        "-Pandroid.injected.signing.key.password=$Password"
    )
    & .\gradlew.bat @gradleArgs
    $gradleExit = $LASTEXITCODE
} else {
    Write-Error "gradlew.bat not found."
    exit 1
}

Set-Location $ProjectPath

if ($gradleExit -eq 0 -and (Test-Path $AabPath)) {
    Write-Host "`n  SUCCESS" -ForegroundColor Green
    Write-Host "  Signed AAB: $AabPath" -ForegroundColor Green
    Write-Host "  Upload to Play Console -> Production -> Create new release.`n"
    Start-Process explorer.exe "/select,`"$AabPath`""
} else {
    Write-Host "`n  Build FAILED. Please scroll up to check for RED errors in the Gradle log." -ForegroundColor Red
    exit 1
}
