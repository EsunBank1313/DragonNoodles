# 龍城麵線 (Dragon Noodles) - Foodpanda (熊貓外送) 即時訂單偵測與自動熱感應出單系統使用手冊

> 建立日期：2026-09-28  
> 適用環境：Windows 10 / 11、Google Chrome、熱感應出單機 (SLK-TL 122S / THERMAL 203DPI Printer 等)

---

## 一、系統概述

本系統專為龍城麵線打造，比照 Uber Eats 自動化出單的高規格標準，徹底解決外送尖峰時段「漏單、看錯備註、手動按出單繁瑣」的問題。

系統透過**本地專屬 Chrome Profile 與 Cookie 永久保存技術**，在背景自動監控 Foodpanda 商家看板：
1. **即時偵測新單**：第一時間攔截新進訂單與餐點明細。
2. **自動列印出單**：自動送至熱感應出單機切單列印「**外送專用貼袋備餐單**」，直接撕下貼於餐點袋上。
3. **語音叮咚提醒**：店內電腦發出專屬雙音節提示音效。
4. **雲端 POS 同步**：訂單同步寫入龍城 POS 雲端資料庫（`type: 'foodpanda'`），店內 Surface 平板畫面立即跳出並語音播報！

---

## 二、檔案清單與功能說明

所有服務檔案均已配置於：`c:\Users\eddgr\Projects\龍城麵線\`

| 檔案名稱 | 類型 | 功能說明 |
| :--- | :--- | :--- |
| **`【1】開啟Foodpanda登入並保存Cookie.bat`** | 登入工具 | **首次登入與保存 Cookie**。開啟專屬 Chrome 視窗前往 `https://partner.foodpanda.com/login`，登入後自動永久保留 Cookie 與 Session 於本機。 |
| **`【2】啟動Foodpanda自動出單與即時同步.bat`** | 批次檔 | **一鍵啟動自動出單守護服務**。自動連線看板、即時出單、切單與同步 POS。 |
| **`【測試】列印Foodpanda出單樣張.bat`** | 測試工具 | **測試出單機樣張**。發送一張熊貓範例單據至印表機，確認文字大小與版面。 |
| **`【停止】Foodpanda自動出單.bat`** | 管理腳本 | 快速停止背景自動出單進程並清理鎖定檔。 |
| **`config_foodpanda_print.json`** | 設定檔 | 出單機名稱、紙張寬度 (58mm/80mm)、提示音效、檢查頻率等參數。 |
| **`foodpanda_printer.py`** | 核心模組 | 熊貓貼袋單據 HTML 排版產生器與 Windows 靜默列印引擎。 |
| **`foodpanda_auto_print.py`** | 核心服務 | 背景訂單即時監聽、防重複出單、蜂鳴音效與 Supabase 雲端資料庫同步。 |
| **`run_foodpanda_auto_print_silent.vbs`** | 啟動腳本 | **開機靜默啟動（無黑視窗）**，適合放入 Windows 啟動資料夾。 |

---

## 三、操作三步驟 (Setup & Run)

### 步驟 1：測試出單機樣張
雙擊執行 **`【測試】列印Foodpanda出單樣張.bat`**：
* 出單機會立即吐出一張熊貓範例單據（包含單號 `#P-76A3`、顧客陳雅涵、麵線規格與反白黑底備註）。
* 確認印表機連線與文字寬度正常。

### 步驟 2：登入 Foodpanda 並保存 Cookie（僅需首次執行一次）
雙擊執行 **`【1】開啟Foodpanda登入並保存Cookie.bat`**：
1. 畫面會自動開啟專屬 Google Chrome 視窗，直達 Foodpanda 商家登入頁面：  
   `https://partner.foodpanda.com/login`
2. 請在 Chrome 視窗中輸入您的**商家帳號 (Email) 與密碼**。
3. 若有跳出簡訊驗證碼 (SMS OTP) 或 2FA 驗證，請照常輸入完成驗證。
4. 成功登入進入訂單看板後，終端機將顯示：  
   `✓ 成功捕捉並保存登入 Cookie！登入狀態已永久保留在本地 Chrome Profile！`
5. 完成後可直接關閉 Chrome 視窗。之後**不需每次重複輸入帳密**！

### 步驟 3：啟動自動出單守護服務
雙擊執行 **`【2】啟動Foodpanda自動出單與即時同步.bat`**：
1. 系統自動載入已保存的 Cookie，在背景連線至 Foodpanda 訂單看板。
2. 顯示 `✓ 成功進入 Foodpanda 訂單看板！開始持續即時監聽新單...`。
3. 一旦有新訂單進入：
   * 電腦發出 **「叮咚！」提醒聲**。
   * 熱感應出單機自動印出單據並切單。
   * 龍城 POS 平板畫面自動跳出新單（標記為 `🐼 foodpanda 熊貓外送`）。

---

## 四、設定檔調整 (`config_foodpanda_print.json`)

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
  * 留空 `""`：使用 Windows 目前的「預設印表機」。
  * 指定名稱：可填入出單機完整名稱（如 `"SLK-TL 122S"` 或 `"THERMAL 203DPI Printer"`）。
* **`paper_width`**：
  * `"58mm"`：預設 58mm 小票紙（實際印出約 44mm 安全邊界，絕不超出紙張邊界）。
  * `"80mm"`：適用 80mm 標準出單紙。
* **`show_price`**：
  * `true`：單據底部印出預估實收金額。
  * `false`：不印金額，僅作為純備餐單。
* **`sound_alert`**：
  * `true`：新單進來發出雙音階提示蜂鳴聲。
  * `false`：靜音出單。
* **`check_interval_seconds`**：
  * 檢查頻率（秒），預設 `15` 秒。

---

## 五、貼袋單據版面特色

1. **大號外送取餐單號**：
   * 頂部以超大粗體顯示 `#P-76A3` 或熊貓短碼，外送員取餐報號一秒辨識！
2. **反白黑底備註標籤**：
   * 客戶備註（如 `👉 備註: 小辣，多蒜`）自動轉為黑底白字高對比標籤，廚房尖峰備餐絕不漏看！
3. **碗數與客製規格明確**：
   * 自動標註 `(大碗)`、`(小碗)` 與份數 `x 2`。
4. **全單特別叮嚀**：
   * 客戶訂單叮嚀（例如：請附特製辣包、分開裝袋）加框標示於單號下方。

---

## 六、Windows 開機自動啟動（選用）

若希望店內電腦每天開機就自動在背景守護、不需手動點開：
1. 按鍵盤 `Win + R`，輸入 `shell:startup` 按 Enter（開啟 Windows 啟動資料夾）。
2. 在該資料夾內按右鍵 ->「新增」->「捷徑」。
3. 捷徑目標輸入：
   ```cmd
   wscript.exe "c:\Users\eddgr\Projects\龍城麵線\run_foodpanda_auto_print_silent.vbs"
   ```
4. 儲存即可。之後每天電腦開機就會在背後自動守護出單！
