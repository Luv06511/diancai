@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 点菜 · 私人菜单

set "PY=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not exist "%PY%" set "PY="

if not defined PY (
  where py >nul 2>nul
  if not errorlevel 1 set "PY=py"
)
if not defined PY (
  where python >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  echo.
  echo   没找到 Python 3。装一个再来：https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)

"%PY%" "%~dp0serve.py" --open
pause
