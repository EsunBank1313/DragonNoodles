#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
龍城麵線 (Dragon Noodles) - Uber Eats 即時訂單偵測與自動熱感應出單守護進程
持續監看 Uber Eats 商家端後台，一旦有新訂單進入：
1. 立即觸發印表機自動列印外送貼袋單據（貼在餐點袋上）
2. 發出提示音效通知店員
3. 將訂單同步至 POS 雲端資料庫 (Supabase)
"""

import os
import sys
import json
import re
import asyncio
import urllib.request
import urllib.parse
from datetime import datetime
from playwright.async_api import async_playwright
from uber_printer import generate_packaging_ticket_html, print_ticket_via_chrome, print_ticket_via_powershell

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(ROOT_DIR, "config_uber_print.json")
PRINTED_LOG_PATH = os.path.join(ROOT_DIR, "printed_orders.json")
LOG_FILE = os.path.join(ROOT_DIR, "uber_auto_print.log")

SUPABASE_URL = "https://ctenchhzlnewhivauumk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0ZW5jaGh6bG5ld2hpdmF1dW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjUzNTYsImV4cCI6MjEwNDM0MTM1Nn0.V65m3c8GTQSrMBaWdG40DBq4LIq7RZnx7igcipYkH1k"

UBER_ACCOUNT = "apricot-149968@ubereats.com"
UBER_PASSWORD = "6fae673b"
UBER_SERVICE_FEE_RATE = 0.31

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def play_alert_sound():
    try:
        import winsound
        winsound.Beep(1200, 250)
        winsound.Beep(1800, 450)
    except Exception:
        pass

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "printer_name": "",
        "paper_width": "58mm",
        "show_price": True,
        "sound_alert": True,
        "check_interval_seconds": 15
    }

def load_printed_set():
    if os.path.exists(PRINTED_LOG_PATH):
        try:
            with open(PRINTED_LOG_PATH, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_printed_order(order_key):
    s = load_printed_set()
    s.add(order_key)
    try:
        with open(PRINTED_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(list(s), f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def check_order_exists_in_db(order_number):
    try:
        url = f"{SUPABASE_URL}/rest/v1/orders?select=id,order_number&order_number=eq.{urllib.parse.quote(order_number)}"
        req = urllib.request.Request(url, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        })
        with urllib.request.urlopen(req, timeout=8) as res:
            data = json.loads(res.read().decode("utf-8"))
            return len(data) > 0
    except Exception:
        return False

def sync_order_to_supabase(order_payload):
    try:
        url = f"{SUPABASE_URL}/rest/v1/orders"
        req_data = json.dumps([order_payload]).encode("utf-8")
        req = urllib.request.Request(url, data=req_data, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        })
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status in (200, 201)
    except Exception as e:
        log(f"同步至雲端資料庫失敗: {e}")
        return False

def parse_order_value_to_print_data(val):
    display_id = val.get("displayID") or ""
    order_id = val.get("id") or display_id
    if not display_id:
        display_id = order_id[:5].upper() if order_id else "UBER"

    order_number = f"U-{display_id}"

    cust_list = val.get("customers", [])
    customer_name = cust_list[0].get("name", "Uber 顧客") if cust_list else "Uber 顧客"

    total_str = val.get("payment", {}).get("orderTotal", {}).get("formatted", "$0")
    original_total = float(re.sub(r"[^0-9.]", "", total_str) or 0)
    net_received = round(original_total * (1 - UBER_SERVICE_FEE_RATE))

    created_at = val.get("terminalStateTimestamp") or val.get("placedAt") or datetime.now().strftime("%Y-%m-%d %H:%M")

    # 提取品項
    cart_items = []
    raw_items = val.get("cartInfo", {}).get("cartItems", [])
    for ci in raw_items:
        full_name = ci.get("name", "") or ci.get("id", "餐點")
        clean_name = full_name.split("  ")[0].strip() if "  " in full_name else full_name.strip()
        qty = ci.get("quantity", {}).get("amount", 1)
        
        # 提取該品項顧客備註
        notes_list = ci.get("notes", [])
        item_note = ""
        for n in notes_list:
            rich_texts = n.get("title", {}).get("content", {}).get("richTextElements", [])
            for rt in rich_texts:
                t = rt.get("text", {}).get("text", "")
                if t:
                    item_note = t.strip("「」").strip()
                    break

        specs = ["大碗"] if "大" in clean_name else (["小碗"] if "小" in clean_name else [])
        
        cart_items.append({
            "name": clean_name,
            "quantity": qty,
            "specs": specs,
            "note": item_note,
            "price": 0
        })

    return {
        "order_id": order_id,
        "display_id": display_id,
        "order_number": order_number,
        "customer_name": customer_name,
        "created_at": created_at,
        "total_price": net_received,
        "original_total": original_total,
        "items": cart_items,
        "note": ""
    }

async def process_new_order(order_data, config):
    display_id = order_data["display_id"]
    order_number = order_data["order_number"]
    customer_name = order_data["customer_name"]

    log(f"🔔 偵測到新進訂單 [{order_number}] 顧客: {customer_name}，品項數: {len(order_data['items'])}")

    # 1. 播放通知音效
    if config.get("sound_alert", True):
        play_alert_sound()

    # 2. 自動列印出單
    printer_name = config.get("printer_name") or None
    paper_width = config.get("paper_width", "58mm")
    show_price = config.get("show_price", True)

    html = generate_packaging_ticket_html(order_data, paper_width, show_price)
    
    log(f"  🖨️ 正在傳送單據至出單機 ({printer_name or '系統預設印表機'})...")
    printed = print_ticket_via_chrome(html, printer_name)
    if not printed:
        printed = print_ticket_via_powershell(html, printer_name)

    if printed:
        log(f"  ✓ [{order_number}] 自動出單成功！可直接貼於餐點包裝袋上。")
    else:
        log(f"  ⚠️ [{order_number}] 列印指令發送失敗，請確認印表機狀態。")

    # 3. 記錄已列印，防重複
    save_printed_order(order_data["order_id"])
    save_printed_order(display_id)
    save_printed_order(order_number)

    # 4. 同步至 Supabase POS 雲端
    if not check_order_exists_in_db(order_number):
        db_payload = {
            "order_number": order_number,
            "total": order_data["total_price"],
            "type": "uber",
            "status": "received",
            "payment_status": "paid",
            "created_at": datetime.now().isoformat(),
            "items": {
                "customerName": customer_name,
                "is_printed": True,
                "cart": [
                    {
                        "id": idx + 1,
                        "name": it["name"],
                        "quantity": it["quantity"],
                        "specs": it["specs"],
                        "note": it["note"]
                    } for idx, it in enumerate(order_data["items"])
                ]
            }
        }
        if sync_order_to_supabase(db_payload):
            log(f"  ✓ [{order_number}] 已同步至 POS 雲端資料庫。")

async def run_monitor():
    config = load_config()
    interval = max(10, config.get("check_interval_seconds", 15))
    
    log("==================================================")
    log("🚀 啟動 Uber Eats 即時訂單偵測與自動出單守護服務...")
    log(f"印表機: {config.get('printer_name') or 'Windows 預設印表機'}")
    log(f"紙張寬度: {config.get('paper_width', '58mm')}")
    log(f"輪詢頻率: 每 {interval} 秒檢查一次")
    log("==================================================")

    while True:
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    executable_path=CHROME_PATH,
                    headless=True
                )
                page = await browser.new_page()

                captured_active_orders = []

                async def handle_response(response):
                    try:
                        if "graphql" in response.url.lower() and response.request.method == "POST":
                            data = await response.json()
                            if isinstance(data, dict) and "data" in data:
                                # 攔截即時新訂單 (getActiveOrders)
                                active_res = data["data"].get("getActiveOrders")
                                if active_res and isinstance(active_res, dict):
                                    orders = active_res.get("result", {}).get("orders") or []
                                    if orders:
                                        captured_active_orders.extend(orders)
                                # 攔截歷史與當前清單 (getOrderHistory)
                                hist_res = data["data"].get("getOrderHistory")
                                if hist_res and isinstance(hist_res, dict):
                                    orders = hist_res.get("result", {}).get("completedOrders") or []
                                    if orders:
                                        captured_active_orders.extend(orders)
                    except Exception:
                        pass

                page.on("response", handle_response)

                log("1. 連線至 Uber Eats 商家登入入口...")
                await page.goto("https://merchants.ubereats.com/orders", wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(3000)

                # 登入帳密
                email_input = page.locator('input').first
                if await email_input.count() > 0:
                    await email_input.fill(UBER_ACCOUNT)
                    await page.wait_for_timeout(800)
                    next_btn = page.locator('button:has-text("下一步")')
                    if await next_btn.count() > 0:
                        await next_btn.first.click()
                    await page.wait_for_timeout(4000)

                pwd_input = page.locator('input[type="password"]')
                if await pwd_input.count() > 0:
                    await pwd_input.first.fill(UBER_PASSWORD)
                    await page.wait_for_timeout(800)
                    next_btn = page.locator('button:has-text("下一步")')
                    if await next_btn.count() > 0:
                        await next_btn.first.click()
                    await page.wait_for_timeout(6000)

                # 關閉彈窗
                later_btn = page.locator('button:has-text("稍後再進行")')
                if await later_btn.count() > 0:
                    await later_btn.first.click()
                    await page.wait_for_timeout(1000)

                log("✓ 成功登入 Uber Eats 訂單看板！開始持續即時監聽新單...")

                # 常駐輪詢監控循環
                consecutive_errors = 0
                while True:
                    config = load_config()
                    printed_set = load_printed_set()
                    
                    # 處理捕捉到的即時新單
                    if captured_active_orders:
                        orders_to_check = list(captured_active_orders)
                        captured_active_orders.clear()
                        for ord_item in orders_to_check:
                            val = ord_item.get("value", {})
                            ord_data = parse_order_value_to_print_data(val)
                            
                            order_id = ord_data["order_id"]
                            display_id = ord_data["display_id"]
                            order_number = ord_data["order_number"]

                            if order_id not in printed_set and display_id not in printed_set and order_number not in printed_set:
                                await process_new_order(ord_data, config)

                    # 等待間隔後重新整理看板頁面以觸發最新訂單拉取
                    await page.wait_for_timeout(interval * 1000)
                    try:
                        await page.reload(wait_until="domcontentloaded", timeout=30000)
                        consecutive_errors = 0
                    except Exception as re_err:
                        consecutive_errors += 1
                        if consecutive_errors >= 3:
                            log(f"連線逾時，準備重新啟動瀏覽器: {re_err}")
                            break

                await browser.close()
        except Exception as e:
            log(f"監控服務發生異常，10 秒後自動重試: {e}")
            await asyncio.sleep(10)

if __name__ == "__main__":
    try:
        asyncio.run(run_monitor())
    except KeyboardInterrupt:
        log("服務已由使用者手動停止。")
