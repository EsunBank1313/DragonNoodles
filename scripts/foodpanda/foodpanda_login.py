#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
龍城麵線 - Foodpanda 商家登入與 Cookie / Session 永久保存工具
以專屬 Chrome 獨立設定檔開啟 https://partner.foodpanda.com/login
引導店家登入後，將所有 Cookie、Token 與 Session 永久保留在本地電腦。
之後背景自動出單服務便可直接讀取此 Cookie 持續運作，不需每次手動登入！
"""

import os
import sys
import json
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
# 專屬 Chrome 使用者資料夾（保存 Cookie、快取、IndexedDB 與登入狀態）
PROFILE_DIR = os.path.join(ROOT_DIR, "foodpanda_chrome_profile")
COOKIE_BACKUP_PATH = os.path.join(ROOT_DIR, "foodpanda_cookies.json")
STORAGE_BACKUP_PATH = os.path.join(ROOT_DIR, "foodpanda_storage.json")

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

async def save_session_cookies(context, page):
    """提取並備份 Cookies 與 LocalStorage"""
    try:
        cookies = await context.cookies()
        with open(COOKIE_BACKUP_PATH, "w", encoding="utf-8") as f:
            json.dump(cookies, f, ensure_ascii=False, indent=2)

        # 備份 LocalStorage
        local_storage = await page.evaluate("() => ({ ...localStorage })")
        with open(STORAGE_BACKUP_PATH, "w", encoding="utf-8") as f:
            json.dump(local_storage, f, ensure_ascii=False, indent=2)

        return len(cookies)
    except Exception as e:
        print(f"備份 Cookie 發生錯誤: {e}")
        return 0

async def main():
    print("=" * 60)
    print("  🐼 龍城麵線 - Foodpanda 商家後台登入與 Cookie 保存工具")
    print("=" * 60)
    print("正在以獨立專屬設定檔啟動 Google Chrome...")
    print(f"Cookie 與設定檔存放目錄: {PROFILE_DIR}")
    print("-" * 60)

    os.makedirs(PROFILE_DIR, exist_ok=True)

    async with async_playwright() as p:
        # 使用持久化瀏覽器環境 launch_persistent_context
        context = await p.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            executable_path=CHROME_PATH if os.path.exists(CHROME_PATH) else None,
            headless=False,  # 顯示視窗供使用者操作登入
            viewport=None,   # 使用預設視窗大小
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized"
            ]
        )

        page = context.pages[0] if context.pages else await context.new_page()

        print("正在前往 Foodpanda 商家登入頁面...")
        try:
            await page.goto("https://partner.foodpanda.com/login", wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            print(f"連線至登入頁面: {e}")

        print("\n" + "=" * 60)
        print("👉 請在剛剛彈出的 Google Chrome 視窗中完成登入：")
        print("   1. 輸入您的 Foodpanda 商家帳號 (Email) 與密碼")
        print("   2. 如有出現簡訊驗證碼、Email 驗證或 2FA，請照常輸入完成驗證")
        print("   3. 成功進入商家訂單看板後，系統會自動捕捉並保存 Cookie！")
        print("=" * 60 + "\n")

        login_success = False
        check_count = 0

        while True:
            await asyncio.sleep(2)
            check_count += 1
            current_url = page.url.lower()

            # 判斷是否已登入成功（離開 login 頁面，進入 orders / dashboard 等）
            is_logged_in = False
            if "/login" not in current_url and "partner.foodpanda.com" in current_url:
                is_logged_in = True
            else:
                # 檢查頁面是否有登入成功後的特徵（如導覽列、商家名稱、訂單看板）
                try:
                    has_vendor = await page.locator('[data-testid*="vendor"], [class*="vendor"], button:has-text("登出"), button:has-text("Log out"), a[href*="orders"]').count()
                    if has_vendor > 0:
                        is_logged_in = True
                except Exception:
                    pass

            if is_logged_in:
                # 等待網路完全加載
                await asyncio.sleep(2)
                cookie_count = await save_session_cookies(context, page)
                
                print("\n" + "★" * 60)
                print("  🎉 恭喜！偵測到 Foodpanda 商家已成功登入！")
                print(f"  ✓ 成功捕捉並保存 {cookie_count} 個登入 Cookie！")
                print(f"  ✓ 登入狀態已永久保留在: {PROFILE_DIR}")
                print(f"  ✓ Cookie 備份檔案已寫入: {COOKIE_BACKUP_PATH}")
                print("★" * 60)
                print("\n您現在可以直接關閉 Chrome 視窗，並啟動【2】Foodpanda 自動出單服務！")
                print("日後自動出單服務會直接使用這份 Cookie 背景收單與列印，不需重複登入。\n")
                login_success = True
                break

            # 每 15 秒印一次等待提示
            if check_count % 8 == 0:
                print(f"⏳ 等待登入中... 目前網址: {page.url}")

        # 登入成功後保留視窗 10 秒，讓使用者能看到登入後的畫面
        if login_success:
            print("視窗將在 10 秒後自動關閉（或您可隨時自行關閉視窗）...")
            await asyncio.sleep(10)

        await context.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n程序已由使用者中斷。")
