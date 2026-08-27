# 🚀 系統安裝與部署手冊 (5 分鐘快速上線指南)

本手冊將引導您在 5 分鐘內完成 **Supabase 雲端資料庫建置** 與 **Vercel 一鍵免費部署**。

---

## 📌 準備工作（只需 2 個免費帳號）
1. [Supabase 官網](https://supabase.com)（免費雲端資料庫）
2. [Vercel 官網](https://vercel.com) 或 [GitHub](https://github.com)（免費前端託管）

---

## 🛠️ 第一步：建立 Supabase 資料庫（2 分鐘）

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard) 點擊 **「New Project」**。
2. 輸入專案名稱（如 `my-pos-system`），設定資料庫密碼，區域選擇 **Singapore (新加坡)** 或 **Tokyo (東京)**。
3. 專案建立完成後，在左側選單點擊 **「SQL Editor」** ➔ **「New query」**。
4. 打開本專案的 `supabase_schema_universal.sql` 檔案，複製全部內容並貼到 SQL Editor 中。
5. 點擊右下角綠色 **「Run」** 按鈕。
   * ✅ 見到底部顯示 `Success. No rows returned` 即代表全資料庫與安全策略建置完成！
6. 在左側選單點擊 **「Project Settings (齒輪圖示)」** ➔ **「API」**：
   * 複製 **Project URL**（例：`https://xxxx.supabase.co`）
   * 複製 **Project API Keys** 中的 **anon public** 金鑰。

---

## 🚀 第二步：部署到 Vercel（2 分鐘）

### 方式 A：透過 GitHub 一鍵匯入（最推薦）
1. 將本專案上傳至您的 GitHub 帳號（設為 Private 私人儲存庫）。
2. 登入 [Vercel Dashboard](https://vercel.com) 點擊 **「Add New...」** ➔ **「Project」**。
3. 選擇剛才匯入的 GitHub Repository。
4. 在 **「Environment Variables」**（環境變數）區塊中新增以下 4 個變數：
   * `VITE_SUPABASE_URL` = 您的 Supabase Project URL
   * `VITE_SUPABASE_ANON_KEY` = 您的 Supabase Anon Public Key
   * `VITE_STORE_NAME` = 您的店家名稱（例如：`幸福水果行` 或 `老王牛肉麵`）
   * `VITE_STAFF_SECRET_TOKEN` = 您的專屬安全管理金鑰（例如：`my_store_safe_897`，**請務必自行修改！**）
5. 點擊 **「Deploy」** 按鈕。
   * 🎉 約 30 秒後即可獲得您的專屬上線網址（例如：`https://my-pos.vercel.app`）！

---

## 💻 第三步：系統初始化與使用方式（1 分鐘）

部署完成後，請分別使用以下網址：

### 1. 📱 顧客線上點餐網址（公開發布或印成 QR Code）
* **網址格式**：`https://your-domain.vercel.app`
* **桌號點餐**：`https://your-domain.vercel.app/?table=3`
* 顧客手機只會看到菜單與點餐介面，完全無後台入口。

### 2. 🖥️ 店家現場收銀 POS 系統
* **網址格式**：`https://your-domain.vercel.app/?pos=YOUR_SECRET_TOKEN`
* （例如：`https://your-domain.vercel.app/?pos=my_store_safe_897`）
* 初次登入輸入預設 PIN 碼 **8888**。
* 系統會自動彈出 **「🎉 首次啟動初始化精靈」**，讓您一鍵選擇行業範本（餐飲、水果、飲料、雜貨）並自動載入菜單！

### 3. 📊 財務記帳與功能模組管理中心
* **網址格式**：`https://your-domain.vercel.app/?bookkeeping=YOUR_SECRET_TOKEN`
* 可隨時點擊頂部 **「🧩 功能模組」** 開關 10 大功能，或點擊 **「💾 全庫備份」** 匯出 JSON 備份檔。

---

## 🔒 安全注意事項
* 請妥善保管您的 `VITE_STAFF_SECRET_TOKEN` 安全管理金鑰，請勿將後台專用網址公開給顧客。
* 若欲修改管理員 PIN 碼，可於後台設定直接進行變更。
