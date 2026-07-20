# Bingo X - Build signed AAB for Google Play
# Usage: cd Desktop\bingo-x ; .\build-aab.ps1

$ProjectPath  = "$env:USERPROFILE\Desktop\bingo-x"
$KeystorePath = "C:\Keys\bingo-x.jks"
$KeyAlias     = "alias"
$BumpVersion  = $true

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

Step "Switching to project: $ProjectPath"
Set-Location $ProjectPath

if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) {
    Write-Host "`n  Keystore file not found: $KeystorePath" -ForegroundColor Yellow
    Write-Host "  Generating a new keystore for Bingo X..." -ForegroundColor Cyan

    if (-not (Test-Path "C:\Keys")) { New-Item -ItemType Directory -Path "C:\Keys" }

    # Generate the keystore (User will be prompted for passwords and details)
    & "keytool" -genkey -v -keystore $KeystorePath -alias $KeyAlias -keyalg RSA -keysize 2048 -validity 10000

    if (-not (Test-Path $KeystorePath)) { Write-Error "Failed to generate keystore." }
}

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
    } else {
        Write-Warning "Could not find versionCode in $gradle"
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

$aab = "$ProjectPath\android\app\build\outputs\bundle\release\app-release.aab"
Set-Location $ProjectPath

if (Test-Path $aab) {
    Write-Host "`n  SUCCESS" -ForegroundColor Green
    Write-Host "  Signed AAB: $aab" -ForegroundColor Green
    Write-Host "  Upload to Play Console.`n"
    Start-Process explorer.exe "/select,`"$aab`""
} else {
    Write-Error "Build finished but AAB not found at $aab"
}
