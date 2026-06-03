@echo off
setlocal EnableDelayedExpansion
echo ==============================================================
echo UrbanAnalysis - Automatic Installation Pipeline
echo ==============================================================
echo.

REM ── Pre-flight: check that Node.js is available ──
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ================================================================
    echo  ERROR: Node.js is not installed or not in your PATH.
    echo.
    echo  Please download and install Node.js LTS from:
    echo    https://nodejs.org/
    echo.
    echo  After installation, close this window and re-run install.bat.
    echo ================================================================
    pause
    exit /b 1
)

echo [1/4] Installing UI Frontend Dependencies...
cd /D "%~dp0frontend"
call npm install
if !ERRORLEVEL! NEQ 0 (
    echo Error: NPM installation failed.
    pause
    exit /b !ERRORLEVEL!
)
cd /D "%~dp0"
echo Frontend installation complete.
echo.

echo [2/4] Setting up Portable Python Sandbox Environment...
if not exist "backend\uv.exe" (
    echo Downloading standalone astral-uv package manager...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/astral-sh/uv/releases/download/0.4.10/uv-x86_64-pc-windows-msvc.zip' -OutFile 'uv.zip'"
    if !ERRORLEVEL! NEQ 0 (
        echo Error: Failed to download uv.zip. Please check your internet connection.
        pause
        exit /b !ERRORLEVEL!
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
cd /D "%~dp0backend"
echo Creating isolated .venv workspace...
uv.exe venv
echo Installing required PIP hooks inside .venv...
uv.exe pip install -r pyproject.toml
if !ERRORLEVEL! NEQ 0 (
    echo Warning: Failed to parse pyproject.toml directly, manually installing core framework...
    uv.exe pip install fastapi[standard] uvicorn[standard] onnxruntime python-multipart pillow numpy requests slowapi httpx
)
cd /D "%~dp0"
echo Python environment provisioned successfully.
echo.

echo [4/4] Downloading Eddy3D Fluid Dynamics Model (208MB)...
cd /D "%~dp0backend"
uv.exe run download_model.py
if !ERRORLEVEL! NEQ 0 (
    echo Error: Failed to fetch the GAN API endpoint. Please check your internet connection.
    pause
    exit /b !ERRORLEVEL!
)
cd /D "%~dp0"
echo Download complete.
echo.

echo ==============================================================
echo Environment Configuration Finished!
echo You can now successfully boot the program using run.bat
echo ==============================================================
pause
