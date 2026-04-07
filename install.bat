@echo off
setlocal
echo ==============================================================
echo UrbanAnalysis - Automatic Installation Pipeline
echo ==============================================================
echo.

echo [1/4] Installing UI Frontend Dependencies...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error: NPM installation failed. Please ensure Node.js is installed.
    pause
    exit /b %ERRORLEVEL%
)
cd ..
echo Frontend installation complete.
echo.

echo [2/4] Setting up Portable Python Sandbox Environment...
if not exist "backend\uv.exe" (
    echo Downloading standalone astral-uv package manager...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/astral-sh/uv/releases/download/0.4.10/uv-x86_64-pc-windows-msvc.zip' -OutFile 'uv.zip'"
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to download uv.zip. Please check your internet connection.
        pause
        exit /b %ERRORLEVEL%
    )
    echo Extracting package manager...
    powershell -Command "Expand-Archive -Path 'uv.zip' -DestinationPath 'uv_temp' -Force"
    move /Y uv_temp\uv.exe backend\uv.exe > nul
    rmdir /S /Q uv_temp
    del uv.zip
    echo Portable Python manager configured successfully.
) else (
    echo Portable Python manager already exists.
)
echo.

echo [3/4] Installing PyTorch/FastAPI dependencies...
cd backend
echo Creating isolated .venv workspace...
uv.exe venv
echo Installing required PIP hooks inside .venv...
uv.exe pip install -r pyproject.toml
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Failed to parse pyproject.toml directly, manually installing core framework...
    uv.exe pip install fastapi[standard] uvicorn[standard] onnxruntime python-multipart pillow numpy requests slowapi httpx
)
cd ..
echo Python environment provisioned successfully.
echo.

echo [4/4] Downloading Eddy3D Fluid Dynamics Model (208MB)...
cd backend
uv.exe run download_model.py
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to fetch the GAN API endpoint. Please check your internet connection.
    pause
    exit /b %ERRORLEVEL%
)
cd ..
echo Download complete.
echo.

echo ==============================================================
echo Environment Configuration Finished!
echo You can now successfully boot the program using run.bat
echo ==============================================================
pause
