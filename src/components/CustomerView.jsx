import React, { useState, useEffect, useRef } from 'react';
import { menuCategories, menuItems as defaultMenuItems, luzhouFallbackMenuItems, defaultUpgradeCombos, isComboApplicableToItem } from '../data/menuData';
import ItemModal from './ItemModal';

import CartPanel from './CartPanel';
import OrderTracker from './OrderTracker';
import { supabase } from '../supabaseClient';
import { getActiveStoreCode, filterItemsByStore, prefixNameForStore } from '../utils/storeContext';

// Import Firebase and config settings
import { firebaseConfig } from '../config';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// Helper to format Supabase order row into React component format
export const formatSupabaseOrder = (dbOrder) => {
  if (!dbOrder) return null;
  let itemsData = dbOrder.items || {};
  if (typeof itemsData === 'string') {
    try {
      itemsData = JSON.parse(itemsData);
    } catch (e) {
      itemsData = {};
    }
  }

  // Determine Type accurately:
  // If order_number starts with 'O-', it is takeout (外帶)
  // If order_number starts with 'I-', it is dine-in (內用)
  const orderNumStr = String(dbOrder.order_number || '');
  let finalType = dbOrder.type === 'dine-in' ? 'dine-in' : 'takeout';
  if (orderNumStr.startsWith('O-') || orderNumStr.startsWith('O')) {
    finalType = 'takeout';
  } else if (orderNumStr.startsWith('I-') || orderNumStr.startsWith('I')) {
    finalType = 'dine-in';
  }

  const tableName = dbOrder.table_number || itemsData.table_number || null;
  let customerName = itemsData.customerName || '';
  if (!customerName) {
    customerName = finalType === 'dine-in' ? (tableName ? `內用 ${tableName} 號桌` : '內用點餐') : '現場外帶';
  }

  let cartItems = [];
  if (Array.isArray(itemsData)) {
    cartItems = itemsData;
  } else if (itemsData && Array.isArray(itemsData.cart)) {
    cartItems = itemsData.cart;
  } else if (itemsData && Array.isArray(itemsData.items)) {
    cartItems = itemsData.items;
  }

  return {
    id: String(dbOrder.id),
    serialNum: dbOrder.order_number || String(dbOrder.id).slice(-6),
    time: new Date(dbOrder.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    timestamp: new Date(dbOrder.created_at).getTime(),
    status: dbOrder.status,
    type: finalType,
    tableName: tableName,
    customerName: customerName,
    customerPhone: itemsData.customerPhone || '',
    phoneVerified: true,
    pickupTime: itemsData.pickupTime || '',
    paymentMethod: itemsData.paymentMethod || 'cash',
    paymentStatus: dbOrder.payment_status,
    remarks: itemsData.remarks || '',
    items: cartItems,
    total: Number(dbOrder.total),
    cashier: itemsData.cashier || '',
    source: itemsData.source || (itemsData.cashier ? 'pos' : 'customer')
  };
};

// Initialize Firebase App
let firebaseApp = null;
let firebaseAuth = null;

if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY') {
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApps()[0];
    }
    firebaseAuth = getAuth(firebaseApp);
  } catch (err) {
    console.error("Firebase Auth initialization failed:", err);
  }
}

// Helper to pick a delicious emoji icon based on dish name
const getItemIcon = (name = '') => {
  if (name.includes('套餐') || name.includes('全席') || name.includes('雙響') || name.includes('組合') || name.includes('【A') || name.includes('【B') || name.includes('【C')) return '🍱';
  if (name.includes('大腸')) return '🥢';
  if (name.includes('肉羹') || name.includes('肉羹麵線')) return '🍲';
  if (name.includes('綜合')) return '🍜';
  if (name.includes('清麵線')) return '🥣';
  if (name.includes('泡菜')) return '🥬';
  if (name.includes('臭豆腐')) return '🥟';
  if (name.includes('紅茶') || name.includes('冬瓜') || name.includes('飲') || name.includes('茶')) return '🧋';
  return '🍜';
};

// Component to gracefully render menu item photo (90x90 standard thumbnail) or warm appetizing gradient card
const MenuItemImage = ({ item }) => {
  if (item && item.image) {
    return (
      <div 
        style={{
          width: '90px',
          height: '90px',
          minWidth: '90px',
          minHeight: '90px',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          backgroundColor: 'var(--bg-input)'
        }}
      >
        <img 
          src={item.image} 
          alt={item.name} 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const placeholder = e.currentTarget.parentElement.querySelector('.item-image-fallback');
            if (placeholder) placeholder.style.display = 'flex';
          }}
        />
        <div 
          className="item-image-fallback"
          style={{
            display: 'none',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            fontSize: '2rem'
          }}
        >
          {getItemIcon(item.name)}
        </div>
      </div>
    );
  }

  return (
    <div 
      style={{
        width: '90px',
        height: '90px',
        minWidth: '90px',
        minHeight: '90px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--primary)',
        flexShrink: 0,
        gap: '2px',
        boxSizing: 'border-box'
      }}
    >
      <span style={{ fontSize: '2rem' }}>{getItemIcon(item?.name)}</span>
      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.1, padding: '0 2px' }}>
        {item?.name}
      </span>
    </div>
  );
};
export default function CustomerView({ storeCode: propStoreCode, tableNumber, onBackToDemo, onSwitchToLogin }) {
  const storeCode = propStoreCode || getActiveStoreCode();
  const handleSwitchToLogin = onSwitchToLogin || onBackToDemo || (() => { window.location.href = '/?login=true'; });
  const [viewState, setViewState] = useState('menu'); // 'menu', 'checkout', 'tracking'
  const [productCategories, setProductCategories] = useState(() => {
    if (storeCode === 'luzhou' || storeCode === 'luzhou7') {
      return [{ id: 'specialties', name: '精選推薦', icon: '🔥' }];
    }
    return [
      { id: 'mee-sua', name: '招牌麵線', icon: '🍜' },
      { id: 'specialties', name: '特色產品', icon: '🔥' }
    ];
  });
  const [activeCategory, setActiveCategory] = useState(() => {
    if (storeCode === 'luzhou' || storeCode === 'luzhou7') {
      return 'specialties';
    }
    return 'mee-sua';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [cart, setCart] = useState([]);
  
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [lineNotifyToken, setLineNotifyToken] = useState('');
  const [generatedLineCode, setGeneratedLineCode] = useState('');
  const [simulatedNotification, setSimulatedNotification] = useState(null);
  const [pickupTime, setPickupTime] = useState('10-15分鐘後');
  const [customPickupTime, setCustomPickupTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('counter');

  const [allOrders, setAllOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);

  const [showCart, setShowCart] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [upgradeCombos, setUpgradeCombos] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storeCode}_restaurant_upgrade_combos`);
      return saved ? JSON.parse(saved) : defaultUpgradeCombos;
    } catch (e) {
      return defaultUpgradeCombos;
    }
  });

  // OTP Verification States (Real Firebase Phone Auth)
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpError, setOtpError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [condimentsAvailability, setCondimentsAvailability] = useState({
    '香菜': true,
    '蒜末': true,
    '烏醋': true,
    '辣醬': true
  });

  const [menuItems, setMenuItems] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storeCode}_restaurant_menu_items`);
      if (saved) {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (storeCode === 'luzhou' || storeCode === 'luzhou7') {
            parsed = parsed.filter(i => !i.name?.includes('麵線') && !i.name?.includes('沙士') && !i.name?.includes('氣泡飲') && i.category !== 'mee-sua' && !([146, 147, 148, 149, 150, 151, 152, 153, 154, 155].includes(Number(i.id))));
          }
          if (parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}
    if (storeCode === 'luzhou' || storeCode === 'luzhou7') return luzhouFallbackMenuItems;
    return storeCode === 'dragon' ? defaultMenuItems : [];
  });
  const [storeName, setStoreName] = useState('龍城麵線');
  const [storeSlogan, setStoreSlogan] = useState('');
  const [showHeroBanner, setShowHeroBanner] = useState(true);
  const [heroTag, setHeroTag] = useState('');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroDesc, setHeroDesc] = useState('');
  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme') || 'default';
    document.body.className = savedTheme === 'default' ? '' : `theme-${savedTheme}`;
  }, []);

  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeOpenStatus, setStoreOpenStatus] = useState(() => {
    try {
      const cached = localStorage.getItem(`${storeCode}_store_open_status`);
      return cached ? JSON.parse(cached) : null;
    } catch (e) { return null; }
  });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [closedDates, setClosedDates] = useState([]);
  const [showOrderConfirmModal, setShowOrderConfirmModal] = useState(false);
  const [receiptConfig, setReceiptConfig] = useState({
    enableOnlineOrdering: true
  });
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState({
    counter: { enabled: true, name: '店內結帳 (到店付款)', desc: '取餐時於櫃檯付款，支援現金與TWQR共同支付' },
    online: { enabled: true, name: '線上刷卡', desc: '下單即完成付款' }
  });
  const [blacklist, setBlacklist] = useState([]);

  const getTodayLocalDate = () => {
    try {
      return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    } catch (e) {
      const d = new Date();
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
    }
  };

  const confirmationResultRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Fetch menu items from Supabase
  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const storeItems = filterItemsByStore(data, storeCode);

        const profileItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_PROFILE');
        if (profileItem && profileItem.description) {
          try {
            const prof = JSON.parse(profileItem.description);
            if (prof.storeName) setStoreName(prof.storeName);
            if (prof.storeAddress) setStoreAddress(prof.storeAddress);
            if (prof.storePhone) setStorePhone(prof.storePhone);
            if (prof.storeSlogan) setStoreSlogan(prof.storeSlogan);
            if (prof.heroTag) setHeroTag(prof.heroTag);
            if (prof.heroTitle) setHeroTitle(prof.heroTitle);
            if (prof.heroDesc) setHeroDesc(prof.heroDesc);
            if (prof.showHeroBanner !== undefined) setShowHeroBanner(prof.showHeroBanner);
          } catch (e) {}
        }

        const heroItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_HERO');
        if (heroItem && heroItem.description) {
          try {
            const h = JSON.parse(heroItem.description);
            if (h.heroTag) setHeroTag(h.heroTag);
            if (h.heroTitle) setHeroTitle(h.heroTitle);
            if (h.heroDesc) setHeroDesc(h.heroDesc);
            if (h.storeSlogan) setStoreSlogan(h.storeSlogan);
            if (h.showHeroBanner !== undefined) setShowHeroBanner(h.showHeroBanner);
          } catch (e) {}
        }

        const tokenItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_LINE_TOKEN');
        if (tokenItem) {
          setLineNotifyToken(tokenItem.description || '');
        }
        let currentCats = productCategories;
        const categoriesItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_PRODUCT_CATEGORIES');
        if (categoriesItem && categoriesItem.description) {
          try {
            const parsed = JSON.parse(categoriesItem.description);
            if (Array.isArray(parsed) && parsed.length > 0) {
              currentCats = parsed;
              setProductCategories(parsed);
              if (!parsed.some(c => c.id === activeCategory)) {
                setActiveCategory(parsed[0].id);
              }
            }
          } catch (e) {}
        }
        const storeNameItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_NAME');
        if (storeNameItem && storeNameItem.description) {
          setStoreName(storeNameItem.description);
        }
        const storeAddrItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_ADDRESS');
        if (storeAddrItem && storeAddrItem.description) {
          setStoreAddress(storeAddrItem.description);
        }
        const storePhoneItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_PHONE');
        if (storePhoneItem && storePhoneItem.description) {
          setStorePhone(storePhoneItem.description);
        }

        const receiptConfigItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_RECEIPT_CONFIG');
        if (receiptConfigItem && receiptConfigItem.description) {
          try {
            setReceiptConfig(JSON.parse(receiptConfigItem.description));
          } catch (e) {}
        }
        const paymentItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_PAYMENT_METHODS');
        if (paymentItem && paymentItem.description) {
          try {
            const parsed = JSON.parse(paymentItem.description);
            setPaymentMethodsConfig(parsed);
            if (parsed.counter && !parsed.counter.enabled && parsed.online && parsed.online.enabled) {
              setPaymentMethod('online');
            } else {
              setPaymentMethod('counter');
            }
          } catch (e) {
            console.error("Failed to parse payment methods:", e);
          }
        }
        const orderItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_MENU_ORDER');
        let orderList = [];
        if (orderItem && orderItem.description) {
          try { orderList = JSON.parse(orderItem.description); } catch (e) {}
        }

        const openStatusItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_OPEN_STATUS');
        if (openStatusItem && openStatusItem.description) {
          try {
            const parsed = JSON.parse(openStatusItem.description);
            setStoreOpenStatus(parsed);
            localStorage.setItem(`${storeCode}_store_open_status`, JSON.stringify(parsed));
          } catch (e) {}
        }

        const upgradeCombosItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_UPGRADE_COMBOS') || data.find(item => item.name === 'SYSTEM_SETTING_UPGRADE_COMBOS');
        if (upgradeCombosItem && upgradeCombosItem.description) {
          try {
            const parsed = JSON.parse(upgradeCombosItem.description);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setUpgradeCombos(parsed);
              localStorage.setItem(`${storeCode}_restaurant_upgrade_combos`, JSON.stringify(parsed));
            }
          } catch (e) {}
        }

        const addonsItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_GLOBAL_ADDONS');
        let currentAddons = [
          { label: '大腸', priceChange: 15 },
          { label: '豬肚', priceChange: 15 },
          { label: '肉羹', priceChange: 15 },
          { label: '花枝羹', priceChange: 15 },
          { label: '貢丸', priceChange: 15 }
        ];
        if (addonsItem && addonsItem.description) {
          try { currentAddons = JSON.parse(addonsItem.description); } catch (e) {}
        }

        const condimentsItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_GLOBAL_CONDIMENTS');
        let currentCondiments = [
          { name: '香菜', choices: ['正常', '多一點', '不要香菜'], default: '正常' },
          { name: '蒜末', choices: ['正常', '多一點', '不要蒜頭'], default: '正常' },
          { name: '烏醋', choices: ['正常', '多一點', '不要烏醋'], default: '正常' },
          { name: '辣醬', choices: ['不辣', '微辣', '中辣', '大辣'], default: '不辣' }
        ];
        if (condimentsItem && condimentsItem.description) {
          try { currentCondiments = JSON.parse(condimentsItem.description); } catch (e) {}
        }

        const blacklistItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_BLACKLIST');
        if (blacklistItem && blacklistItem.description) {
          try { setBlacklist(JSON.parse(blacklistItem.description)); } catch (e) {}
        }

        const visibleItems = storeItems.filter(item => 
          !item.name.startsWith('SYSTEM_SETTING_') &&
          item.customizations?.is_published !== false
        ).map(item => {
          let updatedCust = item.customizations;
          if (updatedCust) {
            updatedCust = { ...updatedCust };
            if (updatedCust.addons) {
              updatedCust.addons = {
                ...updatedCust.addons,
                options: currentAddons
              };
            }
            if (updatedCust.condiments) {
              updatedCust.condiments = {
                ...updatedCust.condiments,
                options: currentCondiments
              };
            }
          }
          return {
            ...item,
            customizations: updatedCust
          };
        });

        if (orderList.length > 0) {
          visibleItems.sort((a, b) => {
            const indexA = orderList.indexOf(String(a.id));
            const indexB = orderList.indexOf(String(b.id));
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
        }
        const finalItems = visibleItems.length === 0 
          ? ((storeCode === 'luzhou' || storeCode === 'luzhou7') ? luzhouFallbackMenuItems : (storeCode === 'dragon' ? defaultMenuItems : []))
          : visibleItems;

        setMenuItems(finalItems);
        try {
          if (visibleItems.length > 0) {
            localStorage.setItem(`${storeCode}_restaurant_menu_items`, JSON.stringify(visibleItems));
          }
        } catch (e) {}

        // Auto-select category with items if activeCategory has 0 items
        if (finalItems.length > 0) {
          const hasCurrent = finalItems.some(i => (i.category === activeCategory) || (activeCategory === 'combos' && (i.category === 'combos' || i.customizations?.is_combo)));
          if (!hasCurrent) {
            const foundCat = currentCats.find(c => finalItems.some(i => (i.category === c.id) || (c.id === 'combos' && (i.category === 'combos' || i.customizations?.is_combo))));
            if (foundCat) {
              setActiveCategory(foundCat.id);
            } else if (finalItems[0]?.category) {
              setActiveCategory(finalItems[0].category);
            }
          }
        }
      } else {
        // Seed database if empty
        const defaultWithNullCustomizations = defaultMenuItems.map(item => ({
          ...item,
          customizations: item.customizations || null
        }));
        await supabase.from('menu_items').insert(defaultWithNullCustomizations);
        const { data: seeded } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
        if (seeded) {
          const tokenItem = seeded.find(item => item.name === 'SYSTEM_SETTING_LINE_TOKEN');
          if (tokenItem) {
            setLineNotifyToken(tokenItem.description || '');
          }
          const storeNameItem = seeded.find(item => item.name === 'SYSTEM_SETTING_STORE_NAME');
          if (storeNameItem && storeNameItem.description) {
            setStoreName(storeNameItem.description);
          }
          const storeAddrItem = seeded.find(item => item.name === 'SYSTEM_SETTING_STORE_ADDRESS');
          if (storeAddrItem && storeAddrItem.description) {
            setStoreAddress(storeAddrItem.description);
          }
          const storePhoneItem = seeded.find(item => item.name === 'SYSTEM_SETTING_STORE_PHONE');
          if (storePhoneItem && storePhoneItem.description) {
            setStorePhone(storePhoneItem.description);
          }
          const paymentItem = seeded.find(item => item.name === 'SYSTEM_SETTING_PAYMENT_METHODS');
          if (paymentItem && paymentItem.description) {
            try {
              const parsed = JSON.parse(paymentItem.description);
              setPaymentMethodsConfig(parsed);
              if (parsed.counter && !parsed.counter.enabled && parsed.online && parsed.online.enabled) {
                setPaymentMethod('online');
              } else {
                setPaymentMethod('counter');
              }
            } catch (e) {
              console.error("Failed to parse payment methods:", e);
            }
          }
          const orderItem = seeded.find(item => item.name === 'SYSTEM_SETTING_MENU_ORDER');
          let orderList = [];
          if (orderItem && orderItem.description) {
            try { orderList = JSON.parse(orderItem.description); } catch (e) {}
          }

          const addonsItem = seeded.find(item => item.name === 'SYSTEM_SETTING_GLOBAL_ADDONS');
          let currentAddons = [
            { label: '大腸', priceChange: 15 },
            { label: '豬肚', priceChange: 15 },
            { label: '肉羹', priceChange: 15 },
            { label: '花枝羹', priceChange: 15 },
            { label: '貢丸', priceChange: 15 }
          ];
          if (addonsItem && addonsItem.description) {
            try { currentAddons = JSON.parse(addonsItem.description); } catch (e) {}
          }

          const visibleItems = seeded.filter(item => 
            !item.name.startsWith('SYSTEM_SETTING_') &&
            item.customizations?.is_published !== false
          ).map(item => {
            if (item.customizations && item.customizations.addons) {
              return {
                ...item,
                customizations: {
                  ...item.customizations,
                  addons: {
                    ...item.customizations.addons,
                    options: currentAddons
                  }
                }
              };
            }
            return item;
          });

          if (orderList.length > 0) {
            visibleItems.sort((a, b) => {
              const indexA = orderList.indexOf(String(a.id));
              const indexB = orderList.indexOf(String(b.id));
              if (indexA === -1 && indexB === -1) return 0;
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
            });
          }
          setMenuItems(visibleItems);
        }
      }
    } catch (err) {
      console.error("Failed to load from Supabase menu_items, using localStorage/default:", err);
      const savedMenuItems = localStorage.getItem('restaurant_menu_items');
      if (savedMenuItems) {
        try {
          const parsed = JSON.parse(savedMenuItems).filter(item => item.name !== 'SYSTEM_SETTING_LINE_TOKEN');
          setMenuItems(parsed.length > 0 ? parsed : defaultMenuItems);
        } catch (e) {
          setMenuItems(defaultMenuItems);
        }
      } else {
        setMenuItems(defaultMenuItems);
      }
    } finally {
      setIsInitialLoading(false);
    }
  };

  const fetchClosedDates = async () => {
    try {
      const closedKey = prefixNameForStore('SYSTEM_SETTING_CLOSED_DATES', storeCode);
      const { data: settingsData } = await supabase
        .from('menu_items')
        .select('description')
        .eq('name', closedKey);
      
      let settingsClosed = [];
      if (settingsData && settingsData.length > 0 && settingsData[0].description) {
        try {
          settingsClosed = JSON.parse(settingsData[0].description);
        } catch (e) {}
      }

      setClosedDates(settingsClosed);
      localStorage.setItem('restaurant_closed_dates', JSON.stringify(settingsClosed));
    } catch (e) {
      console.error("Failed to load closed dates in CustomerView:", e);
    }
  };

  // Initialize Recaptcha for Firebase Auth
  useEffect(() => {
    if (firebaseAuth && !recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            // Recaptcha resolved
          }
        });
      } catch (err) {
        console.error("Failed to init RecaptchaVerifier:", err);
      }
    }
  }, []);

  // Load active order and all orders from Supabase
  useEffect(() => {
    fetchMenuItems();
    fetchClosedDates();

    const savedActiveId = localStorage.getItem('active_customer_order_id');
    if (savedActiveId) {
      supabase.from('orders').select('*').eq('id', savedActiveId).single().then(({ data, error }) => {
        if (data && data.status !== 'completed') {
          const formatted = formatSupabaseOrder(data);
          setAllOrders([formatted]);
          setActiveOrderId(String(data.id));
          setViewState('tracking');
        } else {
          localStorage.removeItem('active_customer_order_id');
        }
      });
    }

    const savedCondiments = localStorage.getItem('condiments_availability');
    if (savedCondiments) {
      setCondimentsAvailability(JSON.parse(savedCondiments));
    }

    const savedMenuItemsAvail = localStorage.getItem('menu_items_availability');
    if (savedMenuItemsAvail) {
      setMenuItemsAvailability(JSON.parse(savedMenuItemsAvail));
    }
  }, [storeCode]);

  // Listen to Supabase Realtime changes for menu items and the active order status
  useEffect(() => {
    const menuChannel = supabase.channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenuItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(menuChannel);
    };
  }, []);

  useEffect(() => {
    if (!activeOrderId) return;
    const orderChannel = supabase.channel(`order-${activeOrderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `id=eq.${activeOrderId}`
      }, payload => {
        const formatted = formatSupabaseOrder(payload.new);
        if (formatted) {
          setAllOrders([formatted]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [activeOrderId]);

  // Polling fallback to ensure customer screen always syncs status in background
  useEffect(() => {
    if (!activeOrderId) return;
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.from('orders').select('*').eq('id', activeOrderId);
        if (!error && data && data.length > 0) {
          const formatted = formatSupabaseOrder(data[0]);
          if (formatted) {
            setAllOrders([formatted]);
          }
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [activeOrderId]);

  // Listen to local storage changes for local variables
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'condiments_availability') {
        setCondimentsAvailability(JSON.parse(e.newValue || '{}'));
      } else if (e.key === 'menu_items_availability') {
        setMenuItemsAvailability(JSON.parse(e.newValue || '{}'));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle countdown timer for resending OTP
  useEffect(() => {
    if (resendTimer > 0) {
      timerIntervalRef.current = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
    }
    return () => clearTimeout(timerIntervalRef.current);
  }, [resendTimer]);

  // Find active order object
  const activeOrder = allOrders.find(o => o.id === activeOrderId);

  // Edit and Cancel Order handlers
  const handleEditOrder = async (orderToEdit) => {
    if (!window.confirm("確定要修改這筆訂單嗎？這將會把原訂單取消並將品項放回購物車，您可以修改後重新送單。")) return;
    try {
      // Delete original order from Supabase
      const { error } = await supabase.from('orders').delete().eq('id', orderToEdit.id);
      if (error) throw error;
      
      // Put items back into cart
      // Re-map db spec formatting back to cart state item spec if needed
      const rawCart = orderToEdit.items.cart || [];
      setCart(rawCart);
      
      // Restore details
      if (orderToEdit.type === 'takeout') {
        setCustName(orderToEdit.items.customerName || '');
        setCustPhone(orderToEdit.items.customerPhone || '');
        setPickupTime(orderToEdit.items.pickupTime || '');
      }
      
      // Clear active order state
      localStorage.removeItem('active_customer_order_id');
      setActiveOrderId(null);
      setViewState('cart');
      alert("已取消原訂單，品項已放回購物車，請修改後重新送單！");
    } catch (err) {
      alert("無法修改訂單：" + err.message);
    }
  };

  const handleCancelOrder = async (orderToCancel) => {
    if (!window.confirm("確定要取消這筆訂單嗎？取消後將無法復原。")) return;
    try {
      // Soft delete by updating status to 'deleted'
      const { error } = await supabase.from('orders').update({
        status: 'deleted'
      }).eq('id', orderToCancel.id);
      if (error) throw error;
      
      alert("訂單已成功取消！");
      localStorage.removeItem('active_customer_order_id');
      setActiveOrderId(null);
      setViewState('menu');
    } catch (err) {
      alert("無法取消訂單：" + err.message);
    }
  };

  // Cart operations
  const handleAddToCart = (cartItem) => {
    setCart(prev => {
      if (editingCartItem) {
        // Clear editing state and map cartItem to replace the match
        setEditingCartItem(null);
        return prev.map(item => item.cartId === cartItem.cartId ? cartItem : item);
      }

      const existingIdx = prev.findIndex(item => 
        item.id === cartItem.id && 
        JSON.stringify(item.specs) === JSON.stringify(cartItem.specs)
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += cartItem.quantity;
        updated[existingIdx].totalPrice = updated[existingIdx].quantity * updated[existingIdx].itemPrice;
        return updated;
      }
      return [...prev, cartItem];
    });
    setEditingCartItem(null);
  };

  const handleUpdateQty = (cartId, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => item.cartId !== cartId));
    } else {
      setCart(prev => prev.map(item => {
        if (item.cartId === cartId) {
          return {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.itemPrice
          };
        }
        return item;
      }));
    }
  };

  // Regular expression to validate Taiwanese mobile numbers: 09XXXXXXXX (10 digits)
  const isValidTaiwanMobile = (phone) => {
    const regex = /^09\d{8}$/;
    return regex.test(phone);
  };



  // Initiating Phone verification (OTP generation & sending)
  const handleStartVerification = async () => {
    if (!isValidTaiwanMobile(custPhone)) {
      alert('請輸入正確的台灣手機號碼格式 (例如: 0912345678)');
      return;
    }

    if (blacklist.some(b => b.phone === custPhone)) {
      alert("⚠️ 您的號碼已被系統列入黑名單，無法進行線上點餐。如有疑問請聯絡店家！");
      setIsVerifying(false);
      return;
    }

    setOtpError('');
    setOtpInput('');
    setIsVerifying(true);

    // 1. Try Firebase Auth Real SMS verification
    if (firebaseAuth && recaptchaVerifierRef.current) {
      try {
        const formattedPhone = `+886${custPhone.substring(1)}`;
        const confirmationResult = await signInWithPhoneNumber(firebaseAuth, formattedPhone, recaptchaVerifierRef.current);
        confirmationResultRef.current = confirmationResult;
        setShowOtpModal(true);
        setResendTimer(60);
        setIsVerifying(false);
        setSimulatedNotification("💬 驗證簡訊已發送至您的手機，請查收！");
        setTimeout(() => setSimulatedNotification(null), 8000);
        return;
      } catch (err) {
        console.warn("Firebase Auth SMS send failed, falling back to LINE Notify / Mock:", err);
      }
    }

    // 2. Fallback to LINE / Mock Simulation
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setGeneratedLineCode(code);
    setShowOtpModal(true);
    setResendTimer(60);

    let hasSentReal = false;

    if (lineNotifyToken) {
      try {
        let settings = {};
        try {
          settings = JSON.parse(lineNotifyToken);
        } catch (e) {
          settings = { type: 'notify', notifyToken: lineNotifyToken };
        }

        const msgText = `\n【${storeName}】您的外帶點餐驗證碼為：${code}\n請於 5 分鐘內輸入此認證碼以完成驗證。`;

        const requestBody = settings.type === 'bot' 
          ? {
              type: 'bot',
              channelAccessToken: settings.channelAccessToken,
              userId: settings.userId,
              message: msgText
            }
          : {
              type: 'notify',
              token: settings.notifyToken,
              message: msgText
            };

        const response = await fetch('/api/send-line', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const resData = await response.json();
        if (response.ok) {
          hasSentReal = true;
          setSimulatedNotification(settings.type === 'bot' 
            ? "💬 LINE 推播通知：驗證碼已發送至您的官方帳號 LINE 訊息！" 
            : "💬 LINE 訊息通知：驗證碼已發送至您的 LINE Notify 帳號！"
          );
        } else {
          console.error("Failed to send real LINE message:", resData);
        }
      } catch (err) {
        console.error("Failed to send real LINE message:", err);
      }
    }

    if (!hasSentReal) {
      setSimulatedNotification(`💬 LINE (${storeName}官方帳號): 您的點餐驗證碼為【${code}】。(請至後台管理設定 LINE Token 以啟用真實通知)`);
    }

    setTimeout(() => setSimulatedNotification(null), 10000);
    setIsVerifying(false);
  };

  // Confirming OTP entered
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    
    if (otpInput.length !== 4 && otpInput.length !== 6) {
      setOtpError('驗證碼長度不正確 (應為 4 位或 6 位數)');
      return;
    }

    setOtpError('');
    setIsVerifying(true);

    // 1. Try Firebase Auth verification if active
    if (confirmationResultRef.current) {
      try {
        await confirmationResultRef.current.confirm(otpInput);
        setPhoneVerified(true);
        setShowOtpModal(false);
        setOtpInput('');
        setShowOrderConfirmModal(true);
        setIsVerifying(false);
        return;
      } catch (err) {
        setOtpError('驗證碼不正確或已逾期，請重新輸入。');
        setIsVerifying(false);
        return;
      }
    }

    // 2. Fallback to Line/Mock verification
    if (otpInput === generatedLineCode) {
      setPhoneVerified(true);
      setShowOtpModal(false);
      setOtpInput('');
      setGeneratedLineCode('');
      setShowOrderConfirmModal(true); // Open double-confirm modal instead of auto submitting
      setIsVerifying(false);
    } else {
      setOtpError('驗證碼不正確，請重新輸入。');
      setIsVerifying(false);
    }
  };

  // Triggered when clicking Checkout
  const handleCheckoutClick = (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    // Validate customer name (only Chinese/English letters, no numbers/symbols)
    if (!tableNumber) {
      const nameCheck = /^[a-zA-Z\s\u4e00-\u9fa5]+$/;
      if (!custName.trim() || !nameCheck.test(custName.trim())) {
        alert('訂購姓名只能包含中文或英文，不能有數字與特殊符號！');
        return;
      }
      if (!isValidTaiwanMobile(custPhone)) {
        alert('請輸入正確的台灣手機號碼格式 (例如: 0912345678)');
        return;
      }
      if (blacklist.some(b => b.phone === custPhone)) {
        alert("⚠️ 您的號碼已被系統列入黑名單，無法進行線上點餐。如有疑問請聯絡店家！");
        return;
      }
    }

    // Direct to confirm modal without phone verification
    setShowOrderConfirmModal(true);
  };

  const submitOrder = async (verified = false) => {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal;

    // Generate easy-to-read daily sequential serial number (max number + 1 logic to prevent duplicates)
    const orderType = tableNumber ? 'dine-in' : 'takeout';
    const prefix = tableNumber ? 'I' : 'O';
    
    const now = new Date();
    const taipeiDateStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    const todayTaipeiISO = new Date(`${taipeiDateStr}T00:00:00+08:00`).toISOString();

    let maxNum = 0;
    try {
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('order_number')
        .gte('created_at', todayTaipeiISO)
        .eq('type', orderType);

      if (todayOrders && todayOrders.length > 0) {
        todayOrders.forEach(o => {
          if (o.order_number && o.order_number.startsWith(prefix + '-')) {
            const num = parseInt(o.order_number.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
      }
    } catch (err) {
      console.warn("Failed to fetch today's max order num:", err);
    }

    const serialNum = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;

    try {
      const orderPayload = {
        order_number: serialNum,
        items: {
          source: 'customer',
          store_code: storeCode,
          storeCode: storeCode,
          cart: cart,
          customerName: tableNumber ? `內用 ${tableNumber} 號桌` : custName,
          customerPhone: tableNumber ? '' : custPhone,
          pickupTime: tableNumber ? '' : (pickupTime === 'custom' ? customPickupTime : pickupTime),
          paymentMethod,
          remarks
        },
        total,
        type: tableNumber ? 'dine-in' : 'takeout',
        table_number: tableNumber || null,
        status: 'received',
        payment_status: paymentMethod === 'online' ? 'paid' : 'unpaid'
      };

      let dbOrders = null;
      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { data, error: insertError } = await supabase.from('orders').insert([orderPayload]).select();
          if (insertError) throw insertError;
          if (data && data.length > 0) {
            dbOrders = data;
            break;
          }
        } catch (retryErr) {
          lastErr = retryErr;
          console.warn(`Customer order submission attempt ${attempt} failed:`, retryErr);
          if (attempt < 3) {
            await new Promise(res => setTimeout(res, attempt * 400));
          }
        }
      }

      if (!dbOrders || dbOrders.length === 0) {
        throw (lastErr || new Error("伺服器無回應，請確認網路連線"));
      }

      const createdOrder = dbOrders[0];
      const formatted = formatSupabaseOrder(createdOrder);

      localStorage.setItem('active_customer_order_id', String(createdOrder.id));
      setAllOrders([formatted]);
      setActiveOrderId(String(createdOrder.id));
      
      // Clear cart
      setCart([]);
      setViewState('tracking');
    } catch (err) {
      console.error("Failed to submit order to Supabase:", err);
      alert(`⚠️ 提交訂單失敗：${err.message || '請檢查網路連線或稍後再試'}`);
    }
  };

  // Filtered menu items based on active category and search input
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = (item.category === activeCategory) || (activeCategory === 'combos' && (item.category === 'combos' || item.customizations?.is_combo));
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleHomeClick = () => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table');
    const store = params.get('store');
    const q = new URLSearchParams();
    if (store && store !== 'dragon') q.set('store', store);
    if (table) q.set('table', table);
    const str = q.toString();
    window.location.href = str ? `/?${str}` : '/';
  };

  const todayStr = getTodayLocalDate();
  const nowTaipei = new Date();
  const currentHour = parseInt(nowTaipei.toLocaleTimeString('en-US', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit' }), 10);
  
  // Robust open status checks
  const isManuallyClosed = Boolean(storeOpenStatus && (storeOpenStatus.is_open === false || storeOpenStatus.isOpen === false));
  const isManuallyOpened = Boolean(storeOpenStatus && (storeOpenStatus.is_open === true || storeOpenStatus.isOpen === true));
  const isTodayHoliday = closedDates.includes(todayStr);

  // If explicitly opened by cashier/manager, store is strictly open (overriding nighttime cutoff!)
  // Store is only closed if today is a scheduled holiday or explicitly closed by staff
  const isClosed = isTodayHoliday || isManuallyClosed;
  const isStoreOpenToday = isManuallyOpened || (!isClosed && (currentHour < 23 && currentHour >= 6));

  if (!isInitialLoading && !isStoreOpenToday && !isClosed) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-body)',
        color: 'var(--text-main)',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '36px 24px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px'
        }}>
          <span style={{ fontSize: '3.8rem' }}>🛎️</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '0', color: 'var(--primary)' }}>
            本日尚未開始營業
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.7', margin: 0 }}>
            歡迎光臨【{storeName}】！<br />
            目前店家<strong>尚未開店</strong>，暫未開放線上點餐。<br />
            請稍候門市人員開店營業後再進行點餐，感謝您的耐心等候！
          </p>
          {storePhone && (
            <div style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              📞 門市電話：{storePhone}
            </div>
          )}
          {storeAddress && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              📍 門市地址：{storeAddress}
            </div>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '10px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(234, 88, 12, 0.3)'
            }}
          >
            🔄 重新整理頁面
          </button>
        </div>
      </div>
    );
  }


  if (receiptConfig && receiptConfig.enableOnlineOrdering === false) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-body)',
        color: 'var(--text-main)',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '32px 24px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '3.5rem' }}>📢</span>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', margin: '0', color: 'var(--text-main)' }}>
            現場櫃檯點餐服務中
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
            【{storeName}】目前暫未開放線上掃碼點餐。<br />
            歡迎您直接至收銀櫃檯，由門市服務人員為您點餐與出單！
          </p>
          {storePhone && (
            <div style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              📞 門市電話：{storePhone}
            </div>
          )}
          {storeAddress && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              📍 門市地址：{storeAddress}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-body)',
        color: 'var(--text-main)',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <span style={{ fontSize: '4rem', marginBottom: '20px' }}>🚪</span>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '10px' }}>本日營業已結束</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '300px', lineHeight: '1.6' }}>
          【{storeName}】今日營業已打烊收店。歡迎您明天再來點餐，謝謝您的支持！
        </p>
      </div>
    );
  }

  return (
    <div className="customer-view">
      {/* SIMULATED APP NOTIFICATION OVERLAY */}
      {simulatedNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#27272a',
          color: '#ffffff',
          borderRadius: '10px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          padding: '16px 20px',
          width: '90%',
          maxWidth: '420px',
          zIndex: 9999,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          animation: 'slideDown 0.3s ease-out',
          borderLeft: '4px solid #06c755'
        }}>
          <span style={{ fontSize: '1.5rem' }}>💬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#06c755', marginBottom: '2px' }}>系統通知</div>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>{simulatedNotification}</div>
          </div>
          <button 
            onClick={() => setSimulatedNotification(null)}
            style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}
      {/* Invisible Recaptcha container for Firebase Auth */}
      <div id="recaptcha-container" style={{ display: 'none' }}></div>

      {/* Header */}
      <header className="customer-header">
        
        <div className="brand-section">
          <button onClick={handleHomeClick} style={{ fontSize: '1.2rem' }}>🏡</button>
          <div>
            <h1 className="brand-name">🥢 {storeName}</h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{storeSlogan || '傳統柴魚高湯・手工紅麵線・精選美味推薦'}</p>
          </div>
        </div>
        
        {tableNumber ? (
          <div className="order-badge">
            <span className="badge-dot"></span>
            <span>內用 {tableNumber} 號桌</span>
          </div>
        ) : (
          <div className="order-badge takeout">
            <span className="badge-dot"></span>
            <span>預約外帶自取</span>
          </div>
        )}
      </header>

      {viewState === 'menu' && (
        <>
          {/* Hero / Announcement Banner */}
          {showHeroBanner !== false && (
            <div className="hero-banner">
              <div className="hero-tag">{heroTag || '🔥 熱門推薦'}</div>
              <h2 className="hero-title">{heroTitle || (storeName ? `${storeName} 招牌熱門推薦` : '招牌綜合麵線配特製辣泡菜')}</h2>
              <p className="hero-desc">{heroDesc || '在地飄香的好味道！獨家配方柴魚高湯，搭配豐富滿載的配料與手作開胃辣泡菜，讓您一吃就愛上！'}</p>
            </div>
          )}

          {/* Category tabs */}
          <div className="category-tabs">
            {productCategories.map(cat => (
              <button 
                key={cat.id} 
                className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.icon || '🍜'}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="搜尋美味餐點..." 
                className="search-bar-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Menu Items List */}
          <div className="menu-list">
            <h3 className="category-header">
              {productCategories.find(c => c.id === activeCategory)?.name}
            </h3>

            {filteredItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '40px 0' }}>
                找不到相關的餐點，換個關鍵字試試看吧！
              </p>
            ) : (
              filteredItems.map(item => {
                const isAvailable = item.customizations?.is_available !== false;
                return (
                  <div 
                    className={`menu-item-card ${!isAvailable ? 'sold-out' : ''}`}
                    key={item.id}
                    onClick={isAvailable ? () => setSelectedItem(item) : undefined}
                    style={!isAvailable ? { opacity: 0.65, filter: 'grayscale(70%)', cursor: 'not-allowed', position: 'relative' } : {}}
                  >
                    <MenuItemImage item={item} />
                    {!isAvailable && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        backgroundColor: 'var(--accent)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        zIndex: 2,
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        今日完售
                      </div>
                    )}
                    <div className="item-info">
                      <div className="item-name-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="item-name">{item.name}</div>
                        {(upgradeCombos || []).some(pkg => isComboApplicableToItem(pkg, item)) && (
                          <span style={{
                            backgroundColor: 'rgba(255, 107, 53, 0.12)',
                            color: 'var(--primary)',
                            fontSize: '0.68rem',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            marginLeft: '6px'
                          }}>
                            🍱 可升級
                          </span>
                        )}
                      </div>
                      <p className="item-description">{item.description}</p>
                      <div className="item-price-row">
                        <span className="item-price">NT$ {item.price} <span style={{fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)'}}>起</span></span>
                        <button 
                          className="item-add-btn" 
                          disabled={!isAvailable}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAvailable) setSelectedItem(item);
                          }}
                          style={!isAvailable ? { backgroundColor: 'var(--border)', color: 'var(--text-muted)', cursor: 'not-allowed' } : {}}
                        >+</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '36px',
            marginBottom: '70px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-muted)',
            fontSize: '0.75rem'
          }}>
            <div>{storeName} ・ 顧客線上掃碼點餐系統</div>
          </div>

          {/* Sticky Floating Cart Bar */}
          {cart.length > 0 && (
            <div className="float-cart-bar" onClick={() => setShowCart(true)}>
              <div className="cart-summary-info">
                <div className="cart-icon-wrapper">
                  🛒
                  <span className="cart-count-badge">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <span className="cart-price-total">NT$ {cart.reduce((sum, item) => sum + item.totalPrice, 0)}</span>
              </div>
              <span className="view-cart-txt">查看購物籃 ➔</span>
            </div>
          )}
        </>
      )}

      {/* Checkout view */}
      {viewState === 'checkout' && (
        <div className="checkout-view animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setViewState('menu')}>
              ⬅ 返回菜單
            </button>
            <h2 style={{ fontSize: '1.25rem' }}>填寫訂單資訊</h2>
          </div>

          <form onSubmit={handleCheckoutClick} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 🛒 訂單明細與店家資訊 */}
            <div className="option-group" style={{ 
              border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-md)', 
              padding: '16px', 
              backgroundColor: 'var(--bg-card)',
              textAlign: 'left'
            }}>
              <h4 className="checkout-section-title" style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                🛒 訂購明細與取餐資訊
              </h4>
              
              {/* 取餐方式與時間 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', marginBottom: '12px' }}>
                <div><strong>取餐方式：</strong>{tableNumber ? `內用 (${tableNumber} 號桌)` : '外帶自取'}</div>
                {!tableNumber && (
                  <div><strong>預計取餐時間：</strong>{pickupTime === 'custom' ? customPickupTime : pickupTime}</div>
                )}
              </div>

              {/* 商品資訊與價格明細 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px dashed var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '0.85rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ color: 'var(--text-main)' }}>{item.name} x {item.quantity}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '6px', wordBreak: 'break-all' }}>
                        {item.specs.join(', ')}
                      </div>
                    </div>
                    <span style={{ fontWeight: 'bold', flexShrink: 0, whiteSpace: 'nowrap' }}>NT$ {item.totalPrice}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', fontWeight: 'bold', marginBottom: (storeAddress || storePhone) ? '12px' : '0px' }}>
                <span>應收總計</span>
                <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>NT$ {cart.reduce((sum, item) => sum + item.totalPrice, 0)}</span>
              </div>

              {/* 店家聯絡資訊 (如果後台有填寫才顯示) */}
              {(storeAddress || storePhone) && (
                <div style={{ 
                  marginTop: '12px', 
                  paddingTop: '12px', 
                  borderTop: '1px solid var(--border)', 
                  fontSize: '0.8rem', 
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  {storeAddress && <div>📍 店家地址：{storeAddress}</div>}
                  {storePhone && <div>📞 聯絡電話：{storePhone}</div>}
                </div>
              )}
            </div>

            {/* Dining details */}
            {tableNumber ? (
              <div className="option-group" style={{ backgroundColor: 'rgba(255,107,53,0.03)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '4px' }}>🍽️ 掃碼內用確認</h4>
                <p style={{ fontSize: '0.9rem' }}>已鎖定 <strong>{tableNumber} 號桌</strong>。餐點製作完成後將會直接送至您的桌位。</p>
              </div>
            ) : (
              <div className="option-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 className="checkout-section-title">👤 外帶聯絡資訊 (需LINE驗證)</h4>
                
                <div className="form-group">
                  <label htmlFor="cust-name">訂購姓名 <span style={{ color: 'var(--accent)' }}>*</span></label>
                  <input 
                    type="text" 
                    id="cust-name" 
                    placeholder="請輸入取餐姓名" 
                    required 
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cust-phone">手機號碼 <span style={{ color: 'var(--accent)' }}>*</span></label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="tel" 
                      id="cust-phone" 
                      placeholder="例: 0912345678" 
                      required 
                      disabled={phoneVerified}
                      value={custPhone}
                      onChange={(e) => {
                        setCustPhone(e.target.value);
                        setPhoneVerified(false); // reset verified if number changes
                      }}
                      style={{ flexGrow: 1 }}
                    />
                    {phoneVerified && (
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        color: '#22c55e', 
                        fontWeight: 'bold', 
                        fontSize: '0.85rem' 
                      }}>
                        ✓ 已驗證
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="pickup-time">預計取餐時間</label>
                  <select 
                    id="pickup-time"
                    value={pickupTime}
                    onChange={(e) => {
                      setPickupTime(e.target.value);
                      if (e.target.value !== 'custom') {
                        setCustomPickupTime('');
                      }
                    }}
                  >
                    <option value="10-15分鐘後">10-15 分鐘後 (儘速製作)</option>
                    <option value="20分鐘後">20 分鐘後</option>
                    <option value="30分鐘後">30 分鐘後</option>
                    <option value="1小時後">1 小時後</option>
                    <option value="custom">自訂時間</option>
                  </select>
                  {pickupTime === 'custom' && (
                    <div style={{ marginTop: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="請輸入自訂取餐時間 (如: 18:30 或 2小時後)"
                        value={customPickupTime}
                        onChange={(e) => setCustomPickupTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: '0.85rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment options */}
            <div className="option-group">
              <h4 className="checkout-section-title">💳 付款方式</h4>
              <div className="payment-options">
                {paymentMethodsConfig.counter?.enabled !== false && (
                  <div 
                    className={`payment-option-card ${paymentMethod === 'counter' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('counter')}
                  >
                    <span className="payment-icon">💵</span>
                    <div>
                      <strong>{paymentMethodsConfig.counter?.name || '店內結帳 (到店付款)'}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {paymentMethodsConfig.counter?.desc || '取餐時於櫃檯付款，支援現金與TWQR共同支付'}
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethodsConfig.online?.enabled !== false && (
                  <div 
                    className={`payment-option-card ${paymentMethod === 'online' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('online')}
                  >
                    <span className="payment-icon">💳</span>
                    <div>
                      <strong>{paymentMethodsConfig.online?.name || '線上刷卡'}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {paymentMethodsConfig.online?.desc || '下單即完成付款'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Kitchen notes */}
            <div className="form-group">
              <h4 className="checkout-section-title">✏️ 訂單備註</h4>
              <textarea 
                placeholder="例如：麵線要醋多一點、香菜多一點、外帶不要餐具..." 
                rows="2"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              ></textarea>
            </div>

            {/* Summary */}
            <div className="cart-summary-section" style={{ borderRadius: 'var(--radius-sm)', padding: '16px', marginTop: '10px' }}>
              <div className="summary-row total" style={{ marginTop: 0, paddingTop: 0, border: 'none' }}>
                <span>訂單總金額</span>
                <span>NT$ {cart.reduce((sum, item) => sum + item.totalPrice, 0)}</span>
              </div>
              <button 
                type="submit" 
                className="cart-checkout-btn" 
                style={{ width: '100%' }}
                disabled={isVerifying}
              >
                確認送出訂單
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tracking view */}
      {viewState === 'tracking' && activeOrder && (
        <OrderTracker 
          order={activeOrder} 
          onBackToMenu={() => {
            if (activeOrder.status === 'completed' || activeOrder.status === 'deleted') {
              localStorage.removeItem('active_customer_order_id');
              setActiveOrderId(null);
            }
            setViewState('menu');
          }}
          onEditOrder={handleEditOrder}
          onCancelOrder={handleCancelOrder}
        />
      )}

      {/* Item Customize Modal */}
      {selectedItem && (
        <ItemModal 
          item={selectedItem} 
          onClose={() => {
            setSelectedItem(null);
            if (editingCartItem) {
              setEditingCartItem(null);
              setShowCart(true); // Return to cart basket on cancel
            }
          }} 
          onAddToCart={(item) => {
            handleAddToCart(item);
            setSelectedItem(null);
            if (editingCartItem) {
              setEditingCartItem(null);
              setShowCart(true); // Return to cart basket ONLY when editing an item
            }
          }}
          condimentsAvailability={condimentsAvailability}
          editingCartItem={editingCartItem}
          upgradeCombos={upgradeCombos}
        />
      )}

      {/* Cart Drawer Panel */}
      {showCart && (
        <CartPanel 
          cart={cart} 
          onClose={() => setShowCart(false)} 
          onUpdateQty={handleUpdateQty}
          onCheckout={() => {
            setShowCart(false);
            setViewState('checkout');
          }}
          onEditItem={(cartItem) => {
            const matchedProduct = menuItems.find(p => p.id === cartItem.id);
            if (matchedProduct) {
              setEditingCartItem(cartItem);
              setSelectedItem(matchedProduct);
              setShowCart(false);
            }
          }}
        />
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="modal-backdrop" style={{ zIndex: 300 }}>
          <div className="modal-content" style={{ 
            maxWidth: '400px', 
            borderRadius: '16px', 
            padding: '24px',
            border: '2px solid #06c755'
          }}>
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', marginBottom: '16px' }}>
              <h3 style={{ color: '#06c755', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                💬 LINE 官方帳號驗證
              </h3>
              <button className="close-btn" style={{ position: 'absolute', right: '16px', top: '16px' }} onClick={() => { setShowOtpModal(false); setOtpInput(''); setOtpError(''); confirmationResultRef.current = null; }}>&times;</button>
            </div>
            
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                我們已發送點餐驗證碼。請在下方輸入驗證代碼：
              </p>

              {otpError && (
                <div style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  ⚠️ {otpError}
                </div>
              )}

              <div className="form-group" style={{ textAlign: 'center' }}>
                <input 
                  type="text" 
                  pattern="\d*" 
                  maxLength={6} 
                  required
                  placeholder="請輸入驗證碼"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))} // numbers only
                  style={{ 
                    fontSize: '1.5rem', 
                    letterSpacing: '8px', 
                    textAlign: 'center', 
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    borderColor: '#06c755'
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {resendTimer > 0 ? `可於 ${resendTimer} 秒後重新發送` : '沒收到認證碼？'}
                </span>
                <button 
                  type="button" 
                  onClick={handleStartVerification}
                  disabled={resendTimer > 0 || isVerifying}
                  style={{ 
                    color: resendTimer > 0 ? 'var(--text-muted)' : '#06c755', 
                    fontWeight: 'bold',
                    cursor: resendTimer > 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  重新發送驗證碼
                </button>
              </div>

              <button 
                type="submit" 
                className="cart-checkout-btn" 
                style={{ width: '100%', marginTop: '8px' }}
                disabled={isVerifying}
              >
                {isVerifying ? '驗證中...' : '確認驗證並送出訂單'}
              </button>
            </form>
          </div>
        </div>
      )}
      {showOrderConfirmModal && (
        <div className="modal-backdrop" style={{ zIndex: 400 }}>
          <div className="modal-content" style={{ maxWidth: '400px', borderRadius: '16px', padding: '24px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>🛒 請確認您的訂單資訊</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', marginBottom: '20px' }}>
              <div><strong>訂購姓名：</strong>{custName || '未填寫'}</div>
              {!tableNumber && <div><strong>聯絡電話：</strong>{custPhone}</div>}
              {tableNumber && <div><strong>內用桌號：</strong>{tableNumber} 號桌</div>}
              <div><strong>取餐方式：</strong>{tableNumber ? '內用' : `外帶自取 (${pickupTime === 'custom' ? customPickupTime : pickupTime})`}</div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '8px' }}>
                <strong>點購商品明細：</strong>
                <div style={{ maxHeight: '180px', overflowY: 'auto', paddingLeft: '4px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cart.map(item => (
                    <div key={item.cartId} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: '6px', marginBottom: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        <span>{item.name} x{item.quantity}</span>
                        <span>NT$ {item.totalPrice}</span>
                      </div>
                      {item.specs && item.specs.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '8px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {item.specs.map((spec, sIdx) => {
                            const parts = spec.split(/[|]/).map(p => p.trim());
                            return parts.map((part, pIdx) => (
                              <span key={`${sIdx}-${pIdx}`}>- {part}</span>
                            ));
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {remarks && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '8px' }}>
                  <strong>訂單備註：</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{remarks}</div>
                </div>
              )}
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--primary)', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>實付總額:</span>
                <span>NT$ {cart.reduce((sum, item) => sum + item.totalPrice, 0)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowOrderConfirmModal(false)}
                className="cart-checkout-btn"
                style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }}
              >
                修改內容
              </button>
              <button
                onClick={() => {
                  setShowOrderConfirmModal(false);
                  submitOrder(true);
                }}
                className="cart-checkout-btn"
                style={{ flex: 1.5 }}
              >
                確定送出訂單
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
