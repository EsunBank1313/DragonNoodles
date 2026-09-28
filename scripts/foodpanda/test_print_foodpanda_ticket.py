#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
龍城麵線 - 測試列印一張 Foodpanda (熊貓) 外送貼袋備餐單
執行此腳本可立即向出單機發送一張範例單據，供確認文字大小、邊距與紙張寬度。
"""

import os
import sys
import json
from foodpanda_printer import generate_foodpanda_ticket_html, print_ticket_via_chrome, print_ticket_via_powershell

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(ROOT_DIR, "config_foodpanda_print.json")

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"printer_name": "", "paper_width": "58mm", "show_price": True}

def test_print():
    config = load_config()
    printer_name = config.get("printer_name") or None
    paper_width = config.get("paper_width", "58mm")
    show_price = config.get("show_price", True)

    sample_order = {
        "display_id": "P-76A3",
        "order_number": "P-76A3",
        "customer_name": "陳雅涵 (熊貓測試單)",
        "created_at": "2026-09-28 12:35",
        "total_price": 285,
        "note": "請附特製辣包，餐具 x 2",
        "items": [
            {"name": "大份綜合麵線", "quantity": 2, "specs": ["大碗"], "note": "小辣，多蒜"},
            {"name": "招牌肉包", "quantity": 3, "specs": [], "note": "分開裝袋"},
            {"name": "特製辣泡菜", "quantity": 1, "specs": [], "note": ""}
        ]
    }

    print("==========================================")
    print("正在測試發送【Foodpanda 熊貓外送貼袋單】至印表機...")
    print(f"印表機: {printer_name or 'Windows 系統預設印表機'}")
    print(f"紙張寬度: {paper_width}")
    print("==========================================")

    html = generate_foodpanda_ticket_html(sample_order, paper_width, show_price)
    
    # 嘗試以 Chrome 靜默列印
    success = print_ticket_via_chrome(html, printer_name)
    if not success:
        print("Chrome 靜默列印未完成，嘗試切換為系統 PowerShell 列印...")
        success = print_ticket_via_powershell(html, printer_name)

    if success:
        print("✓ 列印指令發送成功！請檢查出單機是否正常吐單與切單。")
    else:
        print("❌ 列印指令發送失敗，請確認印表機是否開啟並已正確安裝驅動程式。")

if __name__ == "__main__":
    test_print()
