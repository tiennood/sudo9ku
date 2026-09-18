# Tự động hóa toàn bộ quy trình tải JDK, Android SDK và Build file APK Sudoku Vision
$ErrorActionPreference = "Stop"
$toolsDir = $PSScriptRoot
$rootDir = (Get-Item $toolsDir).Parent.FullName
$androidDir = Join-Path $rootDir "android"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   BẮT ĐẦU TỰ ĐỘNG BIÊN DỊCH FILE APK CHO SUDOKU VISION" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. TẢI VÀ GIẢI NÉN PORTABLE OPENJDK 17
$jdkZip = Join-Path $toolsDir "jdk17.zip"
$jdkExtractDir = Join-Path $toolsDir "jdk17"

if (-not (Test-Path $jdkExtractDir)) {
    Write-Host "`n[1/5] Đang tải OpenJDK 17 Portable từ Adoptium (~190MB)..." -ForegroundColor Yellow
    $jdkUrl = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
    & curl.exe -L -o $jdkZip $jdkUrl --retry 3 --progress-bar

    Write-Host "Đang giải nén JDK 17..." -ForegroundColor Yellow
    Expand-Archive -Path $jdkZip -DestinationPath $jdkExtractDir -Force
    Remove-Item -Path $jdkZip -Force -ErrorAction SilentlyContinue
}

$jdkHome = (Get-ChildItem -Path $jdkExtractDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName "bin\javac.exe") } | Select-Object -First 1).FullName
if (-not $jdkHome) {
    if (Test-Path (Join-Path $jdkExtractDir "bin\javac.exe")) {
        $jdkHome = $jdkExtractDir
    }
}
Write-Host "✓ JDK 17 sẵn sàng tại: $jdkHome" -ForegroundColor Green

# 2. TẢI VÀ GIẢI NÉN GRADLE 8.5
$gradleZip = Join-Path $toolsDir "gradle.zip"
$gradleExtractDir = Join-Path $toolsDir "gradle"

if (-not (Test-Path $gradleExtractDir)) {
    Write-Host "`n[2/5] Đang tải Gradle 8.5 Binary (~130MB)..." -ForegroundColor Yellow
    $gradleUrl = "https://services.gradle.org/distributions/gradle-8.5-bin.zip"
    & curl.exe -L -o $gradleZip $gradleUrl --retry 3 --progress-bar

    Write-Host "Đang giải nén Gradle 8.5..." -ForegroundColor Yellow
    Expand-Archive -Path $gradleZip -DestinationPath $gradleExtractDir -Force
    Remove-Item -Path $gradleZip -Force -ErrorAction SilentlyContinue
}

$gradleHome = (Get-ChildItem -Path $gradleExtractDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName "bin\gradle.bat") } | Select-Object -First 1).FullName
$gradleBat = Join-Path $gradleHome "bin\gradle.bat"
Write-Host "✓ Gradle 8.5 sẵn sàng tại: $gradleBat" -ForegroundColor Green

# 3. TẢI VÀ CẤU HÌNH ANDROID COMMAND-LINE TOOLS
$sdkDir = Join-Path $toolsDir "android-sdk"
$cmdlineDir = Join-Path $sdkDir "cmdline-tools\latest"

if (-not (Test-Path $cmdlineDir)) {
    Write-Host "`n[3/5] Đang tải Android Command-line Tools từ Google (~145MB)..." -ForegroundColor Yellow
    $cmdlineZip = Join-Path $toolsDir "cmdline-tools.zip"
    $cmdlineUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
    & curl.exe -L -o $cmdlineZip $cmdlineUrl --retry 3 --progress-bar

    Write-Host "Đang giải nén Android Command-line Tools..." -ForegroundColor Yellow
    $tempExtract = Join-Path $toolsDir "temp_cmdline"
    Expand-Archive -Path $cmdlineZip -DestinationPath $tempExtract -Force

    New-Item -ItemType Directory -Force -Path (Join-Path $sdkDir "cmdline-tools") | Out-Null
    Move-Item -Path (Join-Path $tempExtract "cmdline-tools") -Destination $cmdlineDir -Force
    Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $cmdlineZip -Force -ErrorAction SilentlyContinue
}

$sdkManagerBat = Join-Path $cmdlineDir "bin\sdkmanager.bat"
Write-Host "✓ Android Command-line Tools sẵn sàng tại: $sdkManagerBat" -ForegroundColor Green

# 4. THIẾT LẬP BIẾN MÔI TRƯỜNG VÀ CÀI ĐẶT ANDROID SDK 34
Write-Host "`n[4/5] Đang cài đặt Android Platform 34 & Build-tools 34.0.0..." -ForegroundColor Yellow
$env:JAVA_HOME = $jdkHome
$env:ANDROID_HOME = $sdkDir
$env:ANDROID_SDK_ROOT = $sdkDir
$env:PATH = "$jdkHome\bin;$cmdlineDir\bin;$sdkDir\platform-tools;$env:PATH"

# Tự động chấp nhận licenses của Google Android SDK
Write-Host "Chấp nhận điều khoản bản quyền Android SDK..." -ForegroundColor Yellow
$yesInput = "y`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny`ny"
$yesInput | & $sdkManagerBat --sdk_root=$sdkDir --licenses | Out-Null

# Tải platform-tools, platforms;android-34 và build-tools;34.0.0 nếu chưa có
if (-not (Test-Path (Join-Path $sdkDir "platforms\android-34"))) {
    Write-Host "Tải android-34 và build-tools-34..." -ForegroundColor Yellow
    & $sdkManagerBat --sdk_root=$sdkDir "platforms;android-34" "build-tools;34.0.0" "platform-tools"
}
Write-Host "✓ Android SDK 34 đã sẵn sàng!" -ForegroundColor Green

# 5. BIÊN DỊCH DỰ ÁN THÀNH FILE APK
Write-Host "`n[5/5] Đang thực thi Gradle build để xuất file APK..." -ForegroundColor Yellow
Push-Location $androidDir

try {
    # Chạy Gradle assembleDebug
    & $gradleBat assembleDebug --no-daemon --stacktrace
} finally {
    Pop-Location
}

# 6. KIỂM TRA FILE APK VÀ XUẤT RA THƯ MỤC CHÍNH
$outputApk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $outputApk) {
    $targetApk = Join-Path $rootDir "Sudo9ku.apk"
    Copy-Item -Path $outputApk -Destination $targetApk -Force
    # Đồng thời sao chép SudokuVision.apk để tương thích ngược
    $compatApk = Join-Path $rootDir "SudokuVision.apk"
    Copy-Item -Path $outputApk -Destination $compatApk -Force

    $apkSizeMB = [math]::Round(((Get-Item $targetApk).Length / 1MB), 2)

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "   🎉 XUẤT THÀNH CÔNG FILE APK SUDO9KU!" -ForegroundColor Green
    Write-Host "   📦 Vị trí file: $targetApk ($apkSizeMB MB)" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Error "Không tìm thấy file output APK tại: $outputApk"
}
