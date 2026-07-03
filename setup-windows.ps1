# Video2Skill - installation SANS DROITS ADMIN et lancement sous Windows.
# Usage :  powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
# Node.js et FFmpeg sont installes en versions portables dans %LOCALAPPDATA%\Video2Skill.
# NOTE: fichier volontairement sans accents (compatibilite encodage PowerShell 5.1).

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$toolsDir = Join-Path $env:LOCALAPPDATA "Video2Skill"
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

function Add-UserPath($dir) {
    $env:Path = "$dir;" + $env:Path
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$dir*") {
        [Environment]::SetEnvironmentVariable("Path", "$dir;$userPath", "User")
    }
}

Write-Host "=== Video2Skill - setup Windows (sans admin) ===" -ForegroundColor Cyan

# ---------- Node.js portable ----------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[..] Telechargement de Node.js portable (~30 MB) ..." -ForegroundColor Yellow
    $nodeVersion = "v22.14.0"
    $nodeZip = Join-Path $toolsDir "node.zip"
    Invoke-WebRequest "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip" -OutFile $nodeZip
    Expand-Archive $nodeZip -DestinationPath $toolsDir -Force
    Remove-Item $nodeZip
    Add-UserPath (Join-Path $toolsDir "node-$nodeVersion-win-x64")
    Write-Host "[OK] Node.js installe (portable)" -ForegroundColor Green
} else {
    Write-Host "[OK] node deja installe" -ForegroundColor Green
}

# ---------- FFmpeg portable ----------
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "[..] Telechargement de FFmpeg portable (~90 MB) ..." -ForegroundColor Yellow
    $ffZip = Join-Path $toolsDir "ffmpeg.zip"
    Invoke-WebRequest "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $ffZip
    Expand-Archive $ffZip -DestinationPath $toolsDir -Force
    Remove-Item $ffZip
    $ffDir = Get-ChildItem $toolsDir -Directory | Where-Object { $_.Name -like "ffmpeg-*" } | Select-Object -First 1
    Add-UserPath (Join-Path $ffDir.FullName "bin")
    Write-Host "[OK] FFmpeg installe (portable)" -ForegroundColor Green
} else {
    Write-Host "[OK] ffmpeg deja installe" -ForegroundColor Green
}

# ---------- Tesseract (optionnel : sans lui, l'OCR est saute mais l'app fonctionne) ----------
$tessDefault = "C:\Program Files\Tesseract-OCR"
if (Test-Path (Join-Path $tessDefault "tesseract.exe")) { Add-UserPath $tessDefault }
if (-not (Get-Command tesseract -ErrorAction SilentlyContinue)) {
    Write-Host "[..] Tentative d'installation de Tesseract (peut demander admin) ..." -ForegroundColor Yellow
    try {
        winget install --id UB-Mannheim.TesseractOCR -e --scope user --accept-source-agreements --accept-package-agreements
        if (Test-Path (Join-Path $tessDefault "tesseract.exe")) { Add-UserPath $tessDefault }
    } catch { }
    if (Get-Command tesseract -ErrorAction SilentlyContinue) {
        Write-Host "[OK] Tesseract installe" -ForegroundColor Green
    } else {
        Write-Host "[!!] Tesseract non installe (droits admin requis). L'app fonctionnera SANS OCR." -ForegroundColor Yellow
        Write-Host "     L'analyse visuelle IA des captures compensera en grande partie." -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] tesseract deja installe" -ForegroundColor Green
}

# ---------- Cles API -> .env.local (jamais commite) ----------
if (-not (Test-Path ".env.local")) {
    Write-Host ""
    Write-Host "Configuration des cles API (stockees dans .env.local, hors git) :" -ForegroundColor Cyan
    $openai = Read-Host "Colle ta cle OpenAI (sk-proj-...)"
    $anthropic = Read-Host "Colle ta cle Anthropic (sk-ant-..., ou Entree pour ignorer)"
    $lines = @("OPENAI_API_KEY=$openai")
    if ($anthropic) { $lines += "ANTHROPIC_API_KEY=$anthropic" }
    # Par defaut tout sur OpenAI ; supprime ces 2 lignes pour utiliser Claude (compte credite requis).
    $lines += "VISION_PROVIDER=openai"
    $lines += "SYNTHESIS_PROVIDER=openai"
    $lines -join "`n" | Out-File -FilePath ".env.local" -Encoding ascii
    Write-Host "[OK] .env.local cree" -ForegroundColor Green
} else {
    Write-Host "[OK] .env.local existe deja" -ForegroundColor Green
}

# ---------- Dependances + lancement ----------
Write-Host "[..] npm install ..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "[!!] npm install a echoue" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== Lancement - ouvre http://localhost:3000 ===" -ForegroundColor Cyan
Start-Process "http://localhost:3000"
npm run dev
