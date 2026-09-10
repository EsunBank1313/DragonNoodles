# 🐉 龍城麵線點餐系統 (DragonNoodle)
## Vercel 雲端部署與連線交接指南

本文件旨在指引新進開發人員接手「龍城麵線點餐系統 (DragonNoodle)」的伺服器端 (Vercel) 連線設定、專案授權與持續整合 (CI/CD) 機制。

---

## 📌 系統架構簡介
* **前端框架**：React 19 + Vite 8
* **資料庫 & 後端服務**：Supabase (Realtime 訂單同步、固定與變動成本儲存)
* **身分驗證**：Firebase Authentication (用於前台外帶簡訊 OTP 驗證)
* **託管平台**：Vercel (專門託管靜態前端資源與 SPA 路由重定向)

---

## 📁 Git 儲存庫資訊
* **最新託管位置**：`https://github.com/EsunBank1313/DragonNoodle`
* **主分支 (Production Branch)**：`main` (任何推送到此分支的代碼皆會直接觸發 Vercel Production Build)

---

## 🚀 Vercel 完整連線與部署步驟

### 步驟一：GitHub 帳號/組織權限授權
Vercel 必須獲得讀取 `Esunbank1313` 組織或帳號下 `DragonNoodle` 儲存庫的權限。
1. 登入 [Vercel 官網](https://vercel.com)。
2. 點擊右上角個人頭像 ➔ 選擇 **Settings**。
3. 進入 **Connections** (或在 Project 建立時進行)。
4. 點選 **Add GitHub Org or Account**。
5. 在彈出的 GitHub 安全授權視窗中，下拉選擇帳號 **`Esunbank1313`**。
6. 在權限範圍中，建議選擇 **Only select repositories**，並搜尋選取 **`DragonNoodle`**，最後點擊 **Install & Authorize** 完成授權。

---

### 步驟二：在 Vercel 建立/連結專案
如果這是一個全新部署的站點：
1. 在 Vercel 控制台主頁點擊 **Add New... ➔ Project**。
2. 在 GitHub 匯入清單中，搜尋並選擇 `Esunbank1313/DragonNoodle`，點擊 **Import**。
3. **專案組態設定 (Project Settings)**：
   * **Framework Preset**：選擇 `Vite` (Vercel 通常會自動偵測)。
   * **Root Directory**：`./` (專案根目錄)。
   * **Build Command**：`npm run build`。
   * **Output Directory**：`dist`。

---

### 步驟三：配置環境變數 (Environment Variables)
這是系統能正常連線資料庫與驗證服務的關鍵。在 Vercel 的專案設定頁面中，請依序加入以下環境變數（請向專案負責人索取對應的密鑰）：

| 變數名稱 (Key) | 說明 |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase 專案的 API 網址 |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名存取公開密鑰 |
| `VITE_FIREBASE_API_KEY` | Firebase Auth 專案 API 密鑰 |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase 驗證網域 |
| `VITE_FIREBASE_PROJECT_ID` | Firebase 專案 ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase 儲存貯體名稱 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase 訊息傳送 ID |
| `VITE_FIREBASE_APP_ID` | Firebase 應用程式 ID |

> [!IMPORTANT]
> 每次新增或修改環境變數後，必須在 Vercel 重新進行一次 **Redeploy (重新部署)**，新環境變數才會在前端網站中生效。

---

### 步驟四：單頁應用 (SPA) 路由重定向設定
本專案採用 React Router，為了防止顧客在瀏覽器重新整理 (F5) 時出現 `404 Not Found` 錯誤，根目錄下已配置了 `vercel.json`：
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
*交接確認：在專案根目錄下必須維持該檔案存在，Vercel 會自動讀取並完成路由重定向設定。*

---

## 🛠️ 開發與運維日常指引

### 1. 本地開發與建置
新人在本地端下載專案後，請執行：
```bash
# 安裝相依套件
npm install

# 啟動本地開發伺服器
npm run dev

# 執行生產環境建置測試
npm run build
```

### 2. CI/CD 工作流
* 本專案已將 `main` 分支設定為生產環境。
* 任何被 Push 或 Merge 到 `main` 分支的代碼，Vercel 都會在背景自動啟動建置，約在 **1-2 分鐘內**自動更新線上網站。
* 若部署失敗，可至 Vercel 專案下的 **Deployments** 頁面查看 Build Logs 進行排錯。
