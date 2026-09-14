#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
龍城麵線 - Uber Eats 熱感應外送貼袋單據生成與列印模組
"""

import os
import sys
import json
import subprocess
import tempfile
from datetime import datetime

# Windows 預設 Chrome 路徑
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

def generate_packaging_ticket_html(order_data, paper_width="58mm", show_price=True):
    """
    生成專門貼在餐點袋上的熱感應外送備餐單據 HTML
    """
    display_id = order_data.get("display_id", "UBER")
    order_number = order_data.get("order_number", f"U-{display_id}")
    customer_name = order_data.get("customer_name", "Uber 顧客")
    created_at = order_data.get("created_at") or datetime.now().strftime("%Y-%m-%d %H:%M")
    total_price = order_data.get("total_price", 0)
    items = order_data.get("items", [])
    overall_note = order_data.get("note", "")

    # 58mm (約 48mm-54mm 可印寬度) / 80mm (約 72mm 可印寬度)
    is_58mm = (paper_width == "58mm")
    container_width = "48mm" if is_58mm else "72mm"
    body_font_size = "13px" if is_58mm else "15px"
    huge_font_size = "26px" if is_58mm else "32px"
    item_font_size = "15px" if is_58mm else "17px"

    items_html = ""
    for idx, it in enumerate(items, 1):
        name = it.get("name", "餐點")
        qty = it.get("quantity", 1)
        specs = it.get("specs", [])
        spec_text = f" ({'/'.join(specs)})" if specs else ""
        item_note = it.get("note", "")
        item_price = it.get("price", 0)

        items_html += f"""
        <div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; font-size: {item_font_size}; font-weight: bold;">
                <span style="flex: 1; word-break: break-word;">{idx}. {name}{spec_text}</span>
                <span style="font-size: {item_font_size}; min-width: 32px; text-align: right; color: #000;">x {qty}</span>
            </div>
        """
        if item_note:
            items_html += f"""
            <div style="margin-top: 3px; padding: 3px 6px; background-color: #000; color: #fff; font-weight: bold; font-size: 13px; border-radius: 3px; display: inline-block;">
                👉 備註: {item_note}
            </div>
            """
        items_html += "</div>"

    overall_note_html = ""
    if overall_note:
        overall_note_html = f"""
        <div style="margin: 6px 0; padding: 6px; border: 2px solid #000; border-radius: 4px; font-weight: bold; font-size: 14px;">
            ⚠️ 全單叮嚀：{overall_note}
        </div>
        """

    price_html = ""
    if show_price and total_price > 0:
        price_html = f"""
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 4px;">
            <span>實收營收(估)：</span>
            <span>NT$ {int(total_price)}</span>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Uber 貼袋單 #{display_id}</title>
    <style>
        @page {{
            margin: 0;
            size: auto;
        }}
        html, body {{
            margin: 0;
            padding: 0;
            background-color: #fff;
            color: #000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", "微軟正黑體", sans-serif;
            font-size: {body_font_size};
            line-height: 1.35;
        }}
        .ticket-wrapper {{
            width: {container_width};
            margin: 0 auto;
            padding: 6px 2px;
            box-sizing: border-box;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
            margin-bottom: 6px;
        }}
        .badge {{
            display: inline-block;
            background-color: #000;
            color: #fff;
            font-weight: 900;
            font-size: 13px;
            padding: 2px 8px;
            border-radius: 4px;
            letter-spacing: 1px;
            margin-bottom: 4px;
        }}
        .display-id {{
            font-size: {huge_font_size};
            font-weight: 900;
            line-height: 1.1;
            margin: 4px 0;
            letter-spacing: 1.5px;
        }}
        .cust-info {{
            font-size: 14px;
            font-weight: bold;
            margin-top: 2px;
        }}
        .items-section {{
            margin: 8px 0;
        }}
        .footer {{
            border-top: 1px dashed #000;
            padding-top: 6px;
            margin-top: 6px;
            font-size: 11px;
            color: #333;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="ticket-wrapper">
        <div class="header">
            <div class="badge">🛵 UBER EATS 外送</div>
            <div class="display-id">#{display_id}</div>
            <div class="cust-info">顧客：{customer_name}</div>
        </div>

        {overall_note_html}

        <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom: 2px;">
            【 餐 點 明 細 】(貼袋備餐專用)
        </div>

        <div class="items-section">
            {items_html}
        </div>

        {price_html}

        <div class="footer">
            <div>單號：{order_number}</div>
            <div>時間：{created_at}</div>
            <div style="font-weight: bold; margin-top: 2px;">龍城麵線 ★ 現點現做</div>
        </div>
    </div>
</body>
</html>
"""
    return html

def print_ticket_via_chrome(html_content, printer_name=None):
    """
    透過 Chrome Headless 靜默送印至指定印表機或預設印表機
    """
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
        f.write(html_content)
        temp_html = f.name

    try:
        cmd = [
            CHROME_PATH,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--kiosk-printing"
        ]
        
        if printer_name:
            cmd.append(f"--print-to-printer={printer_name}")
        
        cmd.append(temp_html)
        res = subprocess.run(cmd, capture_output=True, timeout=15)
        return res.returncode == 0
    except Exception as e:
        print(f"Chrome 列印失敗: {e}")
        return False
    finally:
        try:
            if os.path.exists(temp_html):
                os.remove(temp_html)
        except Exception:
            pass

def print_ticket_via_powershell(html_content, printer_name=None):
    """
    備用方案：生成 PDF 後透過 PowerShell 傳送至 Windows 印表機
    """
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
        f.write(html_content)
        temp_html = f.name
    temp_pdf = temp_html.replace(".html", ".pdf")

    try:
        pdf_cmd = [
            CHROME_PATH,
            "--headless=new",
            "--disable-gpu",
            f"--print-to-pdf={temp_pdf}",
            temp_html
        ]
        subprocess.run(pdf_cmd, capture_output=True, timeout=15)

        if not os.path.exists(temp_pdf):
            return False

        ps_cmd = f"Start-Process -FilePath '{temp_pdf}' -Verb Print"
        if printer_name:
            ps_cmd = f"Start-Process -FilePath '{temp_pdf}' -Verb PrintTo -ArgumentList '\"{printer_name}\"'"

        subprocess.run(["powershell", "-Command", ps_cmd], capture_output=True, timeout=10)
        return True
    except Exception as e:
        print(f"PowerShell 列印失敗: {e}")
        return False
    finally:
        for p in [temp_html, temp_pdf]:
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass
