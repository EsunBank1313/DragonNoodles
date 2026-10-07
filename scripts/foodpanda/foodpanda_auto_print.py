#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
龍城麵線 (Dragon Noodles) - Foodpanda (熊貓外送) 即時訂單偵測與自動熱感應出單守護進程
功能：
1. 使用本地保存的 Chrome Cookie 與 Session 在背景持續監看 Foodpanda 商家訂單看板
2. 攔截 API 與訂單看板即時新單
3. 自動以出單機列印外送專用貼袋備餐單
4. 發出提醒音效通知店員
5. 自動將訂單同步至 POS 雲端資料庫 (Supabase)，使收銀機與廚房即時聯動！
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
from foodpanda_printer import generate_foodpanda_ticket_html, print_ticket_via_chrome, print_ticket_via_powershell

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(ROOT_DIR, "foodpanda_chrome_profile")
CONFIG_PATH = os.path.join(ROOT_DIR, "config_foodpanda_print.json")
PRINTED_LOG_PATH = os.path.join(ROOT_DIR, "foodpanda_printed_orders.json")
LOG_FILE = os.path.join(ROOT_DIR, "foodpanda_auto_print.log")
LOCK_FILE = os.path.join(ROOT_DIR, "foodpanda_auto_print.lock")

SUPABASE_URL = "https://ctenchhzlnewhivauumk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0ZW5jaGh6bG5ld2hpdmF1dW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjUzNTYsImV4cCI6MjEwNDM0MTM1Nn0.V65m3c8GTQSrMBaWdG40DBq4LIq7RZnx7igcipYkH1k"

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
        winsound.Beep(1400, 200)
        winsound.Beep(1900, 450)
    except Exception:
        pass

def is_pid_alive(pid):
    try:
        import ctypes
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

def acquire_single_instance_lock():
    if os.path.exists(LOCK_FILE):
        try:
            with open(LOCK_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content.isdigit():
                    old_pid = int(content)
                    if old_pid != os.getpid() and is_pid_alive(old_pid):
                        return False
        except Exception:
            pass
        try:
            os.remove(LOCK_FILE)
        except Exception:
            pass

    try:
        with open(LOCK_FILE, "w", encoding="utf-8") as f:
            f.write(str(os.getpid()))
            f.flush()
        return True
    except Exception:
        return False

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
    s.add(str(order_key).strip())
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

def update_foodpanda_order_status_in_db(order_number, new_status, cancel_reason=""):
    try:
        url = f"{SUPABASE_URL}/rest/v1/orders?order_number=eq.{urllib.parse.quote(order_number)}"
        req_get = urllib.request.Request(url, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        })
        existing_orders = []
        with urllib.request.urlopen(req_get, timeout=8) as res:
            existing_orders = json.loads(res.read().decode("utf-8"))
        if not existing_orders:
            return False

        existing = existing_orders[0]
        if existing.get("status") == new_status:
            return True

        current_remarks = existing.get("remarks") or ""
        tag = f"[熊貓外送已取消: {cancel_reason}]" if cancel_reason else "[熊貓外送已取消]"
        updated_remarks = current_remarks
        if tag not in updated_remarks:
            updated_remarks = f"{current_remarks} {tag}".strip()

        patch_payload = {
            "status": new_status,
            "remarks": updated_remarks
        }
        req_data = json.dumps(patch_payload).encode("utf-8")
        req_patch = urllib.request.Request(url, data=req_data, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }, method="PATCH")
        with urllib.request.urlopen(req_patch, timeout=10) as res:
            if res.status in (200, 204):
                log(f"  ✓ [{order_number}] 雲端訂單狀態已更新為: {new_status} ({tag})")
                return True
    except Exception as e:
        log(f"⚠️ 更新訂單狀態出錯: {e}")
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

def parse_foodpanda_order_dict(val):
    """將 Foodpanda API 回傳之 JSON 物件解析為標準單據資料結構"""
    order_id = str(val.get("id") or val.get("order_id") or val.get("code") or val.get("order_code") or "").strip()
    short_code = str(val.get("short_code") or val.get("shortCode") or val.get("pickup_code") or (order_id[-5:] if len(order_id) >= 5 else order_id)).strip()
    if not short_code:
        short_code = "PANDA"

    clean_short_code = short_code.replace("P-", "")
    order_number = f"P-{clean_short_code}"

    # 顧客資訊
    cust_data = val.get("customer") or val.get("customer_info") or {}
    if isinstance(cust_data, dict):
        customer_name = cust_data.get("name") or cust_data.get("first_name") or "熊貓 顧客"
    elif isinstance(cust_data, str) and cust_data:
        customer_name = cust_data
    else:
        customer_name = "熊貓 顧客"

    # 金額資訊
    payment_obj = val.get("payment") or {}
    total_val = None
    if isinstance(payment_obj, dict):
        total_val = payment_obj.get("total") or payment_obj.get("itemsTotalPrice") or payment_obj.get("amount")

    if not total_val:
        total_val = val.get("total_amount") or val.get("total") or val.get("price") or val.get("subtotal") or 0

    if isinstance(total_val, dict):
        total_price = float(total_val.get("amount") or total_val.get("value") or 0)
    else:
        try:
            total_price = float(re.sub(r"[^0-9.]", "", str(total_val)) or 0)
        except Exception:
            total_price = 0

    created_at = val.get("created_at") or val.get("placed_at") or val.get("order_time") or datetime.now().strftime("%Y-%m-%d %H:%M")
    if "T" in str(created_at):
        try:
            dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            created_at = dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            pass

    overall_note = str(val.get("special_instructions") or val.get("notes") or val.get("remark") or val.get("comment") or "").strip()

    # 提取品項
    cart_items = []
    raw_items = val.get("items") or val.get("products") or val.get("order_items") or []
    for it in raw_items:
        if not isinstance(it, dict):
            continue
        name = str(it.get("name") or it.get("title") or it.get("item_name") or "餐點").strip()
        qty = int(it.get("quantity") or it.get("qty") or it.get("amount") or 1)
        item_note = str(it.get("special_instructions") or it.get("note") or it.get("instructions") or it.get("comment") or "").strip()

        # 規格 / 加料 / 選項
        specs = []
        if "大" in name:
            specs.append("大碗")
        elif "小" in name:
            specs.append("小碗")

        options = it.get("options") or it.get("selected_options") or it.get("modifiers") or []
        extra_price = 0.0
        for opt in options:
            if isinstance(opt, dict):
                opt_name = opt.get("name") or opt.get("title") or ""
                if opt_name and opt_name not in specs:
                    specs.append(opt_name)
                opt_p = opt.get("price") or opt.get("total") or 0
                try:
                    extra_price += float(opt_p)
                except Exception:
                    pass
            elif isinstance(opt, str) and opt and opt not in specs:
                specs.append(opt)

        raw_price = it.get("price") or it.get("unit_price") or it.get("total") or 0
        if isinstance(raw_price, dict):
            unit_price = float(raw_price.get("amount") or raw_price.get("value") or 0)
        else:
            try:
                unit_price = float(re.sub(r"[^0-9.]", "", str(raw_price)) or 0)
            except Exception:
                unit_price = 0

        item_unit_total = unit_price + (extra_price / qty if qty > 0 else extra_price)

        cart_items.append({
            "name": name,
            "quantity": qty,
            "specs": specs,
            "note": item_note,
            "price": item_unit_total,
            "totalPrice": item_unit_total * qty
        })

    # 若總金額仍為 0，嘗試由品項加總
    if total_price == 0 and cart_items:
        calc_total = sum(it.get("price", 0) * it.get("quantity", 1) for it in cart_items)
        if calc_total > 0:
            total_price = calc_total

    # 預約單 / 預定取餐時間
    is_preorder = bool(val.get("preorder"))
    raw_pickup = val.get("transport", {}).get("pickupTime") or val.get("deliverAt") or val.get("pickup_time") or ""
    pickup_time_str = ""
    if raw_pickup:
        try:
            p_dt = datetime.fromisoformat(str(raw_pickup).replace("Z", "+00:00"))
            p_dt_tw = p_dt.astimezone()
            pickup_time_str = p_dt_tw.strftime("%H:%M")
        except Exception:
            pickup_time_str = str(raw_pickup)

    # 訂單狀態與取消判斷
    raw_state = str(val.get("state") or val.get("status") or "").upper()
    is_cancelled = "CANCEL" in raw_state or "REJECT" in raw_state or "VOID" in raw_state

    return {
        "order_id": order_id,
        "display_id": clean_short_code,
        "short_code": clean_short_code,
        "order_number": order_number,
        "customer_name": customer_name,
        "created_at": created_at,
        "total_price": total_price,
        "state": raw_state,
        "is_cancelled": is_cancelled,
        "is_preorder": is_preorder,
        "pickup_time": pickup_time_str,
        "items": cart_items,
        "note": overall_note
    }

async def process_new_foodpanda_order(order_data, config):
    display_id = order_data["display_id"]
    order_number = order_data["order_number"]
    customer_name = order_data["customer_name"]

    log(f"🔔 偵測到 Foodpanda 新訂單 [{order_number}] 顧客: {customer_name}，品項數: {len(order_data['items'])}")

    # 1. 播放通知音效
    if config.get("sound_alert", True):
        play_alert_sound()

    # 2. 自動列印出單
    printer_name = config.get("printer_name") or None
    paper_width = config.get("paper_width", "58mm")
    show_price = config.get("show_price", True)

    html = generate_foodpanda_ticket_html(order_data, paper_width, show_price)
    
    log(f"  🖨️ 正在傳送單據至出單機 ({printer_name or '系統預設印表機'})...")
    printed = print_ticket_via_chrome(html, printer_name)
    if not printed:
        printed = print_ticket_via_powershell(html, printer_name)

    if printed:
        log(f"  ✓ [{order_number}] 熊貓外送單自動出單成功！直接貼於餐點袋備餐。")
    else:
        log(f"  ⚠️ [{order_number}] 列印指令發送失敗，請確認印表機狀態。")

    # 3. 記錄已列印，防重複
    save_printed_order(order_data["order_id"])
    save_printed_order(display_id)
    save_printed_order(order_number)

    # 4. 同步至 Supabase POS 雲端
    if not check_order_exists_in_db(order_number):
        is_preorder = order_data.get("is_preorder", False)
        pickup_time = order_data.get("pickup_time", "")
        remarks_list = []
        if is_preorder or pickup_time:
            remarks_list.append(f"預約取餐: {pickup_time}" if pickup_time else "預約單")

        db_payload = {
            "order_number": order_number,
            "total": order_data["total_price"],
            "type": "foodpanda",
            "status": "received",
            "payment_status": "paid",
            "payment_method": "foodpanda",
            "cashier_name": "Foodpanda 平台",
            "remarks": " | ".join(remarks_list) if remarks_list else None,
            "created_at": datetime.now().astimezone().isoformat(),
            "items": {
                "source": "foodpanda",
                "customerName": customer_name,
                "is_printed": True,
                "storeCode": "dragon",
                "paymentMethod": "foodpanda",
                "isPreorder": is_preorder,
                "pickupTime": pickup_time,
                "cart": [
                    {
                        "id": idx + 1,
                        "name": it["name"],
                        "quantity": it["quantity"],
                        "specs": it["specs"],
                        "note": it["note"],
                        "price": it.get("price", 0),
                        "totalPrice": it.get("totalPrice", it.get("price", 0) * it["quantity"])
                    } for idx, it in enumerate(order_data["items"])
                ]
            }
        }
        if sync_order_to_supabase(db_payload):
            log(f"  ✓ [{order_number}] 已同步至龍城 POS 雲端系統（平板畫面自動顯示）。")

async def run_foodpanda_monitor():
    if not acquire_single_instance_lock():
        log("❌ 守護進程已在執行中，請勿重複啟動！")
        return

    config = load_config()
    interval = max(10, config.get("check_interval_seconds", 15))

    log("=" * 60)
    log("🚀 啟動 Foodpanda (熊貓外送) 即時訂單偵測與自動出單守護服務...")
    log(f"印表機: {config.get('printer_name') or 'Windows 預設印表機'}")
    log(f"紙張寬度: {config.get('paper_width', '58mm')}")
    log(f"輪詢檢查間隔: 每 {interval} 秒檢查一次")
    log(f"登入 Profile 目錄: {PROFILE_DIR}")
    log("=" * 60)

    if not os.path.exists(PROFILE_DIR):
        log("⚠️ 尚未偵測到 Foodpanda 登入設定檔！")
        log("👉 請先雙擊執行【1】開啟Foodpanda登入並保存Cookie.bat 完成首次登入。")

    while True:
        try:
            async with async_playwright() as p:
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=PROFILE_DIR,
                    executable_path=CHROME_PATH if os.path.exists(CHROME_PATH) else None,
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--disable-gpu",
                        "--no-sandbox"
                    ]
                )

                page = context.pages[0] if context.pages else await context.new_page()

                captured_orders = []

                # 監聽網路回應，攔截即時訂單 API
                async def handle_response(response):
                    try:
                        url_lower = response.url.lower()
                        # 匹配 Delivery Hero / Foodpanda 訂單 API
                        if ("order" in url_lower or "vendor" in url_lower) and response.request.method in ("GET", "POST"):
                            content_type = response.headers.get("content-type", "")
                            if "application/json" in content_type:
                                data = await response.json()
                                if isinstance(data, dict):
                                    # 模式 1: 陣列包裹在 orders 欄位
                                    ord_list = data.get("orders") or data.get("data", {}).get("orders") or []
                                    if isinstance(ord_list, list) and ord_list:
                                        for o in ord_list:
                                            if isinstance(o, dict):
                                                captured_orders.append(o)
                                    # 模式 2: 單筆新訂單推送
                                    elif data.get("id") and (data.get("items") or data.get("customer")):
                                        captured_orders.append(data)
                    except Exception:
                        pass

                page.on("response", handle_response)

                log("1. 連線至 Foodpanda 商家端訂單看板...")
                try:
                    await page.goto("https://partner.foodpanda.com/orders", wait_until="domcontentloaded", timeout=45000)
                except Exception as e:
                    log(f"網頁載入提示: {e}")

                await asyncio.sleep(4)

                # 檢查是否被重導向至登入頁
                if "/login" in page.url.lower():
                    log("⚠️ 登入已失效或尚未登入 (跳轉至 /login)。")
                    log("👉 請先執行【1】開啟Foodpanda登入並保存Cookie.bat 重新登入！")
                    await context.close()
                    await asyncio.sleep(20)
                    continue

                log("✓ 成功進入 Foodpanda 訂單看板！開始持續即時監聽新單...")

                consecutive_errors = 0
                while True:
                    cur_config = load_config()
                    printed_set = load_printed_set()

                    # A. 處理 API 捕捉到的訂單
                    if captured_orders:
                        to_process = list(captured_orders)
                        captured_orders.clear()
                        for raw_order in to_process:
                            try:
                                parsed = parse_foodpanda_order_dict(raw_order)
                                oid = parsed["order_id"]
                                disp = parsed["display_id"]
                                num = parsed["order_number"]
                                is_cancelled = parsed.get("is_cancelled", False)
                                raw_state = parsed.get("state", "")

                                if is_cancelled:
                                    update_foodpanda_order_status_in_db(num, "cancelled", raw_state)
                                elif oid not in printed_set and disp not in printed_set and num not in printed_set:
                                    if parsed["items"]:
                                        await process_new_foodpanda_order(parsed, cur_config)
                            except Exception as parse_err:
                                log(f"解析訂單資料異常: {parse_err}")

                    # B. DOM 頁面即時掃描（防 API 變更之雙重保險）
                    try:
                        # 尋找訂單卡片元素
                        order_cards = await page.locator('[data-testid*="order-card"], [class*="orderCard"], [class*="OrderCard"], tr[class*="order"]').all()
                        for card in order_cards:
                            card_text = await card.inner_text()
                            # 提取訂單號 (如 #1234, P-XXXX 等)
                            m = re.search(r"#?([A-Za-z0-9]{4,8})", card_text)
                            if m:
                                code = m.group(1).upper()
                                if code not in printed_set and f"P-{code}" not in printed_set:
                                    # 嘗試點開或解析品項
                                    lines = [ln.strip() for ln in card_text.split("\n") if ln.strip()]
                                    items = []
                                    cust_name = "熊貓 顧客"
                                    for ln in lines:
                                        if "顧客" in ln or "客戶" in ln:
                                            cust_name = ln.replace("顧客", "").replace(":", "").strip()
                                        elif "x" in ln or "份" in ln or "碗" in ln:
                                            items.append({"name": ln, "quantity": 1, "specs": [], "note": "", "price": 0, "totalPrice": 0})

                                    # 嘗試從卡片文字中擷取金額 (例如 NT$ 244 或 $244)
                                    card_total = 0.0
                                    price_match = re.search(r"(?:NT\$|\$)\s*(\d+(?:\.\d+)?)", card_text)
                                    if price_match:
                                        try:
                                            card_total = float(price_match.group(1))
                                        except Exception:
                                            card_total = 0.0

                                    if items:
                                        dom_order = {
                                            "order_id": code,
                                            "display_id": code,
                                            "short_code": code,
                                            "order_number": f"P-{code}",
                                            "customer_name": cust_name,
                                            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                                            "total_price": card_total,
                                            "items": items,
                                            "note": ""
                                        }
                                        await process_new_foodpanda_order(dom_order, cur_config)
                    except Exception:
                        pass

                    # 等待輪詢間隔
                    await asyncio.sleep(interval)

                    # 輕度重新整理以獲取最新單據列表
                    try:
                        await page.reload(wait_until="domcontentloaded", timeout=30000)
                        consecutive_errors = 0
                    except Exception as re_err:
                        consecutive_errors += 1
                        if consecutive_errors >= 3:
                            log(f"連線逾時 ({consecutive_errors} 次)，重置瀏覽器: {re_err}")
                            break

                await context.close()

        except Exception as e:
            log(f"守護服務遇到異常，10 秒後自動重新連線: {e}")
            await asyncio.sleep(10)

if __name__ == "__main__":
    try:
        asyncio.run(run_foodpanda_monitor())
    except KeyboardInterrupt:
        log("服務已由使用者手動停止。")
