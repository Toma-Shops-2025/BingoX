# Bingo X - Build signed APK for Testing
# Usage: cd Desktop\bingo-x ; .\build-apk.ps1

$ProjectPath  = "$env:USERPROFILE\Desktop\bingo-x"
$KeystorePath = "C:\Keys\bingo-x.jks"
$KeyAlias     = "alias"

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

Step "Switching to project: $ProjectPath"
Set-Location $ProjectPath

Step "npm install"
npm install

Step "Building web app"
npm run build

Step "Capacitor sync (Android)"
npx cap sync android

Step "Keystore credentials (typing is hidden)"
$storePassSecure = Read-Host "Keystore password" -AsSecureString
$keyPassSecure   = Read-Host "Key password (Enter to reuse keystore password)" -AsSecureString

$storePass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePassSecure))
$keyPass   = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPassSecure))
if ([string]::IsNullOrEmpty($keyPass)) { $keyPass = $storePass }

Step "Building signed release APK"
if (Test-Path -Path "$ProjectPath\android\gradlew.bat") {
    Set-Location "$ProjectPath\android"
    $gradleArgs = @(
        "assembleRelease",
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

$apk = "$ProjectPath\android\app\build\outputs\apk\release\app-release.apk"
Set-Location $ProjectPath

if (Test-Path $apk) {
    Write-Host "`n  SUCCESS" -ForegroundColor Green
    Write-Host "  Signed APK: $apk" -ForegroundColor Green
    Write-Host "  Send this file to your phone to test the final version.`n"
    Start-Process explorer.exe "/select,`"$apk`""
} else {
    Write-Error "Build finished but APK not found at $apk"
}
