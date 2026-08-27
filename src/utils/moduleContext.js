// 🧩 10 Major System Feature Modules Definition & Dynamic Context

export const SYSTEM_MODULES = [
  {
    id: 'module_dining_tables',
    name: '桌號與內外帶管理',
    icon: '🍽️',
    description: '提供內用/外帶切換、桌號輸入與管理、翻桌率分析。',
    defaultEnabled: true,
    category: 'pos'
  },
  {
    id: 'module_weighing_pricing',
    name: '稱重計價與生鮮零售',
    icon: '⚖️',
    description: '支援按斤/公斤/個計價、秤重小鍵盤、快捷重量、去皮抹零。',
    defaultEnabled: true,
    category: 'pos'
  },
  {
    id: 'module_kitchen_printing',
    name: '智能廚房出單與列印',
    icon: '🖨️',
    description: '支援自動出單、廚房小白單列印、日結單 (Z-Report) 列印與語音播報。',
    defaultEnabled: true,
    category: 'hardware'
  },
  {
    id: 'module_customizations_combos',
    name: '規格客製與加料升級',
    icon: '🥡',
    description: '支援大小份規格、配料客製勾選（香菜/大蒜）、套餐組合升級。',
    defaultEnabled: true,
    category: 'pos'
  },
  {
    id: 'module_online_ordering',
    name: '顧客線上掃碼點餐',
    icon: '📱',
    description: '提供顧客手機 QR Code 點餐、今日開店/打烊營業控制與進度追蹤。',
    defaultEnabled: true,
    category: 'online'
  },
  {
    id: 'module_cash_audit',
    name: '每日現金盤點與對帳',
    icon: '💰',
    description: '實收現金盤點、面額計算機、備用金扣除、登入提醒與帳實核算。',
    defaultEnabled: true,
    category: 'finance'
  },
  {
    id: 'module_vendor_scorecard',
    name: '供應商進貨與星級評鑑',
    icon: '🏆',
    description: '進貨採購管理、供應商 1~5 星打分、自訂品質標籤與廠商排行榜。',
    defaultEnabled: true,
    category: 'finance'
  },
  {
    id: 'module_inventory_management',
    name: '倉儲庫存與低水位預警',
    icon: '📦',
    description: '物料自動扣庫、安全庫存監控、POS 頂部補貨警報與庫存盤點日誌。',
    defaultEnabled: true,
    category: 'inventory'
  },
  {
    id: 'module_advanced_financial',
    name: '進階財務損益與月報表',
    icon: '📊',
    description: '總預估月淨利、平日/假日對比分析、品項銷售圓餅圖、CSV/PDF 匯出。',
    defaultEnabled: true,
    category: 'finance'
  },
  {
    id: 'module_line_notification',
    name: 'LINE 官方即時推播通知',
    icon: '🤖',
    description: '接收新訂單 LINE Bot 即時推播、每日營業日結自動報表推送。',
    defaultEnabled: false,
    category: 'online'
  }
];

// Industry Presets
export const INDUSTRY_PRESETS = {
  restaurant: {
    id: 'restaurant',
    name: '🍜 傳統小吃與餐飲模式',
    description: '適合小吃店、麵店、便當、快餐、火鍋、早午餐',
    enabledModuleIds: [
      'module_dining_tables',
      'module_kitchen_printing',
      'module_customizations_combos',
      'module_online_ordering',
      'module_cash_audit',
      'module_inventory_management',
      'module_advanced_financial'
    ]
  },
  fruit: {
    id: 'fruit',
    name: '🍎 水果生鮮與秤重零售模式',
    description: '適合水果行、生鮮蔬果、肉品海鮮、市場攤販',
    enabledModuleIds: [
      'module_weighing_pricing',
      'module_cash_audit',
      'module_vendor_scorecard',
      'module_inventory_management',
      'module_advanced_financial'
    ]
  },
  beverage: {
    id: 'beverage',
    name: '☕ 手搖茶飲與烘焙輕食模式',
    description: '適合手搖飲、咖啡館、烘焙甜品、冰品',
    enabledModuleIds: [
      'module_kitchen_printing',
      'module_customizations_combos',
      'module_online_ordering',
      'module_cash_audit',
      'module_advanced_financial'
    ]
  },
  retail: {
    id: 'retail',
    name: '🛒 一般雜貨與通用零售模式',
    description: '適合便利商店、生活雜貨、服飾配件、五金批發',
    enabledModuleIds: [
      'module_weighing_pricing',
      'module_cash_audit',
      'module_vendor_scorecard',
      'module_inventory_management',
      'module_advanced_financial'
    ]
  },
  flagship: {
    id: 'flagship',
    name: '💎 全功能旗艦完整模式',
    description: '開啟全系統 10 大模組與所有進階功能',
    enabledModuleIds: SYSTEM_MODULES.map(m => m.id)
  }
};

// Default initial module settings
export const getDefaultModuleSettings = () => {
  const settings = {};
  SYSTEM_MODULES.forEach(m => {
    settings[m.id] = m.defaultEnabled;
  });
  return settings;
};

// Load active modules from LocalStorage
export const getActiveModuleSettings = () => {
  if (typeof window === 'undefined') return getDefaultModuleSettings();
  try {
    const raw = localStorage.getItem('app_enabled_modules');
    if (raw) {
      return { ...getDefaultModuleSettings(), ...JSON.parse(raw) };
    }
  } catch (e) {}
  return getDefaultModuleSettings();
};

// Save module settings
export const saveActiveModuleSettings = (settings) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('app_enabled_modules', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('app-modules-updated', { detail: settings }));
  } catch (e) {}
};

// Quick helper to check if a specific module is enabled
export const isModuleEnabled = (moduleId, currentSettings = null) => {
  const active = currentSettings || getActiveModuleSettings();
  return Boolean(active[moduleId]);
};
