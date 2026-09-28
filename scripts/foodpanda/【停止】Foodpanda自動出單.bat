@echo off
chcp 65001 >nul
title 停止 Foodpanda 自動出單服務
echo ========================================================
echo   龍城麵線 - 正在停止 Foodpanda 自動出單守護服務...
echo ========================================================
echo.

powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*foodpanda_auto_print.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host '已終止進程 PID:' $_.ProcessId }"

del /f /q "%~dp0foodpanda_auto_print.lock" 2>nul
del /f /q "c:\Users\eddgr\Projects\龍城麵線\foodpanda_auto_print.lock" 2>nul

echo.
echo ✓ Foodpanda 自動出單服務已停止。
pause
