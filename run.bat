@echo off
setlocal EnableDelayedExpansion

echo ==============================================================
echo UrbanAnalysis - Local Environment Launcher
echo ==============================================================
echo.

echo Checking Eddy3D model availability...
cd /D "%~dp0backend"
if not exist "model.onnx" (
    echo Model file not found. Downloading Eddy3D GAN model...
    uv.exe run download_model.py
    if !ERRORLEVEL! NEQ 0 (
        echo WARNING: Automatic download failed. Attempting direct download...
        powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/SustainableUrbanSystemsLab/Yel-1.0/resolve/main/Yel.onnx' -OutFile 'model.onnx'"
        if !ERRORLEVEL! NEQ 0 (
            echo ERROR: Failed to download model. Please check your internet connection.
            echo You can also manually download from:
            echo https://huggingface.co/SustainableUrbanSystemsLab/Yel-1.0
            echo and place the file as backend\model.onnx
            pause
            exit /b 1
        )
    )
    echo Model download complete.
) else (
    echo Model file found.
)
echo.

REM ── Find a free port for the backend, starting at 8005 ──
set BACKEND_PORT=8005

:find_port
netstat -aon 2>nul | findstr /R ":%BACKEND_PORT% " | findstr "LISTENING" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo Port !BACKEND_PORT! is occupied, trying next...
    set /a BACKEND_PORT+=1
    if !BACKEND_PORT! GTR 8099 (
        echo ERROR: Could not find a free port in range 8005-8099.
        pause
        exit /b 1
    )
    goto :find_port
)
echo Backend will use port !BACKEND_PORT!

REM ── Write the port into a Vite env file so the frontend picks it up ──
echo VITE_BACKEND_PORT=!BACKEND_PORT!> "%~dp0frontend\.env.local"

echo Starting Microclimate Python Backend (Port !BACKEND_PORT!)...
start "Eddy3D GAN Engine" /D "%~dp0backend" cmd /c "uv.exe run uvicorn api:app --host 0.0.0.0 --port !BACKEND_PORT! --reload"

echo Starting Web Interface (Port 5173)...
timeout /t 2 /nobreak >nul
cd /D "%~dp0frontend"
call npm run dev -- --open
