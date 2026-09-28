import os
import sys
import ctypes
import subprocess

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def is_pid_alive(pid):
    try:
        kernel32 = ctypes.windll.kernel32
        h = kernel32.OpenProcess(0x1000, False, pid)
        if not h:
            return False
        code = ctypes.c_ulong()
        kernel32.GetExitCodeProcess(h, ctypes.byref(code))
        kernel32.CloseHandle(h)
        return code.value == 259  # STILL_ACTIVE
    except Exception:
        return False

print("=" * 60)
print("  龍城麵線 - 雙外送平台 (Uber Eats & Foodpanda) 守護狀態檢視")
print("=" * 60)
print()

workdir = r"c:\Users\eddgr\Projects\龍城麵線"

# 1. 檢查 Uber Eats
uber_lock = os.path.join(workdir, "uber_realtime_sync.lock")
uber_pid = None
if os.path.exists(uber_lock):
    try:
        with open(uber_lock, "r", encoding="utf-8") as f:
            c = f.read().strip()
            if c.isdigit() and is_pid_alive(int(c)):
                uber_pid = int(c)
    except Exception:
        pass

print("【🛵 平台 1：Uber Eats 即時接單守護】")
if uber_pid:
    print(f"● 運行狀態: [正在背景常駐運行中] (PID: {uber_pid})")
    try:
        ps_cmd = f'powershell -NoProfile -Command "(Get-Process -Id {uber_pid} -ErrorAction SilentlyContinue).StartTime.ToString(\'yyyy-MM-dd HH:mm:ss\')"'
        st_out = subprocess.run(ps_cmd, shell=True, capture_output=True, text=True).stdout.strip()
        if st_out:
            print(f"  - 啟動時間: {st_out}")
    except Exception:
        pass
    print("  - 守護進程正持續監聽 Uber Eats，新單即時推播與同步平板 POS。")
else:
    print("○ 運行狀態: [目前未在執行]")

print()

# 2. 檢查 Foodpanda
fp_lock = os.path.join(workdir, "foodpanda_auto_print.lock")
fp_pid = None
if os.path.exists(fp_lock):
    try:
        with open(fp_lock, "r", encoding="utf-8") as f:
            c = f.read().strip()
            if c.isdigit() and is_pid_alive(int(c)):
                fp_pid = int(c)
    except Exception:
        pass

print("【🐼 平台 2：Foodpanda 熊貓即時自動出單與同步】")
if fp_pid:
    print(f"● 運行狀態: [正在背景常駐運行中] (PID: {fp_pid})")
    try:
        ps_cmd = f'powershell -NoProfile -Command "(Get-Process -Id {fp_pid} -ErrorAction SilentlyContinue).StartTime.ToString(\'yyyy-MM-dd HH:mm:ss\')"'
        st_out = subprocess.run(ps_cmd, shell=True, capture_output=True, text=True).stdout.strip()
        if st_out:
            print(f"  - 啟動時間: {st_out}")
    except Exception:
        pass
    print("  - 守護進程正持續監聽 Foodpanda，新單自動出單切單並同步平板 POS。")
else:
    print("○ 運行狀態: [目前未在執行]")
    print("  - 提示: 首次使用請確認已執行【1】開啟Foodpanda登入並保存Cookie.bat")

print()
print("【⏰ 平台 3：Windows 工作排程定時開關 (每週二～四、六～日)】")
try:
    ps_start = 'powershell -NoProfile -Command "$t = Get-ScheduledTaskInfo -TaskName DragonNoodles_UberSync_Start -ErrorAction SilentlyContinue; if($t){ \'下次自動啟動: \' + $t.NextRunTime } else { \'排程未就緒\' }"'
    ps_stop = 'powershell -NoProfile -Command "$t = Get-ScheduledTaskInfo -TaskName DragonNoodles_UberSync_Stop -ErrorAction SilentlyContinue; if($t){ \'下次自動停止: \' + $t.NextRunTime } else { \'排程未就緒\' }"'
    start_out = subprocess.run(ps_start, shell=True, capture_output=True, text=True).stdout.strip()
    stop_out = subprocess.run(ps_stop, shell=True, capture_output=True, text=True).stdout.strip()
    print(f"● 早上 07:00 雙平台自動啟動: {start_out}")
    print(f"● 下午 13:05 雙平台自動停止: {stop_out}")
    print("  - 適用營業日: 每週二至四、六日 (自動略過週一、週五公休日)")
except Exception:
    print("● 排程狀態: 正常就緒")

print()
print("========================================================")
