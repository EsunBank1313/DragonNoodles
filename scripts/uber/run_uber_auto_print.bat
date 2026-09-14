@echo off
chcp 65001 >nul
title 龍城麵線 - Uber Eats 即時訂單偵測與自動熱感應出單服務
cd /d "c:\Users\eddgr\Projects\龍城麵線"

echo =======================================================
echo   龍城麵線 (Dragon Noodles) - Uber Eats 自動出單服務
echo =======================================================
echo.
echo 正在啟動即時偵測背景服務...
echo 偵測到新訂單時將自動發出提醒音效並由出單機出單。
echo (如需停止服務，請直接關閉此視窗或按下 Ctrl + C)
echo.

python uber_auto_print.py

pause
