@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

if "%PORT%"=="" set "PORT=3000"
if not "%~1"=="" set "PORT=%~1"

set "SDXL_VENV_DIR=%ROOT_DIR%.sdxl-venv"
set "SDXL_PYTHON=%SDXL_VENV_DIR%\Scripts\python.exe"

echo.
echo ==========================================
echo    AI 说书人委员会 - 一键启动
echo ==========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] 未检测到 Node.js，请先安装 Node.js (^>=18)
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] 未检测到 npm，请先安装 Node.js
    exit /b 1
)

if not exist "node_modules\" (
    echo [*] 安装依赖...
    call npm install
)

echo.
if not exist "%SDXL_PYTHON%" (
    echo [*] 创建 SDXL Python 虚拟环境...
    python -m venv "%SDXL_VENV_DIR%"
)

echo [*] 检查 SDXL 依赖...
"%SDXL_PYTHON%" -c "import importlib.util, sys; missing=[m for m in ['torch','diffusers','transformers','accelerate','safetensors','PIL'] if importlib.util.find_spec(m) is None]; sys.exit(1 if missing else 0)" >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] 安装 SDXL 真实生成依赖...
    "%SDXL_PYTHON%" -m pip install --upgrade pip
    "%SDXL_PYTHON%" -m pip install -r "%ROOT_DIR%scripts\requirements-sdxl.txt"
)

set "PREVIEW_PYTHON=%SDXL_PYTHON%"
if "%HF_ENDPOINT%"=="" set "HF_ENDPOINT=https://hf-mirror.com"
if "%PIXEL_MODEL_DIR%"=="" set "PIXEL_MODEL_DIR=%USERPROFILE%\Documents\326_ckpt_SD_XL"

for /f "delims=" %%F in ('dir /b /s /a-d "%PIXEL_MODEL_DIR%\*.safetensors" 2^>nul') do (
    set "MODEL_FILE=%%F"
    goto :found_model
)
:found_model

if not "%MODEL_FILE%"=="" (
    findstr /c:"git-lfs.github.com/spec/v1" "%MODEL_FILE%" >nul 2>nul
    if !errorlevel! equ 0 (
        echo.
        echo [*] 检测到 SDXL 权重仍是 git-lfs 指针文件
        where git-lfs >nul 2>nul
        if !errorlevel! equ 0 (
            echo [*] 拉取 SDXL 真实权重...
            git lfs install
            git -C "%PIXEL_MODEL_DIR%" lfs pull
        ) else (
            echo [X] 未检测到 git-lfs，无法自动拉取 SDXL 权重，请手动安装 git-lfs 后执行 git lfs pull
        )
    )
)

where ollama >nul 2>nul
if %errorlevel% equ 0 (
    curl -s http://localhost:11434/api/tags >nul 2>nul
    if !errorlevel! neq 0 (
        echo [*] 启动 Ollama 服务...
        start /b ollama serve >nul 2>nul
        
        for /l %%i in (1, 1, 30) do (
            curl -s http://localhost:11434/api/tags >nul 2>nul
            if !errorlevel! equ 0 goto :ollama_ready
            timeout /t 1 /nobreak >nul
        )
    )
    :ollama_ready
    curl -s http://localhost:11434/api/tags >nul 2>nul
    if %errorlevel% equ 0 (
        echo.
        echo [*] 扫描本地已安装的 Ollama 模型：
        ollama list
    ) else (
        echo.
        echo [X] Ollama 服务未就绪：请手动运行 ollama serve
    )
) else (
    echo.
    echo [*] 未检测到 ollama 命令，跳过本地模型扫描
)

echo.
curl -s http://localhost:1234/v1/models >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] 检测到 LM Studio，模型列表：
    for /f "delims=" %%a in ('curl -s http://localhost:1234/v1/models ^| python -c "import json, sys; data=json.load(sys.stdin); [print('- ' + (item.get('id') or item.get('name') or 'unknown')) for item in data.get('data', [])]"') do echo %%a
) else (
    echo [*] 未检测到 LM Studio 接口（默认 http://localhost:1234/v1/models）
)

echo.
curl -s http://localhost:1337/v1/models >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] 检测到 Jan，模型列表：
    for /f "delims=" %%a in ('curl -s http://localhost:1337/v1/models ^| python -c "import json, sys; data=json.load(sys.stdin); [print('- ' + (item.get('id') or item.get('name') or 'unknown')) for item in data.get('data', [])]"') do echo %%a
) else (
    echo [*] 未检测到 Jan 接口（默认 http://localhost:1337/v1/models）
)

echo.
echo [*] 启动 Web 服务：http://localhost:%PORT%
echo     如需换端口：set PORT=3005 ^& start-web.bat 或 start-web.bat 3005
echo.

set "PORT=%PORT%"
call npm run server:watch
