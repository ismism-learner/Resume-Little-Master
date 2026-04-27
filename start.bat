@echo off
chcp 65001 >nul 2>&1
title 简历小师 - 启动中...

echo.
echo  ╔══════════════════════════════╗
echo  ║       简历小师 启动器        ║
echo  ╚══════════════════════════════╝
echo.

:: 检测 Python
where python >nul 2>&1
if %errorlevel%==0 (
    echo  [√] 检测到 Python，正在启动服务器...
    echo.
    echo  请在浏览器中访问: http://localhost:8080
    echo  按 Ctrl+C 停止服务器
    echo.
    start http://localhost:8080
    python -m http.server 8080
    goto :end
)

where python3 >nul 2>&1
if %errorlevel%==0 (
    echo  [√] 检测到 Python3，正在启动服务器...
    echo.
    echo  请在浏览器中访问: http://localhost:8080
    echo  按 Ctrl+C 停止服务器
    echo.
    start http://localhost:8080
    python3 -m http.server 8080
    goto :end
)

:: 检测 Node.js
where npx >nul 2>&1
if %errorlevel%==0 (
    echo  [√] 检测到 Node.js，正在启动服务器...
    echo.
    echo  请在浏览器中访问: http://localhost:8080
    echo  按 Ctrl+C 停止服务器
    echo.
    start http://localhost:8080
    npx serve -l 8080 .
    goto :end
)

:: 未找到任何运行时
echo  [!] 未检测到 Python 或 Node.js
echo.
echo  请安装以下任一工具后重试：
echo.
echo    Python:  https://www.python.org/downloads/
echo    Node.js: https://nodejs.org/
echo.
echo  安装时请勾选 "Add to PATH" 选项。
echo.
pause

:end
