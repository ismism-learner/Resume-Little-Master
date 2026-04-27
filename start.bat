@echo off
chcp 65001 >nul 2>&1
title Resume Starter

echo.
echo   ================================
echo     Resume Little Master Starter
echo   ================================
echo.

:: 检测 Python
where python >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Python detected, starting server...
    echo.
    echo   Visit: http://localhost:8080
    echo   Press Ctrl+C to stop
    echo.
    start http://localhost:8080
    python -m http.server 8080
    goto :end
)

where python3 >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Python3 detected, starting server...
    echo.
    echo   Visit: http://localhost:8080
    echo   Press Ctrl+C to stop
    echo.
    start http://localhost:8080
    python3 -m http.server 8080
    goto :end
)

:: 检测 Node.js
where npx >nul 2>&1
if %errorlevel%==0 (
    echo   [OK] Node.js detected, starting server...
    echo.
    echo   Visit: http://localhost:8080
    echo   Press Ctrl+C to stop
    echo.
    start http://localhost:8080
    npx serve -l 8080 .
    goto :end
)

:: 未找到任何运行时
echo   [!] Python or Node.js not found
echo.
echo   Please install one of the following:
echo.
echo     Python:  https://www.python.org/downloads/
echo     Node.js: https://nodejs.org/
echo.
echo   Make sure to check "Add to PATH" during installation.
echo.
pause

:end
