# 🐉 龍城麵線餐飲雲端點餐與財務管理系統
## 👨‍💻 系統開發交接技術手冊 (Developer Handover Manual)

> **文件版本**：v2.4.0 (2026 最新正式版)  
> **交接對象**：接手本系統之前端工程師、全端開發者、系統維運人員  
> **系統狀態**：雙門市正式運營中（龍城總店 ＋ 蘆洲七號分店）

---

## 📑 目錄
1. [系統總覽與線上站點清單](#1-系統總覽與線上站點清單)
2. [技術架構與關鍵相依套件](#2-技術架構與關鍵相依套件)
3. [專案目錄結構與雙店鏡像架構](#3-專案目錄結構與雙店鏡像架構)
4. [核心程式碼模組與功能職責](#4-核心程式碼模組與功能職責)
5. [資料庫架構與雲端資料存儲規格 (Supabase)](#5-資料庫架構與雲端資料存儲規格-supabase)
6. [重要業務邏輯與關鍵陷阱 (Gotchas)](#6-重要業務邏輯與關鍵陷阱-gotchas)
7. [日常開發、同步與佈署工作流 (SOP)](#7-日常開發同步與佈署工作流-sop)
8. [帳號權限、金鑰與安全設定](#8-帳號權限金鑰與安全設定)

---

## 1. 系統總覽與線上站點清單

本系統為專門為中小型連鎖餐飲業打造的**全流程一站式雲端營運平台**，涵蓋：
* **顧客端**：手機免裝 App 掃碼點餐（支援內用桌號、外帶外送、自訂規格口味、套餐點選、訂單進度震動通知）。
* **收銀端 (POS)**：櫃檯現場收銀點餐、桌號管理、單鍵結帳、熱感小票自動列印、RJ11 收銀機錢箱自動彈開、交接班小票對帳、日結單收店。
* **後台管理**：菜單與商品管理、單選與複選客製規格（如大小碗、粗細麵、加料加價）、商品定價與成本維護、營業日與休假日設定。
* **財務記帳與產能分析**：營業流水帳、進貨採購帳（變動成本）、租金水電水單（固定成本）、抽屜現金點鈔盤點計算機、**按月損益報表（支援模組開關、大小碗總比例與一鍋物料換算）**。

### 🌐 正式運營網址與入口

| 門市代碼 | 門市名稱 | 正式運營網域 | 專案目錄 |
| :--- | :--- | :--- | :--- |
| `dragon` | **龍城麵線（總店）** | [https://dragon.twabc.com](https://dragon.twabc.com) | `restaurant_ordering_system/` |
| `luzhou7` | **蘆洲七號店（分店）** | [https://luzhou7.vercel.app](https://luzhou7.vercel.app) | `luzhou7_system/` |

#### 各功能模組 URL 參數入口：
* **📱 顧客線上點餐**：`https://[網域]/?store=[安全鑰匙][&table=桌號]`
* **🖥️ POS 櫃檯收銀機**：`https://[網域]/?store=[安全鑰匙]&cashier=true`（預設 PIN: `8888`）
* **📊 財務記帳與盤點**：`https://[網域]/?store=[安全鑰匙]&bookkeeping=true`
* **⚙️ 後台商品與規格**：`https://[網域]/?store=[安全鑰匙]&management=true`

---

## 2. 技術架構與關鍵相依套件

* **前端框架**：`React 19` + `Vite 8`（極速熱重載與優化編譯）
* **後端與雲端資料庫**：`Supabase`
  * PostgreSQL 資料表存儲（訂單、商品、庫存、記帳、盤點）
  * Realtime Broadcast 即時推播（雙向訂單更新、作廢同步、出單機通知）
  * Row Level Security (RLS) 與資料隔離機制
* **樣式與圖標**：原生 CSS3 Variables（深淺色主視覺配色）+ `lucide-react`
* **硬體通訊與出單**：
  * ESC/POS 80mm / 58mm 熱感小票機列印（經由瀏覽器原生列印 / 網路印表機 / ESC/POS 脈衝開錢箱）
* **輔助套件**：`canvas-confetti`（慶祝動畫）、`qrcode.react`（桌貼點餐 QR Code 產生）
* **託管與自動化**：`Vercel Production` + `GitHub`（Repository: `EsunBank1313/DragonNoodles`）

---

## 3. 專案目錄結構與雙店鏡像架構

```text
龍城麵線/
├── DEPLOYMENT_GUIDE.md               # 店長快速部署圖解指南
├── POS機台列印設定.md                # 出單機與錢箱硬體設定說明
├── vercel_deployment_handover_guide.md # Vercel 雲端部署與連線交接指南
├── supabase_schema_universal.sql     # Supabase 全域資料表建置 SQL 腳本
│
├── restaurant_ordering_system/       # ⭐ 總店主系統原始碼 (主要開發目錄)
│   ├── index.html                    # 總店 HTML 入口 (Title: 龍城麵線)
│   ├── package.json
│   ├── vite.config.js
│   ├── .env                          # 本地開發環境變數 (VITE_STORE_NAME="龍城麵線")
│   └── src/
│       ├── App.jsx                   # 路由分發、全域狀態、模式路由切換
│       ├── index.css                 # 全域主題變數與共用 UI 樣式
│       ├── main.jsx                  # React 19 渲染進入點
│       ├── supabaseClient.js         # Supabase SDK 連線實例
│       ├── components/               # 核心業務組件 (詳見第 4 節)
│       │   ├── CashierView.jsx       # POS 收銀檯、出單機列印、換班收店
│       │   ├── BookkeepingView.jsx   # 財務記帳、按月報表、盤點、作廢復原
│       │   ├── CustomerView.jsx      # 顧客手機掃碼點餐介面
│       │   ├── ManagementView.jsx    # 後台商品菜單、規格客製化設定
│       │   ├── ItemModal.jsx         # 餐點規格/配料加購選擇彈窗
│       │   ├── ModuleCenterModal.jsx # 系統功能模組擴充中心
│       │   └── SetupWizardModal.jsx  # 新店初始化開檔設定精靈
│       └── utils/
│           ├── securityConfig.js     # 安全金鑰與店別代碼解析工具
│           ├── moduleContext.js      # 模組化開關 Context
│           └── storeContext.js       # 多店隔離工具
│
└── luzhou7_system/                   # 🏪 蘆洲七號分店鏡像專案
    ├── index.html                    # 分店 HTML 入口 (Title: 蘆洲七號店)
    ├── package.json
    ├── .env                          # 分店環境變數 (VITE_STORE_NAME="蘆洲七號店")
    └── src/                          # 與主專案同構，由同步腳本保持最新
```

> 💡 **開發黃金準則**：
> 1. 平時所有功能開發與修改，**請一律在 `restaurant_ordering_system/` 進行**。
> 2. 開發測試完成後，執行根目錄的雙店同步腳本，自動將程式碼完全無損同步至 `luzhou7_system/`，避免雙邊修改不一致。

---

## 4. 核心程式碼模組與功能職責

### ① `CashierView.jsx`（POS 櫃檯收銀系統）
* **現場點餐結帳**：桌號選擇、外帶內用切換、快速加點、折扣計算、一鍵結帳。
* **出單機與錢箱聯動**：
  * 支援 ESC/POS 列印格式。
  * 結帳完成觸發開錢箱脈衝（`\x1B\x70\x00\x19\xFA`）。
  * 換班結算單次列印保護（防呆避免小票印兩次）。
  * 日結單收店列印無空白紙防呆。
* **訂單作廢與刪除**：
  * 每張卡片配備【🗑️ 作廢】按鈕，填寫作廢原因後將狀態更新為 `deleted`。
  * 發送 `pos_order_deleted_sync` 廣播，所有 POS 端同步移除該單據。

### ② `BookkeepingView.jsx`（財務記帳、盤點與按月損益報表）
* **當日營業流水帳**：
  * 切換查看「📋 有效營業帳目」與「🗑️ 已作廢/已刪除訂單」。
  * 歷史作廢訂單具備 **【♻️ 復原訂單】** 功能，點擊一鍵還原營收並同步通知 POS。
  * 訂單品項明細編輯彈窗具備餐點選單、加減數量與防空單檢查。
* **成本管理**：
  * 進貨採購管理（變動成本，即時扣抵淨利）。
  * 店面固定成本（租金、薪資、定期支出維護）。
  * 現金盤點對帳（抽屜零錢備用金、各面額點鈔計算機）。
* **按月財務報表與產能分析**：
  * **模組化開關**：6 大統計模組（核心 KPI、大單位大小碗換算、後台規格銷售分佈、平日假日營收比、週一至週日熱度分佈、歷程明細表）可獨立勾選開啟/關閉。
  * **即時自動儲存 (Instant Auto-Save)**：任意勾選切換立即自動儲存至本機與 Supabase 雲端（`SYSTEM_SETTING_MONTHLY_REPORT_VISIBILITY`），下次進入永久保持相同狀態。
  * **規格形式選擇與大小碗總比例**：可切換分析規格形式（如 `份量大小`），頂部儀表板動態呈現全店大碗 vs 小碗的實售碗數、金額貢獻與全幅高對比總比例進度條。
  * **一鍋物料換算模型**：店長填寫製作大單位數量（如煮了 50 鍋），即時算出每鍋平均售出碗數（如大碗 17 碗 + 小碗 23 碗）與每鍋淨毛利。

### ③ `CustomerView.jsx`（顧客手機掃碼點餐）
* **點餐體驗**：防手震點單、購物車浮動條、清爽菜單分類切換。
* **套餐與自訂規格**：完整解析餐點 radio 單選與 checkbox 複選規格，送出乾淨格式之訂單資料結構。
* **即時取餐通知**：透過 Supabase Realtime 監聽該訂單狀態，POS 點擊【✔ 完成】時，手機即時震動並彈出取餐慶祝卡片。

### ④ `ManagementView.jsx`（後台商品與規格設定）
* **規格設定機制**：
  * 商品資料庫欄位 `customizations` (JSONB)。
  * 支援單選群組（`type: 'radio'`，如 `份量大小`：小碗 NT$60、大碗 NT$75）。
  * 支援複選群組（`type: 'checkbox'`，如加香菜、加大蒜、加辣醬）。
* **營業日管理**：自訂每週公休日或特定休假日，自動同步至顧客端與日結統計。

---

## 5. 資料庫架構與雲端資料存儲規格 (Supabase)

### 核心資料表 (Database Tables)

#### 1. `orders`（訂單主表）
* `id` (bigint / text): 訂單唯一序號。
* `items` (jsonb): 餐點明細。相容物件格式 `{ cart: [...] }` 或直接陣列 `[...]`。
  * 每個項目包含：`name`, `quantity`, `price`, `totalPrice`, `specs` (陣列，如 `["小碗", "正常蒜"]`)。
* `total` (numeric): 訂單總金額。
* `status` (text): `pending` (待處理) / `completed` (已結單) / `received` (已取餐) / `deleted` (已作廢)。
* `payment_method` (text): `cash` (現金) / `linepay` / `taiwanpay` 等。
* `source` (text): `pos` (現場櫃檯) / `online` (顧客掃碼)。
* `store_code` (text): 門市辨識碼（`dragon` 或 `luzhou7`）。
* `cancel_reason` / `cancelled_by`: 作廢原因與操作人員。
* `created_at` (timestamptz): 下單時間。

#### 2. `menu_items`（菜單商品 ＋ 系統配置 Key-Value 庫）
* **一般商品**：`category` 為餐點分類（`mee-sua`, `drinks`, `sides`），`customizations` 放規格定義。
* **⭐ 系統配置記錄 (Key-Value Pattern)**：
  為了避免頻繁更動 SQL Schema，系統通用的全域配置統一存放於 `menu_items` 表中，以 `category = 'settings'` 標記，並以 `description` 存放 JSON 字串。
  
  常用配置鍵名：
  * `SYSTEM_SETTING_MONTHLY_REPORT_VISIBILITY`：按月報表模組顯示開關。
  * `SYSTEM_SETTING_BATCH_YIELD_TEMPLATES`：大單位換算模板（一鍋/桶規格與成本）。
  * `SYSTEM_SETTING_MONTHLY_BATCH_LOGS`：各月份登錄之製作鍋數。
  * `SYSTEM_SETTING_CLOSED_DATES`：店家休假日列表。
  * `SYSTEM_SETTING_CASH_AUDITS`：現金盤點記錄。

#### 3. `purchases`（進貨支出流水帳）
* 記錄廠商採購、食材原物料（變動成本），包含品名、數量、單位、金額、付款狀態 (`paid`/`unpaid`)。

#### 4. `fixed_costs`（店面固定開銷）
* 店租、水費、電費、瓦斯基本費、人事薪資、保險。

---

## 6. 重要業務邏輯與關鍵陷阱 (Gotchas)

### ⚠️ 1. 訂單格式容錯 (Items Payload)
歷史訂單中可能存在 `order.items` 為陣列，或 `order.items = { cart: [...] }` 之情況。在撰寫任何計算訂單金額或品項的邏輯時，**務必使用容錯提取**：
```javascript
const cartItems = Array.isArray(order.items) 
  ? order.items 
  : (order.items?.cart || []);
```

### ⚠️ 2. 多門市設定隔離 (`prefixNameForStore`)
當有多家門市（如蘆洲店）連線至同一個 Supabase 資料庫時，系統配置必須進行前綴隔離：
* 總店 key：`SYSTEM_SETTING_MONTHLY_REPORT_VISIBILITY`
* 分店 key：`luzhou7_SYSTEM_SETTING_MONTHLY_REPORT_VISIBILITY`
* 請一律使用 `src/utils/securityConfig.js` 中的 `prefixNameForStore(settingName, storeCode)` 進行包裝，防止分店覆蓋總店的設定。

### ⚠️ 3. POS 列印小票與錢箱指令
* 熱感小票機開錢箱（Cash Drawer Kick-out）：送出 ASCII 碼 `\x1B\x70\x00\x19\xFA`。
* 避免重複列印：換班列印與日結單已有印表機狀態鎖定，切勿在非必要處手動呼叫兩次 `window.print()`。

### ⚠️ 4. 按月報表「即時自動儲存」
月報表的模組顯示開關**不再具備手動儲存按鈕**。任何狀態異動請統一呼叫 `applyAndSaveMonthlyVisibility`，該函式會同步寫入本機 `localStorage` 並異步 Upsert 至 Supabase 雲端。

---

## 7. 日常開發、同步與佈署工作流 (SOP)

### ① 本地環境啟動
```bash
# 1. 切換至總店主目錄
cd c:/Users/ASUS/Desktop/龍城麵線/restaurant_ordering_system

# 2. 安裝依賴 (如初次啟動)
npm install

# 3. 啟動本機開發伺服器
npm run dev
# 瀏覽器打開 http://localhost:5173
```

### ② 本地生產編譯驗證
在提交代碼前，請務必驗證編譯無誤：
```bash
npm run build
```

### ③ 雙店程式碼自動同步 (核心步驟)
在專案根目錄執行同步指令，將主專案之所有變更同步至蘆洲分店專案：
```bash
# 在專案根目錄下 (c:/Users/ASUS/Desktop/龍城麵線)
node sync_to_branch.js
# 或在 restaurant_ordering_system 目錄下執行: npm run sync-branch
```
*腳本會自動同步 `src/` 下之組件、工具庫、公開設定檔與文件，並確保兩店版本完全一致。*

### ④ Git 提交與推播
```bash
cd c:/Users/ASUS/Desktop/龍城麵線/restaurant_ordering_system
git add .
git commit -m "feat/fix: 更新說明"
git push origin master
```
*GitHub 儲存庫：`https://github.com/EsunBank1313/DragonNoodles.git`*

### ⑤ Vercel 線上正式站佈署指令
當功能完成且測試通過後，依序執行雙站 Production 佈署：

```powershell
# 1. 佈署主系統 (dragon.twabc.com)
cd c:/Users/ASUS/Desktop/龍城麵線
npx vercel --prod --yes --scope=yanchang9487-8890s-projects

# 2. 佈署蘆洲分店系統 (luzhou7.vercel.app)
cd c:/Users/ASUS/Desktop/龍城麵線/luzhou7_system
npx vercel --prod --yes --scope=yanchang9487-8890s-projects
npx vercel alias set [產生的最新部署網址] luzhou7.vercel.app --scope=yanchang9487-8890s-projects
```

---

## 8. 帳號權限、金鑰與安全設定

接手開發者請向專案負責人索取下列各平台管理權限或環境設定檔（`.env`）：

1. **GitHub 儲存庫**：
   * 專案網址：`https://github.com/EsunBank1313/DragonNoodles`
   * 預設分支：`master`
2. **Supabase 雲端資料庫**：
   * 請至 [Supabase Dashboard](https://supabase.com/dashboard) 獲取專案 `Project URL` 與 `anon public key`。
   * 查看資料庫請至 **Table Editor**，即時推播狀態請至 **Realtime** 檢查。
3. **Vercel 專案託管**：
   * 組織團隊：`yanchang9487-8890s-projects`
   * 專案 1：`dragon-noodles`（對應網域 `dragon.twabc.com`）
   * 專案 2：`luzhou7_system`（對應網域 `luzhou7.vercel.app`）
4. **系統管理員通行鑰匙**：
   * POS 預設解鎖 PIN 碼：`8888`
   * 網址防護密鑰（`VITE_STAFF_SECRET_TOKEN`）：存放於環境變數，防止未授權顧客直接探測記帳或收銀介面。

---

*手冊維護者：Google Antigravity AI 核心架構小組*  
*如在接手或維護過程中有任何架構疑問，可直接參閱各組件註解或執行 `npm run build` 進行語法檢驗。祝開發順利！*
