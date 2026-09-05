# POS機台列印設定 (Win 10)

#### 設備型號: SLK-TL 122S

#### 作業系統: Windows 10

#### 瀏覽器: Google Chrome



##### 驅動程式安裝:

1\. 下載驅動程式(Window Driver 203dpi)，網址: https://www.miniprinter.com/chn/page/?pid=customer\_5\_view\&pr\_id=21

2\. 安裝驅動程式，過程中要勾選一個【THERMAL 203DPI Printer】，確保已連接列印機再接續安裝流程，否則會安裝失敗



##### 驅動程式設定:

1\. 打開【設定】->【裝置】->【印表機與掃描器】
2. 選擇【THERMAL 203DPI Printer】->【管理】->【印表機內容】->【進階】->【列印預設值】

3\. 點選右下角的【進階】，紙張大小設定為【54 x 297 mm】、彩色列印模式設定為【單色】、半色調設定為【SuperCell】，點選確定
4. 切換到【Printer Commands】頁面，在【Cut the paper】處選擇【End of Page】

5\. 切換到【Paper】頁面，在【Paper Type】處選擇【User Defined Paper Size】，並將下一行的【Paper Width】改成60mm；

&#x09;再勾選頁面最下方的【Adjust Printing Size】，並將下一行的【Width】改成95%
6. 按下套用，按下確定



##### 開機自動開啟系統(全螢幕+自動列印):

**a. 新增排程工作**

1. 打開工作排程器

2\. 在右側面板點選「建立基本工作...」。

3\. 輸入名稱（例如：POS系統自動啟動），點選下一步。

4\. 觸發程序選擇「當我登入時」（比開機時更穩定，能確保桌面環境已載入），點選下一步。

5\. 動作選擇「啟動程式」，點選下一步。



###### **b. 設定 Chrome 路徑與自動列印參數**

1. 在「啟動程式」的設定畫面中，填入以下資訊：
程式或指令碼：填入 Chrome 的主程式路徑。通常為：
**"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"**
*(如果是舊版 32 位元 Windows，路徑可能在 Program Files (x86)**)***
2. 新增引數 (選擇性)：貼上以下這串指令（請將最後的網址換成你的 POS 網址）：
**--kiosk --kiosk-printing "https://your-pos-website.com"**
3. 點選下一步，最後按下「完成」即可。

*(備註: 此方法必須連接電源才可正常運作。)*



##### 建立桌面捷徑(備用開啟方法):

1\. 右鍵點選桌面

2\. 選擇【新增】->【捷徑】

3\. 輸入以下位置(前面的指令碼+引數):

&#x09;**"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk --kiosk-printing "https://your-pos-website.com"**

