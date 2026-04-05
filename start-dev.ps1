#Requires -Version 5.1
# GrandGUI development startup script (PowerShell)
# Backend (port 8000) + Frontend dev server (port 5173) を同時起動します。
# Usage: powershell -ExecutionPolicy Bypass -File start-dev.ps1

$ErrorActionPreference = "Stop"
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir  = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"
$DataDir     = Join-Path $ScriptDir "data"

New-Item -ItemType Directory -Force -Path "$DataDir\maps" | Out-Null

Write-Host "[INFO] GrandGUI 開発モード起動 (PowerShell)" -ForegroundColor Cyan

# Check Python
try { python --version | Out-Null } catch {
    Write-Host "[ERROR] Python が見つかりません。" -ForegroundColor Red; exit 1
}
# Check Node.js
try { node --version | Out-Null } catch {
    Write-Host "[ERROR] Node.js が見つかりません。" -ForegroundColor Red; exit 1
}

# Backend setup
Set-Location $BackendDir
if (-not (Test-Path ".venv")) {
    Write-Host "[INFO] 仮想環境を作成中..." -ForegroundColor Yellow
    python -m venv .venv
    & ".venv\Scripts\pip" install -r requirements.txt -q
}

# Frontend setup
Set-Location $FrontendDir
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] npm install 中..." -ForegroundColor Yellow
    npm install
}

# Environment variables
$dbUrl   = "sqlite:///$($DataDir.Replace('\','/'))/grandgui.db"
$mapsDir = "$DataDir\maps"

# Start backend in a new PowerShell window
Write-Host "[INFO] バックエンドを別ウィンドウで起動中..." -ForegroundColor Yellow
$backendCmd = @"
`$env:DATABASE_URL = '$dbUrl'
`$env:MAPS_DIR = '$mapsDir'
Set-Location '$BackendDir'
Write-Host 'Backend: http://localhost:8000' -ForegroundColor Green
& '.venv\Scripts\uvicorn' app.main:app --host 0.0.0.0 --port 8000 --reload
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Wait for backend to start
Start-Sleep -Seconds 2

# Start frontend dev server in a new PowerShell window
Write-Host "[INFO] フロントエンド開発サーバーを別ウィンドウで起動中..." -ForegroundColor Yellow
$frontendCmd = @"
Set-Location '$FrontendDir'
Write-Host 'Frontend: http://localhost:5173' -ForegroundColor Green
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " GrandGUI 開発サーバー起動完了"           -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Backend:  http://localhost:8000"         -ForegroundColor Green
Write-Host " Frontend: http://localhost:5173"         -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "各ウィンドウを閉じるとサーバーが停止します。" -ForegroundColor Gray

# Open browser
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
