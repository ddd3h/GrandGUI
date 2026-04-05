@echo off
setlocal EnableDelayedExpansion
title GrandGUI

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set FRONTEND_DIR=%SCRIPT_DIR%frontend
set DATA_DIR=%SCRIPT_DIR%data

:: Create data directories
if not exist "%DATA_DIR%\maps" mkdir "%DATA_DIR%\maps"

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python が見つかりません。Python 3.10 以上をインストールしてください。
    echo         https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js が見つかりません。Node.js 18 以上をインストールしてください。
    echo         https://nodejs.org/
    pause
    exit /b 1
)

:: Setup backend venv
cd /d "%BACKEND_DIR%"
if not exist ".venv" (
    echo [INFO] Python 仮想環境を作成中...
    python -m venv .venv
    echo [INFO] 依存パッケージをインストール中...
    .venv\Scripts\pip install -r requirements.txt -q
)

:: Build frontend
cd /d "%FRONTEND_DIR%"
if not exist "node_modules" (
    echo [INFO] フロントエンドの依存パッケージをインストール中...
    npm install
)
echo [INFO] フロントエンドをビルド中...
npm run build

:: Start backend
cd /d "%BACKEND_DIR%"
set DATABASE_URL=sqlite:///%DATA_DIR:\=/%/grandgui.db
set MAPS_DIR=%DATA_DIR%\maps

echo.
echo [INFO] バックエンドを起動中 (http://localhost:8000)...
echo [INFO] ブラウザで http://localhost:8000 を開いてください。
echo [INFO] 終了するには Ctrl+C を押してください。
echo.

.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000
