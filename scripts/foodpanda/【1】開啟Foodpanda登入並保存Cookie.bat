@echo off
chcp 65001 >nul
title 龍城麵線 - Foodpanda 商家登入與保存 Cookie
cd /d "%~dp0"

echo ========================================================
echo   龍城麵線 (Dragon Noodles) - Foodpanda 商家登入驗證
echo ========================================================
echo.
echo 正在開啟專屬 Google Chrome 視窗前往 Foodpanda 登入頁面...
echo (輸入帳密與驗證碼登入後，Cookie 與 Session 將自動永久保存在本機)
echo.

python foodpanda_login.py

echo.
pause
