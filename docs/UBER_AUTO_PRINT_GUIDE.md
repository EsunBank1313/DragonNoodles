# 龍城麵線 (Dragon Noodles) - Uber Eats 即時訂單自動偵測與熱感應出單系統使用與維護手冊

> 建立日期：2026-09-14  
> 適用環境：Windows 10 / 11、Google Chrome、熱感應出單機 (SLK-TL 122S / THERMAL 203DPI Printer 等)

---

## 一、系統概述

本系統專門解決外送高峰期「漏單、看錯備註、手動點印單據繁瑣」的問題。  
系統會在背景自動連線 Uber Eats 商家看板，即時偵測進行中的新訂單，並在第一時間將「**外送專用貼袋單據**」傳送至出單機自動切單列印，讓店家與廚房人員撕下後直接貼在餐點袋上備餐與核單。

---

## 二、檔案清單與功能說明

所有服務檔案均位於專案目錄：`c:\Users\eddgr\Projects\龍城麵線\`

| 檔案名稱 | 類型 | 功能說明 |
| :--- | :--- | :--- |
| **`test_print_ticket.py`** | 測試工具 | **測試出單樣張**。執行後會發送一張範例單據至印表機，供確認文字大小、邊距與紙張寬度。 |
| **`run_uber_auto_print.bat`** | 批次檔 | **一鍵啟動服務（前景模式）**。雙擊執行，會開啟黑底命令視窗顯示連線與接單日誌。 |
| **`run_uber_auto_print_silent.vbs`** | 啟動腳本 | **靜默常駐啟動（無黑視窗）**。適合放入 Windows「啟動」資料夾，電腦開機自動在背景守護。 |
| **`config_uber_print.json`** | 設定檔 | 出單機名稱、紙張寬度 (58mm/80mm)、提示音效、輪詢頻率等參數設定。 |
| **`uber_printer.py`** | 核心模組 | 貼袋單據 HTML 排版產生器與 Windows Chrome/PowerShell 靜默列印引擎。 |
| **`uber_auto_print.py`** | 核心服務 | Playwright 背景監聽、新單解析、防重複出單、蜂鳴音效與 Supabase 雲端資料庫同步。 |
| **`printed_orders.json`** | 資料快取 | 已列印訂單紀錄（清單），防止同一筆訂單重複列印。 |
| **`test_ticket_preview.html`** | 預覽檔案 | 貼袋單據的實際 HTML 預覽版，可用瀏覽器直接開啟檢視排版效果。 |

---

## 三、如何進行測試 (Test Procedures)

在您準備好測試時，請依照以下步驟進行：

### 步驟 1：確認出單機與連線
1. 確認熱感應出單機（如 `SLK-TL 122S`）已開機、裝好熱感應紙，且 USB/網路線已連接至電腦。
2. 確認 Windows 設定中的「印表機與掃描器」能看到該出單機（例如名為 `THERMAL 203DPI Printer`）。

### 步驟 2：測試出單機列印樣張
在終端機（PowerShell 或 CMD）執行以下指令：
```powershell
cd c:\Users\eddgr\Projects\龍城麵線
python test_print_ticket.py
```
* **預期結果**：出單機會立即吐出一張 Uber 貼袋單樣張，內容包含單號 `#8DC3B`、顧客周信佑、大份綜合麵線、花枝羹麵線及黑底白字備註。
* **排版校對**：檢查文字是否有被邊界裁切，若有需要調整寬度，請參考第四節修改 `config_uber_print.json`。

### 步驟 3：測試即時偵測服務
在專案目錄下雙擊執行 **`run_uber_auto_print.bat`**：
1. 視窗會顯示正在連線並登入 Uber Eats 商家看板。
2. 登入完成後會顯示 `✓ 成功登入 Uber Eats 訂單看板！開始持續即時監聽新單...`。
3. 一旦 Uber 後台有新訂單進入：
   * 電腦會發出 **「叮咚！」提醒音效**。
   * 出單機自動「刷！」吐出單據並切單。
   * 畫面顯示 `✓ [U-XXXXX] 自動出單成功！`。
   * 訂單同步入庫至龍城 POS 雲端系統。

---

## 四、設定檔調整 (`config_uber_print.json`)

設定檔內容如下：
```json
{
  "printer_name": "",
  "paper_width": "58mm",
  "show_price": true,
  "sound_alert": true,
  "check_interval_seconds": 15
}
```

* **`printer_name`**：
  * 若留空 `""`：系統會自動使用 Windows 目前設定的「**預設印表機**」。
  * 若想固定指定印表機：可填寫出單機的完整名稱，例如 `"THERMAL 203DPI Printer"`。
* **`paper_width`**：
  * `"58mm"`：適用 58mm 小票紙（實際列印寬度約 48mm）。
  * `"80mm"`：適用 80mm 標準大票紙（實際列印寬度約 72mm）。
* **`show_price`**：
  * `true`：單據底部會印出實收預估金額。
  * `false`：不印金額，僅作為純備餐標籤。
* **`sound_alert`**：
  * `true`：新單進來時發出兩聲提示蜂鳴音。
  * `false`：靜音出單。
* **`check_interval_seconds`**：
  * 檢查間隔秒數，預設為 `15` 秒。

---

## 五、貼袋單據版面設計特色

1. **特大號外送單號**：
   * 頂部以超大粗體顯示 `#8DC3B`，外送員取餐報號一秒辨識。
2. **反白黑底備註標籤**：
   * 客戶填寫的備註（如 `👉 備註: 小辣，蒜多`）自動以黑底白字高對比方塊凸顯，避免尖峰時段廚房忙碌漏看。
3. **碗數與規格明確**：
   * 自動標記 `(大碗)`、`(小碗)` 與份數 `x 2`。
4. **全單特別叮嚀**：
   * 若客戶有訂單備註（例如：請附餐具與辣包），加框顯示在單號下方。

---

## 六、開機自動啟動設定（選用）

若希望這台電腦每天開機就自動在背景守護、不需要手動開程式：
1. 按下鍵盤 `Win + R` 鍵，輸入 `shell:startup` 後按 Enter（會開啟 Windows 的「啟動」資料夾）。
2. 在該資料夾內按右鍵 ->「新增」->「捷徑」。
3. 捷徑位置輸入：
   ```cmd
   wscript.exe "c:\Users\eddgr\Projects\龍城麵線\run_uber_auto_print_silent.vbs"
   ```
4. 儲存即可。之後每次開機登入 Windows，系統便會在背後靜默執行出單服務。

---

## 七、同步完成之熊貓 (foodpanda) 匯入升級紀錄

在此次開發中，亦一併強化了 POS 系統「熊貓 CSV 匯入」的核心相容性：
1. **全自動雙編碼解碼 (UTF-8 & Big5)**：
   * 自動相容微軟 Excel 在 Windows 上開啟存檔後的 ANSI/Big5 編碼，解決中文字變亂碼無法辨識的問題。
2. **全套英文版 CSV 欄位支援**：
   * 支援 `Order ID`、`Order received at`、`Estimated earnings`、`Payout Amount`、`Order Items`、`Delivered` / `Cancelled`。
   * 支援不同分隔符（逗號 `,`、分號 `;`、Tab `\t`）及跳過檔案開頭備註列。
3. **已推播上線**：已部署至雲端正式環境（`master` 與 `main` 分支）。
