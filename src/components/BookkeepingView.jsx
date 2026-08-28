import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { formatSupabaseOrder } from './CustomerView';
import { menuItems as defaultMenuItems } from '../data/menuData';
import { printDailyClosingReport, defaultStoreProfile, defaultReceiptConfig } from '../utils/printHelpers';
import ModuleCenterModal from './ModuleCenterModal';
import { getActiveModuleSettings, isModuleEnabled } from '../utils/moduleContext';
import { getActiveStoreCode, filterItemsByStore, filterOrdersByStore, prefixNameForStore, stripNameForStore, getStoreStorage, setStoreStorage } from '../utils/storeContext';

// Dynamic Item & Addon Cost Calculation Engine
export const calculateItemCost = (item) => {
  if (!item) return 0;
  const name = item.name || '';
  const qty = Number(item.quantity) || 1;
  
  // 1. Check size (小碗 vs 大碗)
  let isBig = false;
  if (Array.isArray(item.specs)) {
    isBig = item.specs.some(s => {
      const val = typeof s === 'object' && s ? (s.value || s.label || '') : String(s);
      return val.includes('大碗') || val.includes('大');
    });
  } else if (typeof item.specs === 'string') {
    isBig = item.specs.includes('大碗') || item.specs.includes('大');
  }
  if (name.includes('大碗') || name.includes('(大)')) {
    isBig = true;
  }

  // 2. Base dish cost
  let baseUnitCost = 0;
  if (name.includes('清麵線')) {
    baseUnitCost = isBig ? 17 : 11;
  } else if (name.includes('蚵仔')) {
    baseUnitCost = isBig ? 36 : 28;
  } else if (name.includes('花枝羹')) {
    baseUnitCost = isBig ? 45 : 35;
  } else if (name.includes('肉羹')) {
    baseUnitCost = isBig ? 45 : 35;
  } else if (name.includes('貢丸')) {
    baseUnitCost = isBig ? 31 : 23;
  } else if (name.includes('豬肚')) {
    baseUnitCost = isBig ? 40 : 30;
  } else if (name.includes('雙腸') || name.includes('大腸')) {
    baseUnitCost = isBig ? 40 : 30;
  } else if (name.includes('綜合')) {
    baseUnitCost = isBig ? 45 : 35;
  } else if (name.includes('肉包')) {
    if (name.includes('量販') || name.includes('包(10') || name.includes('10入')) {
      baseUnitCost = 150;
    } else {
      baseUnitCost = 15;
    }
  } else if (name.includes('優格氣泡飲') || name.includes('氣泡飲')) {
    baseUnitCost = 15;
  } else if (name.includes('麥根沙士') || name.includes('A&W') || name.includes('沙士')) {
    baseUnitCost = 19;
  } else if (name.includes('辣泡菜') || name.includes('泡菜')) {
    baseUnitCost = 90;
  } else if (name.includes('要你命1000')) {
    baseUnitCost = 85;
  } else if (name.includes('要你命2000')) {
    baseUnitCost = 85;
  } else if (name.includes('要你命3000')) {
    baseUnitCost = 105;
  } else if (name.includes('要你命')) {
    baseUnitCost = 85;
  } else if (item.customizations?.cost_price !== undefined && item.customizations?.cost_price !== null) {
    baseUnitCost = Number(item.customizations.cost_price);
  } else {
    const price = Number(item.price) || (item.totalPrice ? Number(item.totalPrice) / qty : 0);
    baseUnitCost = Math.round(price * 0.45);
  }

  // 3. Addons cost
  let addonsCost = 0;
  const parseAddonCost = (addonStr) => {
    if (!addonStr) return 0;
    const str = String(addonStr);
    let cost = 0;
    if (str.includes('皮蛋')) cost += 10;
    if (str.includes('貢丸')) cost += (isBig ? 14 : 12);
    if (str.includes('蚵仔')) cost += (isBig ? 19 : 17);
    if (str.includes('雙腸') || str.includes('大腸')) cost += (isBig ? 23 : 19);
    if (str.includes('豬肚')) cost += (isBig ? 23 : 19);
    if (str.includes('花枝羹')) cost += (isBig ? 28 : 24);
    if (str.includes('肉羹')) cost += (isBig ? 28 : 24);
    return cost;
  };

  if (Array.isArray(item.specs)) {
    item.specs.forEach(s => {
      const val = typeof s === 'object' && s ? (s.value || s.label || '') : String(s);
      addonsCost += parseAddonCost(val);
    });
  } else if (typeof item.specs === 'string') {
    addonsCost += parseAddonCost(item.specs);
  }

  return (baseUnitCost + addonsCost) * qty;
};

const defaultVendorEvalTags = [
  { id: 't1', name: '🍏 品質極佳', isGood: true },
  { id: 't2', name: '🌟 甜度高', isGood: true },
  { id: 't3', name: '⚖️ 足秤無損', isGood: true },
  { id: 't4', name: '🚚 送貨準時', isGood: true },
  { id: 't5', name: '💰 價格實惠', isGood: true },
  { id: 't6', name: '🤝 配合度高', isGood: true },
  { id: 't7', name: '⚠️ 輕微壓傷', isGood: false },
  { id: 't8', name: '🚨 損耗偏高', isGood: false },
  { id: 't9', name: '⏰ 延遲送達', isGood: false },
  { id: 't10', name: '📦 包裝破損', isGood: false }
];

const defaultInventory = [
  { name: '紅麵線', qty: 100, unit: '斤', minStock: 20 },
  { name: '新鮮蚵仔', qty: 30, unit: '斤', minStock: 5 },
  { name: '滷大腸', qty: 50, unit: '斤', minStock: 10 },
  { name: '豬肚', qty: 30, unit: '斤', minStock: 8 },
  { name: '肉羹', qty: 40, unit: '斤', minStock: 10 },
  { name: '花枝羹', qty: 40, unit: '斤', minStock: 10 },
  { name: '貢丸', qty: 200, unit: '個', minStock: 50 },
  { name: '皮蛋', qty: 120, unit: '個', minStock: 30 },
  { name: '板豆腐', qty: 60, unit: '盒', minStock: 15 },
  { name: '黃金泡菜(備料)', qty: 80, unit: '份', minStock: 20 },
  { name: '紅茶(備料)', qty: 150, unit: '杯', minStock: 45 },
  { name: '外帶紙碗/內用清潔費', qty: 500, unit: '個', minStock: 100 },
  { name: '免洗湯匙', qty: 500, unit: '個', minStock: 100 },
  { name: '新鮮香菜', qty: 15, unit: '斤', minStock: 3 },
  { name: '特製辣醬', qty: 20, unit: '罐', minStock: 5 },
  { name: '大蒜/辛香料', qty: 25, unit: '斤', minStock: 5 },
  { name: '桶裝瓦斯', qty: 10, unit: '桶', minStock: 2 },
  { name: '洗衣粉', qty: 0, unit: '包', minStock: 1 },
  { name: '大瓷碗', qty: 0, unit: '個', minStock: 2 },
  { name: '小瓷碗', qty: 0, unit: '個', minStock: 2 },
  { name: '拖鞋', qty: 0, unit: '組', minStock: 1 },
  { name: '手套', qty: 0, unit: '組', minStock: 1 }
];

const RECIPES = {
  '綜合麵線': [
    { name: '紅麵線', qty: 0.1, unit: '斤' },
    { name: '滷大腸', qty: 0.04, unit: '斤' },
    { name: '豬肚', qty: 0.04, unit: '斤' },
    { name: '肉羹', qty: 0.04, unit: '斤' },
    { name: '花枝羹', qty: 0.04, unit: '斤' },
    { name: '貢丸', qty: 1, unit: '個' },
    { name: '外帶紙碗/內用清潔費', qty: 1, unit: '個' },
    { name: '免洗湯匙', qty: 1, unit: '個' }
  ],
  '大腸麵線': [
    { name: '紅麵線', qty: 0.1, unit: '斤' },
    { name: '滷大腸', qty: 0.15, unit: '斤' },
    { name: '外帶紙碗/內用清潔費', qty: 1, unit: '個' },
    { name: '免洗湯匙', qty: 1, unit: '個' }
  ],
  '豬肚麵線': [
    { name: '紅麵線', qty: 0.1, unit: '斤' },
    { name: '豬肚', qty: 0.15, unit: '斤' },
    { name: '外帶紙碗/內用清潔費', qty: 1, unit: '個' },
    { name: '免洗湯匙', qty: 1, unit: '個' }
  ],
  '肉羹麵線': [
    { name: '紅麵線', qty: 0.1, unit: '斤' },
    { name: '肉羹', qty: 0.15, unit: '斤' },
    { name: '外帶紙碗/內用清潔費', qty: 1, unit: '個' },
    { name: '免洗湯匙', qty: 1, unit: '個' }
  ],
  '花枝麵線': [
    { name: '紅麵線', qty: 0.1, unit: '斤' },
    { name: '花枝羹', qty: 0.15, unit: '斤' },
    { name: '外帶紙碗/內用清潔費', qty: 1, unit: '個' },
    { name: '免洗湯匙', qty: 1, unit: '個' }
  ],
  '貢丸麵線': [
    { name: '紅麵線', qty: 0.1, unit: '斤' },
    { name: '貢丸', qty: 2, unit: '個' },
    { name: '外帶紙碗/內用清潔費', qty: 1, unit: '個' },
    { name: '免洗湯匙', qty: 1, unit: '個' }
  ],
  '清麵線': [
    { name: '紅麵線', qty: 0.1, unit: '斤' },
    { name: '外帶紙碗/內用清潔費', qty: 1, unit: '個' },
    { name: '免洗湯匙', qty: 1, unit: '個' }
  ],
  '皮蛋豆腐': [
    { name: '皮蛋', qty: 1, unit: '個' },
    { name: '板豆腐', qty: 1, unit: '盒' }
  ],
  '黃金泡菜': [
    { name: '黃金泡菜(備料)', qty: 1, unit: '份' }
  ],
  '滷大腸': [
    { name: '滷大腸', qty: 0.3, unit: '斤' }
  ],
  '紅茶': [
    { name: '紅茶(備料)', qty: 1, unit: '杯' }
  ]
};

const mapPurchaseToInventory = (purchaseItemName) => {
  const mapping = {
    '紅麵線': '紅麵線',
    '新鮮蚵仔': '新鮮蚵仔',
    '滷大腸': '滷大腸',
    '新鮮香菜': '新鮮香菜',
    '特製辣醬': '特製辣醬',
    '大蒜/辛香料': '大蒜/辛香料',
    '桶裝瓦斯': '桶裝瓦斯',
    '其他雜物': null
  };
  if (mapping[purchaseItemName] !== undefined) {
    return mapping[purchaseItemName];
  }
  return purchaseItemName;
};

const mapPurchaseUnit = (purchaseItemName) => {
  const mapping = {
    '紅麵線': '斤',
    '新鮮蚵仔': '斤',
    '滷大腸': '斤',
    '新鮮香菜': '斤',
    '特製辣醬': '罐',
    '大蒜/辛香料': '斤',
    '桶裝瓦斯': '桶',
    '其他雜物': '個'
  };
  return mapping[purchaseItemName] || '個';
};

export default function BookkeepingView({ storeCode: propStoreCode, onBackToDemo, onLogout, parentClosedDates, parentSetClosedDates }) {
  const storeCode = propStoreCode || getActiveStoreCode();
    const [condimentsAvailability, setCondimentsAvailability] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [selectedManageType, setSelectedManageType] = useState('general');
  const [editingCondimentName, setEditingCondimentName] = useState(null);
  const [newCondimentFormName, setNewCondimentFormName] = useState('');
  const [newCondimentFormStatus, setNewCondimentFormStatus] = useState(true);

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!prodName || !prodPrice) {
      alert("請輸入商品名稱與單價！");
      return;
    }

    const priceNum = parseFloat(prodPrice);
    if (isNaN(priceNum)) {
      alert("請輸入有效的單價金額！");
      return;
    }

    // Set standard mee-sua customizations or none
    let customizations = null;
    if (prodCustomization === 'mee-sua-standard') {
      customizations = {
        size: {
          title: '份量',
          type: 'radio',
          options: [
            { label: '小碗', priceChange: 0 },
            { label: '大碗', priceChange: prodName.includes('清麵線') ? 10 : 15 }
          ],
          default: '小碗'
        },
        addons: {
          title: '加料選項 (可多選)',
          type: 'checkbox',
          options: [
            { label: '大腸', priceChange: 15 },
            { label: '豬肚', priceChange: 15 },
            { label: '肉羹', priceChange: 15 },
            { label: '花枝羹', priceChange: 15 },
            { label: '貢丸', priceChange: 15 }
          ]
        },
        condiments: {
          title: '調料客製 (免加錢)',
          type: 'selects',
          options: [
            { name: '香菜', choices: ['正常', '多一點', '不要香菜'], default: '正常' },
            { name: '蒜末', choices: ['正常', '多一點', '不要蒜頭'], default: '正常' },
            { name: '烏醋', choices: ['正常', '多一點', '不要烏醋'], default: '正常' },
            { name: '辣醬', choices: ['不辣', '微辣', '中辣', '大辣'], default: '不辣' }
          ]
        },
        is_available: true
      };
    }

    const itemData = {
      name: prodName,
      category: prodCategory,
      price: priceNum,
      description: prodDescription || '',
      image: prodImage || (prodCategory === 'mee-sua' ? '/images/taiwanese_mee_sua.jpg' : '/images/spicy_kimchi.jpg'),
      customizations: customizations
    };

    try {
      if (editingItemId) {
        // Update product
        const { error } = await supabase.from('menu_items').update(itemData).eq('id', editingItemId);
        if (error) throw error;
        alert("商品編輯成功！");
      } else {
        // Add new product
        const { error } = await supabase.from('menu_items').insert([itemData]);
        if (error) throw error;
        alert("新增自訂商品上架成功！");
      }
      handleCancelEdit();
      fetchMenuItems();
    } catch (err) {
      console.error("Failed to save product in BookkeepingView:", err);
      alert("儲存商品失敗！");
    }
  };

  const handleEditProductClick = (item) => {
    setEditingItemId(item.id);
    setProdName(item.name);
    setProdCategory(item.category);
    setProdPrice(String(item.price));
    setProdDescription(item.description || '');
    setProdImage(item.image || '');
    setProdCustomization(item.customizations ? 'mee-sua-standard' : 'none');
    
    // Scroll to form
    const formEl = document.getElementById('product-edit-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setProdName('');
    setProdPrice('');
    setProdDescription('');
    setProdImage('');
    setProdCustomization('mee-sua-standard');
  };

  const handleDeleteProduct = async (itemId, itemName) => {
    if (window.confirm(`確定要將商品「${itemName}」從菜單中永久刪除嗎？`)) {
      try {
        const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
        if (error) throw error;
        fetchMenuItems();
        if (editingItemId === itemId) {
          handleCancelEdit();
        }
      } catch (err) {
        console.error("Failed to delete product in BookkeepingView:", err);
        alert("刪除商品失敗！");
      }
    }
  };

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const storeItems = filterItemsByStore(data, storeCode);
        const visible = storeItems.filter(item => !item.name.startsWith('SYSTEM_SETTING_')).map(item => ({
          ...item,
          name: item.name
        }));
        setMenuItems(visible);
        
        // Load manual revenue setting
        const manualRevItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_MANUAL_REVENUE');
        if (manualRevItem && manualRevItem.description) {
          try {
            const parsed = JSON.parse(manualRevItem.description);
            setManualRevenues(parsed);
          } catch (e) {
            setManualRevenues({});
          }
        } else {
          setManualRevenues({});
        }
      } else {
        setMenuItems([]);
      }
    } catch (err) {
      console.error("Failed to load from Supabase menu_items in BookkeepingView:", err);
      setMenuItems([]);
    }
  };

  const handleCondimentToggle = (name) => {
    const updated = {
      ...condimentsAvailability,
      [name]: !condimentsAvailability[name]
    };
    setCondimentsAvailability(updated);
    localStorage.setItem('condiments_availability', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const handleCondimentFormSubmit = (e) => {
    e.preventDefault();
    if (!newCondimentFormName.trim()) return;
    
    const targetName = newCondimentFormName.trim();
    let updated = { ...condimentsAvailability };
    
    if (editingCondimentName) {
      if (editingCondimentName !== targetName) {
        delete updated[editingCondimentName];
      }
      updated[targetName] = newCondimentFormStatus;
      alert("佐料修改成功！");
    } else {
      if (updated[targetName] !== undefined) {
        alert("該佐料已存在！");
        return;
      }
      updated[targetName] = newCondimentFormStatus;
      alert("佐料上架成功！");
    }
    
    setCondimentsAvailability(updated);
    localStorage.setItem('condiments_availability', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
    setSelectedManageType('condiments');
    setEditingCondimentName(null);
    setNewCondimentFormName('');
  };

  const handleDeleteCondiment = (name) => {
    if (window.confirm(`確定要將佐料「${name}」從列表中永久刪除嗎？`)) {
      let updated = { ...condimentsAvailability };
      delete updated[name];
      setCondimentsAvailability(updated);
      localStorage.setItem('condiments_availability', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleEditCondimentClick = (name, isAvailable) => {
    setEditingCondimentName(name);
    setNewCondimentFormName(name);
    setNewCondimentFormStatus(isAvailable);
    setSelectedManageType('add-condiment');
  };

  const handleMenuItemToggle = async (itemId) => {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    const currentCustomizations = item.customizations || {};
    const isCurrentlyAvailable = currentCustomizations.is_available !== false;
    const updatedCustomizations = {
      ...currentCustomizations,
      is_available: !isCurrentlyAvailable
    };

    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ customizations: updatedCustomizations })
        .eq('id', itemId);
      if (error) throw error;
      setMenuItems(prev => prev.map(i => i.id === itemId ? { ...i, customizations: updatedCustomizations } : i));
    } catch (err) {
      console.error("Failed to toggle menu item in BookkeepingView:", err);
      alert("切換商品供應狀態失敗，請確認網路連線！");
    }
  };

    // Product form states
  const [editingItemId, setEditingItemId] = useState(null);
  const [prodName, setProdName] = useState('');

  // LINE Notification settings states
  const [showLineSettingsModal, setShowLineSettingsModal] = useState(false);
  const [lineSettingsType, setLineSettingsType] = useState('bot'); // 'bot', 'notify'
  const [lineBotAccessToken, setLineBotAccessToken] = useState('');
  const [lineBotUserId, setLineBotUserId] = useState('');
  const [lineNotifyToken, setLineNotifyToken] = useState('');
  const [prodCategory, setProdCategory] = useState('mee-sua');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodCustomization, setProdCustomization] = useState('mee-sua-standard');
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [fixedCosts, setFixedCosts] = useState([]);
  
  const [isPurchasesOnCloud, setIsPurchasesOnCloud] = useState(false);
  const [isFixedCostsOnCloud, setIsFixedCostsOnCloud] = useState(false);
  
  // Date Selection
    const getTodayLocalDate = () => {
    try {
      return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    } catch (e) {
      const d = new Date();
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
    }
  };
  // Advanced Bookkeeping & Inventory States
  const [editingFixedCostId, setEditingFixedCostId] = useState(null);
  
  // New Inventory Item States
  const [showAddInventoryForm, setShowAddInventoryForm] = useState(false);
  const [newInvName, setNewInvName] = useState('');
  const [newInvQty, setNewInvQty] = useState('');
  const [newInvUnit, setNewInvUnit] = useState('斤');
  const [newInvMin, setNewInvMin] = useState('');
  
  // 💰 Cash Audit (現金盤點) States
  const [cashAudits, setCashAudits] = useState(() => {
    try {
      const saved = localStorage.getItem('restaurant_cash_audits');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [showCashAuditModal, setShowCashAuditModal] = useState(false);
  const [showCashAuditPromptModal, setShowCashAuditPromptModal] = useState(false);
  const [auditDate, setAuditDate] = useState(getTodayLocalDate());
  const [auditDrawerFloat, setAuditDrawerFloat] = useState(() => localStorage.getItem('drawer_float_default') || '3000');
  const [auditCountedCash, setAuditCountedCash] = useState('');
  const [auditDenominations, setAuditDenominations] = useState({
    d1000: '', d500: '', d200: '', d100: '', d50: '', d10: '', d5: '', d1: ''
  });
  const [showDenomCalc, setShowDenomCalc] = useState(false);
  const [auditAuditor, setAuditAuditor] = useState('店長');
  const [auditRemarks, setAuditRemarks] = useState('');
  const [editingAuditId, setEditingAuditId] = useState(null);

  // Daily prompt check for cash audit on load
  useEffect(() => {
    const todayStr = getTodayLocalDate();
    const isSkipped = localStorage.getItem('cash_audit_skip_' + todayStr) === 'true';
    const todayAudit = cashAudits.find(a => a.date === todayStr);
    if (!todayAudit && !isSkipped) {
      const timer = setTimeout(() => {
        setShowCashAuditPromptModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cashAudits]);

  // Recalculate counted cash from denominations
  const updateDenomAndSum = (field, val) => {
    const newDenom = { ...auditDenominations, [field]: val };
    setAuditDenominations(newDenom);
    const sum = (Number(newDenom.d1000 || 0) * 1000) +
                (Number(newDenom.d500 || 0) * 500) +
                (Number(newDenom.d200 || 0) * 200) +
                (Number(newDenom.d100 || 0) * 100) +
                (Number(newDenom.d50 || 0) * 50) +
                (Number(newDenom.d10 || 0) * 10) +
                (Number(newDenom.d5 || 0) * 5) +
                (Number(newDenom.d1 || 0) * 1);
    setAuditCountedCash(String(sum));
  };

  // Open modal for a specific date (or today)
  const handleOpenCashAuditModal = (targetDate = getTodayLocalDate()) => {
    const existing = cashAudits.find(a => a.date === targetDate);
    setAuditDate(targetDate);
    if (existing) {
      setEditingAuditId(existing.id);
      setAuditDrawerFloat(String(existing.drawerFloat ?? 3000));
      setAuditCountedCash(String(existing.countedCash ?? ''));
      setAuditDenominations(existing.denominations || { d1000: '', d500: '', d200: '', d100: '', d50: '', d10: '', d5: '', d1: '' });
      setAuditAuditor(existing.auditor || '店長');
      setAuditRemarks(existing.remarks || '');
    } else {
      setEditingAuditId(null);
      setAuditCountedCash('');
      setAuditDenominations({ d1000: '', d500: '', d200: '', d100: '', d50: '', d10: '', d5: '', d1: '' });
      setAuditRemarks('');
    }
    setShowCashAuditModal(true);
  };

  // Save cash audit record
  const handleSaveCashAudit = async () => {
    if (!auditDate) {
      alert("請選擇盤點日期！");
      return;
    }
    if (!auditCountedCash && auditCountedCash !== 0) {
      alert("請輸入實收現金總金額！");
      return;
    }

    // Get system orders on auditDate
    const dateOrders = orders.filter(o => {
      const d = o.timestamp ? new Date(o.timestamp).toLocaleDateString('en-CA') : (o.time ? o.time.slice(0, 10) : '');
      return d === auditDate;
    });
    const manualForDate = Number(manualRevenues[auditDate] || 0);
    const dateTotalRev = dateOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) + manualForDate;
    const dateCashRev = dateOrders.filter(o => !o.paymentMethod || o.paymentMethod === 'cash').reduce((sum, o) => sum + (Number(o.total) || 0), 0) + manualForDate;
    const dateOnlineRev = dateOrders.filter(o => o.paymentMethod && o.paymentMethod !== 'cash').reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const counted = Number(auditCountedCash || 0);
    const floatVal = Number(auditDrawerFloat || 0);
    const netActual = counted - floatVal;
    const diff = netActual - dateCashRev;

    const auditObj = {
      id: editingAuditId || `audit_${auditDate}_${Date.now()}`,
      date: auditDate,
      timestamp: Date.now(),
      systemTotalRevenue: dateTotalRev,
      systemCashRevenue: dateCashRev,
      systemOnlineRevenue: dateOnlineRev,
      orderCount: dateOrders.length,
      drawerFloat: floatVal,
      countedCash: counted,
      netActualCash: netActual,
      difference: diff,
      denominations: { ...auditDenominations },
      auditor: auditAuditor || '店長',
      remarks: auditRemarks || ''
    };

    const updated = cashAudits.filter(a => a.date !== auditDate).concat(auditObj).sort((a, b) => b.date.localeCompare(a.date));
    setCashAudits(updated);
    localStorage.setItem('restaurant_cash_audits', JSON.stringify(updated));
    localStorage.setItem('drawer_float_default', String(floatVal));

    try {
      const auditKey = 'SYSTEM_SETTING_CASH_AUDITS';
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', auditKey);
      if (exist && exist.length > 0) {
        await supabase.from('menu_items').update({ description: JSON.stringify(updated) }).eq('name', auditKey);
      } else {
        await supabase.from('menu_items').insert([{ name: auditKey, price: 0, category: 'settings', description: JSON.stringify(updated) }]);
      }
    } catch (e) {
      console.error("Failed to sync cash audits to Supabase:", e);
    }

    const diffStatus = diff === 0 ? '✅ 帳實相符' : (diff > 0 ? `📈 溢收 +NT$ ${diff.toLocaleString()}` : `📉 短少 -NT$ ${Math.abs(diff).toLocaleString()}`);
    alert(`🎉 ${auditDate} 現金盤點已儲存！\n實收營業現金：NT$ ${netActual.toLocaleString()}\n系統現金營收：NT$ ${dateCashRev.toLocaleString()}\n差額核算結果：${diffStatus}`);
    setShowCashAuditModal(false);
    setEditingAuditId(null);
  };

  // Delete cash audit record
  const handleDeleteCashAudit = async (dateToDelete) => {
    if (!confirm(`確定要刪除 ${dateToDelete} 的現金盤點紀錄嗎？`)) return;
    const updated = cashAudits.filter(a => a.date !== dateToDelete);
    setCashAudits(updated);
    localStorage.setItem('restaurant_cash_audits', JSON.stringify(updated));

    try {
      const auditKey = 'SYSTEM_SETTING_CASH_AUDITS';
      await supabase.from('menu_items').update({ description: JSON.stringify(updated) }).eq('name', auditKey);
    } catch (e) {}
  };

  // Edit Vendor index state
  const [editingVendorIndex, setEditingVendorIndex] = useState(null);
    const [selectedBookkeepingDate, setSelectedBookkeepingDate] = useState(getTodayLocalDate());
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'variable', 'fixed', 'monthly'
  const [selectedMonthlyReportMonth, setSelectedMonthlyReportMonth] = useState('all');
  const [variableCostRange, setVariableCostRange] = useState('day'); // 'day', 'week', 'month', 'all'
  
  // Manual revenues states
  const [manualRevenues, setManualRevenues] = useState({});
  const [showManualRevModal, setShowManualRevModal] = useState(false);
  const [manualRevDate, setManualRevDate] = useState(getTodayLocalDate());
  const [manualRevAmount, setManualRevAmount] = useState('');

  // Editing existing inventory settings
  const [editingInvItem, setEditingInvItem] = useState(null);
  const [editInvUnit, setEditInvUnit] = useState('');
  const [editInvMinStock, setEditInvMinStock] = useState('');
  const [editInvQty, setEditInvQty] = useState('');
  const [editInvIsWatched, setEditInvIsWatched] = useState(true);
  const [newInvIsWatched, setNewInvIsWatched] = useState(true);
  const [storeProfile, setStoreProfile] = useState(defaultStoreProfile);
  const defaultInitialStoreName = false ? '蘆洲七號店' : (storeCode !== 'dragon' ? `門市 [${storeCode}]` : '龍城麵線');
  const [storeName, setStoreName] = useState(defaultInitialStoreName);
  const [receiptConfig, setReceiptConfig] = useState(defaultReceiptConfig);

  // Financial report date range filtering
  const [reportRangeType, setReportRangeType] = useState('30days'); // '30days', 'thisMonth', 'lastMonth', '6months', '1year', 'all', 'custom'
  const [reportCustomStartDate, setReportCustomStartDate] = useState('');
  const [reportCustomEndDate, setReportCustomEndDate] = useState(getTodayLocalDate());
  
  // Daily Closing State
  const [localClosedDates, setLocalClosedDates] = useState([]);
  const closedDates = parentClosedDates || localClosedDates;
  const setClosedDates = parentSetClosedDates || setLocalClosedDates;

  // 🏷️ Customizable Vendor Evaluation Tags & Rating States
  const [vendorEvalTags, setVendorEvalTags] = useState(() => {
    try {
      const saved = localStorage.getItem('restaurant_vendor_eval_tags');
      return saved ? JSON.parse(saved) : defaultVendorEvalTags;
    } catch (e) {
      return defaultVendorEvalTags;
    }
  });
  const [showTagManagerModal, setShowTagManagerModal] = useState(false);
  const [showModuleCenterModal, setShowModuleCenterModal] = useState(false);
  const [activeModules, setActiveModules] = useState(() => getActiveModuleSettings());
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [newCustomTagName, setNewCustomTagName] = useState('');
  const [newCustomTagIsGood, setNewCustomTagIsGood] = useState(true);
  const [showVendorScorecard, setShowVendorScorecard] = useState(true);

  useEffect(() => {
    const onModulesChanged = (e) => {
      if (e.detail) setActiveModules(e.detail);
    };
    window.addEventListener('app-modules-updated', onModulesChanged);
    return () => window.removeEventListener('app-modules-updated', onModulesChanged);
  }, []);

  // Form states for purchase rating
  const [purchaseRating, setPurchaseRating] = useState(5);
  const [purchaseSelectedTags, setPurchaseSelectedTags] = useState([]);
  const [purchaseQualityNote, setPurchaseQualityNote] = useState('');

  // Form states for adding purchases (Variable Costs)
  const [purchaseDate, setPurchaseDate] = useState(selectedBookkeepingDate || '');
  const [purchaseVendor, setPurchaseVendor] = useState('');
  const [purchaseItemName, setPurchaseItemName] = useState('滷大腸');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState('paid');

  // Inventory States
  const [isInventoryLoaded, setIsInventoryLoaded] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [processedOrderIds, setProcessedOrderIds] = useState([]);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  // Vendor Management States (V2: multi-items support)
  // Bookkeeping Order Editing State
  const [editingBookkeepingOrder, setEditingBookkeepingOrder] = useState(null);
  const [editOrderTotal, setEditOrderTotal] = useState('');
  const [editOrderType, setEditOrderType] = useState('dine-in');
  const [editOrderCust, setEditOrderCust] = useState('');
  const [editOrderPayment, setEditOrderPayment] = useState('');
  const [editOrderRemarks, setEditOrderRemarks] = useState('');
  const [editOrderCashier, setEditOrderCashier] = useState('店長 (Admin)');
  const [editOrderItems, setEditOrderItems] = useState([]);

  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('v1');
  const [selectedVendorItemIndex, setSelectedVendorItemIndex] = useState('0'); // index or 'custom'
  const [customItemName, setCustomItemName] = useState('');
  const [showVendorModal, setShowVendorModal] = useState(false);
  
  // Add Vendor form state in modal (starts with one item, but can add)
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorItems, setNewVendorItems] = useState([{ name: '紅麵線', qty: '10斤', cost: '600' }]);

  // Sync selected vendor & selected item to form inputs
  useEffect(() => {
    if (selectedVendorId && selectedVendorId !== 'manage-vendors') {
      const v = vendors.find(item => item.id === selectedVendorId);
      if (v) {
        setPurchaseVendor(v.name);
        if (selectedVendorItemIndex === 'custom') {
          setPurchaseItemName(customItemName);
        } else {
          const idx = Number(selectedVendorItemIndex);
          const item = v.items[idx];
          if (item) {
            setPurchaseItemName(item.name);
            setPurchaseQty(item.qty);
            setPurchaseCost(item.cost);
          }
        }
      }
    }
  }, [selectedVendorId, selectedVendorItemIndex, customItemName, vendors]);

  // Recalculate purchaseCost automatically when user updates purchaseQty based on default item ratio
  useEffect(() => {
    if (!purchaseQty || !selectedVendorId || selectedVendorId === 'manage-vendors') return;
    const v = vendors.find(item => item.id === selectedVendorId);
    if (!v || !v.items || selectedVendorItemIndex === 'custom') return;
    
    const defaultItem = v.items[Number(selectedVendorItemIndex)];
    if (!defaultItem || defaultItem.name !== purchaseItemName) return;
    
    const defaultQtyNum = parseFloat(defaultItem.qty.replace(/[^0-9.]/g, ''));
    const inputQtyNum = parseFloat(purchaseQty.replace(/[^0-9.]/g, ''));
    
    if (defaultQtyNum > 0 && inputQtyNum > 0 && defaultItem.cost > 0) {
      const ratio = inputQtyNum / defaultQtyNum;
      const newCost = Math.round(defaultItem.cost * ratio);
      setPurchaseCost(String(newCost));
    }
  }, [purchaseQty, selectedVendorId, selectedVendorItemIndex, purchaseItemName, vendors]);

  const handleAddVendor = (e) => {
    e.preventDefault();
    if (!newVendorName) return;
    const filteredItems = newVendorItems
      .filter(item => item.name.trim() !== '')
      .map(item => ({
        name: item.name,
        qty: item.qty || '10斤',
        cost: Number(item.cost) || 0
      }));

    if (filteredItems.length === 0) {
      alert("請至少新增一個進貨品項！");
      return;
    }

    const newV = {
      id: 'v_' + Date.now(),
      name: newVendorName,
      items: filteredItems
    };
    const updated = [...vendors, newV];
    setVendors(updated);
    localStorage.setItem('restaurant_vendors_v2', JSON.stringify(updated));
    saveVendorsToCloud(updated);
    setNewVendorName('');
    setNewVendorItems([{ name: '紅麵線', qty: '10斤', cost: '600' }]);
    setSelectedVendorId(newV.id);
    setSelectedVendorItemIndex('0');
    alert("廠商新增成功！");
  };

  const handleDeleteVendor = (id, name) => {
    if (window.confirm(`確定要刪除廠商「${name}」嗎？`)) {
      const updated = vendors.filter(v => v.id !== id);
      setVendors(updated);
      localStorage.setItem('restaurant_vendors_v2', JSON.stringify(updated));
      saveVendorsToCloud(updated);
      if (selectedVendorId === id) {
        if (updated.length > 0) {
          setSelectedVendorId(updated[0].id);
          setSelectedVendorItemIndex('0');
        } else {
          setSelectedVendorId('');
        }
      }
    }
  };
    const [adjItemName, setAdjItemName] = useState('');
  const [adjType, setAdjType] = useState('add'); // 'add', 'sub', 'set'
  const [adjQty, setAdjQty] = useState('');
  const [adjRemarks, setAdjRemarks] = useState('');

  // Form states for adding fixed costs
  const [fcName, setFcName] = useState('');
  const [fcCost, setFcCost] = useState('');
  const [fcExpiry, setFcExpiry] = useState('');

  // Fixed Cost Edit Handlers
  const handleEditFixedCostClick = (fc) => {
    setEditingFixedCostId(fc.id);
    setFcName(fc.name);
    setFcCost(String(fc.cost));
    setFcExpiry(fc.expiryDate);
    
    // Scroll to form
    const formEl = document.getElementById('fixed-cost-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEditFixedCost = () => {
    setEditingFixedCostId(null);
    setFcName('');
    setFcCost('');
    setFcExpiry('');
  };

  // Inventory Add/Delete Handlers
  const handleAddInventoryItem = (e) => {
    e.preventDefault();
    if (!newInvName.trim()) return;
    if (inventory.some(i => i.name === newInvName.trim())) {
      alert("該庫存品項已存在！");
      return;
    }
    const newItem = {
      name: newInvName.trim(),
      qty: Number(newInvQty) || 0,
      unit: newInvUnit.trim() || '斤',
      minStock: Number(newInvMin) || 0
    };
    const updated = [...inventory, newItem];
    setInventory(updated);
    localStorage.setItem('restaurant_inventory', JSON.stringify(updated));
    setNewInvName('');
    setNewInvQty('');
    setNewInvUnit('斤');
    setNewInvMin('');
    setShowAddInventoryForm(false);
    alert("成功新增庫存品項！");
  };

  const handleDeleteInventoryItem = (name) => {
    if (window.confirm(`確定要永久刪除庫存項目「${name}」嗎？此動作將無法復原。`)) {
      const updated = inventory.filter(i => i.name !== name);
      setInventory(updated);
      localStorage.setItem('restaurant_inventory', JSON.stringify(updated));
    }
  };

  const handleMoveInventoryItem = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= inventory.length) return;
    const updated = [...inventory];
    const temp = updated[idx];
    updated[idx] = updated[newIdx];
    updated[newIdx] = temp;
    setInventory(updated);
    localStorage.setItem('restaurant_inventory', JSON.stringify(updated));
  };

  // Helper for computing date range for financial reports
  const getReportDateRange = () => {
    const today = new Date();
    const todayStr = getTodayLocalDate();
    
    if (reportRangeType === 'thisMonth') {
      const start = `${todayStr.slice(0, 7)}-01`;
      return { start, end: todayStr, label: '🗓️ 本月' };
    }
    if (reportRangeType === 'lastMonth') {
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonthStr = prevMonthDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 7);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      return { start: `${prevMonthStr}-01`, end: `${prevMonthStr}-${String(lastDay).padStart(2, '0')}`, label: `📅 上個月 (${prevMonthStr})` };
    }
    if (reportRangeType === '30days') {
      const d = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const start = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      return { start, end: todayStr, label: '⏱️ 近 30 天' };
    }
    if (reportRangeType === '6months') {
      const d = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
      const start = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      return { start, end: todayStr, label: '📊 近半年 (180天)' };
    }
    if (reportRangeType === '1year') {
      const d = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
      const start = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      return { start, end: todayStr, label: '📈 近一年 (365天)' };
    }
    if (reportRangeType === 'custom') {
      return { 
        start: reportCustomStartDate || '2000-01-01', 
        end: reportCustomEndDate || todayStr, 
        label: `✏️ 自訂區間 (${reportCustomStartDate || '起始'} ~ ${reportCustomEndDate || todayStr})` 
      };
    }
    if (selectedMonthlyReportMonth && selectedMonthlyReportMonth !== 'all') {
      const start = `${selectedMonthlyReportMonth}-01`;
      const end = `${selectedMonthlyReportMonth}-31`;
      return { start, end, label: `📅 ${selectedMonthlyReportMonth.replace('-', '年 ')}月` };
    }
    return { start: '2000-01-01', end: '2099-12-31', label: '🌐 全部歷史紀錄' };
  };

  // Toggle Watched status on inventory item for POS alerts
  const handleToggleWatchInventoryItem = (itemName) => {
    const updated = inventory.map(i => {
      if (i.name === itemName) {
        const isWatched = i.isWatched !== false;
        return { ...i, isWatched: !isWatched };
      }
      return i;
    });
    setInventory(updated);
    localStorage.setItem('restaurant_inventory', JSON.stringify(updated));
    supabase.from('menu_items').select('*').eq('name', 'SYSTEM_SETTING_INVENTORY').then(({ data }) => {
      if (data && data.length > 0) {
        supabase.from('menu_items').update({ description: JSON.stringify(updated) }).eq('name', 'SYSTEM_SETTING_INVENTORY');
      }
    });
  };

  // Dedicated CSV Exporter for Monthly Financial & Revenue Reports
  const handleExportMonthlyDataCSV = () => {
    const range = getReportDateRange();
    const targetReports = monthlyReports.filter(r => r.month >= range.start && r.month <= range.end);

    if (targetReports.length === 0) {
      alert("目前尚無損益對帳資料可供匯出！");
      return;
    }

    let totalRevenue = 0;
    let totalSystemRevenue = 0;
    let totalManualRevenue = 0;
    let totalVariable = 0;
    let totalFixed = 0;

    targetReports.forEach(r => {
      totalRevenue += (Number(r.revenue) || 0);
      totalSystemRevenue += (Number(r.systemRevenue) || 0);
      totalManualRevenue += (Number(r.manualRev) || 0);
      totalVariable += (Number(r.variableCosts) || 0);
    });

    const uniqueMonths = Array.from(new Set(targetReports.map(r => r.month.slice(0, 7))));
    uniqueMonths.forEach(m => {
      const activeFixed = fixedCosts.filter(fc => fc.expiryDate.slice(0, 7) >= m);
      totalFixed += activeFixed.reduce((sum, fc) => sum + fc.cost, 0);
    });

    const totalGrossProfit = totalRevenue - totalVariable;
    const grossMarginPercent = totalRevenue > 0 ? ((totalGrossProfit / totalRevenue) * 100) : 0;
    const netProfit = totalGrossProfit - totalFixed;
    const netMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    const activeDays = targetReports.filter(r => (Number(r.revenue) || 0) > 0 || (Number(r.orderCount) || 0) > 0).map(r => r.month);
    const filteredOrders = orders.filter(o => {
      if (o.status !== 'completed' && o.status !== 'received') return false;
      const orderDate = new Date(o.timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      return activeDays.includes(orderDate);
    });
    const totalOrdersCount = filteredOrders.length;
    const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;
    const avgDailyRevenue = activeDays.length > 0 ? Math.round(totalRevenue / activeDays.length) : 0;

    // Item sales breakdown
    const itemSalesMap = {};
    filteredOrders.forEach(o => {
      const orderItems = Array.isArray(o.items) ? o.items : [];
      orderItems.forEach(item => {
        const name = item.name || '未知品項';
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || (item.totalPrice ? Number(item.totalPrice) / qty : 0);
        const itemTotal = Number(item.totalPrice) || (price * qty);
        const itemCost = calculateItemCost(item);

        if (!itemSalesMap[name]) {
          itemSalesMap[name] = { name, qty: 0, revenue: 0, cost: 0 };
        }
        itemSalesMap[name].qty += qty;
        itemSalesMap[name].revenue += itemTotal;
        itemSalesMap[name].cost += itemCost;
      });
    });

    const itemSalesList = Object.values(itemSalesMap).map(item => {
      const grossProfit = item.revenue - item.cost;
      const grossMargin = item.revenue > 0 ? (grossProfit / item.revenue * 100) : 0;
      return { ...item, grossProfit, grossMargin };
    }).sort((a, b) => b.revenue - a.revenue);

    let csv = "\uFEFF";
    csv += `龍城麵線 - 財務損益與營業額對帳報表\n`;
    csv += `統計區間, ${range.label} (${range.start} ~ ${range.end})\n`;
    csv += `匯出時間, ${new Date().toLocaleString('zh-TW', { hour12: false })}\n\n`;

    // 1. Summary KPI Section
    csv += `=== 營運財務與營業額總覽 ===\n`;
    csv += `指標項目, 金額 / 數值, 備註說明\n`;
    csv += `營業總額 (營業額), NT$ ${totalRevenue}, 統計期間全部實收營業額 (系統 + 人工補登)\n`;
    csv += `系統點餐營業額, NT$ ${totalSystemRevenue}, 由 POS 與顧客手機點餐產生之營業額\n`;
    csv += `人工補登營業額, NT$ ${totalManualRevenue}, 手動登錄之非系統營業額\n`;
    csv += `訂單總筆數, ${totalOrdersCount} 筆, 已結算之成交訂單數\n`;
    csv += `平均客單價, NT$ ${avgOrderValue}, 營業總額 ÷ 訂單總筆數\n`;
    csv += `平均每日營業額, NT$ ${avgDailyRevenue}, 營業總額 ÷ 營業天數 (${activeDays.length} 天)\n`;
    csv += `進貨食材成本, -NT$ ${totalVariable}, 原物料進貨變動支出\n`;
    csv += `營業總毛利, NT$ ${totalGrossProfit}, 毛利率: ${grossMarginPercent.toFixed(1)}%\n`;
    csv += `固定成本總額, -NT$ ${totalFixed}, 房租水電人事等固定成本\n`;
    csv += `營運淨利, NT$ ${netProfit}, 淨利率: ${netMarginPercent.toFixed(1)}%\n\n`;

    // 2. Daily Details Section
    csv += `=== 每日營業額與收支損益明細表 ===\n`;
    csv += `對帳日期, 營業總額 (營業額), 系統點餐營業額, 手動補登營業額, 訂單筆數, 食材進貨成本, 固定成本分攤, 營業毛利, 毛利率(%), 營運淨利, 淨利率(%), 經營狀態\n`;
    
    targetReports.forEach(r => {
      const dayGross = r.revenue - r.variableCosts;
      const dayGrossMargin = r.revenue > 0 ? ((dayGross / r.revenue) * 100).toFixed(1) : '0.0';
      const dayNet = dayGross - r.fixedCosts;
      const dayNetMargin = r.revenue > 0 ? ((dayNet / r.revenue) * 100).toFixed(1) : '0.0';
      const statusStr = dayNet >= 0 ? '盈餘' : '虧損';

      csv += `${r.month},${r.revenue},${r.systemRevenue || 0},${r.manualRev || 0},${r.orderCount || 0},${r.variableCosts},${r.fixedCosts},${dayGross},${dayGrossMargin}%,${dayNet},${dayNetMargin}%,${statusStr}\n`;
    });

    csv += `合計/總結,${totalRevenue},${totalSystemRevenue},${totalManualRevenue},${totalOrdersCount},${totalVariable},${totalFixed},${totalGrossProfit},${grossMarginPercent.toFixed(1)}%,${netProfit},${netMarginPercent.toFixed(1)}%,\n\n`;

    // 3. Product Sales Ranking Section
    const totalQtyAll = itemSalesList.reduce((acc, curr) => acc + curr.qty, 0);
    const totalRevAll = itemSalesList.reduce((acc, curr) => acc + curr.revenue, 0);
    csv += `=== 各餐點品項銷售與營業額排行 ===\n`;
    csv += `排行, 品項名稱, 累積銷量, 銷量佔比(%), 銷售營業額(NT$), 營業額佔比(%), 食材總成本(NT$), 毛利額(NT$), 毛利率(%)\n`;
    itemSalesList.forEach((item, idx) => {
      const qPct = totalQtyAll > 0 ? ((item.qty / totalQtyAll) * 100).toFixed(1) : '0.0';
      const rPct = totalRevAll > 0 ? ((item.revenue / totalRevAll) * 100).toFixed(1) : '0.0';
      csv += `${idx + 1},${item.name.replace(/,/g, ' ')},${item.qty},${qPct}%,${item.revenue},${rPct}%,${item.cost},${item.grossProfit},${item.grossMargin.toFixed(1)}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `龍城麵線_按月財務營業額報表_${range.start}_${range.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exporter for Monthly HTML interactive report
  const handleExportMonthlyCSV = () => {
    const range = getReportDateRange();
    const targetReports = monthlyReports.filter(r => r.month >= range.start && r.month <= range.end);

    if (targetReports.length === 0) {
      alert("目前尚無損益對帳資料可供匯出！");
      return;
    }

    // Calculations
    let totalRevenue = 0;
    let totalVariable = 0;
    let totalFixed = 0;
    const reportsWithProfit = targetReports.map(r => {
      const dayGross = r.revenue - r.variableCosts;
      const dayGrossMargin = r.revenue > 0 ? ((dayGross / r.revenue) * 100) : 0;
      const dayNetProfit = dayGross - r.fixedCosts;
      const dayNetMargin = r.revenue > 0 ? ((dayNetProfit / r.revenue) * 100) : 0;
      return { 
        ...r, 
        grossProfit: dayGross,
        grossMargin: dayGrossMargin,
        profit: dayNetProfit,
        netMargin: dayNetMargin
      };
    });

    let totalSystemRevenue = 0;
    let totalManualRevenue = 0;
    targetReports.forEach(r => {
      totalRevenue += (Number(r.revenue) || 0);
      totalSystemRevenue += (Number(r.systemRevenue) || 0);
      totalManualRevenue += (Number(r.manualRev) || 0);
      totalVariable += (Number(r.variableCosts) || 0);
    });

    const uniqueMonths = Array.from(new Set(targetReports.map(r => r.month.slice(0, 7))));
    uniqueMonths.forEach(m => {
      const activeFixed = fixedCosts.filter(fc => fc.expiryDate.slice(0, 7) >= m);
      totalFixed += activeFixed.reduce((sum, fc) => sum + fc.cost, 0);
    });

    const totalGrossProfit = totalRevenue - totalVariable;
    const grossMarginPercent = totalRevenue > 0 ? ((totalGrossProfit / totalRevenue) * 100) : 0;
    const netProfit = totalGrossProfit - totalFixed;
    const netMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    // Hourly order peak calculations
    const activeDays = targetReports.filter(r => (Number(r.revenue) || 0) > 0 || (Number(r.orderCount) || 0) > 0).map(r => r.month);
    const filteredOrders = orders.filter(o => {
      if (o.status !== 'completed' && o.status !== 'received') return false;
      const orderDate = new Date(o.timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      return activeDays.includes(orderDate);
    });

    const hourlyCounts = Array(24).fill(0);
    filteredOrders.forEach(o => {
      try {
        const dateObj = new Date(o.timestamp);
        const hr = parseInt(new Intl.DateTimeFormat('zh-TW', { hour: 'numeric', hour12: false, timeZone: 'Asia/Taipei' }).format(dateObj)) || 0;
        if (hr >= 0 && hr < 24) {
          hourlyCounts[hr] += 1;
        }
      } catch (e) {
        const hr = new Date(o.timestamp).getHours();
        hourlyCounts[hr] += 1;
      }
    });

    const dayCount = activeDays.length || 1;
    const hourlyAvgs = hourlyCounts.map(count => count / dayCount);

    // Item & Mee-Sua Sales Analysis calculation
    const itemSalesMap = {};
    let totalItemsQty = 0;
    let totalItemsRevenue = 0;
    let totalItemsCost = 0;

    filteredOrders.forEach(o => {
      const orderItems = Array.isArray(o.items) ? o.items : [];
      orderItems.forEach(item => {
        const name = item.name || '未知品項';
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || (item.totalPrice ? Number(item.totalPrice) / qty : 0);
        const itemTotal = Number(item.totalPrice) || (price * qty);
        const itemCost = calculateItemCost(item);

        if (!itemSalesMap[name]) {
          itemSalesMap[name] = {
            name,
            qty: 0,
            revenue: 0,
            cost: 0,
            isMeeSua: name.includes('麵線') || name.includes('羹')
          };
        }
        itemSalesMap[name].qty += qty;
        itemSalesMap[name].revenue += itemTotal;
        itemSalesMap[name].cost += itemCost;
        totalItemsQty += qty;
        totalItemsRevenue += itemTotal;
        totalItemsCost += itemCost;
      });
    });

    const itemSalesList = Object.values(itemSalesMap).map(item => {
      const grossProfit = item.revenue - item.cost;
      const grossMargin = item.revenue > 0 ? (grossProfit / item.revenue * 100) : 0;
      return {
        ...item,
        grossProfit,
        grossMargin
      };
    }).sort((a, b) => b.qty - a.qty);

    const meeSuaSalesList = itemSalesList.filter(item => item.isMeeSua);
    const itemSalesLabelsJson = JSON.stringify(itemSalesList.map(i => i.name));
    const itemSalesQtyJson = JSON.stringify(itemSalesList.map(i => i.qty));
    const itemSalesRevenueJson = JSON.stringify(itemSalesList.map(i => i.revenue));
    const itemSalesProfitJson = JSON.stringify(itemSalesList.map(i => i.grossProfit));

    // Dynamic JSON serialization for embedding in HTML
    const dailyDataJson = JSON.stringify([...reportsWithProfit].reverse().map(r => ({
      date: r.month,
      revenue: r.revenue,
      cost: r.fixedCosts + r.variableCosts,
      profit: r.profit
    })));

    const hourlyLabelsJson = JSON.stringify(Array(24).fill(0).map((_, hr) => 
      `${String(hr).padStart(2, '0')}:00-${String((hr + 1) % 24).padStart(2, '0')}:00`
    ));
    const hourlyAvgsJson = JSON.stringify(hourlyAvgs.map(v => parseFloat(v.toFixed(2))));

    // Standalone Interactive HTML Dashboard template
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${storeName || '龍城麵線'} - 財務損益對帳與客群時段分析報告 (${selectedMonthlyReportMonth})</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --primary: #ea580c;
      --primary-hover: #c2410c;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --success: #10b981;
      --danger: #ef4444;
      --card-gradient: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    }
    body {
      font-family: 'Outfit', 'Noto Sans TC', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 40px 20px;
      line-height: 1.5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo {
      font-size: 2.2rem;
      background: var(--primary);
      padding: 10px;
      border-radius: 12px;
      display: inline-block;
    }
    h1 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 900;
      color: #fff;
    }
    .report-badge {
      display: inline-block;
      background-color: rgba(234, 88, 12, 0.15);
      color: var(--primary);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: bold;
      border: 1px solid rgba(234, 88, 12, 0.3);
      margin-top: 5px;
    }
    .btn-print {
      background-color: var(--primary);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: bold;
      cursor: pointer;
      font-size: 0.95rem;
      transition: all 0.2s;
      box-shadow: 0 4px 6px rgba(234, 88, 12, 0.2);
    }
    .btn-print:hover {
      background-color: var(--primary-hover);
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(234, 88, 12, 0.3);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
      margin-bottom: 45px;
    }
    .kpi-card {
      background: var(--card-gradient);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      transition: transform 0.2s;
    }
    .kpi-card:hover {
      transform: translateY(-4px);
    }
    .kpi-title {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: bold;
      letter-spacing: 0.05em;
    }
    .kpi-value {
      font-size: 2rem;
      font-weight: 900;
      margin-top: 10px;
    }
    .kpi-value.profit { color: var(--success); }
    .kpi-value.loss { color: var(--danger); }
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 30px;
      margin-bottom: 45px;
    }
    @media (min-width: 992px) {
      .charts-grid { grid-template-columns: 1fr 1fr; }
    }
    .chart-card {
      background: var(--card-gradient);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
    }
    .chart-title {
      font-size: 1.15rem;
      font-weight: bold;
      margin-bottom: 24px;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .table-card {
      background: var(--card-gradient);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      margin-bottom: 40px;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      text-align: left;
    }
    th {
      border-bottom: 2px solid var(--border);
      padding: 14px;
      color: var(--primary);
      font-weight: 700;
      font-size: 0.95rem;
    }
    td {
      padding: 14px;
      border-bottom: 1px solid var(--border);
    }
    tr:last-child td {
      border-bottom: none;
    }
    .text-success { color: var(--success); font-weight: bold; }
    .text-danger { color: var(--danger); font-weight: bold; }
    
    @media print {
      body {
        background-color: white;
        color: black;
        padding: 0;
      }
      .btn-print { display: none; }
      .kpi-card, .chart-card, .table-card {
        box-shadow: none;
        border: 1px solid #ccc;
        background: white;
        color: black;
      }
      h1, .report-badge, .chart-title, th {
        color: black !important;
        -webkit-text-fill-color: black;
      }
      .kpi-value.profit { color: #15803d !important; }
      .kpi-value.loss { color: #b91c1c !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-left">
        <div class="logo">🥢</div>
        <div>
          <h1>${storeName || '龍城麵線'} - 財務損益對帳與客群時段分析報告</h1>
          <div class="report-badge">📅 統計時段: <strong>${range.label} (${range.start === '2000-01-01' ? '全部歷史' : range.start} ~ ${range.end === '2099-12-31' ? '至今' : range.end})</strong></div>
        </div>
      </div>
      <button class="btn-print" onclick="window.print()">🖨️ 列印報告 / 存為 PDF</button>
    </header>

    <div class="kpis">
      <div class="kpi-card" style="border: 2px solid #ea580c; background: linear-gradient(135deg, rgba(234, 88, 12, 0.15) 0%, #1e293b 100%);">
        <div class="kpi-title">💰 營業總額 (營業額)</div>
        <div class="kpi-value" style="color: #fb923c;">NT$ ${totalRevenue.toLocaleString()}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; line-height: 1.5;">
          <span>📱 系統點餐: NT$ ${totalSystemRevenue.toLocaleString()}</span><br/>
          <span>✍️ 手動補登: NT$ ${totalManualRevenue.toLocaleString()}</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">🧾 訂單數與客單價</div>
        <div class="kpi-value" style="color: #38bdf8;">${filteredOrders.length.toLocaleString()} <span style="font-size: 1rem; font-weight: normal;">筆</span></div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; line-height: 1.5;">
          <span>🏷️ 平均客單價: NT$ ${filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length) : 0}</span><br/>
          <span>📅 日均營業額: NT$ ${activeDays.length > 0 ? Math.round(totalRevenue / activeDays.length).toLocaleString() : 0}</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">💸 進貨變動成本</div>
        <div class="kpi-value" style="color: #ef4444;">-NT$ ${totalVariable.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">🥗 營業總毛利</div>
        <div class="kpi-value ${totalGrossProfit >= 0 ? 'profit' : 'loss'}">NT$ ${totalGrossProfit.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">📊 營業毛利率</div>
        <div class="kpi-value ${grossMarginPercent >= 0 ? 'profit' : 'loss'}">${grossMarginPercent.toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">🏢 固定成本總額</div>
        <div class="kpi-value" style="color: #ef4444;">-NT$ ${totalFixed.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">📈 營運淨利與淨利率</div>
        <div class="kpi-value ${netProfit >= 0 ? 'profit' : 'loss'}">
          NT$ ${netProfit.toLocaleString()}
          <span style="font-size: 0.85rem; font-weight: normal; opacity: 0.85;">(${netMarginPercent.toFixed(1)}%)</span>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">📈 每日收支淨利趨勢曲線</div>
        <div style="height: 320px; position: relative;">
          <canvas id="profitTrendChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-title">⏰ 平均點單時段分佈 (每小時)</div>
        <div style="height: 320px; position: relative;">
          <canvas id="hourlyOrderChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Mee-Sua & Item Sales Analysis Charts -->
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">🍜 各麵線與品項銷售數量佔比</div>
        <div style="height: 320px; position: relative;">
          <canvas id="itemQtyDoughnutChart"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-title">💵 各麵線與品項銷售金額佔比</div>
        <div style="height: 320px; position: relative;">
          <canvas id="itemRevenueBarChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Mee-Sua & Item Sales Analysis Table -->
    <div class="table-card">
      <div class="chart-title">🍜 各類麵線與餐點品項銷售與毛利深度分析表</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>排行</th>
              <th>餐點/麵線品項名稱</th>
              <th>累積銷售量 (佔比)</th>
              <th>銷售總額 (佔比)</th>
              <th>食材總成本 (NT$)</th>
              <th>毛利額 (NT$)</th>
              <th>毛利率 (%)</th>
              <th>平均售價</th>
            </tr>
          </thead>
          <tbody>
            ${itemSalesList.length === 0 ? '<tr><td colspan="8" style="text-align: center; color: #94a3b8;">此期間無銷售明細數據</td></tr>' : 
              itemSalesList.map((item, idx) => {
                const avgPrice = item.qty > 0 ? Math.round(item.revenue / item.qty) : 0;
                const isProfitable = item.grossProfit >= 0;
                return `
                <tr>
                  <td style="font-weight: bold; color: ${idx < 3 ? '#ea580c' : 'inherit'};">${idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : String(idx + 1)}</td>
                  <td style="font-weight: bold;">
                    ${item.name}
                    ${item.isMeeSua ? '<span style="margin-left: 6px; padding: 2px 6px; font-size: 0.65rem; border-radius: 4px; background-color: rgba(234,88,12,0.15); color: #ea580c; font-weight: bold;">麵線類</span>' : ''}
                  </td>
                  <td style="font-weight: bold; color: #38bdf8;">${item.qty.toLocaleString()} 份</td>
                  <td style="font-weight: bold;">NT$ ${item.revenue.toLocaleString()}</td>
                  <td style="color: #ef4444;">NT$ ${item.cost.toLocaleString()}</td>
                  <td style="font-weight: bold; color: ${isProfitable ? '#10b981' : '#ef4444'};">NT$ ${item.grossProfit.toLocaleString()}</td>
                  <td style="font-weight: bold; color: ${isProfitable ? '#10b981' : '#ef4444'};">${item.grossMargin.toFixed(1)}%</td>
                  <td>NT$ ${avgPrice}</td>
                </tr>`;
              }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="table-card">
      <div class="chart-title">📊 每日收支損益與毛利明細對帳表</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>對帳日期</th>
              <th>營業總額 (營業額)</th>
              <th>系統營業額</th>
              <th>手動補登</th>
              <th>訂單數</th>
              <th>進貨變動成本</th>
              <th>營業毛利</th>
              <th>毛利率</th>
              <th>固定成本</th>
              <th>單日淨利</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            ${reportsWithProfit.map(r => {
              const isProfitable = r.profit >= 0;
              return `
              <tr>
                <td style="font-weight: bold; color: var(--primary);">${r.month}</td>
                <td style="font-weight: bold; color: #fb923c; font-size: 0.95rem;">NT$ ${r.revenue.toLocaleString()}</td>
                <td style="color: var(--text-muted);">NT$ ${(r.systemRevenue || 0).toLocaleString()}</td>
                <td style="color: var(--text-muted);">NT$ ${(r.manualRev || 0).toLocaleString()}</td>
                <td style="color: #38bdf8; font-weight: bold;">${r.orderCount || 0} 筆</td>
                <td style="color: #ef4444;">NT$ ${r.variableCosts.toLocaleString()}</td>
                <td style="font-weight: bold; color: ${r.grossProfit >= 0 ? '#10b981' : '#ef4444'};">NT$ ${r.grossProfit.toLocaleString()}</td>
                <td style="font-weight: bold;">${r.grossMargin.toFixed(1)}%</td>
                <td style="color: #ef4444;">NT$ ${r.fixedCosts.toLocaleString()}</td>
                <td class="${isProfitable ? 'text-success' : 'text-danger'}" style="font-weight: bold; font-size: 0.95rem;">NT$ ${r.profit.toLocaleString()}</td>
                <td>
                  <span style="background-color: ${isProfitable ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${isProfitable ? '#10b981' : '#ef4444'}; padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">
                    ${isProfitable ? '盈餘' : '虧損'}
                  </span>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    // Embed data sets
    const dailyData = ${dailyDataJson};
    const hourlyLabels = ${hourlyLabelsJson};
    const hourlyAvgs = ${hourlyAvgsJson};

    // 1. Render Daily Profit Trend Line Chart
    const ctx1 = document.getElementById('profitTrendChart').getContext('2d');
    new Chart(ctx1, {
      type: 'line',
      data: {
        labels: dailyData.map(d => d.date),
        datasets: [
          {
            label: '單日淨利潤 (NT$)',
            data: dailyData.map(d => d.profit),
            borderColor: '#ea580c',
            backgroundColor: 'rgba(234, 88, 12, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: '#ea580c'
          },
          {
            label: '單日營業額 (NT$)',
            data: dailyData.map(d => d.revenue),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.3,
            borderWidth: 3,
            pointBackgroundColor: '#10b981',
            hidden: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { family: 'Noto Sans TC' } }
          }
        },
        scales: {
          x: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });

    // 2. Render Hourly Order Distribution Bar Chart
    const ctx2 = document.getElementById('hourlyOrderChart').getContext('2d');
    new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: hourlyLabels,
        datasets: [{
          label: '平均訂單筆數 (筆/日)',
          data: hourlyAvgs,
          backgroundColor: 'rgba(234, 88, 12, 0.75)',
          borderColor: '#ea580c',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8' }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }
          },
          y: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          }
        }
      }
    });

    // 3. Render Item Qty Doughnut Chart
    const itemLabels = ${itemSalesLabelsJson};
    const itemQtys = ${itemSalesQtyJson};
    const itemRevenues = ${itemSalesRevenueJson};

    const palette = [
      '#ea580c', '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6', '#f43f5e'
    ];

    const ctx3 = document.getElementById('itemQtyDoughnutChart').getContext('2d');
    new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: itemLabels,
        datasets: [{
          data: itemQtys,
          backgroundColor: palette.slice(0, itemLabels.length),
          borderColor: '#1e293b',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { family: 'Noto Sans TC', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                var value = Number(context.raw) || 0;
                var total = context.dataset.data.reduce(function(acc, curr) { return acc + (Number(curr) || 0); }, 0);
                var percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return ' ' + percent + '% (' + value.toLocaleString() + ' 份)';
              }
            }
          }
        }
      }
    });

    // 4. Render Item Revenue Doughnut Chart
    const ctx4 = document.getElementById('itemRevenueBarChart').getContext('2d');
    new Chart(ctx4, {
      type: 'doughnut',
      data: {
        labels: itemLabels,
        datasets: [{
          data: itemRevenues,
          backgroundColor: palette.slice(0, itemLabels.length),
          borderColor: '#1e293b',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { family: 'Noto Sans TC', size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                var value = Number(context.raw) || 0;
                var total = context.dataset.data.reduce(function(acc, curr) { return acc + (Number(curr) || 0); }, 0);
                var percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return ' ' + percent + '% (NT$ ' + value.toLocaleString() + ')';
              }
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Fetch orders from Supabase (Filtered strictly by storeCode)
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const storeOrders = data.filter(o => {
          const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
          if (storeCode === 'dragon') {
            return !itemsData?.storeCode || itemsData?.storeCode === 'dragon';
          }
          return itemsData?.storeCode === storeCode;
        });

        // Filter out SYSTEM_STORE_CLOSE
        const clientOrders = storeOrders.filter(o => {
          const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
          return itemsData?.customerName !== 'SYSTEM_STORE_CLOSE';
        });
        setOrders(clientOrders.map(formatSupabaseOrder).filter(Boolean));
        
        // Extract SYSTEM_STORE_CLOSE dates
        const cloudClosedDates = storeOrders
          .filter(o => {
            const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
            return itemsData?.customerName === 'SYSTEM_STORE_CLOSE';
          })
          .map(o => new Date(o.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }));
          
        // Merge cloud closed dates into closedDates state
        const local = JSON.parse(localStorage.getItem(`${storeCode}_restaurant_closed_dates`) || localStorage.getItem('restaurant_closed_dates') || '[]');
        const merged = Array.from(new Set([...local, ...cloudClosedDates]));
        setClosedDates(merged);
        localStorage.setItem(`${storeCode}_restaurant_closed_dates`, JSON.stringify(merged));
      }
    } catch (err) {
      console.error("Failed to load orders in BookkeepingView:", err);
      setOrders([]);
    }
  };

  // Fetch purchases from Supabase
  const fetchPurchases = async () => {
    try {
      const { data, error } = await supabase.from('purchases').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const storePurchases = data.filter(p => {
          if (true) {
            return !p.item_name?.startsWith('[') || p.item_name?.startsWith('[dragon] ');
          }
          return p.item_name?.startsWith(`[${storeCode}] `);
        });

        const mapped = storePurchases.map(p => ({
          id: String(p.id),
          date: p.date,
          time: p.time,
          vendor: p.vendor,
          itemName: p.item_name,
          quantity: p.quantity,
          cost: Number(p.cost),
          status: p.status
        }));
        setPurchases(mapped);
        setIsPurchasesOnCloud(true);
      }
    } catch (err) {
      console.warn("Supabase purchases fallback in BookkeepingView:", err.message);
      setPurchases([]);
      setIsPurchasesOnCloud(false);
    }
  };

  const updateClosedDatesOnCloud = async (newClosedDates) => {
    try {
      const closedKey = prefixNameForStore('SYSTEM_SETTING_CLOSED_DATES', storeCode);
      const { data: existing } = await supabase.from('menu_items').select('*').eq('name', closedKey);
      if (existing && existing.length > 0) {
        await supabase.from('menu_items').update({
          description: JSON.stringify(newClosedDates)
        }).eq('name', closedKey);
      } else {
        await supabase.from('menu_items').insert([{
          name: closedKey,
          price: 0,
          category: 'settings',
          description: JSON.stringify(newClosedDates)
        }]);
      }
    } catch (e) {
      console.error("Failed to sync closed dates to cloud:", e);
    }
  };

  // Fetch fixed costs from Supabase
  const fetchFixedCosts = async () => {
    try {
      const { data, error } = await supabase.from('fixed_costs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const storeFixedCosts = data.filter(fc => {
          if (true) {
            return !fc.name?.startsWith('[') || fc.name?.startsWith('[dragon] ');
          }
          return fc.name?.startsWith(`[${storeCode}] `);
        });

        const mapped = storeFixedCosts.map(fc => ({
          id: String(fc.id),
          name: fc.name,
          cost: Number(fc.cost),
          expiryDate: fc.expiry_date
        }));
        setFixedCosts(mapped);
        setIsFixedCostsOnCloud(true);
      }
    } catch (err) {
      console.warn("Supabase fixed_costs fallback to localStorage in BookkeepingView:", err.message);
      setFixedCosts([]);
      setIsFixedCostsOnCloud(false);
    }
  };

  const saveVendorsToCloud = async (updatedVendors) => {
    try {
      const vendorKey = prefixNameForStore('SYSTEM_SETTING_VENDORS_V2', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', vendorKey);
      if (exist && exist.length > 0) {
        await supabase.from('menu_items').update({
          description: JSON.stringify(updatedVendors)
        }).eq('name', vendorKey);
      } else {
        await supabase.from('menu_items').insert([{
          name: vendorKey,
          description: JSON.stringify(updatedVendors),
          price: 0,
          category: 'settings',
          image: ''
        }]);
      }
    } catch (err) {
      console.error("Failed to save vendors to cloud:", err);
    }
  };

  const fetchInventoryFromCloud = async () => {
    try {
      const { data, error } = await supabase.from('menu_items').select('*');
      if (error) throw error;
      if (data) {
        const storeItems = filterItemsByStore(data, storeCode);
        
        const profileItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_STORE_PROFILE');
        if (profileItem && profileItem.description) {
          try {
            const parsed = JSON.parse(profileItem.description);
            setStoreProfile(parsed);
            if (parsed.storeName) setStoreName(parsed.storeName);
          } catch (e) {}
        } else {
          const nameItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_STORE_NAME');
          if (nameItem && nameItem.description) {
            setStoreName(nameItem.description);
          } else {
            setStoreName(storeCode === 'dragon' ? '龍城麵線' : (storeCode === 'luzhou' ? '蘆洲七號麵線' : `門市 [${storeCode}]`));
          }
        }

        const receiptItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_RECEIPT_CONFIG');
        if (receiptItem && receiptItem.description) {
          try {
            setReceiptConfig(JSON.parse(receiptItem.description));
          } catch (e) {}
        }

        const invItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_INVENTORY');
        if (invItem && invItem.description) {
          try {
            setInventory(JSON.parse(invItem.description));
          } catch (e) { setInventory([]); }
        } else {
          setInventory([]);
        }

        const logsItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_INVENTORY_LOGS');
        if (logsItem && logsItem.description) {
          try {
            setInventoryLogs(JSON.parse(logsItem.description));
          } catch (e) { setInventoryLogs([]); }
        } else {
          setInventoryLogs([]);
        }

        const processedItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_PROCESSED_ORDERS');
        if (processedItem && processedItem.description) {
          try {
            setProcessedOrderIds(JSON.parse(processedItem.description));
          } catch (e) { setProcessedOrderIds([]); }
        } else {
          setProcessedOrderIds([]);
        }

        const condsItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_CONDIMENTS_AVAILABILITY');
        if (condsItem && condsItem.description) {
          try {
            setCondimentsAvailability(JSON.parse(condsItem.description));
          } catch (e) { setCondimentsAvailability({}); }
        }

        const cashAuditsItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_CASH_AUDITS');
        if (cashAuditsItem && cashAuditsItem.description) {
          try {
            const parsed = JSON.parse(cashAuditsItem.description);
            setCashAudits(parsed);
            localStorage.setItem(`${storeCode}_restaurant_cash_audits`, JSON.stringify(parsed));
          } catch (e) {}
        } else {
          setCashAudits([]);
        }

        const closedDatesItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_CLOSED_DATES');
        if (closedDatesItem && closedDatesItem.description) {
          try {
            const cloudClosed = JSON.parse(closedDatesItem.description);
            setClosedDates(cloudClosed);
          } catch (e) { setClosedDates([]); }
        } else {
          setClosedDates([]);
        }
        
        const tagsItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_VENDOR_EVAL_TAGS');
        if (tagsItem && tagsItem.description) {
          try {
            const parsed = JSON.parse(tagsItem.description);
            setVendorEvalTags(parsed);
            localStorage.setItem(`${storeCode}_restaurant_vendor_eval_tags`, JSON.stringify(parsed));
          } catch (e) {}
        }

        const vendorsItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_VENDORS_V2');
        if (vendorsItem && vendorsItem.description) {
          try {
            const parsed = JSON.parse(vendorsItem.description);
            setVendors(parsed);
          } catch (e) {
            setVendors([]);
          }
        } else {
          setVendors([]);
        }
      }
    } catch (e) {
      console.error("Failed to load inventory settings from cloud:", e);
    } finally {
      setIsInventoryLoaded(true);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchPurchases();
    fetchFixedCosts();
    fetchMenuItems();
    fetchInventoryFromCloud();
  }, [storeCode]);

  // Sync closedDates across storage updates (e.g. from cashier closing shop)
  useEffect(() => {
    const handleStorageChange = () => {
      setClosedDates(JSON.parse(localStorage.getItem(`${storeCode}_restaurant_closed_dates`) || (storeCode === 'dragon' ? localStorage.getItem('restaurant_closed_dates') : null) || '[]'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sync form purchase date with selected viewing date
  useEffect(() => {
    setPurchaseDate(selectedBookkeepingDate);
  }, [selectedBookkeepingDate]);

  // Save inventory to local storage & cloud on changes
  useEffect(() => {
    if (!isInventoryLoaded) return;
    localStorage.setItem('restaurant_inventory', JSON.stringify(inventory));
    const syncInv = async () => {
      try {
        const invKey = 'SYSTEM_SETTING_INVENTORY';
        const { data } = await supabase.from('menu_items').select('*').eq('name', invKey);
        if (data && data.length > 0) {
          await supabase.from('menu_items').update({ description: JSON.stringify(inventory) }).eq('name', invKey);
        } else {
          await supabase.from('menu_items').insert([{ name: invKey, price: 0, category: 'settings', description: JSON.stringify(inventory) }]);
        }
      } catch (e) {
        console.error("Failed to sync inventory to cloud:", e);
      }
    };
    syncInv();
  }, [inventory, isInventoryLoaded]);

  // Save processed order IDs to local storage & cloud on changes
  useEffect(() => {
    if (!isInventoryLoaded) return;
    localStorage.setItem('restaurant_processed_orders', JSON.stringify(processedOrderIds));
    const syncProcessed = async () => {
      try {
        const procKey = 'SYSTEM_SETTING_PROCESSED_ORDERS';
        const { data } = await supabase.from('menu_items').select('*').eq('name', procKey);
        if (data && data.length > 0) {
          await supabase.from('menu_items').update({ description: JSON.stringify(processedOrderIds) }).eq('name', procKey);
        } else {
          await supabase.from('menu_items').insert([{ name: procKey, price: 0, category: 'settings', description: JSON.stringify(processedOrderIds) }]);
        }
      } catch (e) {
        console.error("Failed to sync processed orders to cloud:", e);
      }
    };
    syncProcessed();
  }, [processedOrderIds, isInventoryLoaded]);

  // Save inventory logs to local storage & cloud on changes
  useEffect(() => {
    if (!isInventoryLoaded) return;
    localStorage.setItem('restaurant_inventory_logs', JSON.stringify(inventoryLogs));
    const syncLogs = async () => {
      try {
        const logsKey = 'SYSTEM_SETTING_INVENTORY_LOGS';
        const { data } = await supabase.from('menu_items').select('*').eq('name', logsKey);
        if (data && data.length > 0) {
          await supabase.from('menu_items').update({ description: JSON.stringify(inventoryLogs) }).eq('name', logsKey);
        } else {
          await supabase.from('menu_items').insert([{ name: logsKey, price: 0, category: 'settings', description: JSON.stringify(inventoryLogs) }]);
        }
      } catch (e) {
        console.error("Failed to sync logs to cloud:", e);
      }
    };
    syncLogs();
  }, [inventoryLogs, isInventoryLoaded]);

  // Save condiments availability to local storage & cloud on changes
  useEffect(() => {
    if (!isInventoryLoaded) return;
    localStorage.setItem('condiments_availability', JSON.stringify(condimentsAvailability));
    const syncConds = async () => {
      try {
        const condKey = prefixNameForStore('SYSTEM_SETTING_CONDIMENTS_AVAILABILITY', storeCode);
        const { data } = await supabase.from('menu_items').select('*').eq('name', condKey);
        if (data && data.length > 0) {
          await supabase.from('menu_items').update({ description: JSON.stringify(condimentsAvailability) }).eq('name', condKey);
        } else {
          await supabase.from('menu_items').insert([{ name: condKey, price: 0, category: 'settings', description: JSON.stringify(condimentsAvailability) }]);
        }
      } catch (e) {
        console.error("Failed to sync condiments to cloud:", e);
      }
    };
    syncConds();
  }, [condimentsAvailability, isInventoryLoaded]);

  // Process completed orders to decrease inventory automatically
  useEffect(() => {
    if (!isInventoryLoaded) return;
    if (orders.length === 0) return;

    const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'received');
    const newProcessedIds = [...processedOrderIds];
    const newLogs = [];
    let processedAny = false;

    const ordersToProcess = completedOrders.filter(order => !newProcessedIds.includes(order.id));

    if (ordersToProcess.length === 0) return;

    setInventory(prevInventory => {
      const newInventory = prevInventory.map(item => ({ ...item }));

      ordersToProcess.forEach(order => {
        const cartItems = order.items?.cart || [];
        cartItems.forEach(cartItem => {
          const recipe = RECIPES[cartItem.name];
          if (recipe) {
            recipe.forEach(ingredient => {
              const target = newInventory.find(i => i.name === ingredient.name);
              if (target) {
                const totalConsumption = cartItem.quantity * ingredient.qty;
                target.qty = Math.max(0, Number((target.qty - totalConsumption).toFixed(2)));

                newLogs.push({
                  id: `LOG-SALE-${order.id.slice(-6)}-${ingredient.name}-${Date.now()}`,
                  time: order.time || new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                  date: order.date || new Date().toISOString().split('T')[0],
                  itemName: ingredient.name,
                  type: '銷售扣減(聯動)',
                  change: `-${totalConsumption}`,
                  unit: ingredient.unit,
                  remarks: `交易單號: ${order.serialNum || order.id.slice(-6)} [${cartItem.name} x ${cartItem.quantity}]`
                });
              }
            });
          }
        });
        newProcessedIds.push(order.id);
        processedAny = true;
      });

      return newInventory;
    });

    if (processedAny) {
      setProcessedOrderIds(newProcessedIds);
      if (newLogs.length > 0) {
        setInventoryLogs(prev => {
          const updatedLogs = [...newLogs, ...prev].slice(0, 50);
          return updatedLogs;
        });
      }
    }
  }, [orders, processedOrderIds, isInventoryLoaded]);

  // One-time sync of 7/23 purchases into inventory status
  useEffect(() => {
    if (inventory.length === 0) return;
    const isSynced = localStorage.getItem('is_723_purchases_synced_v3');
    if (!isSynced) {
      // 7/23 purchases details
      const purchases723 = [
        { name: '洗衣粉', qty: 1, unit: '包', minStock: 1 },
        { name: '大瓷碗', qty: 4, unit: '個', minStock: 2 },
        { name: '小瓷碗', qty: 2, unit: '個', minStock: 2 },
        { name: '拖鞋', qty: 2, unit: '組', minStock: 1 },
        { name: '手套', qty: 2, unit: '組', minStock: 1 }
      ];

      setInventory(prev => {
        let updated = [...prev];
        purchases723.forEach(p => {
          const idx = updated.findIndex(item => item.name === p.name);
          if (idx !== -1) {
            // We set it to the purchased quantity if it was 0, or add it
            updated[idx] = { ...updated[idx], qty: updated[idx].qty + p.qty };
          } else {
            updated.push(p);
          }
        });
        localStorage.setItem('restaurant_inventory', JSON.stringify(updated));
        return updated;
      });

      // Insert matching logs
      const time = "09:00";
      const date = "2026-07-23";
      const newLogs = purchases723.map((p, idx) => ({
        id: `LOG-PUR-723-SYNC-${idx}-${Date.now()}`,
        time,
        date,
        itemName: p.name,
        type: '採購進貨(聯動)',
        change: `+${p.qty}`,
        unit: p.unit,
        remarks: '7/23 補登進貨聯動'
      }));

      setInventoryLogs(prev => {
        const updatedLogs = [...newLogs, ...prev].slice(0, 50);
        localStorage.setItem('restaurant_inventory_logs', JSON.stringify(updatedLogs));
        return updatedLogs;
      });

      localStorage.setItem('is_723_purchases_synced_v3', 'true');
    }
  }, [inventory]);

  // Listen for PostgreSQL database changes in real-time
  useEffect(() => {
    const ordersChannel = supabase.channel('bookkeeping-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    const purchasesChannel = supabase.channel('bookkeeping-purchases')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => {
        fetchPurchases();
      })
      .subscribe();

    const fixedCostsChannel = supabase.channel('bookkeeping-fixed-costs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_costs' }, () => {
        fetchFixedCosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(purchasesChannel);
      supabase.removeChannel(fixedCostsChannel);
    };
  }, []);

  // Open edit modal for sales bookkeeping record
  const handleOpenEditBookkeepingOrderModal = (order) => {
    setEditingBookkeepingOrder(order);
    setEditOrderTotal(String(order.total || 0));
    setEditOrderType(order.type || 'dine-in');
    setEditOrderCust(order.customerName || '');
    setEditOrderPayment(order.paymentMethod || '現金');
    setEditOrderRemarks(order.remarks || '');
    setEditOrderCashier(order.cashier || '店長 (Admin)');
    setEditOrderItems(Array.isArray(order.items) ? order.items.map(i => ({ ...i })) : []);
  };

  const handleSaveBookkeepingOrderEdit = async (e) => {
    e.preventDefault();
    if (!editingBookkeepingOrder) return;

    try {
      const numericId = Number(editingBookkeepingOrder.id);
      const newTotal = Number(editOrderTotal) || 0;
      
      const updatedItemsPayload = {
        cart: editOrderItems,
        cashier: editOrderCashier.trim() || '店長 (Admin)',
        remarks: editOrderRemarks.trim(),
        pickupTime: editingBookkeepingOrder.pickupTime,
        customerName: editOrderCust.trim(),
        customerPhone: editingBookkeepingOrder.customerPhone,
        paymentMethod: editOrderPayment.trim()
      };

      const { error } = await supabase
        .from('orders')
        .update({
          total: newTotal,
          type: editOrderType,
          items: updatedItemsPayload
        })
        .eq('id', isNaN(numericId) ? editingBookkeepingOrder.id : numericId);

      if (error) throw error;

      alert("🎉 帳目流水訂單修改成功！");
      setEditingBookkeepingOrder(null);
      fetchOrders();
    } catch (err) {
      console.error("Failed to save bookkeeping order edit:", err);
      alert("修改失敗：" + (err.message || "請檢查網路連線"));
    }
  };

  // Soft-delete sales bookkeeping record
  const handleDeleteBookkeepingOrder = async (orderId, currentRemarks) => {
    if (!window.confirm("警告：您確定要刪除此筆已完成的營業流水帳紀錄嗎？\n此操作將從當日營收中扣除，且刪除歷程將被存檔記錄！")) {
      return;
    }

    const reason = window.prompt("請輸入刪除此帳目紀錄的緣由 (必要)：");
    if (!reason || !reason.trim()) {
      alert("必須輸入刪除緣由才能進行刪除！");
      return;
    }

    try {
      const targetOrder = orders.find(o => String(o.id) === String(orderId));
      if (!targetOrder) throw new Error("找不到該筆訂單");

      const updatedItems = {
        cart: targetOrder.items,
        cashier: targetOrder.cashier,
        remarks: `${targetOrder.remarks || ''} [已刪除 - 原因: ${reason.trim()}]`,
        pickupTime: targetOrder.pickupTime,
        customerName: targetOrder.customerName,
        customerPhone: targetOrder.customerPhone,
        paymentMethod: targetOrder.paymentMethod
      };

      const numericId = Number(orderId);
      const { error } = await supabase.from('orders').update({
        status: 'deleted',
        items: updatedItems
      }).eq('id', isNaN(numericId) ? orderId : numericId);
      
      if (error) throw error;
      alert("已成功刪除該筆帳目紀錄！");
      fetchOrders();
    } catch (err) {
      console.error("Failed to soft-delete order in BookkeepingView:", err);
      // LocalStorage fallback
      const savedOrders = JSON.parse(localStorage.getItem('restaurant_orders') || '[]');
      const updated = savedOrders.map(o => {
        if (o.id === orderId) {
          return { ...o, status: 'deleted', remarks: `${o.remarks || ''} [已刪除 - 原因: ${reason.trim()}]` };
        }
        return o;
      });
      localStorage.setItem('restaurant_orders', JSON.stringify(updated));
      fetchOrders();
      alert("已由本機存檔執行軟刪除！");
    }
  };

  // Helper to sync purchase to inventory
  const updateInventoryFromPurchase = (vendor, itemName, qtyText, dateText, timeText) => {
    const numericQty = parseFloat(qtyText.replace(/[^0-9.]/g, '')) || 0;
    const mappedName = mapPurchaseToInventory(itemName);

    if (mappedName && numericQty > 0) {
      setInventory(prev => {
        const updated = prev.map(item => {
          if (item.name === mappedName) {
            return { ...item, qty: Number((item.qty + numericQty).toFixed(2)) };
          }
          return item;
        });
        localStorage.setItem('restaurant_inventory', JSON.stringify(updated));
        return updated;
      });

      // Create inventory log
      const newLog = {
        id: `LOG-PUR-${Date.now()}`,
        time: timeText,
        date: dateText,
        itemName: mappedName,
        type: '採購進貨(聯動)',
        change: `+${numericQty}`,
        unit: mapPurchaseUnit(itemName),
        remarks: `進貨登記聯動 [廠商: ${vendor}]`
      };
      setInventoryLogs(prev => {
        const updatedLogs = [newLog, ...prev].slice(0, 50);
        localStorage.setItem('restaurant_inventory_logs', JSON.stringify(updatedLogs));
        return updatedLogs;
      });
    }
  };

  // Update inventory item settings (unit, current quantity, and minStock threshold)
  const handleSaveInvItemSettings = (e) => {
    e.preventDefault();
    if (!editingInvItem) return;

    const minStockVal = Number(editInvMinStock);
    if (isNaN(minStockVal) || minStockVal < 0) {
      alert("安全警戒線必須是有效的數字！");
      return;
    }

    const currentQtyVal = editInvQty !== '' ? Number(editInvQty) : editingInvItem.qty;
    if (isNaN(currentQtyVal) || currentQtyVal < 0) {
      alert("目前庫存數量必須是有效的數字（可為 0）！");
      return;
    }

    setInventory(prev => {
      const updated = prev.map(item => {
        if (item.name === editingInvItem.name) {
          return {
            ...item,
            qty: Math.max(0, currentQtyVal),
            unit: editInvUnit.trim(),
            minStock: minStockVal,
            isWatched: editInvIsWatched !== false
          };
        }
        return item;
      });
      localStorage.setItem('restaurant_inventory', JSON.stringify(updated));
      return updated;
    });

    // Add log if qty changed
    if (currentQtyVal !== editingInvItem.qty) {
      const newLog = {
        id: `LOG-${Date.now()}`,
        time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }),
        itemName: editingInvItem.name,
        type: '編輯修正',
        change: `重設為 ${currentQtyVal}`,
        unit: editInvUnit.trim(),
        remarks: '在物料設定中直接修改數量'
      };
      setInventoryLogs(prev => {
        const updatedLogs = [newLog, ...prev].slice(0, 50);
        localStorage.setItem('restaurant_inventory_logs', JSON.stringify(updatedLogs));
        return updatedLogs;
      });
    }

    alert(`物料「${editingInvItem.name}」的設定與庫存已更新！`);
    setEditingInvItem(null);
  };

  // Helper for manual adjustment submission
  const handleManualInventoryAdjustment = (e) => {
    e.preventDefault();
    if (!adjItemName || adjQty === '' || adjQty === null) return;
    const qtyVal = Number(adjQty);
    if (isNaN(qtyVal) || (adjType === 'set' ? qtyVal < 0 : qtyVal <= 0)) {
      alert("請輸入有效的數量！" + (adjType === 'set' ? "（重設數量可為 0 或大於 0 的數值）" : "（增減數量需大於 0）"));
      return;
    }

    const targetItem = inventory.find(i => i.name === adjItemName);
    if (!targetItem) return;

    let newQty = targetItem.qty;
    let typeLabel = '';
    if (adjType === 'add') {
      newQty = Number((targetItem.qty + qtyVal).toFixed(2));
      typeLabel = '手動補貨';
    } else if (adjType === 'sub') {
      newQty = Math.max(0, Number((targetItem.qty - qtyVal).toFixed(2)));
      typeLabel = '損耗扣除';
    } else if (adjType === 'set') {
      newQty = Math.max(0, qtyVal);
      typeLabel = '盤點修正/歸零';
    }

    const updatedInventory = inventory.map(item => {
      if (item.name === adjItemName) {
        return { ...item, qty: newQty };
      }
      return item;
    });
    setInventory(updatedInventory);
    localStorage.setItem(`${storeCode}_restaurant_inventory`, JSON.stringify(updatedInventory));
    try {
      const invKey = prefixNameForStore('SYSTEM_SETTING_INVENTORY', storeCode);
      supabase.from('menu_items').upsert([{ name: invKey, price: 0, category: 'settings', description: JSON.stringify(updatedInventory) }]);
    } catch(e){}

    const newLog = {
      id: `LOG-${Date.now()}`,
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }),
      itemName: adjItemName,
      type: typeLabel,
      change: adjType === 'set' ? `重設為 ${qtyVal}` : `${adjType === 'add' ? '+' : '-'}${qtyVal}`,
      unit: targetItem.unit,
      remarks: adjRemarks.trim() || (adjType === 'set' && qtyVal === 0 ? '庫存清零/耗盡' : '無備註')
    };
    const updatedLogs = [newLog, ...inventoryLogs].slice(0, 50);
    setInventoryLogs(updatedLogs);
    localStorage.setItem('restaurant_inventory_logs', JSON.stringify(updatedLogs));

    setAdjQty('');
    setAdjRemarks('');
    alert("庫存盤點調整成功！目前數量已更新為：" + newQty + " " + targetItem.unit);
  };

  // Add Purchase (Variable Cost)
  const handleAddPurchase = async (e) => {
    e.preventDefault();
    
    // Resolve vendor name fallback
    let vendorName = purchaseVendor;
    if (!vendorName || !vendorName.trim()) {
      const matched = vendors.find(v => v.id === selectedVendorId);
      if (matched) {
        vendorName = matched.name;
      }
    }
    
    if (!vendorName || !vendorName.trim()) {
      alert("請先選擇或新增進貨廠商！");
      return;
    }
    if (!purchaseQty || !purchaseQty.trim()) {
      alert("請輸入數量或重量！");
      return;
    }
    if (!purchaseCost) {
      alert("請輸入支出金額！");
      return;
    }

    const time = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const costNum = Number(purchaseCost);

    const purchaseObj = {
      purchase_id: `PUR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      date: purchaseDate,
      time,
      vendor: vendorName.trim(),
      item_name: prefixNameForStore(purchaseItemName, storeCode),
      quantity: purchaseQty.trim(),
      cost: costNum,
      status: purchaseStatus
    };

    try {
      const { error } = await supabase.from('purchases').insert([purchaseObj]);
      if (error) throw error;
      updateInventoryFromPurchase(vendorName.trim(), purchaseItemName, purchaseQty.trim(), purchaseDate, time);
      fetchPurchases();
      alert("🎉 新增進貨成功，已即時同步至雲端資料庫！");
    } catch (err) {
      console.error("Failed to add purchase in BookkeepingView:", err);
      // Fallback to local
      const localObj = {
        id: purchaseObj.purchase_id,
        date: purchaseDate,
        time,
        vendor: vendorName.trim(),
        itemName: purchaseItemName,
        quantity: purchaseQty.trim(),
        cost: costNum,
        status: purchaseStatus
      };
      const updated = [localObj, ...purchases];
      setPurchases(updated);
      localStorage.setItem(`${storeCode}_restaurant_purchases`, JSON.stringify(updated));
      updateInventoryFromPurchase(vendorName.trim(), purchaseItemName, purchaseQty.trim(), purchaseDate, time);
      fetchPurchases();
      alert("同步雲端失敗（已儲存於本機）：" + err.message);
    }

    setPurchaseSelectedTags([]);
    setPurchaseQualityNote('');
    setPurchaseRating(5);

    setPurchaseVendor('');
    setPurchaseQty('');
    setPurchaseCost('');
  };

  // Save / Delete Manual Revenue
  const handleSaveManualRevenue = async (date, amount) => {
    const key = date.length === 7 ? `${date}-01` : date;
    const updated = {
      ...manualRevenues,
      [key]: Number(amount) || 0
    };
    
    // Save locally first
    setManualRevenues(updated);
    localStorage.setItem('restaurant_manual_revenues', JSON.stringify(updated));

    try {
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', 'SYSTEM_SETTING_MANUAL_REVENUE');
      if (exist && exist.length > 0) {
        const { error } = await supabase.from('menu_items').update({
          description: JSON.stringify(updated)
        }).eq('name', 'SYSTEM_SETTING_MANUAL_REVENUE');
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert([{
          name: 'SYSTEM_SETTING_MANUAL_REVENUE',
          description: JSON.stringify(updated),
          price: 0,
          category: 'system',
          image: ''
        }]);
        if (error) throw error;
      }
      alert(`${date} 的手動登錄人工營業額更新成功！`);
      setShowManualRevModal(false);
    } catch (err) {
      alert("同步雲端失敗（已儲存於本機）：" + err.message);
    }
  };

  const handleDeleteManualRevenue = async (date) => {
    if (!window.confirm(`確定要清除 ${date} 的所有手動登錄人工營業額嗎？`)) return;
    const key = date.length === 7 ? `${date}-01` : date;
    const updated = { ...manualRevenues };
    delete updated[key];
    
    // Save locally first
    setManualRevenues(updated);
    localStorage.setItem('restaurant_manual_revenues', JSON.stringify(updated));

    try {
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', 'SYSTEM_SETTING_MANUAL_REVENUE');
      if (exist && exist.length > 0) {
        const { error } = await supabase.from('menu_items').update({
          description: JSON.stringify(updated)
        }).eq('name', 'SYSTEM_SETTING_MANUAL_REVENUE');
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert([{
          name: 'SYSTEM_SETTING_MANUAL_REVENUE',
          description: JSON.stringify(updated),
          price: 0,
          category: 'system',
          image: ''
        }]);
        if (error) throw error;
      }
      alert(`${date} 的手動登錄人工營業額已成功清除！`);
    } catch (err) {
      alert("同步雲端失敗（已於本機清除）：" + err.message);
    }
  };

  // Delete Purchase (Variable Cost)
  const handleDeletePurchase = async (id) => {
    if (!window.confirm('確定要刪除這筆變動成本支出嗎？')) return;

    try {
      const { error } = await supabase.from('purchases').delete().eq('id', id);
      if (error) throw error;
      fetchPurchases();
      alert("已成功從雲端資料庫刪除該筆進貨支出！");
    } catch (err) {
      console.error("Failed to delete purchase in BookkeepingView:", err);
      const updated = purchases.filter(p => p.id !== id);
      setPurchases(updated);
      localStorage.setItem(`${storeCode}_restaurant_purchases`, JSON.stringify(updated));
      fetchPurchases();
    }
  };

  // Add or Edit Fixed Cost
  const handleAddFixedCost = async (e) => {
    e.preventDefault();
    if (!fcName.trim() || !fcCost || !fcExpiry) return;

    const costNum = Number(fcCost);

    if (editingFixedCostId) {
      if (isFixedCostsOnCloud) {
        try {
          const { error } = await supabase.from('fixed_costs').update({
            name: prefixNameForStore(fcName.trim(), storeCode),
            cost: costNum,
            expiry_date: fcExpiry
          }).eq('id', editingFixedCostId);
          if (error) throw error;
          fetchFixedCosts();
        } catch (err) {
          console.error("Failed to update fixed cost in BookkeepingView:", err);
          alert("修改固定成本失敗！");
        }
      } else {
        const updated = fixedCosts.map(fc => fc.id === editingFixedCostId ? {
          ...fc,
          name: fcName.trim(),
          cost: costNum,
          expiryDate: fcExpiry
        } : fc);
        setFixedCosts(updated);
        localStorage.setItem('restaurant_fixed_costs', JSON.stringify(updated));
        fetchFixedCosts();
      }
      setEditingFixedCostId(null);
    } else {
      if (isFixedCostsOnCloud) {
        try {
          const { error } = await supabase.from('fixed_costs').insert([{
            name: prefixNameForStore(fcName.trim(), storeCode),
            cost: costNum,
            expiry_date: fcExpiry
          }]);
          if (error) throw error;
          fetchFixedCosts();
        } catch (err) {
          console.error("Failed to add fixed cost in BookkeepingView:", err);
          alert("新增固定成本失敗！若您尚未在 Supabase 中建立 fixed_costs 資料表，請依指示執行 SQL 建立資料表並關閉 RLS。");
        }
      } else {
        const newFC = {
          id: `FC-${Date.now()}`,
          name: fcName.trim(),
          cost: costNum,
          expiryDate: fcExpiry
        };
        const updated = [newFC, ...fixedCosts];
        setFixedCosts(updated);
        localStorage.setItem('restaurant_fixed_costs', JSON.stringify(updated));
        fetchFixedCosts();
      }
    }

    setFcName('');
    setFcCost('');
    setFcExpiry('');
  };

  // Delete Fixed Cost
  const handleDeleteFixedCost = async (id) => {
    if (!window.confirm('確定要刪除這筆固定成本項目嗎？')) return;

    if (isFixedCostsOnCloud) {
      try {
        const { error } = await supabase.from('fixed_costs').delete().eq('id', id);
        if (error) throw error;
        fetchFixedCosts();
      } catch (err) {
        console.error("Failed to delete fixed cost in BookkeepingView:", err);
        alert("刪除固定成本失敗！");
      }
    } else {
      const updated = fixedCosts.filter(fc => fc.id !== id);
      setFixedCosts(updated);
      localStorage.setItem('restaurant_fixed_costs', JSON.stringify(updated));
      fetchFixedCosts();
    }
  };

  // Re-open store for editing (requires admin code)
  const handleReopenShop = () => {
    if (window.confirm("警告：您確定要重開此日期的帳目嗎？\n重開帳目後，該日流水明細將再次鎖定。")) {
      const pwd = window.prompt("請輸入管理員對帳密碼以重開：");
      if (pwd === '8888') {
        const updated = closedDates.filter(d => d !== selectedBookkeepingDate);
        setClosedDates(updated);
        localStorage.setItem('restaurant_closed_dates', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        updateClosedDatesOnCloud(updated);
        
        // Also update Supabase orders to sync other devices (RLS-friendly update instead of delete)
        supabase.from('orders').select('id, created_at, items')
          .then(({ data }) => {
            if (data) {
              const matched = data.find(o => {
                const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
                if (itemsData?.customerName !== 'SYSTEM_STORE_CLOSE') return false;
                const d = new Date(o.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
                return d === selectedBookkeepingDate;
              });
              if (matched) {
                const itemsData = typeof matched.items === 'string' ? JSON.parse(matched.items) : matched.items;
                itemsData.customerName = 'SYSTEM_STORE_OPEN';
                supabase.from('orders').update({
                  items: itemsData
                }).eq('id', matched.id)
                  .then(({ error }) => {
                    if (error) console.error("Failed to update store close to open in Supabase orders:", error);
                  });
              }
            }
          });

        alert("帳目已成功重開，流水已被鎖定。");
      } else if (pwd !== null) {
        alert("密碼錯誤，重開失敗！");
      }
    }
  };

  // Print Daily Closing Report
  const handlePrintDailyClosingReport = () => {
    const avgOrderVal = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;
    const dailyData = {
      date: selectedBookkeepingDate,
      cashier: '店長 (Admin)',
      totalRevenue,
      cashRevenue,
      onlineRevenue,
      manualRevenue: todayManualRevenue,
      totalOrders: completedOrders.length,
      dineInCount: totalDineIn,
      takeoutCount: totalTakeout,
      avgOrderValue: avgOrderVal,
      topItems: sortedItems
    };

    printDailyClosingReport(dailyData, {
      ...storeProfile,
      storeName: storeName || storeProfile.storeName
    });
  };

  // Export Daily Ledger CSV
  const handleExportCSV = () => {
    if (completedOrders.length === 0) {
      alert('該日無交易明細可供匯出！');
      return;
    }
    
    let csvContent = "\uFEFF";
    csvContent += `${storeName} - 當日交易對帳明細表 (${selectedBookkeepingDate})\n`;
    csvContent += `當日營業總額 (營業額):,NT$ ${totalRevenue},訂單總筆數:,${completedOrders.length} 筆,現金營業額:,NT$ ${cashRevenue},線上營業額:,NT$ ${onlineRevenue}\n\n`;
    csvContent += "時間,流水號,類型,顧客姓名/桌號,實收金額(NT$),付款方式,購買明細\n";
    
    completedOrders.forEach(order => {
      const time = order.time;
      const serial = order.serialNum || order.id.slice(-6);
      const type = order.type === 'dine-in' ? '內用' : '外帶';
      const name = (order.customerName || '').replace(/,/g, ' ');
      const total = order.total;
      const payment = order.paymentMethod === 'online' ? '線上付' : '現金付';
      const itemsStr = (order.items || []).map(item => `${item.name}x${item.quantity}`).join(' | ');
      
      csvContent += `${time},${serial},${type},${name},${total},${payment},"${itemsStr}"\n`;
    });
    
    csvContent += `\n合計,,${completedOrders.length} 筆,,${totalRevenue},,\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${storeName}_當日營業額與對帳明細_${selectedBookkeepingDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Memoized Completed Orders for Selected Viewing Date
  const completedOrders = useMemo(() => {
    return orders.filter(o => {
      const orderDate = new Date(o.timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      return (o.status === 'completed' || o.status === 'received') && orderDate === selectedBookkeepingDate;
    });
  }, [orders, selectedBookkeepingDate]);

  // 2. Memoized Daily Summary & Product BOM Costs
  const { 
    totalRevenue, 
    onlineRevenue, 
    cashRevenue, 
    totalDineIn, 
    totalTakeout, 
    dailyProductCost, 
    dailyGrossProfit, 
    dailyGrossMargin, 
    sortedItems 
  } = useMemo(() => {
    const todayManualRevenue = Number(manualRevenues[selectedBookkeepingDate]) || 0;
    const rev = completedOrders.reduce((sum, o) => sum + o.total, 0) + todayManualRevenue;
    const online = completedOrders
      .filter(o => o.paymentMethod === 'online')
      .reduce((sum, o) => sum + o.total, 0);
    const cash = rev - online;

    const dineIn = completedOrders.filter(o => o.type === 'dine-in').length;
    const takeout = completedOrders.length - dineIn;

    const prodCost = completedOrders.reduce((totalCost, order) => {
      const orderItems = Array.isArray(order.items) ? order.items : [];
      const orderCost = orderItems.reduce((sub, item) => sub + calculateItemCost(item), 0);
      return totalCost + orderCost;
    }, 0);

    const gross = rev - prodCost;
    const margin = rev > 0 ? ((gross / rev) * 100) : 0;

    const itemCounts = {};
    completedOrders.forEach(o => {
      (o.items || []).forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      });
    });
    const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);

    return {
      totalRevenue: rev,
      onlineRevenue: online,
      cashRevenue: cash,
      totalDineIn: dineIn,
      totalTakeout: takeout,
      dailyProductCost: prodCost,
      dailyGrossProfit: gross,
      dailyGrossMargin: margin,
      sortedItems: sorted
    };
  }, [completedOrders, manualRevenues, selectedBookkeepingDate]);

  // 3. Memoized Purchases for Selected Date & Range
  const purchasesForDate = useMemo(() => {
    return purchases.filter(p => p.date === selectedBookkeepingDate);
  }, [purchases, selectedBookkeepingDate]);

  const totalPurchasesCost = useMemo(() => {
    return purchasesForDate.reduce((sum, p) => sum + p.cost, 0);
  }, [purchasesForDate]);

  const purchasesForSelectedRange = useMemo(() => {
    if (variableCostRange === 'day') {
      return purchases.filter(p => p.date === selectedBookkeepingDate);
    }
    if (variableCostRange === 'week') {
      const current = new Date(selectedBookkeepingDate);
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(current.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const start = monday.toLocaleDateString('sv-SE');
      const end = sunday.toLocaleDateString('sv-SE');
      return purchases.filter(p => p.date >= start && p.date <= end);
    }
    if (variableCostRange === 'month') {
      const monthPrefix = selectedBookkeepingDate.slice(0, 7);
      return purchases.filter(p => p.date.startsWith(monthPrefix));
    }
    return purchases;
  }, [purchases, variableCostRange, selectedBookkeepingDate]);

  const totalPurchasesCostForSelectedRange = useMemo(() => {
    return purchasesForSelectedRange.reduce((sum, p) => sum + p.cost, 0);
  }, [purchasesForSelectedRange]);

  // Selected Year Month (YYYY-MM)
  const selectedYearMonth = selectedBookkeepingDate ? selectedBookkeepingDate.slice(0, 7) : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 7);

  // 4. Memoized Active Fixed Costs
  const { activeFixedCostsForMonth, totalFixedCostsForMonth, dailyFixedCostShare } = useMemo(() => {
    const active = fixedCosts.filter(fc => {
      if (!fc.expiryDate) return true;
      return fc.expiryDate.slice(0, 7) >= selectedYearMonth;
    });
    const total = active.reduce((sum, fc) => sum + (Number(fc.cost) || 0), 0);
    return {
      activeFixedCostsForMonth: active,
      totalFixedCostsForMonth: total,
      dailyFixedCostShare: Math.round(total / 30)
    };
  }, [fixedCosts, selectedYearMonth]);

  // Estimated net profit
  const estimatedNetProfit = totalRevenue - totalPurchasesCost;
  const isClosedToday = closedDates.includes(selectedBookkeepingDate);

  // 5. Blazing-fast O(N) Memoized Monthly Reports (Eliminates render-loop freezing on keystrokes)
  const monthlyReports = useMemo(() => {
    const ordersByDate = {};
    orders.forEach(o => {
      if (o.status === 'completed' || o.status === 'received') {
        const orderDate = new Date(o.timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
        if (!ordersByDate[orderDate]) ordersByDate[orderDate] = [];
        ordersByDate[orderDate].push(o);
      }
    });

    const purchasesByDate = {};
    purchases.forEach(p => {
      if (p.date) {
        if (!purchasesByDate[p.date]) purchasesByDate[p.date] = 0;
        purchasesByDate[p.date] += (Number(p.cost) || 0);
      }
    });

    const datesSet = new Set(closedDates);
    Object.keys(ordersByDate).forEach(d => datesSet.add(d));
    purchases.forEach(p => { if (p.date) datesSet.add(p.date); });
    Object.keys(manualRevenues).forEach(d => {
      if (Number(manualRevenues[d]) > 0) datesSet.add(d);
    });

    const days = Array.from(datesSet).sort((a, b) => b.localeCompare(a));

    return days.map(day => {
      const dayOrders = ordersByDate[day] || [];
      const dayManual = Number(manualRevenues[day]) || 0;
      const systemRevenue = dayOrders.reduce((sum, o) => sum + o.total, 0);
      const totalRevenue = systemRevenue + dayManual;
      const variableCosts = purchasesByDate[day] || 0;

      const month = day.slice(0, 7);
      const activeFixed = fixedCosts.filter(fc => fc.expiryDate.slice(0, 7) >= month);
      const totalFixed = activeFixed.reduce((sum, fc) => sum + fc.cost, 0);
      const fixedShare = Math.round(totalFixed / 30);

      return {
        month: day,
        date: day,
        isClosed: closedDates.includes(day),
        orderCount: dayOrders.length,
        systemRevenue,
        manualRev: dayManual,
        revenue: totalRevenue,
        variableCosts,
        fixedCosts: fixedShare
      };
    }).filter(r => r.revenue > 0); // 自動過濾：營業額為 0 的天數不列入按月財務報表
  }, [orders, purchases, manualRevenues, fixedCosts, closedDates]);

  const handleHomeClick = () => {
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo');
    if (demo === 'true') {
      onBackToDemo();
    } else {
      window.location.href = '/?bookkeeping=true';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-body)',
      color: 'var(--text-main)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>📊</span>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0 }}>{storeName || '龍城麵線'} 營業記帳與財務系統</h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>財務支出、營業流水與對帳管理面板</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Global Date Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>對帳日期:</span>
            <input 
              type="date" 
              value={selectedBookkeepingDate} 
              onChange={(e) => setSelectedBookkeepingDate(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-body)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            />
          </div>
          {/* LINE 密鑰設定按鈕 (暫時隱藏) */}
          {/* <button 
            onClick={() => setShowLineSettingsModal(true)} 
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: '1px solid #06c755',
              backgroundColor: 'rgba(6, 199, 85, 0.05)',
              color: '#06c755',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            💬 LINE 密鑰設定
          </button> */}
          <button 
            onClick={onLogout} 
            style={{
              padding: '6px 14px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-body)',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🚪 登出 / 切換系統
          </button>
        </div>
      </header>

        <main style={{
          flex: 1,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Unlocked Financial Metrics Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow-sm)' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>📈 財務管道統計</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>💵 現金實收:</span>
                  <strong style={{ marginLeft: 'auto' }}>NT$ {cashRevenue}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>💳 線上已付:</span>
                  <strong style={{ marginLeft: 'auto' }}>NT$ {onlineRevenue}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                  <span>當日營業額:</span>
                  <strong style={{ marginLeft: 'auto', color: 'var(--primary)' }}>NT$ {totalRevenue}</strong>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow-sm)' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>🛍️ 點餐管道比例</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🍽️ 內用就座:</span>
                  <strong style={{ marginLeft: 'auto' }}>{totalDineIn} 筆 ({completedOrders.length ? Math.round(totalDineIn/completedOrders.length*100) : 0}%)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🛍️ 線上外帶:</span>
                  <strong style={{ marginLeft: 'auto' }}>{totalTakeout} 筆 ({completedOrders.length ? Math.round(totalTakeout/completedOrders.length*100) : 0}%)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                  <span>結案總訂單:</span>
                  <strong style={{ marginLeft: 'auto' }}>{completedOrders.length} 筆</strong>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow-sm)' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>🔥 當日銷售排行</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', maxHeight: '72px', overflowY: 'auto' }}>
                {sortedItems.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>暫無銷售數據</span>
                ) : (
                  sortedItems.map(([name, qty]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{name}:</span>
                      <strong style={{ marginLeft: 'auto' }}>{qty} 份</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow-sm)' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px' }}>💰 當日營業額與毛利試算</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>📈 當日營業額:</span>
                  <strong style={{ marginLeft: 'auto', color: 'var(--primary)' }}>NT$ {totalRevenue}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🥩 餐點食材成本:</span>
                  <strong style={{ marginLeft: 'auto', color: '#ef4444' }}>-NT$ {dailyProductCost}</strong>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  borderTop: '1px dashed var(--border)', 
                  paddingTop: '6px', 
                  marginTop: '4px',
                  color: dailyGrossProfit >= 0 ? '#16a34a' : '#dc2626'
                }}>
                  <span>🥗 預估營業毛利:</span>
                  <strong style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: '800' }}>
                    NT$ {dailyGrossProfit} <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>({dailyGrossMargin.toFixed(1)}%)</span>
                  </strong>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', textAlign: 'right' }}>
                  * 進貨採購與固定成本統一於月報表中結算
                </div>
              </div>
            </div>
          </div>

          {/* Sub-view navigation tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('sales')} 
              style={{
                padding: '10px 20px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                border: 'none',
                borderBottom: activeTab === 'sales' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'sales' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              📋 當日交易流水
            </button>
            <button 
              onClick={() => setActiveTab('variable')} 
              style={{
                padding: '10px 20px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                border: 'none',
                borderBottom: activeTab === 'variable' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'variable' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              🛒 變動成本 (進貨採購)
            </button>
            <button 
              onClick={() => setActiveTab('fixed')} 
              style={{
                padding: '10px 20px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                border: 'none',
                borderBottom: activeTab === 'fixed' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'fixed' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              🏢 固定成本 (月租折舊)
            </button>
            <button 
              onClick={() => setActiveTab('monthly')} 
              style={{
                padding: '10px 20px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                border: 'none',
                borderBottom: activeTab === 'monthly' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'monthly' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              📅 按月財務報表
            </button>
            <button 
              onClick={() => setActiveTab('inventory')} 
              style={{
                padding: '10px 20px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                border: 'none',
                borderBottom: activeTab === 'inventory' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'inventory' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              📦 倉儲物料庫存
            </button>
            <button 
              onClick={() => setActiveTab('supply')} 
              style={{
                padding: '10px 20px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                border: 'none',
                borderBottom: activeTab === 'supply' ? '3px solid var(--primary)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === 'supply' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              🌿 前台佐料與沽清管理
            </button>
          </div>

          {/* TAB CONTENTS */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            
            {/* 1. SALES TAB */}
            {activeTab === 'sales' && (
              <div>
                {/* Daily Cash Audit Quick Status Card */}
                {(() => {
                  const selectedAudit = cashAudits.find(a => a.date === selectedBookkeepingDate);
                  return (
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: selectedAudit ? (selectedAudit.difference === 0 ? 'rgba(16, 185, 129, 0.08)' : (selectedAudit.difference > 0 ? 'rgba(59, 130, 246, 0.08)' : 'rgba(239, 68, 68, 0.08)')) : 'rgba(234, 88, 12, 0.08)',
                      border: selectedAudit ? (selectedAudit.difference === 0 ? '1px solid #10b981' : (selectedAudit.difference > 0 ? '1px solid #3b82f6' : '1px solid #ef4444')) : '1px dashed #ea580c',
                      marginBottom: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <span>💰</span>
                        <strong style={{ color: 'var(--text-main)' }}>當日實收現金盤點：</strong>
                        {selectedAudit ? (
                          <span>
                            實收 <strong style={{ color: '#059669' }}>NT$ {selectedAudit.netActualCash.toLocaleString()}</strong> / 系統現金 NT$ {selectedAudit.systemCashRevenue.toLocaleString()}
                            <span style={{
                              marginLeft: '8px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '0.75rem',
                              backgroundColor: selectedAudit.difference === 0 ? '#10b981' : (selectedAudit.difference > 0 ? '#2563eb' : '#ef4444'),
                              color: 'white'
                            }}>
                              {selectedAudit.difference === 0 ? '✓ 帳實相符' : (selectedAudit.difference > 0 ? `+NT$ ${selectedAudit.difference.toLocaleString()} (溢收)` : `-NT$ ${Math.abs(selectedAudit.difference).toLocaleString()} (短少)`)}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#ea580c', fontWeight: 'bold' }}>
                            ⚠️ 該日尚未輸入實收現金盤點
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenCashAuditModal(selectedBookkeepingDate)}
                        style={{
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          borderRadius: '6px',
                          border: selectedAudit ? '1px solid var(--border)' : 'none',
                          backgroundColor: selectedAudit ? 'var(--bg-card)' : '#10b981',
                          color: selectedAudit ? 'var(--text-main)' : 'white',
                          boxShadow: selectedAudit ? 'none' : '0 2px 4px rgba(16, 185, 129, 0.3)',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        {selectedAudit ? '✏️ 重新盤點' : '💵 立即盤點該日現金'}
                      </button>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: 0 }}>📝 當日已結交易流水帳明細</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {receiptConfig.enableDailyClosingPrint !== false && (
                      <button
                        type="button"
                        onClick={handlePrintDailyClosingReport}
                        title="列印該日之熱感應日結對帳小票"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #3b82f6',
                          color: '#2563eb',
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        🖨️ 列印日結對帳小票
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>時間</th>
                        <th style={{ padding: '10px 12px' }}>流水號</th>
                        <th style={{ padding: '10px 12px' }}>類型</th>
                        <th style={{ padding: '10px 12px' }}>顧客/桌號</th>
                        <th style={{ padding: '10px 12px' }}>實收金額</th>
                        <th style={{ padding: '10px 12px' }}>付款方式</th>
                        <th style={{ padding: '10px 12px' }}>明細/備註</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedOrders.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>該日無已結交易流水記錄</td>
                        </tr>
                      ) : (
                        completedOrders.map(order => (
                          <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 12px' }}>{order.time}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--primary)' }}>{order.serialNum || order.id.slice(-6)}</td>
                            <td style={{ padding: '10px 12px' }}>{order.type === 'dine-in' ? '🍽️ 內用' : '🛍️ 外帶'}</td>
                            <td style={{ padding: '10px 12px' }}>{order.customerName}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>NT$ {order.total}</td>
                            <td style={{ padding: '10px 12px' }}>{order.paymentMethod === 'online' ? '💳 線上付' : '💵 現金付'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {order.items.map((item, idx) => {
                                  let sizeLabel = '';
                                  const specs = Array.isArray(item.specs) ? item.specs : (typeof item.specs === 'string' ? [item.specs] : []);
                                  
                                  const sizeSpec = specs.find(s => {
                                    const str = typeof s === 'object' && s ? (s.value || s.name || '') : String(s);
                                    return str.includes('大碗') || str.includes('小碗');
                                  });
                                  if (sizeSpec) {
                                    const val = typeof sizeSpec === 'object' && sizeSpec ? (sizeSpec.value || sizeSpec.name || '') : String(sizeSpec);
                                    if (val.includes('大碗') || val.includes('大')) sizeLabel = ' (大碗)';
                                    else if (val.includes('小碗') || val.includes('小')) sizeLabel = ' (小碗)';
                                  } else if (item.name.includes('大碗') || item.name.includes('(大)')) {
                                    sizeLabel = '';
                                  }

                                  const addonSpecs = specs.filter(s => {
                                    const str = typeof s === 'object' && s ? (s.value || s.name || '') : String(s);
                                    return str.includes('加料') || str.includes('皮蛋') || str.includes('貢丸') || str.includes('蚵仔') || str.includes('雙腸') || str.includes('豬肚') || str.includes('花枝羹') || str.includes('肉羹');
                                  }).map(s => {
                                    const str = typeof s === 'object' && s ? (s.value || s.name || '') : String(s);
                                    return str.replace(/^加料:\s*/, '').trim();
                                  });

                                  const otherSpecs = specs.filter(s => {
                                    const str = typeof s === 'object' && s ? (s.value || s.name || '') : String(s);
                                    const isSize = str.includes('大碗') || str.includes('小碗') || str.includes('份量');
                                    const isAddon = str.includes('加料') || str.includes('皮蛋') || str.includes('貢丸') || str.includes('蚵仔') || str.includes('雙腸') || str.includes('豬肚') || str.includes('花枝羹') || str.includes('肉羹');
                                    return !isSize && !isAddon;
                                  }).map(s => typeof s === 'object' && s ? (s.value || s.name || '') : String(s));

                                  return (
                                    <div key={idx} style={{ lineHeight: '1.4' }}>
                                      <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                                        {item.name}{sizeLabel} x {item.quantity}
                                      </span>
                                      {addonSpecs.length > 0 && (
                                        <div style={{ color: '#d97706', fontSize: '0.7rem', paddingLeft: '6px', fontWeight: 'bold' }}>
                                          └ +加料: {addonSpecs.join(', ')}
                                        </div>
                                      )}
                                      {otherSpecs.length > 0 && (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', paddingLeft: '6px' }}>
                                          └ 備註: {otherSpecs.join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {order.remarks && <div style={{ color: 'var(--primary)', fontStyle: 'italic', marginTop: '3px' }}>※ {order.remarks}</div>}
                              <div style={{ color: '#16a34a', fontWeight: 'bold', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                👤 經手收銀: {order.cashier || '店長 (Admin)'}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button 
                                onClick={() => handleOpenEditBookkeepingOrderModal(order)}
                                style={{ padding: '4px 8px', fontSize: '0.7rem', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                ✏️ 編輯
                              </button>
                              <button 
                                onClick={() => handleDeleteBookkeepingOrder(order.id, order.remarks)}
                                style={{ padding: '4px 8px', fontSize: '0.7rem', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                🗑️ 刪除
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>

                  </table>
                </div>
              </div>
            )}

            {/* 2. VARIABLE COSTS (PURCHASES) */}
            {activeTab === 'variable' && (
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '14px' }}>🛒 變動成本 - 食材與採購支出流水帳</h4>
                
                {/* Add Purchase Form */}
                <form onSubmit={handleAddPurchase} style={{
                  backgroundColor: 'var(--bg-body)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'flex-end'
                }}>
                  <div style={{ flex: '1 1 130px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>支出日期</label>
                    <input 
                      type="date" 
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                  </div>

                  <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>進貨廠商</label>
                    <select 
                      value={selectedVendorId} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'manage-vendors') {
                          setShowVendorModal(true);
                        } else {
                          setSelectedVendorId(val);
                          setSelectedVendorItemIndex('0');
                        }
                      }}
                      style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', height: '33px', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', fontWeight: 'bold' }}
                    >
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>🏢 {v.name}</option>
                      ))}
                      <option value="manage-vendors">⚙️ 管理/新增廠商...</option>
                    </select>
                  </div>

                  <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>進貨品項</label>
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                      <select 
                        value={selectedVendorItemIndex} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedVendorItemIndex(val);
                          if (val === 'custom') {
                            setPurchaseItemName(customItemName);
                          }
                        }}
                        style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', height: '33px', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                      >
                        {selectedVendorId && selectedVendorId !== 'manage-vendors' && 
                          (vendors.find(v => v.id === selectedVendorId)?.items || []).map((item, idx) => (
                            <option key={idx} value={String(idx)}>{item.name}</option>
                          ))
                        }
                        <option value="custom">✏️ 其他品項 (手動輸入)</option>
                      </select>
                      {selectedVendorItemIndex === 'custom' && (
                        <input 
                          type="text" 
                          placeholder="手動輸入品項" 
                          required
                          value={customItemName}
                          onChange={(e) => {
                            setCustomItemName(e.target.value);
                            setPurchaseItemName(e.target.value);
                          }}
                          style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                        />
                      )}
                    </div>
                  </div>

                  <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>數量 / 重量</label>
                    <input 
                      list="qty-options"
                      type="text" 
                      placeholder="例如: 10斤" 
                      required
                      value={purchaseQty}
                      onChange={(e) => setPurchaseQty(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                    <datalist id="qty-options">
                      <option value="5斤" />
                      <option value="10斤" />
                      <option value="50斤" />
                    </datalist>
                  </div>

                  <div style={{ flex: '1 1 100px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>支出金額 (NT$)</label>
                    <input 
                      type="number" 
                      placeholder="金額" 
                      required
                      min="0"
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                  </div>

                  <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>付款狀態</label>
                    <select 
                      value={purchaseStatus} 
                      onChange={(e) => setPurchaseStatus(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', height: '33px', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    >
                      <option value="paid">🟢 已付款</option>
                      <option value="unpaid">🔴 賒帳/未付</option>
                    </select>
                  </div>

                  {/* ⭐ Vendor Rating & Customizable Tags Section */}
                  <div style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          ⭐ 供應商進貨品質評分：
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setPurchaseRating(star)}
                              style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.3rem',
                                cursor: 'pointer',
                                padding: '0 2px',
                                color: star <= purchaseRating ? '#f59e0b' : '#64748b',
                                transition: 'transform 0.1s ease'
                              }}
                              title={`${star} 星評分`}
                            >
                              ★
                            </button>
                          ))}
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f59e0b', marginLeft: '6px' }}>
                            {purchaseRating} 星 ({purchaseRating >= 4.5 ? '極佳' : (purchaseRating >= 3 ? '良好' : '需注意')})
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowTagManagerModal(true)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-body)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ⚙️ 自訂/管理評鑑標籤
                      </button>
                    </div>

                    {/* Clickable Tag Selector */}
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        點選品質與服務標籤 (可複選)：
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {vendorEvalTags.map(tag => {
                          const isSelected = purchaseSelectedTags.includes(tag.name);
                          return (
                            <button
                              key={tag.id || tag.name}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setPurchaseSelectedTags(purchaseSelectedTags.filter(t => t !== tag.name));
                                } else {
                                  setPurchaseSelectedTags([...purchaseSelectedTags, tag.name]);
                                }
                              }}
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.78rem',
                                borderRadius: '16px',
                                border: isSelected ? (tag.isGood ? '1px solid #16a34a' : '1px solid #dc2626') : '1px solid var(--border)',
                                backgroundColor: isSelected ? (tag.isGood ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)') : 'var(--bg-body)',
                                color: isSelected ? (tag.isGood ? '#16a34a' : '#dc2626') : 'var(--text-main)',
                                cursor: 'pointer',
                                fontWeight: isSelected ? '900' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {tag.name} {isSelected ? '✓' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quality / Waste Note */}
                    <div>
                      <input
                        type="text"
                        value={purchaseQualityNote}
                        onChange={(e) => setPurchaseQualityNote(e.target.value)}
                        placeholder="📝 品質/甜度/損耗備註 (例: 甜度15度、無黑點，或 底部輕微壓傷損耗5%)"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-body)',
                          color: 'var(--text-main)'
                        }}
                      />
                    </div>
                  </div>

                  <button type="submit" style={{ padding: '10px 20px', fontSize: '0.9rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '900', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)', width: '100%', marginTop: '4px' }}>
                    ➕ 登錄進貨與評鑑紀錄
                  </button>
                </form>


                {/* 🏆 Vendor Scorecard & Rating Overview (供應商評鑑排行榜與品質看板) */}
                <div style={{
                  backgroundColor: 'var(--bg-body)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🏆 供應商評鑑排行榜與品質績效看板 ({vendors.length} 家廠商)
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVendorScorecard(!showVendorScorecard)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {showVendorScorecard ? '收起看板 ▴' : '展開看板 ▾'}
                    </button>
                  </div>

                  {showVendorScorecard && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                      {vendors.map(v => {
                        const vendorPurchases = purchases.filter(p => p.vendor === v.name);
                        const ratedPurchases = vendorPurchases.filter(p => p.rating > 0);
                        const totalSpent = vendorPurchases.reduce((sum, p) => sum + (Number(p.cost) || 0), 0);
                        const avgRating = ratedPurchases.length > 0
                          ? (ratedPurchases.reduce((sum, p) => sum + p.rating, 0) / ratedPurchases.length).toFixed(1)
                          : '5.0';
                        const avgNum = parseFloat(avgRating);

                        // Tag count
                        const tagMap = {};
                        vendorPurchases.forEach(p => {
                          const tList = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : []);
                          tList.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; });
                        });

                        const tierBadge = avgNum >= 4.5
                          ? { label: '🏆 金牌優質', bg: 'rgba(22, 163, 74, 0.15)', color: '#16a34a' }
                          : (avgNum >= 3.5
                            ? { label: '🟢 穩定配合', bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' }
                            : { label: '⚠️ 待觀察/常有損耗', bg: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' });

                        return (
                          <div key={v.id} style={{
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{v.name}</strong>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: '900',
                                backgroundColor: tierBadge.bg,
                                color: tierBadge.color
                              }}>
                                {tierBadge.label}
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span>
                                平均評分：<strong style={{ color: '#f59e0b', fontSize: '0.95rem' }}>★ {avgRating}</strong> ({ratedPurchases.length} 筆評鑑)
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                累計進貨：<strong>NT$ {totalSpent.toLocaleString()}</strong> ({vendorPurchases.length} 次)
                              </span>
                            </div>

                            {/* Tag Badges Cloud */}
                            {Object.keys(tagMap).length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                {Object.entries(tagMap).map(([tagName, count]) => (
                                  <span key={tagName} style={{
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    fontSize: '0.7rem',
                                    backgroundColor: 'var(--bg-body)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-muted)'
                                  }}>
                                    {tagName} <strong style={{ color: 'var(--primary)' }}>x{count}</strong>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>暫無標籤紀錄</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Purchase List Table */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>📅 檢視區間:</span>
                    <select 
                      value={variableCostRange}
                      onChange={(e) => setVariableCostRange(e.target.value)}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    >
                      <option value="day">單日紀錄</option>
                      <option value="week">當週紀錄 (週一至週日)</option>
                      <option value="month">當月紀錄</option>
                      <option value="all">全部紀錄</option>
                    </select>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    區間支出總計: NT$ {totalPurchasesCostForSelectedRange}
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>進貨日期</th>
                        <th style={{ padding: '10px 12px' }}>進貨廠商</th>
                        <th style={{ padding: '10px 12px' }}>品項</th>
                        <th style={{ padding: '10px 12px' }}>數量/重量</th>
                        <th style={{ padding: '10px 12px' }}>金額</th>
                        <th style={{ padding: '10px 12px' }}>品質評鑑與標籤</th>
                        <th style={{ padding: '10px 12px' }}>付款狀態</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchasesForSelectedRange.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>此區間無變動進貨支出紀錄</td>
                        </tr>
                      ) : (
                        purchasesForSelectedRange.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 12px' }}>{p.date}</td>
                            <td style={{ padding: '10px 12px' }}>{p.vendor}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{p.itemName}</td>
                            <td style={{ padding: '10px 12px' }}>{p.quantity}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ef4444' }}>NT$ {p.cost}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {p.rating ? (
                                  <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                    {'★'.repeat(p.rating)}{'☆'.repeat(Math.max(0, 5 - p.rating))}
                                  </span>
                                ) : null}
                                {(() => {
                                  const tagList = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags || '[]') : []);
                                  return tagList.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                      {tagList.map((t, idx) => (
                                        <span key={idx} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null;
                                })()}
                                {(p.qualityNote || p.quality_note) && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    📝 {p.qualityNote || p.quality_note}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                backgroundColor: p.status === 'paid' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                color: p.status === 'paid' ? '#16a34a' : '#ef4444'
                              }}>
                                {p.status === 'paid' ? '已付款' : '未付款'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <button 
                                onClick={() => handleDeletePurchase(p.id)}
                                style={{ padding: '4px 8px', fontSize: '0.7rem', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                🗑️ 刪除
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. FIXED COSTS TAB */}
            {activeTab === 'fixed' && (
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '14px' }}>🏢 固定成本 - 店面租金與固定開銷維護</h4>
                
                {/* Add Fixed Cost Form */}
                <form id="fixed-cost-form" onSubmit={handleAddFixedCost} style={{
                  backgroundColor: 'var(--bg-body)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'flex-end'
                }}>
                  <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>固定項目名稱</label>
                    <input 
                      type="text" 
                      placeholder="例如: 店面月租金、員工固定底薪" 
                      required
                      value={fcName}
                      onChange={(e) => setFcName(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                  </div>

                  <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>每月固定額度 (NT$)</label>
                    <input 
                      type="number" 
                      placeholder="金額" 
                      required
                      min="0"
                      value={fcCost}
                      onChange={(e) => setFcCost(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                  </div>

                  <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>有效到期期限</label>
                    <input 
                      type="date" 
                      required
                      value={fcExpiry}
                      onChange={(e) => setFcExpiry(e.target.value)}
                      style={{ padding: '5px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', height: '33px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', height: '33px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {editingFixedCostId ? '💾 儲存修改' : '➕ 登錄項目'}
                    </button>
                    {editingFixedCostId && (
                      <button 
                        type="button" 
                        onClick={handleCancelEditFixedCost}
                        style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', height: '33px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        ❌ 取消
                      </button>
                    )}
                  </div>
                </form>

                {/* Fixed Costs List */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>項目</th>
                        <th style={{ padding: '10px 12px' }}>每月固定支出</th>
                        <th style={{ padding: '10px 12px' }}>折合每日攤銷 (30天)</th>
                        <th style={{ padding: '10px 12px' }}>有效期限截止日</th>
                        <th style={{ padding: '10px 12px' }}>狀態</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixedCosts.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>目前無登錄的固定成本項目</td>
                        </tr>
                      ) : (
                        fixedCosts.map(fc => {
                          const expiryYM = fc.expiryDate ? fc.expiryDate.slice(0, 7) : '';
                          const isExpired = expiryYM ? expiryYM < selectedYearMonth : false;
                          return (
                            <tr key={fc.id} style={{ borderBottom: '1px solid var(--border)', opacity: isExpired ? 0.5 : 1 }}>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{fc.name}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ef4444' }}>NT$ {fc.cost}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>NT$ {Math.round((Number(fc.cost) || 0) / 30)} / 天</td>
                              <td style={{ padding: '10px 12px' }}>{fc.expiryDate || '無'}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: '600',
                                  backgroundColor: isExpired ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                  color: isExpired ? '#ef4444' : '#16a34a'
                                }}>
                                  {isExpired ? '已過期 (不計入)' : '生效中'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button 
                                  onClick={() => handleEditFixedCostClick(fc)}
                                  style={{ padding: '4px 8px', fontSize: '0.7rem', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  ✏️ 編輯
                                </button>
                                <button 
                                  onClick={() => handleDeleteFixedCost(fc.id)}
                                  style={{ padding: '4px 8px', fontSize: '0.7rem', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  🗑️ 刪除
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. MONTHLY FINANCIAL REPORTS */}
            {activeTab === 'monthly' && (() => {
              const range = getReportDateRange();
              const targetReports = monthlyReports.filter(r => r.month >= range.start && r.month <= range.end);
              const availableMonths = Array.from(new Set(monthlyReports.map(r => r.month.slice(0, 7)))).sort((a, b) => b.localeCompare(a));
              
              // Weekday vs Weekend Analytics
              let weekdayRev = 0, weekdayOrdersCount = 0, weekdayDaysCount = 0;
              let weekendRev = 0, weekendOrdersCount = 0, weekendDaysCount = 0;
              const dowStats = [
                { name: '週一', rev: 0, orders: 0, days: 0 },
                { name: '週二', rev: 0, orders: 0, days: 0 },
                { name: '週三', rev: 0, orders: 0, days: 0 },
                { name: '週四', rev: 0, orders: 0, days: 0 },
                { name: '週五', rev: 0, orders: 0, days: 0 },
                { name: '週六', rev: 0, orders: 0, days: 0 },
                { name: '週日', rev: 0, orders: 0, days: 0 }
              ];

              targetReports.forEach(r => {
                const dateObj = new Date(r.month + 'T00:00:00');
                const rawDay = dateObj.getDay(); // 0 is Sunday, 1-6 is Mon-Sat
                const dowIndex = (rawDay + 6) % 7; // Convert 0-6 to Mon=0, Sun=6
                const rev = Number(r.revenue) || 0;
                const ord = Number(r.orderCount) || 0;
                const isActualOpenDay = rev > 0 || ord > 0;

                if (isActualOpenDay) {
                  dowStats[dowIndex].rev += rev;
                  dowStats[dowIndex].orders += ord;
                  dowStats[dowIndex].days += 1; // 僅統計實際有開門營業的天數

                  if (rawDay === 0 || rawDay === 6) {
                    weekendRev += rev;
                    weekendOrdersCount += ord;
                    weekendDaysCount += 1; // 僅統計實際有開門的假日本數
                  } else {
                    weekdayRev += rev;
                    weekdayOrdersCount += ord;
                    weekdayDaysCount += 1; // 僅統計實際有開門的平日天數
                  }
                }
              });

              const weekdayAvgDaily = weekdayDaysCount > 0 ? Math.round(weekdayRev / weekdayDaysCount) : 0;
              const weekdayAvgTicket = weekdayOrdersCount > 0 ? Math.round(weekdayRev / weekdayOrdersCount) : 0;
              const weekendAvgDaily = weekendDaysCount > 0 ? Math.round(weekendRev / weekendDaysCount) : 0;
              const weekendAvgTicket = weekendOrdersCount > 0 ? Math.round(weekendRev / weekendOrdersCount) : 0;

              const totalPeriodRev = weekdayRev + weekendRev;
              const weekdayPercent = totalPeriodRev > 0 ? Math.round((weekdayRev / totalPeriodRev) * 100) : 0;
              const weekendPercent = totalPeriodRev > 0 ? (100 - weekdayPercent) : 0;

              // 🏆 Total Financial Summary for Selected Period (以完整月份金額計算總固定成本)
              let totalSystemRev = 0;
              let totalManualRev = 0;
              let totalPeriodVariable = 0;

              targetReports.forEach(r => {
                totalSystemRev += (Number(r.systemRevenue) || 0);
                totalManualRev += (Number(r.manualRev) || 0);
                totalPeriodVariable += (Number(r.variableCosts) || 0);
              });

              // 依所選期間涵蓋之完整月份計算總固定成本 (不採每日零碎攤銷，以完整月份額度結算)
              const uniqueReportMonths = Array.from(new Set(targetReports.map(r => r.month.slice(0, 7))));
              let totalPeriodFixed = 0;
              if (uniqueReportMonths.length > 0) {
                uniqueReportMonths.forEach(m => {
                  const activeFixed = fixedCosts.filter(fc => !fc.expiryDate || fc.expiryDate.slice(0, 7) >= m);
                  totalPeriodFixed += activeFixed.reduce((sum, fc) => sum + (Number(fc.cost) || 0), 0);
                });
              } else {
                const currentYM = selectedYearMonth;
                const activeFixed = fixedCosts.filter(fc => !fc.expiryDate || fc.expiryDate.slice(0, 7) >= currentYM);
                totalPeriodFixed = activeFixed.reduce((sum, fc) => sum + (Number(fc.cost) || 0), 0);
              }

              const totalPeriodCost = totalPeriodFixed + totalPeriodVariable;
              const totalPeriodGrossProfit = totalPeriodRev - totalPeriodVariable;
              const totalPeriodNetProfit = totalPeriodRev - totalPeriodCost;
              const isPeriodNetProfit = totalPeriodNetProfit >= 0;
              const netProfitMargin = totalPeriodRev > 0 ? ((totalPeriodNetProfit / totalPeriodRev) * 100).toFixed(1) : '0.0';
              const costRatio = totalPeriodRev > 0 ? ((totalPeriodCost / totalPeriodRev) * 100).toFixed(1) : '0.0';


              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: 0 }}>📅 財務損益分析報表</h4>
                      
                      {/* Range Presets Selector */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {[
                          { key: '30days', label: '⏱️ 近30天' },
                          { key: 'thisMonth', label: '🗓️ 本月' },
                          { key: 'lastMonth', label: '📅 上個月' },
                          { key: '6months', label: '📊 近半年' },
                          { key: '1year', label: '📈 近一年' },
                          { key: 'all', label: '🌐 全部歷史' },
                          { key: 'custom', label: '✏️ 自訂區間' }
                        ].map(preset => (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setReportRangeType(preset.key)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              border: reportRangeType === preset.key ? '1px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: reportRangeType === preset.key ? 'var(--primary)' : 'var(--bg-card)',
                              color: reportRangeType === preset.key ? 'white' : 'var(--text-main)',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom Date Picker */}
                      {reportRangeType === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--primary)' }}>
                          <input 
                            type="date" 
                            value={reportCustomStartDate} 
                            onChange={(e) => setReportCustomStartDate(e.target.value)} 
                            style={{ padding: '2px 4px', fontSize: '0.75rem', border: 'none', backgroundColor: 'transparent', color: 'var(--text-main)', fontWeight: 'bold', outline: 'none' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>~</span>
                          <input 
                            type="date" 
                            value={reportCustomEndDate} 
                            onChange={(e) => setReportCustomEndDate(e.target.value)} 
                            style={{ padding: '2px 4px', fontSize: '0.75rem', border: 'none', backgroundColor: 'transparent', color: 'var(--text-main)', fontWeight: 'bold', outline: 'none' }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => {
                          setManualRevDate(getTodayLocalDate());
                          setManualRevAmount('');
                          setShowManualRevModal(true);
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        ✍️ 登錄手動營業額
                      </button>

                      <button 
                        onClick={handleExportMonthlyCSV}
                        style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        📊 開啟按月財務分析報告 (新分頁展報)
                      </button>
                    </div>
                  </div>

                  {/* 🏆 Executive KPI Summary Cards - Total Estimated Monthly Net Profit & Breakdown */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '14px',
                    marginBottom: '20px'
                  }}>
                    {/* 1. 營業總收入 */}
                    <div style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        💰 營業總收入 ({targetReports.length} 天)
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#16a34a' }}>
                        NT$ {totalPeriodRev.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        系統: {totalSystemRev.toLocaleString()} | 人工: {totalManualRev.toLocaleString()}
                      </div>
                    </div>

                    {/* 2. 固定成本支出 */}
                    <div style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        🏢 總固定成本支出
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#ef4444' }}>
                        NT$ {totalPeriodFixed.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        完整月份固定額度 ({uniqueReportMonths.length > 0 ? `${uniqueReportMonths.length} 個月` : '本月'})
                      </div>
                    </div>

                    {/* 3. 進貨變動成本 */}
                    <div style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        🛒 總進貨變動成本
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#ef4444' }}>
                        NT$ {totalPeriodVariable.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        食材物料與採購進貨
                      </div>
                    </div>

                    {/* 4. 合計總成本 */}
                    <div style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        📦 合計營運總成本
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#dc2626' }}>
                        NT$ {totalPeriodCost.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        佔總營收比重 {costRatio}%
                      </div>
                    </div>

                    {/* 5. 總預估月淨利 (Highlighted Key Card) */}
                    <div style={{
                      backgroundColor: isPeriodNetProfit ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                      border: isPeriodNetProfit ? '2px solid #16a34a' : '2px solid #dc2626',
                      borderRadius: '12px',
                      padding: '16px',
                      boxShadow: isPeriodNetProfit ? '0 0 15px rgba(22, 163, 74, 0.2)' : '0 0 15px rgba(220, 38, 38, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: isPeriodNetProfit ? '#16a34a' : '#dc2626' }}>
                          🏆 總預估月淨利 (累計淨利)
                        </span>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: '900',
                          backgroundColor: isPeriodNetProfit ? '#16a34a' : '#dc2626',
                          color: 'white'
                        }}>
                          {isPeriodNetProfit ? '🟢 總體盈餘' : '🔴 總體虧損'}
                        </span>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '900', color: isPeriodNetProfit ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                        {totalPeriodNetProfit >= 0 ? '+' : ''}NT$ {totalPeriodNetProfit.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        淨利率: <strong style={{ color: isPeriodNetProfit ? '#16a34a' : '#dc2626' }}>{netProfitMargin}%</strong> (毛利 NT$ {totalPeriodGrossProfit.toLocaleString()})
                      </div>
                    </div>
                  </div>

                  {/* Weekday vs Weekend & Day-of-Week Insights */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    {/* Weekday vs Weekend Card */}
                    <div style={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⚖️ 平日 (週一至週五) vs 假日 (週六日) 營收對比
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🏢 平日營業額 (佔 {weekdayPercent}%)</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)', marginTop: '4px' }}>NT$ {weekdayRev.toLocaleString()}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                            <span>📅 日均 (營業 {weekdayDaysCount} 天): <strong>NT$ {weekdayAvgDaily.toLocaleString()}</strong></span><br/>
                            <span>🏷️ 平均客單價 (每單均消): <strong>NT$ {weekdayAvgTicket}</strong></span>
                          </div>
                        </div>

                        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(234, 88, 12, 0.4)' }}>
                          <div style={{ fontSize: '0.75rem', color: '#ea580c' }}>🏖️ 假日營業額 (佔 {weekendPercent}%)</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#ea580c', marginTop: '4px' }}>NT$ {weekendRev.toLocaleString()}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                            <span>📅 日均 (營業 {weekendDaysCount} 天): <strong>NT$ {weekendAvgDaily.toLocaleString()}</strong></span><br/>
                            <span>🏷️ 平均客單價 (每單均消): <strong>NT$ {weekendAvgTicket}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${weekdayPercent}%`, backgroundColor: '#38bdf8' }} title={`平日 ${weekdayPercent}%`} />
                        <div style={{ width: `${weekendPercent}%`, backgroundColor: '#ea580c' }} title={`假日 ${weekendPercent}%`} />
                      </div>
                    </div>

                    {/* Day of Week Mini Bar Chart */}
                    <div style={{ backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '10px' }}>
                        📊 週一至週日平均日營業額分佈
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', alignItems: 'flex-end', height: '90px' }}>
                        {dowStats.map((dow, idx) => {
                          const avg = dow.days > 0 ? Math.round(dow.rev / dow.days) : 0;
                          const maxAvg = Math.max(...dowStats.map(d => d.days > 0 ? d.rev / d.days : 0), 1);
                          const heightPct = Math.max(Math.round((avg / maxAvg) * 100), 10);
                          const isWeekend = idx >= 5;

                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: isWeekend ? '#ea580c' : 'var(--text-muted)' }}>
                                {avg > 0 ? `${Math.round(avg / 1000)}k` : '-'}
                              </span>
                              <div 
                                style={{
                                  width: '100%',
                                  height: `${heightPct}%`,
                                  backgroundColor: isWeekend ? '#ea580c' : '#38bdf8',
                                  borderRadius: '4px 4px 0 0',
                                  transition: 'height 0.3s ease'
                                }}
                                title={`${dow.name}: 平均日營收 NT$ ${avg.toLocaleString()} (${dow.days}天)`}
                              />
                              <span style={{ fontSize: '0.72rem', fontWeight: isWeekend ? '900' : 'bold', color: isWeekend ? '#ea580c' : 'var(--text-main)' }}>
                                {dow.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>根據資料庫中訂單交易額與支出流，每月進行自動化對帳與結算淨利。您也可以手動補登非系統記錄的人工營業額。</p>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>對帳日期</th>
                        <th style={{ padding: '10px 12px' }}>營業總收入</th>
                        <th style={{ padding: '10px 12px' }}>固定成本支出</th>
                        <th style={{ padding: '10px 12px' }}>進貨變動成本</th>
                        <th style={{ padding: '10px 12px' }}>合計總成本</th>
                        <th style={{ padding: '10px 12px' }}>單日預估淨利</th>
                        <th style={{ padding: '10px 12px' }}>財務健康狀態</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetReports.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>此月份無損益對帳資料可供彙整</td>
                        </tr>
                      ) : (
                        targetReports.map(report => {
                          const totalCost = report.fixedCosts + report.variableCosts;
                          const monthlyProfit = report.revenue - totalCost;
                          const isProfit = monthlyProfit >= 0;
                          return (
                            <tr key={report.month} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)' }}>{report.month}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '0.85rem' }}>NT$ {report.revenue}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  (系統: {report.systemRevenue || 0} | 人工: {report.manualRev || 0})
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#ef4444' }}>NT$ {report.fixedCosts}</td>
                              <td style={{ padding: '10px 12px', color: '#ef4444' }}>NT$ {report.variableCosts}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#ef4444' }}>NT$ {totalCost}</td>
                              <td style={{ padding: '10px 12px', fontWeight: '900', fontSize: '0.85rem', color: isProfit ? '#16a34a' : '#dc2626' }}>
                                NT$ {monthlyProfit}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: '600',
                                  backgroundColor: isProfit ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                  color: isProfit ? '#16a34a' : '#ef4444'
                                }}>
                                  {isProfit ? '🟢 盈餘利潤' : '🔴 營運虧損'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <button 
                                  onClick={() => {
                                    setManualRevDate(report.month);
                                    setManualRevAmount(report.manualRev || '');
                                    setShowManualRevModal(true);
                                  }}
                                  style={{ padding: '4px 8px', fontSize: '0.7rem', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer', marginRight: '4px' }}
                                >
                                  ✏️ 登錄人工
                                </button>
                                {report.manualRev > 0 && (
                                  <button 
                                    onClick={() => handleDeleteManualRevenue(report.month)}
                                    style={{ padding: '4px 8px', fontSize: '0.7rem', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer' }}
                                  >
                                    🗑️ 清除
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {/* 🏆 Total Summary Row at bottom of Monthly Report Table */}
                    {targetReports.length > 0 && (
                      <tfoot style={{ borderTop: '2px solid var(--primary)', backgroundColor: 'rgba(255, 107, 53, 0.06)' }}>
                        <tr style={{ fontWeight: 'bold' }}>
                          <td style={{ padding: '12px 10px', color: 'var(--primary)', fontSize: '0.85rem' }}>
                            📊 區間累計總計 ({targetReports.length}天)
                          </td>
                          <td style={{ padding: '12px 10px', color: '#16a34a', fontSize: '0.9rem' }}>
                            NT$ {totalPeriodRev.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 10px', color: '#ef4444', fontSize: '0.9rem' }}>
                            NT$ {totalPeriodFixed.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 10px', color: '#ef4444', fontSize: '0.9rem' }}>
                            NT$ {totalPeriodVariable.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 10px', color: '#dc2626', fontSize: '0.9rem' }}>
                            NT$ {totalPeriodCost.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 10px', fontSize: '1.05rem', fontWeight: '900', color: isPeriodNetProfit ? '#16a34a' : '#dc2626' }}>
                            {totalPeriodNetProfit >= 0 ? '+' : ''}NT$ {totalPeriodNetProfit.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '900',
                              backgroundColor: isPeriodNetProfit ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                              color: isPeriodNetProfit ? '#16a34a' : '#dc2626'
                            }}>
                              {isPeriodNetProfit ? '🟢 總預估月淨利 盈餘' : '🔴 總預估月淨利 虧損'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            淨利率 {netProfitMargin}%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )})()}

            {/* 5. INVENTORY & WAREHOUSE SYSTEM */}
            {activeTab === 'inventory' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Left Side: Stock List */}
                <div style={{ flex: '1 1 60%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: 0 }}>📦 倉儲物料與食材庫存狀態</h4>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        安全警戒數: <strong style={{ color: '#ef4444' }}>{inventory.filter(i => i.qty <= i.minStock).length}</strong>
                      </span>
                      <button 
                        onClick={() => setShowAddInventoryForm(!showAddInventoryForm)}
                        style={{ padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--primary)', color: 'white', backgroundColor: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        {showAddInventoryForm ? '✖ 關閉表單' : '➕ 新增物料品項'}
                      </button>
                    </div>
                  </div>

                  {/* Add Inventory Item Form */}
                  {showAddInventoryForm && (
                    <form onSubmit={handleAddInventoryItem} style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '14px',
                      marginBottom: '16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                      alignItems: 'flex-end'
                    }}>
                      <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>物料/食材名稱 *</label>
                        <input 
                          type="text" 
                          placeholder="例: 白胡椒粉"
                          required
                          value={newInvName}
                          onChange={(e) => setNewInvName(e.target.value)}
                          style={{ padding: '6px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                        />
                      </div>
                      <div style={{ flex: '1 1 80px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>目前庫存數量 *</label>
                        <input 
                          type="number" 
                          step="0.01"
                          placeholder="10"
                          required
                          value={newInvQty}
                          onChange={(e) => setNewInvQty(e.target.value)}
                          style={{ padding: '6px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                        />
                      </div>
                      <div style={{ flex: '1 1 60px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>單位 *</label>
                        <input 
                          type="text" 
                          placeholder="包/斤/個"
                          required
                          value={newInvUnit}
                          onChange={(e) => setNewInvUnit(e.target.value)}
                          style={{ padding: '6px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                        />
                      </div>
                      <div style={{ flex: '1 1 80px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>安全警告線 *</label>
                        <input 
                          type="number" 
                          placeholder="2"
                          required
                          value={newInvMin}
                          onChange={(e) => setNewInvMin(e.target.value)}
                          style={{ padding: '6px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                        />
                      </div>
                      <button 
                        type="submit" 
                        style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', height: '30px', cursor: 'pointer' }}
                      >
                        ➕ 新增
                      </button>
                    </form>
                  )}
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 12px' }}>項目</th>
                          <th style={{ padding: '10px 12px' }}>目前庫存</th>
                          <th style={{ padding: '10px 12px' }}>安全警戒線</th>
                          <th style={{ padding: '10px 12px' }}>狀態</th>
                          <th style={{ padding: '10px 12px' }}>⭐ POS 關注提醒</th>
                          <th style={{ padding: '10px 12px' }}>排序</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map((item, idx) => {
                          const isWarning = item.qty <= item.minStock;
                          const isOut = item.qty <= 0;
                          return (
                            <tr key={item.name} style={{ borderBottom: '1px solid var(--border)', backgroundColor: isWarning ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{item.name}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                {item.qty} {item.unit}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.minStock} {item.unit}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  backgroundColor: isOut ? 'rgba(239,68,68,0.15)' : (isWarning ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)'),
                                  color: isOut ? '#ef4444' : (isWarning ? '#f59e0b' : '#16a34a')
                                }}>
                                  {isOut ? '🔴 缺貨' : (isWarning ? '🟡 偏低' : '🟢 正常')}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleWatchInventoryItem(item.name)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.75rem',
                                    borderRadius: '12px',
                                    border: item.isWatched !== false ? '1px solid #f59e0b' : '1px solid var(--border)',
                                    backgroundColor: item.isWatched !== false ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-body)',
                                    color: item.isWatched !== false ? '#d97706' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title={item.isWatched !== false ? '點擊取消 POS 補貨關注提醒' : '點擊開啟 POS 補貨關注提醒'}
                                >
                                  {item.isWatched !== false ? '⭐ 關注中' : '⚪ 未關注'}
                                </button>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveInventoryItem(idx, -1)}
                                    style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === inventory.length - 1}
                                    onClick={() => handleMoveInventoryItem(idx, 1)}
                                    style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: idx === inventory.length - 1 ? 'not-allowed' : 'pointer' }}
                                  >
                                    ▼
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button 
                                  onClick={() => {
                                    setAdjItemName(item.name);
                                    setAdjType('add');
                                    const input = document.getElementById('adj-qty-input');
                                    if (input) input.focus();
                                  }}
                                  style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  盤點登記
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditingInvItem(item);
                                    setEditInvUnit(item.unit || '');
                                    setEditInvQty(String(item.qty !== undefined ? item.qty : 0));
                                    setEditInvMinStock(String(item.minStock || 0));
                                    setEditInvIsWatched(item.isWatched !== false);
                                  }}
                                  style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  ✏️ 編輯
                                </button>
                                <button 
                                  onClick={() => handleDeleteInventoryItem(item.name)}
                                  style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  🗑️ 刪除
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Side: Adjustment Form & Logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Adjustment Form */}
                  <form onSubmit={handleManualInventoryAdjustment} style={{
                    backgroundColor: 'var(--bg-body)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                      📋 倉儲食材/器具手動盤點異動
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>選擇項目</label>
                      <select 
                        value={adjItemName}
                        onChange={(e) => setAdjItemName(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                        required
                      >
                        <option value="">-- 選擇庫存品項 --</option>
                        {inventory.map(item => (
                          <option key={item.name} value={item.name}>{item.name} ({item.unit})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>異動類型</label>
                        <select 
                          value={adjType}
                          onChange={(e) => setAdjType(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', height: '33px' }}
                        >
                          <option value="add">➕ 手動進貨/增加</option>
                          <option value="sub">➖ 損耗扣除/減少</option>
                          <option value="set">📝 盤點修正/重設</option>
                        </select>
                      </div>
                      
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>數量</label>
                        <input 
                          id="adj-qty-input"
                          type="number" 
                          step="0.01"
                          placeholder="輸入數量"
                          value={adjQty}
                          onChange={(e) => setAdjQty(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>備註說明 (原因)</label>
                      <input 
                        type="text" 
                        placeholder="例如: 盤點誤差校正、毀損丟棄"
                        value={adjRemarks}
                        onChange={(e) => setAdjRemarks(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                      />
                    </div>

                    <button type="submit" style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                      💾 儲存異動紀錄
                    </button>
                  </form>

                  {/* Logs list */}
                  <div style={{
                    backgroundColor: 'var(--bg-body)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '16px',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: '0 0 10px 0', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                      ⏳ 庫存歷史異動日誌 (聯動記錄)
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
                      {inventoryLogs.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>暫無異動日誌</span>
                      ) : (
                        inventoryLogs.map(log => (
                          <div key={log.id} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '2px' }}>
                              <span>{log.itemName} ({log.type})</span>
                              <span style={{ color: log.change.startsWith('+') ? '#16a34a' : '#ef4444' }}>
                                {log.change} {log.unit}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                              <span>{log.date} {log.time}</span>
                              <span>{log.remarks}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. SUPPLY AVAILABILITY TAB (Unified Single-Pane Layout) */}
            {activeTab === 'supply' && (
              <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
                
                {/* Header Dropdown Control */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>🍜 菜單品項與佐料供應管理</h4>
                  <select 
                    value={selectedManageType} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedManageType(val);
                      if (val === 'add-new') {
                        setEditingItemId(null);
                        setProdName('');
                        setProdPrice('');
                        setProdDescription('');
                        setProdImage('');
                        setProdCustomization('mee-sua-standard');
                      } else if (val === 'add-condiment') {
                        setEditingCondimentName(null);
                        setNewCondimentFormName('');
                        setNewCondimentFormStatus(true);
                      }
                    }}
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-body)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      outline: 'none'
                    }}
                  >
                    <option value="general">🍜 一般麵線產品</option>
                    <option value="specialties">🔥 特色小菜產品</option>
                    <option value="condiments">🌿 前台佐料供應狀態</option>
                    <option value="add-new">➕ 新增自訂商品上架</option>
                    <option value="add-condiment">➕ 新增前台佐料上架</option>
                  </select>
                </div>

                {/* 1. LIST VIEW: GENERAL & SPECIALTIES ITEMS */}
                {(selectedManageType === 'general' || selectedManageType === 'specialties') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {menuItems
                      .filter(item => selectedManageType === 'general' ? item.category === 'mee-sua' : item.category === 'specialties')
                      .map(item => {
                        const isAvailable = item.customizations?.is_available !== false;
                        return (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-body)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <img 
                                src={item.image} 
                                alt="" 
                                style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border)' }}
                                onError={(e) => { e.target.src = item.category === 'mee-sua' ? '/images/taiwanese_mee_sua.jpg' : '/images/spicy_kimchi.jpg'; }}
                              />
                              <div>
                                <h5 style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>{item.name}</h5>
                                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  <span>分類: {item.category === 'mee-sua' ? '🍜 一般產品' : '🔥 特色產品'}</span>
                                  <span>單價: <strong>NT$ {item.price}</strong></span>
                                  <span>客製: {item.customizations ? '📋 標準規格' : '🚫 僅選數量'}</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-card)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '0.75rem' }}>
                                <input 
                                  type="checkbox" 
                                  checked={isAvailable} 
                                  onChange={() => handleMenuItemToggle(item.id)}
                                  style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: 'var(--primary)' }}
                                />
                                <span>{isAvailable ? '🟢 上架供應中' : '🔴 已沽清下架'}</span>
                              </label>
                              <button 
                                onClick={() => {
                                  handleEditProductClick(item);
                                  setSelectedManageType('add-new');
                                }}
                                style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                ✏️ 編輯
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(item.id, item.name)}
                                style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                🗑️ 刪除
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* 2. LIST VIEW: FRONT CONDIMENTS */}
                {selectedManageType === 'condiments' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(condimentsAvailability).map(([name, isAvailable]) => (
                      <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-body)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '1.2rem' }}>🌿</span>
                          <div>
                            <h5 style={{ fontSize: '0.9rem', fontWeight: 'bold', margin: 0 }}>{name}</h5>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>前台顧客自助佐料</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-card)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '0.75rem' }}>
                            <input 
                              type="checkbox" 
                              checked={isAvailable} 
                              onChange={() => handleCondimentToggle(name)}
                              style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: 'var(--primary)' }}
                            />
                            <span>{isAvailable ? '🟢 上架供應中' : '🔴 已沽清下架'}</span>
                          </label>
                          <button 
                            onClick={() => handleEditCondimentClick(name, isAvailable)}
                            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ✏️ 編輯
                          </button>
                          <button 
                            onClick={() => handleDeleteCondiment(name)}
                            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            🗑️ 刪除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. FORM VIEW: ADD / EDIT MENU ITEM */}
                {selectedManageType === 'add-new' && (
                  <form onSubmit={handleProductSubmit} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxWidth: '600px',
                    margin: '0 auto'
                  }}>
                    <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                      {editingItemId ? '✏️ 編輯單品資訊' : '➕ 上架自訂新商品'}
                    </h5>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>商品名稱 *</label>
                      <input 
                        type="text" 
                        value={prodName} 
                        onChange={(e) => setProdName(e.target.value)} 
                        placeholder="例：招牌花枝羹" 
                        required 
                        style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>商品分類</label>
                        <select 
                          value={prodCategory} 
                          onChange={(e) => setProdCategory(e.target.value)}
                          style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)', height: '37px' }}
                        >
                          <option value="mee-sua">🍜 招牌麵線</option>
                          <option value="specialties">🔥 特色產品</option>
                        </select>
                      </div>
                      
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>商品單價 (元) *</label>
                        <input 
                          type="number" 
                          value={prodPrice} 
                          onChange={(e) => setProdPrice(e.target.value)} 
                          placeholder="55" 
                          required 
                          style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>規格客製方案</label>
                      <select 
                        value={prodCustomization} 
                        onChange={(e) => setProdCustomization(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)', height: '37px' }}
                      >
                        <option value="mee-sua-standard">📋 一般麵線客製（大/小碗、加料、佐料）</option>
                        <option value="none">🚫 僅選數量（無客製項目，如小菜飲品）</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>商品描述 (選填)</label>
                      <textarea 
                        value={prodDescription} 
                        onChange={(e) => setProdDescription(e.target.value)} 
                        placeholder="例：軟Ｑ鮮甜 of 魷魚花枝羹，佐麵線更是絕配。" 
                        rows={2}
                        style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)', resize: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>商品圖片網址 (選填)</label>
                      <input 
                        type="text" 
                        value={prodImage} 
                        onChange={(e) => setProdImage(e.target.value)} 
                        placeholder="留空將自動匹配預設圖片" 
                        style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                      <button 
                        type="button" 
                        onClick={() => {
                          handleCancelEdit();
                          setSelectedManageType(prodCategory === 'mee-sua' ? 'general' : 'specialties');
                        }}
                        style={{ padding: '10px 20px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ❌ 取消並返回
                      </button>
                      <button 
                        type="submit" 
                        style={{ padding: '10px 24px', fontSize: '0.85rem', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {editingItemId ? '💾 儲存修改' : '➕ 上架商品'}
                      </button>
                    </div>
                  </form>
                )}

                {/* 4. FORM VIEW: ADD / EDIT CONDIMENT */}
                {selectedManageType === 'add-condiment' && (
                  <form onSubmit={handleCondimentFormSubmit} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxWidth: '600px',
                    margin: '0 auto'
                  }}>
                    <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', margin: 0, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                      {editingCondimentName ? '✏️ 編輯前台佐料' : '➕ 新增前台佐料'}
                    </h5>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>佐料名稱 *</label>
                      <input 
                        type="text" 
                        value={newCondimentFormName} 
                        onChange={(e) => setNewCondimentFormName(e.target.value)} 
                        placeholder="例：特製辣油" 
                        required 
                        style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>預設供應狀態</label>
                      <select 
                        value={newCondimentFormStatus ? 'true' : 'false'} 
                        onChange={(e) => setNewCondimentFormStatus(e.target.value === 'true')}
                        style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)', height: '37px' }}
                      >
                        <option value="true">🟢 正常供應中</option>
                        <option value="false">🔴 已沽清下架</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                      <button 
                        type="button" 
                        onClick={() => {
                          setSelectedManageType('condiments');
                          setEditingCondimentName(null);
                        }}
                        style={{ padding: '10px 20px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ❌ 取消並返回
                      </button>
                      <button 
                        type="submit" 
                        style={{ padding: '10px 24px', fontSize: '0.85rem', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {editingCondimentName ? '💾 儲存修改' : '➕ 上架佐料'}
                      </button>
                    </div>
                  </form>
                )}

              </div>
            )}
          </div>
        </main>

      {/* VENDOR MANAGEMENT MODAL (V3: multi-items support + editable vendors) */}
      {showVendorModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '560px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>⚙️ 進貨廠商與預設品項資料管理</h4>
              <button 
                onClick={() => {
                  setShowVendorModal(false);
                  setEditingVendorIndex(null);
                  setNewVendorName('');
                  setNewVendorItems([{ name: '紅麵線', qty: '10斤', cost: '600' }]);
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>

            {/* List of existing vendors */}
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>現有廠商清單 (點選編輯可修改廠商名稱與所有品項)</span>
              {vendors.map((v, vIdx) => (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-body)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem', flex: 1, marginRight: '8px' }}>
                    <strong>🏢 {v.name}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {v.items.map((item, idx) => (
                        <span key={idx} style={{ backgroundColor: 'var(--bg-card)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          {item.name}: {item.qty} / {item.cost}元
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={() => {
                        setEditingVendorIndex(vIdx);
                        setNewVendorName(v.name);
                        setNewVendorItems(v.items.map(item => ({ name: item.name, qty: item.qty, cost: String(item.cost) })));
                      }}
                      style={{ padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer' }}
                    >
                      ✏️ 編輯
                    </button>
                    <button 
                      onClick={() => handleDeleteVendor(v.id, v.name)}
                      style={{ padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                    >
                      🗑️ 刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add/Edit Vendor Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newVendorName) return;
              const filteredItems = newVendorItems
                .filter(item => item.name.trim() !== '')
                .map(item => ({
                  name: item.name,
                  qty: item.qty || '10斤',
                  cost: Number(item.cost) || 0
                }));

              if (filteredItems.length === 0) {
                alert("請至少新增一個進貨品項！");
                return;
              }

              let updated;
              if (editingVendorIndex !== null) {
                // EDIT MODE
                updated = vendors.map((v, idx) => {
                  if (idx === editingVendorIndex) {
                    return { ...v, name: newVendorName, items: filteredItems };
                  }
                  return v;
                });
                setEditingVendorIndex(null);
                alert("廠商資訊修改成功！");
              } else {
                // ADD MODE
                const newV = {
                  id: 'v_' + Date.now(),
                  name: newVendorName,
                  items: filteredItems
                };
                updated = [...vendors, newV];
                setSelectedVendorId(newV.id);
                setSelectedVendorItemIndex('0');
                alert("廠商新增成功！");
              }
              setVendors(updated);
              localStorage.setItem('restaurant_vendors_v2', JSON.stringify(updated));
              saveVendorsToCloud(updated);
              setNewVendorName('');
              setNewVendorItems([{ name: '紅麵線', qty: '10斤', cost: '600' }]);
            }} style={{
              backgroundColor: 'var(--bg-body)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                {editingVendorIndex !== null ? '✏️ 編輯廠商與預設進貨資訊' : '➕ 新增廠商與預設進貨資訊'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>廠商名稱 *</label>
                <input 
                  type="text" 
                  placeholder="例: 大明麵粉廠"
                  required
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                />
              </div>

              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>📋 預設進貨品項列表</span>
                  <button 
                    type="button" 
                    onClick={() => setNewVendorItems([...newVendorItems, { name: '', qty: '10斤', cost: '600' }])}
                    style={{ padding: '2px 8px', fontSize: '0.65rem', borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ＋ 新增品項
                  </button>
                </div>

                {newVendorItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      placeholder="品項 (例: 紅麵線)" 
                      required
                      value={item.name}
                      onChange={(e) => {
                        const updated = [...newVendorItems];
                        updated[idx].name = e.target.value;
                        setNewVendorItems(updated);
                      }}
                      style={{ flex: 2, padding: '4px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                    <input 
                      type="text" 
                      placeholder="數量 (例: 10斤)" 
                      value={item.qty}
                      onChange={(e) => {
                        const updated = [...newVendorItems];
                        updated[idx].qty = e.target.value;
                        setNewVendorItems(updated);
                      }}
                      style={{ flex: 1.5, padding: '4px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                    <input 
                      type="number" 
                      placeholder="金額" 
                      value={item.cost}
                      onChange={(e) => {
                        const updated = [...newVendorItems];
                        updated[idx].cost = e.target.value;
                        setNewVendorItems(updated);
                      }}
                      style={{ flex: 1.5, padding: '4px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                    {newVendorItems.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => setNewVendorItems(newVendorItems.filter((_, i) => i !== idx))}
                        style={{ padding: '4px 8px', fontSize: '0.7rem', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                {editingVendorIndex !== null && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setEditingVendorIndex(null);
                      setNewVendorName('');
                      setNewVendorItems([{ name: '紅麵線', qty: '10斤', cost: '600' }]);
                    }}
                    style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                  >
                    ❌ 取消編輯
                  </button>
                )}
                <button 
                  type="submit" 
                  style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {editingVendorIndex !== null ? '💾 儲存修改' : '➕ 儲存並新增廠商'}
                </button>
              </div>
            </form>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button 
                onClick={() => {
                  setShowVendorModal(false);
                  setEditingVendorIndex(null);
                  setNewVendorName('');
                  setNewVendorItems([{ name: '紅麵線', qty: '10斤', cost: '600' }]);
                }}
                style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL REVENUE MODAL */}
      {showManualRevModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '24px', borderRadius: '16px', boxSizing: 'border-box', textAlign: 'left' }}>
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
                ✍️ 登錄人工接單/未登錄營業收入
              </h3>
              <button className="close-btn" style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowManualRevModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleSaveManualRevenue(manualRevDate, manualRevAmount);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>進貨/營業日期</label>
                <input 
                  type="date"
                  required
                  value={manualRevDate}
                  onChange={(e) => setManualRevDate(e.target.value)}
                  style={{ padding: '8px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>手動補登營業額 (NT$)</label>
                <input 
                  type="number"
                  placeholder="例如: 1500"
                  required
                  min="0"
                  value={manualRevAmount}
                  onChange={(e) => setManualRevAmount(e.target.value)}
                  style={{ padding: '8px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button"
                  onClick={() => setShowManualRevModal(false)}
                  style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button 
                  type="submit"
                  style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  💾 儲存並同步雲端
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      

      {/* 🧩 Module Center Modal */}
      <ModuleCenterModal
        isOpen={showModuleCenterModal}
        onClose={() => setShowModuleCenterModal(false)}
        onModulesUpdated={(newMods) => setActiveModules(newMods)}
      />

      {/* 🏷️ Tag Manager Modal (自訂評鑑標籤管理 - 支援編輯、刪除、載入行業範本) */}
      {showTagManagerModal && (() => {
        const defaultTemplates = {
          fruit: [
            { id: 'f1', name: '🍏 品質極佳', isGood: true },
            { id: 'f2', name: '🌟 甜度高/口感極佳', isGood: true },
            { id: 'f3', name: '⚖️ 足秤無損', isGood: true },
            { id: 'f4', name: '🌿 當天現採新鮮', isGood: true },
            { id: 'f5', name: '📦 包裝保護完整', isGood: true },
            { id: 'f6', name: '🚚 送貨準時', isGood: true },
            { id: 'f7', name: '⚠️ 輕微壓傷/瑕疵', isGood: false },
            { id: 'f8', name: '🚨 損耗偏高', isGood: false },
            { id: 'f9', name: '⏰ 延遲送達', isGood: false },
            { id: 'f10', name: '📉 甜度/熟度不均', isGood: false }
          ],
          restaurant: [
            { id: 'r1', name: '🥩 新鮮無異味', isGood: true },
            { id: 'r2', name: '❄️ 冷鏈溫控良好', isGood: true },
            { id: 'r3', name: '⏱️ 效期新鮮', isGood: true },
            { id: 'r4', name: '💰 批發價格優惠', isGood: true },
            { id: 'r5', name: '🤝 配合度高', isGood: true },
            { id: 'r6', name: '⚠️ 效期偏短', isGood: false },
            { id: 'r7', name: '❌ 少送/缺件', isGood: false },
            { id: 'r8', name: '⏰ 延遲送達', isGood: false },
            { id: 'r9', name: '💸 漲價通知', isGood: false }
          ],
          retail: [
            { id: 'g1', name: '📦 耐摔耐重', isGood: true },
            { id: 'g2', name: '📐 尺寸規格精準', isGood: true },
            { id: 'g3', name: '💰 批發底價', isGood: true },
            { id: 'g4', name: '🚚 快速出貨', isGood: true },
            { id: 'g5', name: '⚠️ 外箱破損', isGood: false },
            { id: 'g6', name: '❌ 規格錯誤', isGood: false }
          ]
        };

        const handleLoadTemplate = async (type) => {
          if (!confirm(`確定要載入【${type === 'fruit' ? '水果生鮮' : (type === 'restaurant' ? '餐飲食材' : '通用包材')}】評鑑標籤範本嗎？`)) return;
          const tplTags = defaultTemplates[type] || defaultTemplates.fruit;
          setVendorEvalTags(tplTags);
          localStorage.setItem('restaurant_vendor_eval_tags', JSON.stringify(tplTags));
          try {
            const tagKey = 'SYSTEM_SETTING_VENDOR_EVAL_TAGS';
            await supabase.from('menu_items').upsert([{ id: 9992, name: tagKey, price: 0, category: 'settings', description: JSON.stringify(tplTags) }]);
          } catch (err) {}
          alert("✅ 標籤範本載入成功！");
        };

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              border: '2px solid var(--primary)',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🏷️ 自訂供應商評鑑標籤庫
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTagManagerModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Template Quick Loader */}
              <div style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(255, 107, 53, 0.08)', border: '1px solid rgba(255, 107, 53, 0.2)', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                  📂 一鍵載入行業專屬標籤庫:
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate('fruit')}
                    style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🍎 水果生鮮
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate('restaurant')}
                    style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🍜 餐飲食材
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate('retail')}
                    style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    📦 通用包材
                  </button>
                </div>
              </div>

              {/* Add New Tag Section */}
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', marginBottom: '18px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '8px' }}>
                  ➕ 新增自訂標籤
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newCustomTagName}
                    onChange={(e) => setNewCustomTagName(e.target.value)}
                    placeholder="例: 🍉 甜度爆表 或 🥩 油花均勻"
                    style={{ flex: 1, padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                  <select
                    value={newCustomTagIsGood ? 'good' : 'bad'}
                    onChange={(e) => setNewCustomTagIsGood(e.target.value === 'good')}
                    style={{ padding: '8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="good">🟢 正向好評</option>
                    <option value="bad">🔴 警示/需注意</option>
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newCustomTagName.trim()) {
                        alert("請輸入標籤名稱！");
                        return;
                      }
                      const newTag = {
                        id: `tag_${Date.now()}`,
                        name: newCustomTagName.trim(),
                        isGood: newCustomTagIsGood
                      };
                      const updated = [...vendorEvalTags, newTag];
                      setVendorEvalTags(updated);
                      localStorage.setItem('restaurant_vendor_eval_tags', JSON.stringify(updated));
                      try {
                        const tagKey = 'SYSTEM_SETTING_VENDOR_EVAL_TAGS';
                        await supabase.from('menu_items').upsert([{ id: 9992, name: tagKey, price: 0, category: 'settings', description: JSON.stringify(updated) }]);
                      } catch (err) {}
                      setNewCustomTagName('');
                    }}
                    style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    新增
                  </button>
                </div>
              </div>

              {/* Tag List & Live Editable Badges */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>現有標籤庫清單 ({vendorEvalTags.length} 個標籤):</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>點擊文字即可直接編輯改名</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                  {vendorEvalTags.map(tag => (
                    <div
                      key={tag.id || tag.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: tag.isGood ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        border: tag.isGood ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          backgroundColor: tag.isGood ? '#16a34a' : '#ef4444',
                          color: 'white'
                        }}>
                          {tag.isGood ? '好評' : '警示'}
                        </span>
                        <input
                          type="text"
                          value={tag.name}
                          onChange={async (e) => {
                            const newName = e.target.value;
                            const updated = vendorEvalTags.map(t => (t.id ? t.id === tag.id : t.name === tag.name) ? { ...t, name: newName } : t);
                            setVendorEvalTags(updated);
                            localStorage.setItem('restaurant_vendor_eval_tags', JSON.stringify(updated));
                            try {
                              const tagKey = 'SYSTEM_SETTING_VENDOR_EVAL_TAGS';
                              await supabase.from('menu_items').upsert([{ id: 9992, name: tagKey, price: 0, category: 'settings', description: JSON.stringify(updated) }]);
                            } catch (err) {}
                          }}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)',
                            borderRadius: '4px'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = vendorEvalTags.map(t => (t.id ? t.id === tag.id : t.name === tag.name) ? { ...t, isGood: !t.isGood } : t);
                            setVendorEvalTags(updated);
                            localStorage.setItem('restaurant_vendor_eval_tags', JSON.stringify(updated));
                            try {
                              const tagKey = 'SYSTEM_SETTING_VENDOR_EVAL_TAGS';
                              await supabase.from('menu_items').upsert([{ id: 9992, name: tagKey, price: 0, category: 'settings', description: JSON.stringify(updated) }]);
                            } catch (err) {}
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.72rem', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)' }}
                          title="切換好評/警示屬性"
                        >
                          切換性質
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = vendorEvalTags.filter(t => (t.id ? t.id !== tag.id : t.name !== tag.name));
                            setVendorEvalTags(updated);
                            localStorage.setItem('restaurant_vendor_eval_tags', JSON.stringify(updated));
                            try {
                              const tagKey = 'SYSTEM_SETTING_VENDOR_EVAL_TAGS';
                              await supabase.from('menu_items').upsert([{ id: 9992, name: tagKey, price: 0, category: 'settings', description: JSON.stringify(updated) }]);
                            } catch (err) {}
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.72rem', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer' }}
                          title="刪除標籤"
                        >
                          🗑️ 刪除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowTagManagerModal(false)}
                  style={{ padding: '8px 20px', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 💰 Cash Audit Prompt Modal (Daily Login Reminder) */}
      {showCashAuditPromptModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 99999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '32px 28px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.3)',
            border: '2px solid #10b981',
            textAlign: 'center',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>💰</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: '0 0 10px 0' }}>
              今日尚未進行現金盤點
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              本日日期：<strong style={{ color: 'var(--primary)' }}>{getTodayLocalDate()}</strong><br />
              及時盤點抽屜實收現金並與系統營業額比對，能確保帳目精準並及早發現溢收或短少！
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCashAuditPromptModal(false);
                  handleOpenCashAuditModal(getTodayLocalDate());
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1.05rem',
                  fontWeight: '900',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                💵 立即進行現金盤點
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = getTodayLocalDate();
                    localStorage.setItem('cash_audit_skip_' + todayStr, 'true');
                    setShowCashAuditPromptModal(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  今日不再提示
                </button>

                <button
                  type="button"
                  onClick={() => setShowCashAuditPromptModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  稍後提醒
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💵 Cash Audit Entry & Calculation Modal */}
      {showCashAuditModal && (() => {
        const targetOrders = orders.filter(o => {
          const d = o.timestamp ? new Date(o.timestamp).toLocaleDateString('en-CA') : (o.time ? o.time.slice(0, 10) : '');
          return d === auditDate;
        });
        const manualForTarget = Number(manualRevenues[auditDate] || 0);
        const sysTotalRev = targetOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) + manualForTarget;
        const sysCashRev = targetOrders.filter(o => !o.paymentMethod || o.paymentMethod === 'cash').reduce((sum, o) => sum + (Number(o.total) || 0), 0) + manualForTarget;
        const sysOnlineRev = targetOrders.filter(o => o.paymentMethod && o.paymentMethod !== 'cash').reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        const counted = Number(auditCountedCash || 0);
        const floatVal = Number(auditDrawerFloat || 0);
        const netActual = counted - floatVal;
        const diff = netActual - sysCashRev;

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              border: '2px solid var(--primary)',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.6rem' }}>💵</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)' }}>
                    {editingAuditId ? '✏️ 編輯現金盤點紀錄' : '💰 每日實收現金盤點與對帳'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCashAuditModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Date Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  📅 盤點日期
                </label>
                <input
                  type="date"
                  value={auditDate}
                  onChange={(e) => setAuditDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.95rem' }}
                />
              </div>

              {/* System Revenue Reference Card */}
              <div style={{
                backgroundColor: 'rgba(234, 88, 12, 0.08)',
                border: '1px solid rgba(234, 88, 12, 0.3)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '18px'
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '6px' }}>
                  📊 系統當日帳目記錄 (自動核算)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>系統總營業額：<strong>NT$ {sysTotalRev.toLocaleString()}</strong> ({targetOrders.length} 筆)</span>
                  <span>系統現金營收：<strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>NT$ {sysCashRev.toLocaleString()}</strong></span>
                </div>
                {sysOnlineRev > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    * 線上/非現金支付：NT$ {sysOnlineRev.toLocaleString()}
                  </div>
                )}
              </div>

              {/* Float & Counted Cash Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    🪙 抽屜零錢備用金 (NT$)
                  </label>
                  <input
                    type="number"
                    value={auditDrawerFloat}
                    onChange={(e) => setAuditDrawerFloat(e.target.value)}
                    placeholder="例: 3000"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.95rem' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>開班時抽屜內的固定底層零錢</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
                    💵 抽屜盤點總現金 (NT$) *
                  </label>
                  <input
                    type="number"
                    value={auditCountedCash}
                    onChange={(e) => setAuditCountedCash(e.target.value)}
                    placeholder="例: 17200"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #10b981', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 'bold' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#10b981' }}>抽屜內所有鈔票與硬幣加總</span>
                </div>
              </div>

              {/* Denominations Counter Toggle */}
              <div style={{ marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setShowDenomCalc(!showDenomCalc)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    backgroundColor: showDenomCalc ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-body)',
                    color: showDenomCalc ? '#10b981' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🧮 {showDenomCalc ? '收起紙鈔硬幣面額計算機' : '展開紙鈔硬幣面額計算機 (快速點鈔加總)'}
                </button>

                {showDenomCalc && (
                  <div style={{
                    marginTop: '10px',
                    padding: '14px',
                    backgroundColor: 'var(--bg-body)',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '10px'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>千元 (1000)</span>
                      <input
                        type="number"
                        value={auditDenominations.d1000}
                        onChange={(e) => updateDenomAndSum('d1000', e.target.value)}
                        placeholder="張數"
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>五百 (500)</span>
                      <input
                        type="number"
                        value={auditDenominations.d500}
                        onChange={(e) => updateDenomAndSum('d500', e.target.value)}
                        placeholder="張數"
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>二百 (200)</span>
                      <input
                        type="number"
                        value={auditDenominations.d200}
                        onChange={(e) => updateDenomAndSum('d200', e.target.value)}
                        placeholder="張數"
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>百元 (100)</span>
                      <input
                        type="number"
                        value={auditDenominations.d100}
                        onChange={(e) => updateDenomAndSum('d100', e.target.value)}
                        placeholder="張數"
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>五十元 (50)</span>
                      <input
                        type="number"
                        value={auditDenominations.d50}
                        onChange={(e) => updateDenomAndSum('d50', e.target.value)}
                        placeholder="個數"
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>十元 (10)</span>
                      <input
                        type="number"
                        value={auditDenominations.d10}
                        onChange={(e) => updateDenomAndSum('d10', e.target.value)}
                        placeholder="個數"
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>五元 (5)</span>
                      <input
                        type="number"
                        value={auditDenominations.d5}
                        onChange={(e) => updateDenomAndSum('d5', e.target.value)}
                        placeholder="個數"
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>一元 (1)</span>
                      <input
                        type="number"
                        value={auditDenominations.d1}
                        onChange={(e) => updateDenomAndSum('d1', e.target.value)}
                        placeholder="個數"
                        style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Real-time Discrepancy Preview Card */}
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: diff === 0 ? 'rgba(16, 185, 129, 0.1)' : (diff > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                border: diff === 0 ? '2px solid #10b981' : (diff > 0 ? '2px solid #3b82f6' : '2px solid #ef4444'),
                marginBottom: '18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    扣除備用金後實收現金：
                  </span>
                  <strong style={{ fontSize: '1.15rem', color: '#059669' }}>
                    NT$ {netActual.toLocaleString()}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    核算差額 (實收 - 系統)：
                  </span>
                  <strong style={{
                    fontSize: '1.3rem',
                    fontWeight: '900',
                    color: diff === 0 ? '#10b981' : (diff > 0 ? '#2563eb' : '#ef4444')
                  }}>
                    {diff === 0 ? '✅ 帳實相符 ($0)' : (diff > 0 ? `📈 溢收 +NT$ ${diff.toLocaleString()}` : `📉 短少 -NT$ ${Math.abs(diff).toLocaleString()}`)}
                  </strong>
                </div>
              </div>

              {/* Auditor & Remarks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    👤 盤點人員
                  </label>
                  <input
                    type="text"
                    value={auditAuditor}
                    onChange={(e) => setAuditAuditor(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    📝 備註說明 (選填)
                  </label>
                  <input
                    type="text"
                    value={auditRemarks}
                    onChange={(e) => setAuditRemarks(e.target.value)}
                    placeholder="例: 找錯50元、備用金增補等"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleSaveCashAudit}
                  style={{
                    flex: 2,
                    padding: '14px',
                    fontSize: '1.05rem',
                    fontWeight: '900',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  ✓ 儲存現金盤點紀錄
                </button>
                <button
                  type="button"
                  onClick={() => setShowCashAuditModal(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT BOOKKEEPING ORDER MODAL */}
      {editingBookkeepingOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                ✏️ 編輯當日流水帳單 (單號: {editingBookkeepingOrder.serialNum || editingBookkeepingOrder.id})
              </h3>
              <button 
                onClick={() => setEditingBookkeepingOrder(null)}
                style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBookkeepingOrderEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>實收金額 (NT$)</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    value={editOrderTotal}
                    onChange={(e) => setEditOrderTotal(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>點單類型</label>
                  <select
                    value={editOrderType}
                    onChange={(e) => setEditOrderType(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                  >
                    <option value="dine-in">🍽️ 內用</option>
                    <option value="takeout">🛍️ 外帶</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>顧客 / 桌號</label>
                  <input 
                    type="text" 
                    value={editOrderCust}
                    onChange={(e) => setEditOrderCust(e.target.value)}
                    placeholder="例: 3號桌 或 陳先生"
                    style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>付款方式</label>
                  <input 
                    type="text" 
                    value={editOrderPayment}
                    onChange={(e) => setEditOrderPayment(e.target.value)}
                    placeholder="例: 現金, 信用卡, LINE Pay"
                    style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>備註事項</label>
                <input 
                  type="text" 
                  value={editOrderRemarks}
                  onChange={(e) => setEditOrderRemarks(e.target.value)}
                  placeholder="特別說明或補註"
                  style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>👤 經手收銀員</label>
                <input 
                  type="text" 
                  value={editOrderCashier}
                  onChange={(e) => setEditOrderCashier(e.target.value)}
                  placeholder="例: 店長 (Admin) 或 收銀員-小明"
                  style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>點餐品項明細調整：</label>
                {editOrderItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-body)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 'bold' }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...editOrderItems];
                          if (updated[idx].quantity > 1) {
                            updated[idx].quantity -= 1;
                            setEditOrderItems(updated);
                          }
                        }}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', width: '24px', textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...editOrderItems];
                          updated[idx].quantity += 1;
                          setEditOrderItems(updated);
                        }}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setEditingBookkeepingOrder(null)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  💾 儲存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT INVENTORY ITEM SETTINGS MODAL */}
      {editingInvItem && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '24px', borderRadius: '16px', boxSizing: 'border-box', textAlign: 'left' }}>
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
                ✏️ 編輯物料設定
              </h3>
              <button className="close-btn" style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setEditingInvItem(null)}>&times;</button>
            </div>
            
            <form onSubmit={handleSaveInvItemSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>物料名稱</label>
                <input 
                  type="text"
                  disabled
                  value={editingInvItem.name}
                  style={{ padding: '8px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>物料單位</label>
                <input 
                  type="text"
                  required
                  placeholder="如: 斤, 個, 包, 罐"
                  value={editInvUnit}
                  onChange={(e) => setEditInvUnit(e.target.value)}
                  style={{ padding: '8px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>安全警戒值</label>
                <input 
                  type="number"
                  required
                  min="0"
                  placeholder="低於此值會顯示黃色偏低警告"
                  value={editInvMinStock}
                  onChange={(e) => setEditInvMinStock(e.target.value)}
                  style={{ padding: '8px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button"
                  onClick={() => setEditingInvItem(null)}
                  style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button 
                  type="submit"
                  style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  💾 儲存設定
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* LINE Notify & Messaging API Settings Modal */}
      {showLineSettingsModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '460px', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', marginBottom: '16px' }}>
              <h3 style={{ color: '#06c755', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                💬 LINE 點餐通知發送設定
              </h3>
              <button className="close-btn" style={{ position: 'absolute', right: '16px', top: '16px' }} onClick={() => setShowLineSettingsModal(false)}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button 
                type="button" 
                onClick={() => setLineSettingsType('bot')}
                style={{
                  flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 'bold', borderRadius: '8px', border: '2px solid',
                  borderColor: lineSettingsType === 'bot' ? '#06c755' : 'var(--border)',
                  backgroundColor: lineSettingsType === 'bot' ? 'rgba(6, 199, 85, 0.05)' : 'transparent',
                  color: lineSettingsType === 'bot' ? '#06c755' : 'var(--text-main)', cursor: 'pointer'
                }}
              >
                🤖 LINE 官方帳號 Bot
              </button>
              <button 
                type="button" 
                onClick={() => setLineSettingsType('notify')}
                style={{
                  flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 'bold', borderRadius: '8px', border: '2px solid',
                  borderColor: lineSettingsType === 'notify' ? '#06c755' : 'var(--border)',
                  backgroundColor: lineSettingsType === 'notify' ? 'rgba(6, 199, 85, 0.05)' : 'transparent',
                  color: lineSettingsType === 'notify' ? '#06c755' : 'var(--text-main)', cursor: 'pointer'
                }}
              >
                🔔 LINE Notify (舊版)
              </button>
            </div>

            {lineSettingsType === 'bot' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                  使用官方 LINE Messaging API 發送通知。每月提供 200 則免費額度。
                </p>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>1. LINE Access Token (長期存取權杖)</label>
                  <textarea 
                    rows="3"
                    placeholder="請輸入長期存取權杖 (Channel Access Token)"
                    value={lineBotAccessToken}
                    onChange={(e) => setLineBotAccessToken(e.target.value.trim())}
                    style={{ fontSize: '0.75rem', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>2. 您的 LINE User ID (接收通知對象)</label>
                  <input 
                    type="text" 
                    placeholder="例: U1234567890abcdef..."
                    value={lineBotUserId}
                    onChange={(e) => setLineBotUserId(e.target.value.trim())}
                    style={{ fontSize: '0.75rem', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    可在 LINE Developers 後台「Messaging API」最下方的 "Your user ID" 中找到。
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                  ⚠️ LINE Notify 服務將於 2025 年 4 月停用，請盡快轉移至 LINE Bot。
                </p>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>LINE Notify Access Token</label>
                  <input 
                    type="text" 
                    placeholder="請貼上您的 LINE Notify Token"
                    value={lineNotifyToken}
                    onChange={(e) => setLineNotifyToken(e.target.value.trim())}
                    style={{ fontSize: '0.75rem', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button 
                onClick={() => setShowLineSettingsModal(false)}
                style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
              >
                取消
              </button>
              <button 
                onClick={async () => {
                  const settingsObj = {
                    type: lineSettingsType,
                    channelAccessToken: lineBotAccessToken,
                    userId: lineBotUserId,
                    notifyToken: lineNotifyToken
                  };
                  const { error } = await supabase.from('menu_items').upsert({
                    id: 9999,
                    name: 'SYSTEM_SETTING_LINE_TOKEN',
                    description: JSON.stringify(settingsObj),
                    price: 0,
                    category: 'settings',
                    image: ''
                  });
                  if (error) {
                    alert("LINE 設定儲存失敗：" + error.message);
                  } else {
                    alert("LINE 通知密鑰儲存與雲端同步成功！");
                    setShowLineSettingsModal(false);
                  }
                }}
                style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#06c755', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
              >
                💾 儲存並同步雲端
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}