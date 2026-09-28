@echo off
chcp 65001 >nul
title 龍城麵線 - 測試列印一張 Foodpanda 外送貼袋單
cd /d "%~dp0"

echo ========================================================
echo   龍城麵線 - 測試列印 Foodpanda 熊貓出單樣張
echo ========================================================
echo.

python test_print_foodpanda_ticket.py

echo.
pause
