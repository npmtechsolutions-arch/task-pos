@echo off
cd /d "%~dp0"

echo ===================================================
echo Starting ProjectFlow POS System
echo ===================================================

:: Start Backend
echo Starting Backend Server (FastAPI)...
start "ProjectFlow Backend" cmd /k "cd backend && python -m uvicorn app.main:app --reload --port 8000"

:: Initial DB setup / Seed Landing
echo Waiting for backend to spin up, then seeding database...
timeout /t 3 /nobreak > nul
start "Seed Database" cmd /k "cd backend && set PYTHONPATH=. && python seed_landing.py && echo Seeding complete! You can close this window. && pause"

:: Start React Frontend
echo Starting React Frontend Application (Vite)...
start "ProjectFlow React App" cmd /k "cd app && npm run dev"

echo.
echo ===================================================
echo Services are starting in new command windows.
echo React App            : http://localhost:5173
echo Backend API          : http://localhost:8000
echo Backend Docs         : http://localhost:8000/docs
echo ===================================================
echo.

:: Wait for servers to spin up
timeout /t 5 /nobreak > nul

:: Open Browser
echo Opening Application in Browser...
start http://localhost:5173

pause
