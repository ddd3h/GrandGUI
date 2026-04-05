@echo off
setlocal EnableDelayedExpansion
title GrandGUI Dev

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend
set FRONTEND_DIR=%SCRIPT_DIR%frontend
set DATA_DIR=%SCRIPT_DIR%data

:: Create data directories
if not exist "%DATA_DIR%\maps" mkdir "%DATA_DIR%\maps"

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python が見つかりません。
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js が見つかりません。
    pause
    exit /b 1
)

:: Setup backend venv
cd /d "%BACKEND_DIR%"
if not exist ".venv" (
    echo [INFO] Python 仮想環境を作成中...
    python -m venv .venv
    .venv\Scripts\pip install -r requirements.txt -q
)

:: Install frontend deps
cd /d "%FRONTEND_DIR%"
if not exist "node_modules" (
    echo [INFO] フロントエンドの依存パッケージをインストール中...
    npm install
)

:: Start backend in a new window
echo [INFO] バックエンドを起動中...
set DATABASE_URL=sqlite:///%DATA_DIR:\=/%/grandgui.db
set MAPS_DIR=%DATA_DIR%\maps
start "GrandGUI Backend" cmd /k "cd /d "%BACKEND_DIR%" && set DATABASE_URL=sqlite:///%DATA_DIR:\=/%/grandgui.db && set MAPS_DIR=%DATA_DIR%\maps && .venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait a moment for backend to start
timeout /t 2 /nobreak >nul

:: Start frontend dev server in a new window
echo [INFO] フロントエンド開発サーバーを起動中...
start "GrandGUI Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo.
echo =========================================
echo  GrandGUI 開発サーバー起動完了
echo =========================================
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5173
echo =========================================
echo.
echo 各ウィンドウを閉じるとサーバーが停止します。
echo.
pause
