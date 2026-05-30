@echo off
setlocal
echo ==============================================================
echo UrbanAnalysis - Local Environment Launcher
echo ==============================================================
echo.

echo Checking Eddy3D model availability...
cd backend
if not exist "model.onnx" (
    echo Model file not found. Downloading Eddy3D GAN model (208MB)...
    uv.exe run download_model.py
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Automatic download failed. Attempting direct download...
        powershell -Command "Invoke-WebRequest -Uri 'https://huggingface.co/SustainableUrbanSystemsLab/UrbanWind-GAN/resolve/main/GAN-21-05-2023-23-Generative.onnx' -OutFile 'model.onnx'"
        if %ERRORLEVEL% NEQ 0 (
            echo ERROR: Failed to download model. Please check your internet connection.
            echo You can also manually download from:
            echo https://huggingface.co/SustainableUrbanSystemsLab/UrbanWind-GAN
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
echo Starting Microclimate Python Backend (Port 8005)...
start "Eddy3D GAN Engine" cmd /c "uv.exe run uvicorn api:app --host 0.0.0.0 --port 8005 --reload"
cd ..

echo Starting Web Interface (Port 5173)...
timeout /t 2 /nobreak > nul
cd frontend
call npm run dev -- --open
