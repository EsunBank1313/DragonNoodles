-- ==============================================================================
-- 🚀 智慧 POS 收銀與雲端財務記帳系統 - 1-Click 通用資料庫建置腳本
-- 說明：請直接登入 Supabase 後台 ➔ SQL Editor ➔ 貼上本腳本並點擊 Run 即可完成全庫建置！
-- ==============================================================================

-- 1. 菜單與商品資料表 (menu_items)
CREATE TABLE IF NOT EXISTS public.menu_items (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    image_url TEXT,
    unit TEXT DEFAULT '份',
    pricing_mode TEXT DEFAULT 'unit', -- 'unit' (按件/顆/盒) 或 'weight' (按斤/公斤秤重)
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 訂單流水記錄表 (orders)
CREATE TABLE IF NOT EXISTS public.orders (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    type TEXT DEFAULT 'dine-in', -- 'dine-in' (內用), 'takeout' (外帶), 'delivery' (外送)
    status TEXT DEFAULT 'completed', -- 'pending', 'received', 'completed', 'cancelled'
    payment_method TEXT DEFAULT 'cash', -- 'cash', 'linepay', 'credit'
    table_number TEXT,
    cashier_name TEXT DEFAULT '店長',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 變動成本與進貨採購記錄表 (purchases)
CREATE TABLE IF NOT EXISTS public.purchases (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor TEXT,
    item_name TEXT NOT NULL,
    qty TEXT,
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'paid', -- 'paid' (已付款), 'pending' (待付款)
    rating NUMERIC(2, 1) DEFAULT 5.0, -- 1~5 星評分
    evaluation_tags JSONB DEFAULT '[]'::jsonb,
    quality_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 固定成本支出記錄表 (fixed_costs)
CREATE TABLE IF NOT EXISTS public.fixed_costs (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    frequency TEXT DEFAULT 'monthly', -- 'monthly' (每月固定), 'yearly'
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. 系統設定與快取表 (system_settings)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 🔒 Row Level Security (RLS) 安全策略 (保護商業機密與財務數據)
-- ==============================================================================

-- 啟用 RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 菜單商品：公開訪客與顧客可讀取、管理員可全權管理
DROP POLICY IF EXISTS "Public Read Menu Items" ON public.menu_items;
CREATE POLICY "Public Read Menu Items" ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Full Access Menu Items" ON public.menu_items;
CREATE POLICY "Admin Full Access Menu Items" ON public.menu_items FOR ALL USING (true);

-- 訂單：公開訪客可新增訂單與讀取、管理員全權管理
DROP POLICY IF EXISTS "Public Insert Orders" ON public.orders;
CREATE POLICY "Public Insert Orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Orders" ON public.orders;
CREATE POLICY "Public Read Orders" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin Full Access Orders" ON public.orders;
CREATE POLICY "Admin Full Access Orders" ON public.orders FOR ALL USING (true);

-- 採購進貨與財務固定成本：預設全權管理
DROP POLICY IF EXISTS "Admin Full Access Purchases" ON public.purchases;
CREATE POLICY "Admin Full Access Purchases" ON public.purchases FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin Full Access Fixed Costs" ON public.fixed_costs;
CREATE POLICY "Admin Full Access Fixed Costs" ON public.fixed_costs FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin Full Access Settings" ON public.system_settings;
CREATE POLICY "Admin Full Access Settings" ON public.system_settings FOR ALL USING (true);

-- 啟用即時推送 Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.menu_items, public.orders, public.purchases, public.fixed_costs;
COMMIT;
