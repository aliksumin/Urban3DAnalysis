@echo off
setlocal
echo ==============================================================
echo UrbanAnalysis - Local Environment Launcher
echo ==============================================================
echo.
echo Starting Microclimate Python Backend (Port 8000)...
cd backend
start "Eddy3D GAN Engine" cmd /c "uv.exe run uvicorn api:app --host 0.0.0.0 --port 8005 --reload"
cd ..

echo Starting Web Interface (Port 5173)...
timeout /t 2 /nobreak > nul
cd frontend
call npm run dev -- --open
