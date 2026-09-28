#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
龍城麵線 - 雙外送平台 (Uber Eats & Foodpanda) 背景守護進程啟動程式
由 Windows 工作排程器 (每週二～四、六～日 07:00) 或桌面捷徑自動調用。
於背景同時啟動 Uber Eats 與 Foodpanda 訂單即時偵測服務（無黑視窗模式）。
"""

import os
import sys
import subprocess
import ctypes

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

workdir = r"c:\Users\eddgr\Projects\龍城麵線"
python_exe = r"C:\Python314\python.exe"
if not os.path.exists(python_exe):
    python_exe = sys.executable

CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200

def is_pid_alive(pid):
    try:
        kernel32 = ctypes.windll.kernel32
        h = kernel32.OpenProcess(0x1000, False, pid)
        if not h:
            return False
        code = ctypes.c_ulong()
        kernel32.GetExitCodeProcess(h, ctypes.byref(code))
        kernel32.CloseHandle(h)
        return code.value == 259
    except Exception:
        return False

def launch_service(script_name, lock_name, service_title):
    script_path = os.path.join(workdir, script_name)
    lock_path = os.path.join(workdir, lock_name)
    
    if not os.path.exists(script_path):
        print(f"❌ 找不到腳本: {script_path}")
        return None

    # 檢查是否已在運行
    if os.path.exists(lock_path):
        try:
            with open(lock_path, "r", encoding="utf-8") as f:
                c = f.read().strip()
                if c.isdigit() and is_pid_alive(int(c)):
                    print(f"● {service_title} 已在背景運行中 (PID: {c})，無需重複啟動。")
                    return int(c)
        except Exception:
            pass

    try:
        proc = subprocess.Popen(
            [python_exe, script_path],
            cwd=workdir,
            creationflags=CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        print(f"✓ {service_title} 已在背景成功啟動！(PID: {proc.pid})")
        return proc.pid
    except Exception as e:
        print(f"❌ 啟動 {service_title} 失敗: {e}")
        return None

def main():
    print("=" * 60)
    print("  龍城麵線 - 雙外送平台 (Uber Eats & Foodpanda) 自動排程啟動")
    print("=" * 60)

    # 1. 啟動 Uber Eats
    launch_service("uber_realtime_sync.py", "uber_realtime_sync.lock", "🛵 Uber Eats 即時訂單同步服務")

    # 2. 啟動 Foodpanda
    launch_service("foodpanda_auto_print.py", "foodpanda_auto_print.lock", "🐼 Foodpanda 熊貓自動出單與同步服務")

    print("-" * 60)
    print("✓ 雙平台外送新單守護服務已就緒，營業時段持續於背景偵測！")
    print("=" * 60)

if __name__ == "__main__":
    main()
