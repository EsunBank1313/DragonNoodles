#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
龍城麵線 - 測試列印一張 Uber 外送貼袋備餐單
執行此腳本可立即向印表機發送一張範例單據，用於校對版面、大小與清晰度。
"""

import os
import sys
import json
from uber_printer import generate_packaging_ticket_html, print_ticket_via_chrome, print_ticket_via_powershell

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config_uber_print.json")

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
        "display_id": "8DC3B",
        "order_number": "U-8DC3B",
        "customer_name": "周信佑 (測試單)",
        "created_at": "2026-09-13 18:25",
        "total_price": 240,
        "note": "請附餐具與辣包",
        "items": [
            {"name": "大份綜合麵線", "quantity": 2, "specs": ["大碗"], "note": "小辣，蒜多"},
            {"name": "花枝羹麵線", "quantity": 1, "specs": ["小碗"], "note": "不加香菜"}
        ]
    }

    print(f"==========================================")
    print(f"正在測試發送【Uber 外送貼袋單】至印表機...")
    print(f"印表機: {printer_name or 'Windows 系統預設印表機'}")
    print(f"紙張寬度: {paper_width}")
    print(f"==========================================")

    html = generate_packaging_ticket_html(sample_order, paper_width, show_price)
    
    # 嘗試以 Chrome 靜默列印
    success = print_ticket_via_chrome(html, printer_name)
    if not success:
        print("Chrome 靜默列印未完成，嘗試切換為系統 PowerShell 列印...")
        success = print_ticket_via_powershell(html, printer_name)

    if success:
        print("列印指令發送成功！請檢查出單機是否正常吐單。")
    else:
        print("列印指令發送失敗，請確認印表機是否開啟並已正確安裝驅動程式。")

if __name__ == "__main__":
    test_print()
