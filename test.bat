@echo off
REM プロジェクトのルートに移動
cd /d %~dp0

REM Pythonの簡易サーバーを起動（ポート8000）
start "" python -m http.server 8000

REM 少し待ってからブラウザで開く（2秒待機）
timeout /t 2 >nul

REM 既定ブラウザで index.html を開く
start http://localhost:8000/index.html