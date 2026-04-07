# Changelog — 戰鎚40K：史詩紀元

所有重要的改動記錄，依時間由新到舊排列。

---

## [2026-04-07 下午]

### ✏️ 使用者更新術語偏好翻譯
**檔案：** `terminology.md`
- Necrontyr → 懼亡者 / Necrons → 太空死靈
- Eldar → 艾達靈族 / Orks → 獸人 / Tau → 鈦星人
- 四大混沌神：恐虐(Khorne)、奸奇(Tzeentch)、納垢(Nurgle)、色孽(Slaanesh)
- 多位始祖譯名調整：赤紅的馬格努斯、莫塔里安、黎曼·魯斯、羅伯特·基里曼、萊恩·艾爾莊森
- Webway → 網道 / Bolter → 爆彈槍 / Chainsword → 鏈鋸劍 / Dreadnought → 無畏機甲

### 📖 術語表獨立為可編輯檔案 + 文章內嵌英文原文標注
**檔案：** `terminology.md`（新增），`src/app/api/generate/route.ts`
- 將術語表從 `route.ts` 抽出，獨立為 `terminology.md`（專案根目錄），可直接修改，重啟後生效
- 術語表擴充至 80+ 條目，新增更多始祖王名、戰場地點、武器裝備
- 伺服器啟動時自動讀取 `terminology.md` 並注入系統提示
- 新增撰寫規則：每個重要專有名詞首次出現時，必須附英文標注，格式：`古聖(Old Ones)`

### ⚡ 關閉 Gemini 2.5 Flash 思考功能以提升速度
**檔案：** `src/app/api/generate/route.ts`
- `gemini-2.5-flash` 預設會先「思考」再回答，大幅增加等待時間
- 加入 `thinkingConfig: { thinkingBudget: 0 }` 關閉思考，讓回應速度恢復正常
- 解決生成時間過長導致 Cloudflare Tunnel 逾時（`context canceled`）的根本原因

### 🛠️ 加入 JSON 截斷修復機制
**檔案：** `src/app/api/generate/route.ts`
- 新增 `repairTruncatedJson()` 函式，當 JSON 因逾時被截斷時嘗試撈回可用內容
- 從截斷的文字中提取章節標題、已完成的段落（以最後一個 `[PARA]` 為截止點）
- 若修復失敗，顯示「本章內容被截斷」提示，引導使用者繼續點擊下一章

---

## [2026-04-07]

### 🐛 修復 Cloudflare Tunnel 啟動競態問題
**檔案：** `啟動戰鎚40K-史詩紀元.bat`
- **問題**：Cloudflare Tunnel 在 Next.js 伺服器尚未啟動前就開始運行，導致 `control stream failure` 持續重試
- **修復**：調整啟動順序：Build → 啟動伺服器 → 等待 5 秒 → 才啟動 Tunnel
- Next.js 伺服器改為在獨立視窗中運行（`start cmd /k`）

### ✅ 確認可用模型並切換至 gemini-2.5-flash
**檔案：** `src/app/api/generate/route.ts`
- 透過 `ai.models.list()` API 查詢帳號實際可用的模型清單
- 確認 `gemini-2.5-flash` 可用後切換（之前的 `gemini-2.0-flash`、`gemini-2.0-flash-lite`、`gemini-1.5-flash` 均因 API 版本或帳號狀態無法使用）

### 💅 錯誤訊息加入一鍵複製按鈕
**檔案：** `src/app/api/generate/route.ts`
- 錯誤發生時，錯誤代碼以橘色 `<pre>` 區塊顯示
- 右上角加入「複製」按鈕，點擊後顯示「✓ 已複製」，2 秒後恢復

---

## [2026-04-06]

### 🔧 切換回 Gemini API（使用者啟用 Billing）
**檔案：** `src/app/api/generate/route.ts`
- 使用者在 Google AI Studio 開通付費方案後，從 OpenRouter 切換回直接使用 Gemini API
- 啟用 Billing 後無每日次數限制（付費按 Token 計算，約每章 NT$0.018）

### 🌐 支援 OpenRouter 作為備用 API（後棄用）
**檔案：** `src/app/api/generate/route.ts`
- 因 Gemini 免費帳號 Quota 被清零（`limit: 0`），新增 OpenRouter 作為備用
- 透過 `fetch` 呼叫 OpenRouter，使用 `google/gemini-2.0-flash-exp:free` 模型
- 不需安裝額外套件，繞過 Google 帳號的配額限制

### 🔄 切換至 Groq API（後因品質問題棄用）
**檔案：** `src/app/api/generate/route.ts`
- 因 Gemini 免費配額耗盡，切換至 Groq（Llama 3.3 70B）
- 安裝 `groq-sdk` 套件
- 後因繁體中文 Lore 品質顯著不如 Gemini，且 JSON 格式穩定性差，放棄

### 🖼️ 修復圖片 onError 無限迴圈
**檔案：** `src/components/EbookViewer.tsx`
- `<img>` 的 `onError` 原本指向 `currentChapter.image_url`（Proxy 路徑），造成圖片失敗後不斷重試同一個失敗路徑
- 修改為靜態備用 `https://picsum.photos/seed/fallback/1200/600`

### 🔍 程式碼全面檢查與小修
**檔案：** `src/app/api/generate/route.ts`, `src/components/EbookViewer.tsx`
- 錯誤頁面圖片改用 Proxy 路徑（原本殘留 picsum.photos 直連）
- 統一圖片 URL 格式

---

## [2026-04-05]

### 📖 閱讀進度本地儲存
**檔案：** `src/components/EbookViewer.tsx`
- 使用 `localStorage` 儲存 `story_id`，重開瀏覽器後自動恢復上次的故事
- 使用 `localStorage` 儲存每個故事的閱讀章節位置（`wh40k_index_{storyId}`）
- 「重置時間線」時同步清除 localStorage

### 🧠 防止 AI 內容重複
**檔案：** `src/components/EbookViewer.tsx`, `src/app/api/generate/route.ts`
- 每次生成時，前端傳送**所有已完成章節的標題清單**（而非只傳最後 3 章）
- 上一章的內容摘要從 200 字擴充至 600 字
- 系統提示加入「嚴禁重複」規則，AI 必須推進到全新事件
- `[PARA]` 分段符號：使用純文字分隔符取代 JSON 內嵌 HTML，伺服器端再轉換為 `<p>` 標籤（解決 Groq/Llama JSON 格式問題，Gemini 亦相容）

### 🖼️ 圖片 Proxy 伺服器（繞過登入限制）
**檔案：** `src/app/api/image/route.ts`（新增）
- 建立 `/api/image` 伺服器端 Proxy，由伺服器去 Pollinations.ai 取圖再回傳
- 瀏覽器不直接連 Pollinations.ai，避免帶入登入 Cookie 被拒（`authenticated users` 錯誤）
- 圖片快取 24 小時（`Cache-Control: public, max-age=86400`）

### 🎨 圖片內容相關化
**檔案：** `src/app/api/generate/route.ts`, `src/components/EbookViewer.tsx`
- 改用 Pollinations.ai AI 繪圖取代隨機 picsum.photos
- AI 產生的 `image_prompt` 強制包含風格關鍵字：`warhammer 40k style, dark gothic, cinematic, grimdark`
- 加入圖片提示詞語言偵測，若 AI 誤以中文輸出則使用預設英文提示詞
- 前端圖片邏輯簡化，圖片 URL 由後端統一產生

### ⚡ 穩定性：縮短章節長度防止 Timeout
**檔案：** `src/app/api/generate/route.ts`
- 將每章節字數要求從 3000 字調降至 1500-2000 字
- 減少 Gemini 生成時間，防止瀏覽器或 Cloudflare Tunnel 因等待過久而中斷（`context canceled`）

---

## 技術架構摘要

| 元件 | 技術 |
|------|------|
| 前端框架 | Next.js 16 (App Router) |
| AI 文字生成 | Google Gemini 2.5 Flash (付費) |
| AI 圖片生成 | Pollinations.ai（透過伺服器 Proxy）|
| 資料庫 | 本地 JSON 檔案（`data/stories.json`）|
| 進度儲存 | localStorage |
| 外部分享 | Cloudflare Tunnel（無需帳號的臨時 URL）|
