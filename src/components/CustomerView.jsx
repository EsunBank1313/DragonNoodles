import React, { useState, useEffect, useRef } from 'react';
import { menuCategories, menuItems as defaultMenuItems, luzhouFallbackMenuItems, defaultUpgradeCombos, isComboApplicableToItem } from '../data/menuData';
import ItemModal from './ItemModal';

import CartPanel from './CartPanel';
import OrderTracker from './OrderTracker';
import { supabase } from '../supabaseClient';
import { getActiveStoreCode, filterItemsByStore, prefixNameForStore } from '../utils/storeContext';
import { getStoredCustomerAuth, initCustomerAuth, loginWithCustomerProvider, logoutCustomerAuth } from '../utils/customerAuthHelper';
import { initLiff, loginWithLine, logoutLine } from '../utils/liffHelper';

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
  // If order_number starts with 'U-', it is uber (Uber Eats 外送)
  // If order_number starts with 'P-', it is foodpanda (熊貓外送)
  // If order_number starts with 'O-', it is takeout (現場外帶)
  // If order_number starts with 'I-', it is dine-in (內用)
  const orderNumStr = String(dbOrder.order_number || '');
  let finalType = 'takeout';
  if (orderNumStr.startsWith('U-') || orderNumStr.startsWith('U') || dbOrder.type === 'uber' || dbOrder.type === 'ubereats') {
    finalType = 'uber';
  } else if (orderNumStr.startsWith('P-') || orderNumStr.startsWith('P') || dbOrder.type === 'foodpanda' || dbOrder.type === 'panda') {
    finalType = 'foodpanda';
  } else if (orderNumStr.startsWith('D-') || dbOrder.type === 'delivery') {
    finalType = 'delivery';
  } else if (orderNumStr.startsWith('I-') || orderNumStr.startsWith('I') || dbOrder.type === 'dine-in') {
    finalType = 'dine-in';
  } else {
    finalType = 'takeout';
  }

  const tableName = dbOrder.table_number || itemsData.table_number || null;
  let customerName = itemsData.customerName || '';
  if (!customerName) {
    if (finalType === 'uber') {
      customerName = '🛵 外送 (Uber Eats)';
    } else if (finalType === 'foodpanda') {
      customerName = '🐼 外送 (foodpanda)';
    } else if (finalType === 'delivery') {
      customerName = '🛵 外送';
    } else {
      customerName = finalType === 'dine-in' ? (tableName ? `內用 ${tableName} 號桌` : '內用點餐') : '現場外帶';
    }
  }
  const authUser = itemsData.authUser || itemsData.customerAuth || (itemsData.lineUser ? { provider: 'line', displayName: itemsData.lineUser.displayName } : null);
  if (authUser?.displayName && !customerName.includes(authUser.displayName)) {
    const pTag = authUser.provider === 'google' ? 'Google' : (authUser.provider === 'apple' ? 'Apple' : 'LINE');
    customerName = `${customerName} [${pTag}:${authUser.displayName}]`;
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
    source: itemsData.source || (itemsData.cashier ? 'pos' : 'customer'),
    lineUser: itemsData.lineUser || null,
    authUser: authUser || null
  };
};

// Helper to get branding metadata for auth providers (LINE, Google, Apple)
export const getCustomerProviderMeta = (provider) => {
  const p = (provider || 'line').toLowerCase();
  if (p === 'google') {
    return {
      name: 'Google',
      label: 'Google已認證',
      color: '#4285f4',
      bgLight: '#eff6ff',
      borderLight: '#bfdbfe',
      textColor: '#1d4ed8',
      initial: 'G',
      icon: (
        <svg width="18" height="18" viewBox="0 0 48 48" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
      )
    };
  }
  if (p === 'apple') {
    return {
      name: 'Apple',
      label: 'Apple已認證',
      color: '#000000',
      bgLight: '#f3f4f6',
      borderLight: '#e5e7eb',
      textColor: '#111827',
      initial: '',
      icon: (
        <svg width="18" height="18" viewBox="0 0 170 170" fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.59-7.78-11.72-14.21-6.14-9.5-10.96-20.48-14.45-32.96-3.49-12.47-5.24-24.16-5.24-35.07 0-15.34 3.73-28.05 11.19-38.13 7.46-10.08 17.06-15.24 28.8-15.49 4.35 0 9.29 1.14 14.81 3.42 5.53 2.28 9.38 3.48 11.56 3.59 1.74 0 5.86-1.3 12.37-3.92 6.51-2.61 11.95-3.75 16.32-3.41 12.7.76 22.84 5.34 30.43 13.73-11.09 6.75-16.53 16.22-16.32 28.4.22 9.57 3.81 17.63 10.77 24.17 6.96 6.54 15.35 10.15 25.17 10.82-2.18 6.53-4.9 13.12-8.16 19.78zM119.22 31.84c0-7.39 2.67-14.42 8.01-21.09 5.34-6.67 11.97-10.58 19.89-11.75.22 1.09.33 2.07.33 2.94 0 7.39-2.83 14.63-8.49 21.72-5.66 7.09-12.44 11.08-20.34 11.98-.22-1.31-.33-2.31-.33-3.8z" />
        </svg>
      )
    };
  }
  // Default: LINE
  return {
    name: 'LINE',
    label: 'LINE已認證',
    color: '#06c755',
    bgLight: '#f0fdf4',
    borderLight: '#bbf7d0',
    textColor: '#15803d',
    initial: 'L',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#06c755" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <path d="M12 2C6.48 2 2 5.92 2 10.76c0 3.09 1.83 5.82 4.67 7.37-.2.75-.72 2.73-.83 3.16-.13.54.2.53.42.38.17-.11 2.39-1.63 3.36-2.3 0.77.15 1.57.23 2.38.23 5.52 0 10-3.92 10-8.76C22 5.92 17.52 2 12 2z" />
      </svg>
    )
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

// Date & time helpers for reservation and pickup scheduling
const getTomorrowFormatted = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}`;
};

const getDayAfterTomorrowFormatted = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}`;
};

const getRelativeClockTime = (minutes) => {
  const d = new Date(Date.now() + minutes * 60000);
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getTodayISODate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const [pickupMode, setPickupMode] = useState('asap'); // 'asap', 'today_later', 'future_date'
  const [quickMinutes, setQuickMinutes] = useState(20);
  const [specificTime, setSpecificTime] = useState('');
  const [futureDate, setFutureDate] = useState('tomorrow');
  const [customDateInput, setCustomDateInput] = useState('');
  const [customPickupNote, setCustomPickupNote] = useState('');

  const getFinalPickupTimeDisplay = () => {
    if (customPickupNote && customPickupNote.trim()) {
      return customPickupNote.trim();
    }
    if (pickupMode === 'asap') {
      const est = getRelativeClockTime(15);
      return `儘速取餐 (約10-15分鐘，約 ${est})`;
    }
    if (pickupMode === 'today_later') {
      if (specificTime) {
        return `今天 ${specificTime} (預約取餐)`;
      }
      const est = getRelativeClockTime(quickMinutes);
      return `今日約 ${quickMinutes} 分鐘後 (約 ${est})`;
    }
    if (pickupMode === 'future_date') {
      let dateLabel = '';
      if (futureDate === 'tomorrow') {
        dateLabel = `明天 (${getTomorrowFormatted()})`;
      } else if (futureDate === 'day_after') {
        dateLabel = `後天 (${getDayAfterTomorrowFormatted()})`;
      } else if (customDateInput) {
        dateLabel = customDateInput;
      } else {
        dateLabel = '預約日';
      }
      const timeLabel = specificTime || '12:00';
      return `${dateLabel} ${timeLabel} (預約取餐)`;
    }
    return '儘速取餐 (約10-15分鐘)';
  };

  const [paymentMethod, setPaymentMethod] = useState('counter');

  const [allOrders, setAllOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);

  // Customer Order History Modal State
  const [showOrderHistoryModal, setShowOrderHistoryModal] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleOpenOrderHistory = async () => {
    setShowOrderHistoryModal(true);
    setIsLoadingHistory(true);
    try {
      const savedActiveId = localStorage.getItem('active_customer_order_id');
      const authUserId = customerAuth?.userId;

      // Query recent customer orders
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      if (data && data.length > 0) {
        const formatted = data.map(formatSupabaseOrder).filter(Boolean);
        const filtered = formatted.filter(o => {
          if (savedActiveId && String(o.id) === String(savedActiveId)) return true;
          if (authUserId && (o.authUser?.userId === authUserId || o.lineUser?.userId === authUserId)) return true;
          if (custPhone && o.customerPhone && o.customerPhone === custPhone) return true;
          return false;
        });
        setHistoryOrders(filtered);
      } else {
        setHistoryOrders([]);
      }
    } catch (err) {
      console.warn("Failed to load customer order history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

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

  // Unified Customer Authentication state (LINE, Google, Apple)
  const [customerAuth, setCustomerAuth] = useState(() => getStoredCustomerAuth());
  const lineUser = customerAuth; // backward-compatible alias for all existing references
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const showLineAuthModal = showAuthModal; // backward-compatible alias
  const setShowLineAuthModal = setShowAuthModal; // backward-compatible alias

  useEffect(() => {
    let isMounted = true;
    const setupAuth = async () => {
      try {
        const res = await initCustomerAuth((updatedAuth) => {
          if (!isMounted) return;
          setCustomerAuth(updatedAuth);
          if (updatedAuth?.displayName) {
            setCustName(prev => prev || updatedAuth.displayName || '');
          }
        });
        if (!isMounted) return;
        setIsAuthReady(res.isReady);
        if (res.authUser) {
          setCustomerAuth(res.authUser);
          if (res.authUser.displayName) {
            setCustName(prev => prev || res.authUser.displayName || '');
          }
        }
      } catch (err) {
        console.warn("Customer auth init error:", err);
      }
    };
    setupAuth();
    return () => { isMounted = false; };
  }, []);

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

    // 🛡️ LINE 認證防惡意點餐保護：未通過 LINE 認證強制阻擋並彈窗提示
    if (!lineUser) {
      setShowLineAuthModal(true);
      return;
    }

    // Validate customer name
    if (!tableNumber) {
      const currentName = custName.trim() || lineUser?.displayName || '';
      if (!currentName) {
        alert('請填寫訂購姓名！');
        return;
      }
      if (custPhone && !isValidTaiwanMobile(custPhone)) {
        alert('請輸入正確的台灣手機號碼格式 (例如: 0912345678)');
        return;
      }
      if (custPhone && blacklist.some(b => b.phone === custPhone)) {
        alert("⚠️ 您的號碼已被系統列入黑名單，無法進行線上點餐。如有疑問請聯絡店家！");
        return;
      }
    }

    // Direct to confirm modal
    setShowOrderConfirmModal(true);
  };

  const submitOrder = async (verified = false) => {
    if (!lineUser) {
      setShowLineAuthModal(true);
      return;
    }

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
      const authUser = customerAuth;
      const authName = authUser?.displayName || '';
      const finalCustomerName = tableNumber 
        ? `內用 ${tableNumber} 號桌${authName ? ` (${authName})` : ''}`
        : `${custName.trim() || authName || '現場顧客'}`;

      const orderPayload = {
        order_number: serialNum,
        items: {
          source: 'customer',
          channel: '線上點餐',
          orderChannel: '線上點餐',
          storeCode: storeCode,
          store_code: storeCode,
          cart: cart,
          customerName: finalCustomerName,
          customerPhone: tableNumber ? '' : custPhone,
          pickupTime: tableNumber ? '' : getFinalPickupTimeDisplay(),
          paymentMethod,
          remarks,
          customerAuth: authUser ? {
            provider: authUser.provider,
            userId: authUser.userId,
            displayName: authUser.displayName,
            pictureUrl: authUser.pictureUrl || '',
            email: authUser.email || ''
          } : null,
          authUser: authUser ? {
            provider: authUser.provider,
            userId: authUser.userId,
            displayName: authUser.displayName,
            pictureUrl: authUser.pictureUrl || '',
            email: authUser.email || ''
          } : null,
          lineUser: authUser ? {
            userId: authUser.userId,
            displayName: authUser.displayName,
            pictureUrl: authUser.pictureUrl || ''
          } : null
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
          <div style={{ marginTop: '16px', fontSize: '0.85rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <a href="/privacy.html" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>隱私權政策 (Privacy Policy)</a>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <a href="/terms.html" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>服務條款 (Terms of Service)</a>
          </div>
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
        <div style={{ marginTop: '24px', fontSize: '0.85rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href="/privacy.html" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>隱私權政策 (Privacy Policy)</a>
          <span style={{ color: 'var(--text-muted)' }}>|</span>
          <a href="/terms.html" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>服務條款 (Terms of Service)</a>
        </div>
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

      {/* 🔐 顧客身分認證狀態條 (LINE / Google / Apple) */}
      {(() => {
        const providerInfo = customerAuth ? getCustomerProviderMeta(customerAuth.provider) : null;
        return (
          <div style={{
            margin: '10px 16px 4px 16px',
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: customerAuth ? (providerInfo?.bgLight || '#f0fdf4') : '#fffbeb',
            border: customerAuth ? `1px solid ${providerInfo?.borderLight || '#bbf7d0'}` : '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            fontSize: '0.85rem'
          }}>
            {customerAuth ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                {customerAuth.pictureUrl ? (
                  <img 
                    src={customerAuth.pictureUrl} 
                    alt={customerAuth.displayName} 
                    style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${providerInfo?.color || '#22c55e'}` }}
                  />
                ) : (
                  <span style={{ 
                    width: '34px', 
                    height: '34px', 
                    borderRadius: '50%', 
                    backgroundColor: providerInfo?.color || '#22c55e', 
                    color: '#fff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 'bold', 
                    fontSize: '0.95rem' 
                  }}>
                    {providerInfo?.initial || '✓'}
                  </span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 'bold', color: providerInfo?.textColor || '#15803d' }}>{customerAuth.displayName}</span>
                    <span style={{ 
                      backgroundColor: providerInfo?.color || '#22c55e', 
                      color: 'white', 
                      fontSize: '0.65rem', 
                      padding: '1px 7px', 
                      borderRadius: '10px', 
                      fontWeight: 'bold' 
                    }}>
                      {providerInfo?.label || '已認證'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>已具備快速點餐資格</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontSize: '0.82rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📋</span>
                <div>
                  <div style={{ fontWeight: 'bold' }}>請註冊/登入會員</div>
                  <div style={{ fontSize: '0.72rem', color: '#b45309' }}>以查詢訂單記錄</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => handleOpenOrderHistory()}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#4338ca',
                  border: '1.5px solid #c7d2fe',
                  borderRadius: '8px',
                  padding: '5px 9px',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  whiteSpace: 'nowrap'
                }}
                title="查詢歷史訂單與即時出餐進度"
              >
                <span>📋</span> 查詢訂單
              </button>

              {customerAuth ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('確定要切換或登出目前帳號嗎？')) {
                      logoutCustomerAuth(customerAuth);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #d1d5db',
                    color: '#6b7280',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '4px 7px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  登出
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  style={{
                    backgroundColor: '#1f2937',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>🔐</span> 登入
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ⚡ 進行中訂單即時進度常駐浮動條 */}
      {viewState === 'menu' && activeOrder && activeOrder.status !== 'completed' && activeOrder.status !== 'deleted' && activeOrder.status !== 'cancelled' && activeOrder.status !== 'rejected' && (
        <div 
          onClick={() => setViewState('tracking')}
          style={{
            margin: '8px 16px 12px 16px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: activeOrder.status === 'ready' 
              ? 'linear-gradient(135deg, #059669, #10b981)' 
              : (activeOrder.status === 'preparing' 
                ? 'linear-gradient(135deg, #7c3aed, #6366f1)' 
                : 'linear-gradient(135deg, #ea580c, #f97316)'),
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <span style={{ fontSize: '1.3rem' }}>
              {activeOrder.status === 'ready' ? '🎉' : (activeOrder.status === 'preparing' ? '🍜' : '⏳')}
            </span>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>訂單【{activeOrder.serialNum || activeOrder.id}】</span>
                <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '8px' }}>
                  {activeOrder.status === 'ready' ? '製作完成' : (activeOrder.status === 'preparing' ? '收單製作中' : '等待收單')}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.92, marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {activeOrder.status === 'ready' ? '餐點已熱騰騰完成，點此查看取餐號碼！' : (activeOrder.status === 'preparing' ? '店家正用心烹調中，點此查看進度' : '已送達店家排單，點此查看即時進度')}
              </div>
            </div>
          </div>
          <span style={{ backgroundColor: '#ffffff', color: '#1f2937', padding: '5px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '900', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            進度 ›
          </span>
        </div>
      )}

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
                  <div><strong>預計取餐時間：</strong><span style={{ color: '#ea580c', fontWeight: 'bold' }}>{getFinalPickupTimeDisplay()}</span></div>
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
              <div className="option-group" style={{ backgroundColor: 'rgba(255,107,53,0.03)', padding: '16px', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '4px' }}>🍽️ 掃碼內用確認</h4>
                <p style={{ fontSize: '0.9rem' }}>已鎖定 <strong>{tableNumber} 號桌</strong>。餐點製作完成後將會直接送至您的桌位。</p>
                {customerAuth ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#166534', backgroundColor: '#f0fdf4', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '1rem' }}>✓</span>
                    <span>{getCustomerProviderMeta(customerAuth.provider).label}顧客：<strong>{customerAuth.displayName}</strong></span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fffbeb', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <span style={{ fontSize: '0.8rem', color: '#92400e' }}>請註冊/登入會員，以查詢訂單記錄</span>
                    <button type="button" onClick={() => setShowAuthModal(true)} style={{ backgroundColor: '#1f2937', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>🔐 登入驗證</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="option-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 className="checkout-section-title">👤 外帶聯絡資訊</h4>

                {/* 顧客身分認證狀態卡片 */}
                {customerAuth ? (() => {
                  const pMeta = getCustomerProviderMeta(customerAuth.provider);
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: pMeta.bgLight,
                      border: `1px solid ${pMeta.borderLight}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {customerAuth.pictureUrl ? (
                          <img src={customerAuth.pictureUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${pMeta.color}` }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: pMeta.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {pMeta.initial}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 'bold', color: pMeta.textColor, fontSize: '0.9rem' }}>{customerAuth.displayName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>✓ {pMeta.label}通過</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: pMeta.textColor, fontWeight: 'bold', backgroundColor: '#ffffff', padding: '4px 8px', borderRadius: '20px', border: `1px solid ${pMeta.borderLight}` }}>已驗證</span>
                    </div>
                  );
                })() : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                      <div>👤 尚未登入會員</div>
                      <div style={{ fontSize: '0.75rem', color: '#b45309' }}>請註冊/登入會員，以查詢訂單記錄</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      style={{
                        backgroundColor: '#1f2937',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      🔐 登入驗證
                    </button>
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="cust-name">訂購姓名 <span style={{ color: 'var(--accent)' }}>*</span></label>
                  <input 
                    type="text" 
                    id="cust-name" 
                    placeholder="請輸入取餐姓名" 
                    required 
                    value={custName || (lineUser ? lineUser.displayName : '')}
                    onChange={(e) => setCustName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cust-phone">手機號碼 (選填，方便到店備用連絡)</label>
                  <input 
                    type="tel" 
                    id="cust-phone" 
                    placeholder="例: 0912345678 (選填)" 
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>⏰ 取餐 / 預定時間</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>提供預約與即時排單</span>
                  </label>

                  {/* Mode Tabs: 儘速取餐 / 今日稍後 / 預約日期 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '6px',
                    marginBottom: '10px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setPickupMode('asap')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: pickupMode === 'asap' ? '2px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: pickupMode === 'asap' ? '#fff7ed' : 'var(--bg-card)',
                        color: pickupMode === 'asap' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: pickupMode === 'asap' ? 'bold' : 'normal',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span>⚡ 儘速製作</span>
                      <span style={{ fontSize: '0.68rem', color: pickupMode === 'asap' ? 'var(--primary)' : 'var(--text-muted)' }}>10-15分</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPickupMode('today_later')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: pickupMode === 'today_later' ? '2px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: pickupMode === 'today_later' ? '#fff7ed' : 'var(--bg-card)',
                        color: pickupMode === 'today_later' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: pickupMode === 'today_later' ? 'bold' : 'normal',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span>⏰ 今日稍後</span>
                      <span style={{ fontSize: '0.68rem', color: pickupMode === 'today_later' ? 'var(--primary)' : 'var(--text-muted)' }}>指定時間</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPickupMode('future_date')}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: pickupMode === 'future_date' ? '2px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: pickupMode === 'future_date' ? '#fff7ed' : 'var(--bg-card)',
                        color: pickupMode === 'future_date' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: pickupMode === 'future_date' ? 'bold' : 'normal',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span>📅 預約日期</span>
                      <span style={{ fontSize: '0.68rem', color: pickupMode === 'future_date' ? 'var(--primary)' : 'var(--text-muted)' }}>明天/後天</span>
                    </button>
                  </div>

                  {/* Mode Sub-options */}
                  {pickupMode === 'asap' && (
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)'
                    }}>
                      ⚡ 現點現做，送單後廚房將立即備料排單（預計約 10~15 分鐘後完成）。
                    </div>
                  )}

                  {pickupMode === 'today_later' && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        快捷時間選擇：
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {[20, 30, 45, 60].map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              setQuickMinutes(mins);
                              setSpecificTime('');
                            }}
                            style={{
                              padding: '6px 2px',
                              borderRadius: '6px',
                              border: (!specificTime && quickMinutes === mins) ? '2px solid #ea580c' : '1px solid #cbd5e1',
                              backgroundColor: (!specificTime && quickMinutes === mins) ? '#fff7ed' : '#ffffff',
                              color: (!specificTime && quickMinutes === mins) ? '#ea580c' : '#334155',
                              fontWeight: (!specificTime && quickMinutes === mins) ? 'bold' : 'normal',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            +{mins}分鐘
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>或指定時間：</span>
                        <input
                          type="time"
                          value={specificTime}
                          onChange={(e) => setSpecificTime(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '0.85rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            backgroundColor: '#fff'
                          }}
                        />
                        {specificTime && (
                          <button
                            type="button"
                            onClick={() => setSpecificTime('')}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.72rem',
                              color: '#64748b',
                              background: '#e2e8f0',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            清除
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {pickupMode === 'future_date' && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '10px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                        選擇預約日期：
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => { setFutureDate('tomorrow'); setCustomDateInput(''); }}
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: futureDate === 'tomorrow' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                            backgroundColor: futureDate === 'tomorrow' ? '#fff7ed' : '#ffffff',
                            color: futureDate === 'tomorrow' ? '#ea580c' : '#334155',
                            fontWeight: futureDate === 'tomorrow' ? 'bold' : 'normal',
                            fontSize: '0.78rem',
                            cursor: 'pointer'
                          }}
                        >
                          明天 ({getTomorrowFormatted()})
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFutureDate('day_after'); setCustomDateInput(''); }}
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: futureDate === 'day_after' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                            backgroundColor: futureDate === 'day_after' ? '#fff7ed' : '#ffffff',
                            color: futureDate === 'day_after' ? '#ea580c' : '#334155',
                            fontWeight: futureDate === 'day_after' ? 'bold' : 'normal',
                            fontSize: '0.78rem',
                            cursor: 'pointer'
                          }}
                        >
                          後天 ({getDayAfterTomorrowFormatted()})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFutureDate('custom')}
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: futureDate === 'custom' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                            backgroundColor: futureDate === 'custom' ? '#fff7ed' : '#ffffff',
                            color: futureDate === 'custom' ? '#ea580c' : '#334155',
                            fontWeight: futureDate === 'custom' ? 'bold' : 'normal',
                            fontSize: '0.78rem',
                            cursor: 'pointer'
                          }}
                        >
                          其他日期
                        </button>
                      </div>

                      {futureDate === 'custom' && (
                        <input
                          type="date"
                          min={getTodayISODate()}
                          value={customDateInput}
                          onChange={(e) => setCustomDateInput(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: '0.85rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            backgroundColor: '#fff'
                          }}
                        />
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>預定取餐時間：</span>
                        <input
                          type="time"
                          value={specificTime || '12:00'}
                          onChange={(e) => setSpecificTime(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '0.85rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            backgroundColor: '#fff'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 補充自訂備註 */}
                  <div style={{ marginTop: '8px' }}>
                    <input
                      type="text"
                      placeholder="補充自訂備註 (選填，如: 請於12:30前備妥)"
                      value={customPickupNote}
                      onChange={(e) => setCustomPickupNote(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)'
                      }}
                    />
                  </div>

                  {/* Live Selected Time Banner */}
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#ecfdf5',
                    borderRadius: '8px',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>🕒</span>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#065f46' }}>目前預定取餐時間：</div>
                      <div style={{ fontWeight: 'bold', color: '#047857', fontSize: '0.88rem' }}>
                        {getFinalPickupTimeDisplay()}
                      </div>
                    </div>
                  </div>
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
              {customerAuth ? (
                <button 
                  type="submit" 
                  className="cart-checkout-btn" 
                  style={{ width: '100%' }}
                  disabled={isVerifying}
                >
                  確認送出訂單 ({getCustomerProviderMeta(customerAuth.provider).name}認證: {customerAuth.displayName})
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setShowAuthModal(true)} 
                  className="cart-checkout-btn" 
                  style={{ 
                    width: '100%', 
                    backgroundColor: '#1f2937', 
                    borderColor: '#1f2937',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>🔐</span> 請先點此登入驗證（LINE / Google / Apple）
                </button>
              )}
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

      {/* 🛡️ 顧客身分認證提示彈窗 (LINE / Google / Apple) */}
      {showAuthModal && (
        <div className="modal-backdrop" style={{ zIndex: 500 }} onClick={() => setShowAuthModal(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '400px', borderRadius: '24px', padding: '28px 22px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              width: '60px', 
              height: '60px', 
              backgroundColor: '#eff6ff', 
              borderRadius: '50%', 
              margin: '0 auto 14px auto', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '1.8rem',
              border: '2px solid #bfdbfe'
            }}>
              🔐
            </div>
            
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>
              請註冊 / 登入會員
            </h3>
            
            <p style={{ fontSize: '0.84rem', color: '#4b5563', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              請註冊/登入會員，以查詢訂單記錄。<strong>{storeName}</strong> 支援常用快速授權，請選擇一種方式登入：
            </p>

            {/* 登入選項按鈕列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              {/* LINE 登入按鈕 */}
              <button
                type="button"
                onClick={() => loginWithCustomerProvider('line')}
                style={{
                  width: '100%',
                  backgroundColor: '#06c755',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 3px 8px rgba(6,199,85,0.25)',
                  transition: 'transform 0.1s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M12 2C6.48 2 2 5.92 2 10.76c0 3.09 1.83 5.82 4.67 7.37-.2.75-.72 2.73-.83 3.16-.13.54.2.53.42.38.17-.11 2.39-1.63 3.36-2.3 0.77.15 1.57.23 2.38.23 5.52 0 10-3.92 10-8.76C22 5.92 17.52 2 12 2z" />
                  </svg>
                  <span>使用 LINE 帳號登入</span>
                </div>
                <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '10px' }}>推薦</span>
              </button>

              {/* Google 登入按鈕 */}
              <button
                type="button"
                onClick={() => loginWithCustomerProvider('google')}
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#3c4043',
                  border: '1px solid #dadce0',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(60,64,67,0.08)',
                  transition: 'transform 0.1s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span>使用 Google 帳號登入</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#5f6368' }}>免密碼</span>
              </button>
            </div>

            {/* 安全認證保障說明 */}
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '12px 14px',
              borderRadius: '12px',
              marginBottom: '16px',
              textAlign: 'left',
              fontSize: '0.78rem',
              color: '#475569',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span> 免繁瑣註冊密碼，一秒授權快速辨識
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span> 訂單即時綁定，取餐不拿錯、防冒領
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span> 僅用於訂單狀態與核對，絕不發送垃圾廣告
              </div>
            </div>

            <div style={{ fontSize: '0.74rem', color: '#64748b', textAlign: 'center', marginBottom: '14px', lineHeight: '1.4' }}>
              登入即代表您已閱讀並同意龍城麵線之<br />
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: '500' }}>隱私權政策 (Privacy Policy)</a> 與 <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: '500' }}>服務條款</a>
            </div>

            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              返回繼續瀏覽菜單
            </button>
          </div>
        </div>
      )}

      {/* 📋 顧客訂單查詢與歷史紀錄彈窗 */}
      {showOrderHistoryModal && (
        <div className="modal-backdrop" style={{ zIndex: 600 }} onClick={() => setShowOrderHistoryModal(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '440px', maxHeight: '85vh', borderRadius: '22px', padding: '24px 20px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>📋</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    我的點餐紀錄
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {customerAuth ? `會員：${customerAuth.displayName}` : '訪客裝置訂單查詢'}
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowOrderHistoryModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 8px' }}
              >
                ×
              </button>
            </div>

            {/* Orders List */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isLoadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  ⏳ 載入訂單紀錄中...
                </div>
              ) : historyOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🥣</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '6px' }}>
                    尚無訂單紀錄
                  </div>
                  <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#6b7280' }}>
                    {customerAuth 
                      ? '您在此帳號下尚未送出過訂單。送單後即可在此即時追蹤每一筆出餐進度！' 
                      : '送單完成後將在此顯示取餐進度。登入會員（LINE / Google / Apple）可跨裝置同步紀錄！'}
                  </div>
                  {!customerAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowOrderHistoryModal(false);
                        setShowAuthModal(true);
                      }}
                      style={{
                        marginTop: '16px',
                        backgroundColor: '#1f2937',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      🔐 立即登入會員
                    </button>
                  )}
                </div>
              ) : (
                historyOrders.map(order => {
                  const getStatusBadge = (status) => {
                    switch (status) {
                      case 'cancelled':
                      case 'rejected':
                        return { text: '❌ 無法提供', bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' };
                      case 'ready':
                      case 'completed':
                        return { text: '✔ 製作完成', bg: '#dcfce7', color: '#15803d', border: '#86efac' };
                      case 'preparing':
                        return { text: '🍜 收單製作中', bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' };
                      case 'received':
                      default:
                        return { text: '⏳ 等待收單', bg: '#ffedd5', color: '#c2410c', border: '#fdba74' };
                    }
                  };
                  const badge = getStatusBadge(order.status);
                  const isUnfinished = order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'rejected' && order.status !== 'deleted';

                  return (
                    <div 
                      key={order.id}
                      onClick={() => {
                        setActiveOrderId(String(order.id));
                        setAllOrders([order]);
                        setViewState('tracking');
                        setShowOrderHistoryModal(false);
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: isUnfinished ? '2px solid #8b5cf6' : '1px solid var(--border)',
                        backgroundColor: isUnfinished ? '#faf5ff' : 'var(--bg-body)',
                        boxShadow: isUnfinished ? '0 2px 8px rgba(139, 92, 246, 0.15)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '900', fontSize: '0.98rem', color: 'var(--primary)' }}>
                            單號: {order.serialNum || order.id}
                          </span>
                          <span style={{ fontSize: '0.68rem', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            📱 線上點餐
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {order.time}
                          </span>
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 'bold',
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}>
                          {badge.text}
                        </span>
                      </div>

                      {/* Items preview */}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                        {(order.items || []).map(i => `${i.name} x${i.quantity}`).join('、')}
                      </div>

                      {order.pickupTime && (
                        <div style={{ fontSize: '0.74rem', color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                          ⏰ 預定取餐: {order.pickupTime}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                          實付總額: NT$ {order.total}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 'bold' }}>
                          查看進度與明細 ›
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer refresh button */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleOpenOrderHistory}
                disabled={isLoadingHistory}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: 'var(--bg-body)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  color: 'var(--text-main)'
                }}
              >
                🔄 重新整理
              </button>
              <button
                type="button"
                onClick={() => setShowOrderHistoryModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
