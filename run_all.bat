@echo off
title ECHO Trade Monitor Launcher
echo ========================================================
echo    ECHO | Public Channel Illegal Trade Monitor
echo    PS02 Telegram and social-media advertisements
echo ========================================================

echo Starting FastAPI Backend (Port 8000)...
start "ECHO Backend (FastAPI)" cmd /k "cd backend && py seed_data.py && py -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo Starting Vite Frontend (Port 5173)...
start "ECHO Frontend (Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo =======================================================================
echo [SUCCESS] Backend and Frontend servers launched!
echo Access the Operations Center at: http://localhost:5173
echo =======================================================================
pause
