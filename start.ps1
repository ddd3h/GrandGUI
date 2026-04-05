#Requires -Version 5.1
# GrandGUI startup script (PowerShell)
# Usage: powershell -ExecutionPolicy Bypass -File start.ps1

$ErrorActionPreference = "Stop"
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"
$DataDir    = Join-Path $ScriptDir "data"

# Create data directories
New-Item -ItemType Directory -Force -Path "$DataDir\maps" | Out-Null

Write-Host "[INFO] GrandGUI 起動スクリプト (PowerShell)" -ForegroundColor Cyan

# Check Python
try {
    $pyVer = python --version 2>&1
    Write-Host "[OK]   $pyVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python が見つかりません。https://www.python.org/ からインストールしてください。" -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVer = node --version 2>&1
    Write-Host "[OK]   Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js が見つかりません。https://nodejs.org/ からインストールしてください。" -ForegroundColor Red
    exit 1
}

# Setup backend venv
Set-Location $BackendDir
if (-not (Test-Path ".venv")) {
    Write-Host "[INFO] Python 仮想環境を作成中..." -ForegroundColor Yellow
    python -m venv .venv
    Write-Host "[INFO] 依存パッケージをインストール中..." -ForegroundColor Yellow
    & ".venv\Scripts\pip" install -r requirements.txt -q
}

# Build frontend
Set-Location $FrontendDir
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] フロントエンドの依存パッケージをインストール中..." -ForegroundColor Yellow
    npm install
}
Write-Host "[INFO] フロントエンドをビルド中..." -ForegroundColor Yellow
npm run build

# Set environment variables
$env:DATABASE_URL = "sqlite:///$($DataDir.Replace('\','/'))/grandgui.db"
$env:MAPS_DIR     = "$DataDir\maps"

# Start backend
Set-Location $BackendDir
Write-Host ""
Write-Host "[INFO] バックエンドを起動しています → http://localhost:8000" -ForegroundColor Green
Write-Host "[INFO] 終了するには Ctrl+C を押してください。" -ForegroundColor Gray
Write-Host ""

# Open browser after a short delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8000"
} | Out-Null

& ".venv\Scripts\uvicorn" app.main:app --host 0.0.0.0 --port 8000
