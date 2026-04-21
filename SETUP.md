# 部署與設定說明

## 在使用前需要完成這三件事：

### 1. 建立 Supabase 專案（存放資料用）

1. 前往 https://supabase.com 登入
2. 點 "New project"，取個名字（例如：family-meal-planner）
3. 專案建好後，點左側 "SQL Editor"
4. 把 `supabase-schema.sql` 的全部內容貼進去執行
5. 回到 Project Settings > API，複製：
   - Project URL → 填入 `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → 填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → 填入 `SUPABASE_SERVICE_ROLE_KEY`

### 2. 取得 Anthropic API Key（AI 解析食譜用）

1. 前往 https://console.anthropic.com
2. 登入後到 API Keys，建立新的 key
3. 複製後填入 `ANTHROPIC_API_KEY`

### 3. 把以上資訊填入 `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 本機測試

```bash
npm run dev
```

開啟 http://localhost:3000

---

## 部署到 Railway（讓家人用連結開啟）

1. 前往 https://railway.com，登入後點 "New Project"
2. 選 "Deploy from GitHub repo"，連結此專案的 GitHub repo
3. 在 Variables 頁面填入以下四個環境變數：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
4. Railway 會自動偵測 Next.js 並執行 build + start
5. 部署完成後到 Settings > Networking，產生一個公開網址給家人使用

---

## 建立家人帳號

1. 在 Supabase 後台 > Authentication > Users > Invite User
2. 填入家人的信箱，他們會收到設定密碼的信
3. 如果要把自己設為管理員，在 SQL Editor 執行：
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'your-user-uuid';
   ```

---

## 功能說明

- **你（管理員）**：可以新增/編輯食譜、管理食材庫
- **家人（一般用戶）**：可以選菜、打評分、留建議
- 食譜頁：用文字/圖片/網址輸入食譜，AI 自動分類
- 週計畫：週一到週日，每天選主食+肉+菜 或 一鍋料理
- 即時同步：家人選菜時大家都能即時看到
- 採買清單：全部填完送出後自動產生
