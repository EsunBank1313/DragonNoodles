# 🚀 系統安裝與部署手冊 (5 分鐘快速上線指南)

本手冊將引導您在 5 分鐘內完成 **Supabase 雲端資料庫建置**、**Vercel 一鍵免費部署** 與 **各模組完整設定**。

---

## 📂 安裝手冊與文檔位置索引

為了方便您查閱，專案中包含以下重要手冊與指南：
* 📖 **系統安裝與部署手冊（本文件）**：
  * 根目錄：`龍城麵線/DEPLOYMENT_GUIDE.md`
  * 主系統：`龍城麵線/restaurant_ordering_system/DEPLOYMENT_GUIDE.md`
  * 分店系統：`龍城麵線/luzhou7_system/DEPLOYMENT_GUIDE.md`
* 📖 **系統功能與架構總覽**：
  * `龍城麵線/README.md` 或 `restaurant_ordering_system/README.md`
* 🖨️ **POS 機台與熱感小票機設定手冊**：
  * `龍城麵線/POS機台設定.md`

---

## 📌 準備工作（只需 2 個免費帳號）
1. [Supabase 官網](https://supabase.com)（免費雲端資料庫）
2. [Vercel 官網](https://vercel.com) 或 [GitHub](https://github.com)（免費前端託管）

---

## 🛠️ 第一步：建立 Supabase 資料庫（2 分鐘）

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard) 點擊 **「New Project」**。
2. 輸入專案名稱（如 `dragon-noodles` 或 `my-pos-system`），設定資料庫密碼，區域選擇 **Singapore (新加坡)** 或 **Tokyo (東京)**。
3. 專案建立完成後，在左側選單點擊 **「SQL Editor」** ➔ **「New query」**。
4. 打開本專案的 `supabase_schema_universal.sql` 檔案，複製全部內容並貼到 SQL Editor 中。
5. 點擊右下角綠色 **「Run」** 按鈕。
   * ✅ 見到底部顯示 `Success. No rows returned` 即代表全資料庫、安全策略（RLS）與即時更新（Realtime）建置完成！
6. 在左側選單點擊 **「Project Settings (齒輪圖示)」** ➔ **「API」**：
   * 複製 **Project URL**（例：`https://xxxx.supabase.co`）
   * 複製 **Project API Keys** 中的 **anon public** 金鑰。

---

## 🚀 第二步：部署到 Vercel（2 分鐘）

### 方式 A：透過 GitHub 一鍵匯入（最推薦）
1. 將本專案推送到您的 GitHub 帳號（設為 Private 私人儲存庫）。
2. 登入 [Vercel Dashboard](https://vercel.com) 點擊 **「Add New...」** ➔ **「Project」**。
3. 選擇剛才匯入的 GitHub Repository。
4. 在 **「Environment Variables」**（環境變數）區塊中新增以下環境變數：
   * `VITE_SUPABASE_URL` = 您的 Supabase Project URL
   * `VITE_SUPABASE_ANON_KEY` = 您的 Supabase Anon Public Key
   * `VITE_STORE_NAME` = 您的店家名稱（例如：`龍城麵線`）
   * `VITE_STAFF_SECRET_TOKEN` = 您的專屬安全管理金鑰（例如：`dg_8f2a1c`，**請務必自行修改！**）
5. 點擊 **「Deploy」** 按鈕。
   * 🎉 約 30 秒後即可獲得您的專屬上線網址（例如：`https://dragon.twabc.com` 或 `https://your-pos.vercel.app`）！

---

## 💻 第三步：系統初始化與各入口網址（1 分鐘）

部署完成後，請分別使用以下網址：

### 1. 📱 顧客線上 / 掃碼點餐網址（公開發布或印成桌貼 QR Code）
* **外帶自取點餐**：`https://your-domain.com/?store=YOUR_SECRET_TOKEN`
* **內用掃碼點餐**：`https://your-domain.com/?store=YOUR_SECRET_TOKEN&table=3`（例如 3 號桌）
* 顧客手機端只會看到點餐菜單、加料客製、套餐升級與訂單進度追蹤介面，完全無後台入口。

### 2. 🖥️ 店家現場收銀 POS 系統
* **網址格式**：`https://your-domain.com/?store=YOUR_SECRET_TOKEN&cashier=true`
* 初次登入輸入預設 PIN 碼 **8888**（可於後台自行變更）。
* **POS 快速特點**：
  * 現場點餐送出後**直接結單並計入營收**，無多餘的狀態切換。
  * 收到顧客線上點餐時，訂單卡片會顯示紫色標籤，並有專屬綠色**【✔ 完成】**按鈕，按下後顧客手機**即時收到取餐完成通知與提示音**。

### 3. 📊 財務記帳、庫存管理與現金盤點中心
* **網址格式**：`https://your-domain.com/?store=YOUR_SECRET_TOKEN&bookkeeping=true`
* 包含**當日營業額即時流水帳**、**抽屜現金盤點計算機（含開/收店零錢核算）**、**庫存管理與進貨日誌**、**供應商評鑑**與**月損益報表**。

### 4. ⚙️ 商品與規格菜單後台管理
* **網址格式**：`https://your-domain.com/?store=YOUR_SECRET_TOKEN&management=true`
* 支援**多組規格自訂**（大小碗、麵條種類、辣度等）、**手機相簿/相機直接拍照上傳照片（內建極速壓縮）**、**加料專區價格調整**與**分類排序**。

---

## 🌟 2026 最新功能使用說明

| 功能模組 | 操作方式與特色說明 |
|---|---|
| 🍜 **多重規格自訂** | 在後台編輯商品時，可新增多組獨立規格（如【份量】＋【麵條種類】），顧客端與 POS 均可同時選擇並即時加價。 |
| 📱 **手機拍照上傳照片** | 在手機後台點擊「選擇手機相簿/照片」或「手機直接拍照」，系統會秒級自動壓縮至 <80KB，秒速同步雲端。 |
| ⚡ **POS 現場快速出單** | POS 現場單送出後自動完成結單，無任何多餘狀態流程。 |
| 📱 **顧客單即時完成連動** | 顧客線上點餐在 POS 點擊【✔ 完成】後，顧客手機畫面即時跳出「🎉 餐點製作完成」大通知並觸發音效/震動。 |
| 💰 **抽屜現金盤點計算機** | 輸入各面額張數與抽屜零錢備用金，系統自動計算實收總現金並與系統營收 100% 同步比對短溢差額。 |
| 📦 **庫存盤點與進貨日誌** | 進貨紀錄預設為未付款，支援異動日誌歷程追蹤與安全庫存低水位警報。 |
| 🥢 **全品項加料與調料** | 清麵線與全品項麵線全面支援自選加料（皮蛋/雙腸/豬肚/肉羹/花枝羹/貢丸/蚵仔）與調料客製。 |

---

## 🔒 安全注意事項
* 請妥善保管您的 `VITE_STAFF_SECRET_TOKEN` 安全管理金鑰，請勿將後台專用網址公開給顧客。
* 若欲修改管理員 PIN 碼，可於後台設定直接進行變更。
