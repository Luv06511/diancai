@echo off
chcp 65001 >nul
title 停止 点菜 服务

powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -ge 8000 -and $_.LocalPort -le 8020 } | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop; Write-Host ('已停止端口 ' + $_.LocalPort) } catch {} }"

echo.
echo   8000-8020 之间的点菜服务已经停掉了。
echo   如果手机还开着页面，刷新一下就会断开。
echo.
pause
