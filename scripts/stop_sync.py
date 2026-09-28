#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
龍城麵線 - 雙外送平台 (Uber Eats & Foodpanda) 背景守護進程停止程式
由 Windows 工作排程器 (每週二～四、六～日 13:05) 或桌面捷徑自動調用。
於營業結束時完全停止 Uber Eats 與 Foodpanda 的背景進程，釋放系統資源。
"""

import os
import sys
import subprocess

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

print("=" * 60)
print("  龍城麵線 - 正在停止雙外送平台 (Uber Eats & Foodpanda) 守護服務...")
print("=" * 60)

# 1. 終止 Uber 進程
cmd_uber = 'powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'uber_realtime_sync\\.py\' -or $_.CommandLine -match \'uber_auto_print\\.py\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host (\'已終止 Uber 進程 PID: \' + $_.ProcessId) }"'
subprocess.run(cmd_uber, shell=True)

# 2. 終止 Foodpanda 進程
cmd_fp = 'powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'foodpanda_auto_print\\.py\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host (\'已終止 Foodpanda 進程 PID: \' + $_.ProcessId) }"'
subprocess.run(cmd_fp, shell=True)

# 清理鎖定檔
for lock_file in ["uber_realtime_sync.lock", "uber_auto_print.lock", "foodpanda_auto_print.lock"]:
    path = os.path.join(r"c:\Users\eddgr\Projects\龍城麵線", lock_file)
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass

print("-" * 60)
print("✓ Uber Eats 與 Foodpanda 雙平台守護進程已完全停止。")
print("=" * 60)
