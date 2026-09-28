@echo off
chcp 65001 >nul
title 龍城麵線 - Foodpanda 即時新單偵測與自動出單守護服務
cd /d "%~dp0"

echo ========================================================
echo   龍城麵線 (Dragon Noodles) - Foodpanda 自動出單服務
echo ========================================================
echo.
echo 正在啟動 Foodpanda 訂單即時偵測服務...
echo 偵測到新訂單時將自動發出提醒音效、由出單機出單，並同步至 POS 系統！
echo (如需停止服務，請直接關閉此視窗，或雙擊【停止】Foodpanda自動出單.bat)
echo.

python foodpanda_auto_print.py

pause
