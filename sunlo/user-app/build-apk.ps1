# Sunlo user-app: Gradle se debug APK banane ki script
# Chalane ka tarika (PowerShell mein, user-app folder ke andar):
#   powershell -ExecutionPolicy Bypass -File .\build-apk.ps1
# Tip: project ko C:\sunlo jaisi chhoti path par rakho (Windows 260-char limit).

$ErrorActionPreference = "Stop"

function Fail($msg) { Write-Host "`nX $msg" -ForegroundColor Red; exit 1 }
function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# 0. Sahi folder?
if (-not (Test-Path ".\app.json") -or -not (Test-Path ".\package.json")) {
  Fail "Ye script user-app folder ke andar chalao (jahan app.json hai)."
}
if ((Get-Location).Path.Length -gt 60) {
  Write-Host "! Path lamba hai. Build fail ho to project ko C:\sunlo mein copy karo." -ForegroundColor Yellow
}

# 1. Tools check
Step "Tools check"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js install karo (v20+)." }
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { Fail "JDK 17 ya 21 install karo aur PATH mein jodo." }
if (-not $env:ANDROID_HOME) {
  $default = "$env:LOCALAPPDATA\Android\Sdk"
  if (Test-Path $default) { $env:ANDROID_HOME = $default }
  else { Fail "ANDROID_HOME set nahi hai. Android Studio install karo aur SDK path set karo." }
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
Write-Host "ANDROID_HOME = $env:ANDROID_HOME"

# 2. Zaroori files
Step "Config check"
if (-not (Test-Path ".\google-services.json")) {
  Fail "google-services.json nahi mili. Firebase console se download karke yahin (app.json ke saath) rakho."
}
if (Select-String -Path .\app.json -Pattern "com.yourcompany" -Quiet) {
  Write-Host "! app.json mein abhi placeholder package (com.yourcompany.sunlo) hai." -ForegroundColor Yellow
  Write-Host "  Firebase mein jo package register kiya hai, wahi app.json mein hona chahiye." -ForegroundColor Yellow
}
if (Select-String -Path .\app.json -Pattern "localhost" -Quiet) {
  Write-Host "! apiUrl abhi localhost hai. Emulator: http://10.0.2.2:4000/api/v1, phone: laptop ka LAN IP." -ForegroundColor Yellow
}

# 3. Dependencies
Step "npm install"
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm install fail hua." }

# 4. Android (Gradle) project generate karo
Step "expo prebuild (android/ + Gradle files banega)"
npx expo prebuild --platform android --clean --no-install
if ($LASTEXITCODE -ne 0) { Fail "expo prebuild fail hua." }

# 5. Gradle build
Step "Gradle build (pehli baar 10-20 min lag sakte hain)"
Push-Location android
.\gradlew.bat assembleDebug
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Fail "Gradle build fail hua. Upar ka error paste karo." }

# 6. Result
$apk = Join-Path (Get-Location) "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apk) {
  Write-Host "`nOK APK taiyaar: $apk" -ForegroundColor Green
  Write-Host "Phone par install: adb install -r `"$apk`""
} else {
  Fail "APK nahi mili. android\app\build\outputs\apk\ check karo."
}
