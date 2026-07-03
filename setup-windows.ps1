# Video2Skill — installation et lancement automatiques sous Windows.
# Usage :  powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1

$ErrorActionPreference = "Stop"

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path", "User")
}

function Ensure-Tool($cmd, $wingetId, $extraPath) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        Write-Host "[OK] $cmd déjà installé" -ForegroundColor Green
        return
    }
    Write-Host "[..] Installation de $wingetId ..." -ForegroundColor Yellow
    winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
    Refresh-Path
    if ($extraPath -and -not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        $env:Path += ";$extraPath"
        [Environment]::SetEnvironmentVariable("Path",
            [Environment]::GetEnvironmentVariable("Path", "User") + ";$extraPath", "User")
    }
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[!!] $cmd introuvable après installation. Ferme et rouvre PowerShell, puis relance ce script." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] $cmd installé" -ForegroundColor Green
}

Write-Host "=== Video2Skill — setup Windows ===" -ForegroundColor Cyan

Ensure-Tool "node" "OpenJS.NodeJS.LTS" $null
Ensure-Tool "ffmpeg" "Gyan.FFmpeg" $null
Ensure-Tool "tesseract" "UB-Mannheim.TesseractOCR" "C:\Program Files\Tesseract-OCR"

# Clés API -> .env.local (jamais commité)
if (-not (Test-Path ".env.local")) {
    Write-Host ""
    Write-Host "Configuration des clés API (stockées dans .env.local, hors git) :" -ForegroundColor Cyan
    $openai = Read-Host "Colle ta clé OpenAI (sk-proj-...)"
    $anthropic = Read-Host "Colle ta clé Anthropic (sk-ant-..., Entrée pour ignorer)"
    $lines = @("OPENAI_API_KEY=$openai")
    if ($anthropic) { $lines += "ANTHROPIC_API_KEY=$anthropic" }
    # Par défaut tout sur OpenAI ; supprime ces 2 lignes pour utiliser Claude (compte crédité requis).
    $lines += "VISION_PROVIDER=openai"
    $lines += "SYNTHESIS_PROVIDER=openai"
    $lines -join "`n" | Out-File -FilePath ".env.local" -Encoding utf8
    Write-Host "[OK] .env.local créé" -ForegroundColor Green
} else {
    Write-Host "[OK] .env.local existe déjà" -ForegroundColor Green
}

Write-Host "[..] npm install ..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "[!!] npm install a échoué" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== Lancement — ouvre http://localhost:3000 ===" -ForegroundColor Cyan
Start-Process "http://localhost:3000"
npm run dev
