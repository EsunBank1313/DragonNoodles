import React, { useState, useEffect, useRef, useMemo } from 'react';
import { menuCategories, menuItems as defaultMenuItems, luzhouFallbackMenuItems, defaultUpgradeCombos, isComboApplicableToItem } from '../data/menuData';
import ItemModal from './ItemModal';

import CartPanel from './CartPanel';
import OrderTracker from './OrderTracker';
import GroupOrderShareModal from './GroupOrderShareModal';
import { 
  getGroupRoom, 
  subscribeGroupRoom, 
  isHostOfRoom, 
  addItemToGroupRoom, 
  updateGroupRoomStatus,
  buildGroupOrderUrl 
} from '../services/groupOrderService';
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
      customerName = '🛵 Lalamove 外送';
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
    deliveryAddress: itemsData.deliveryAddress || dbOrder.delivery_address || '',
    deliveryFee: Number(itemsData.deliveryFee || dbOrder.delivery_fee || 0),
    deliveryType: itemsData.deliveryType || (finalType === 'delivery' ? 'lalamove' : ''),
    transferLast5: itemsData.transferLast5 || '',
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
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(`${storeCode}_customer_cart`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved cart:", e);
    }
    return [];
  });
  
  const [custName, setCustName] = useState(() => getStoredCustomerAuth()?.displayName || '');
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

  const [paymentMethod, setPaymentMethod] = useState('linepay');
  const [fulfillmentType, setFulfillmentType] = useState('takeout'); // 'takeout' | 'delivery'
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFloorNote, setDeliveryFloorNote] = useState('');
  const [transferLast5, setTransferLast5] = useState('');
  const [copiedBankNotice, setCopiedBankNotice] = useState(false);

  const [allOrders, setAllOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [showStoreDetailsModal, setShowStoreDetailsModal] = useState(false);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);

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
  const [showGroupShareModal, setShowGroupShareModal] = useState(false);
  
  // 👥 Group Order Room State (多人即時協同揪團點餐)
  const [activeGroupRoom, setActiveGroupRoom] = useState(null);
  const [participantName, setParticipantName] = useState(() => {
    try {
      return localStorage.getItem('group_participant_name') || '';
    } catch {
      return '';
    }
  });
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [pendingCartItemForGroup, setPendingCartItemForGroup] = useState(null);
  const [groupToastMsg, setGroupToastMsg] = useState('');

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

  // 🛒 購物車持久化儲存：避免顧客在轉跳 LINE 或 Google 授權認證重新整理時，購物車內容遺失清空
  useEffect(() => {
    try {
      if (cart && cart.length > 0) {
        localStorage.setItem(`${storeCode}_customer_cart`, JSON.stringify(cart));
      } else {
        localStorage.removeItem(`${storeCode}_customer_cart`);
      }
    } catch (e) {
      console.warn("Failed to persist customer cart:", e);
    }
  }, [cart, storeCode]);

  // 🔄 OAuth 登入跳回自動前往結帳頁：LINE/Google 授權完成返回後，自動保留購物車並直接進入結帳確認流程
  useEffect(() => {
    try {
      const hasPendingCheckout = sessionStorage.getItem('customer_pending_checkout') === 'true';
      const urlHasOAuth = window.location.hash.includes('access_token') || 
                          window.location.search.includes('code=') || 
                          window.location.search.includes('liff.state=');
      if ((hasPendingCheckout || urlHasOAuth) && cart.length > 0) {
        sessionStorage.removeItem('customer_pending_checkout');
        setViewState('checkout');
      }
    } catch (e) {
      console.warn("Auto checkout restoration error:", e);
    }
  }, [cart.length]);

  // 👥 揪團房間偵測與自動加入 (由 URL ?group=GR-XXXX 或恢復上次使用之房間)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomCodeFromUrl = params.get('group');
      if (roomCodeFromUrl) {
        getGroupRoom(roomCodeFromUrl).then(room => {
          if (room) {
            setActiveGroupRoom(room);
            try { localStorage.setItem('last_active_group_room', room.roomCode); } catch (e) {}
            // 若為團員且尚未設定暱稱，彈出輸入暱稱視窗
            const existingName = localStorage.getItem('group_participant_name') || custName || customerAuth?.displayName || '';
            if (!existingName && !isHostOfRoom(room)) {
              setShowParticipantModal(true);
            }
          }
        });
      } else {
        const lastActive = localStorage.getItem('last_active_group_room');
        if (lastActive) {
          getGroupRoom(lastActive).then(room => {
            if (room && room.status === 'open') {
              setActiveGroupRoom(room);
            }
          });
        }
      }
    } catch (err) {
      console.warn("Group room setup error:", err);
    }
  }, []);

  // 👥 即時監聽揪團房間狀態與餐點推播更新 (Supabase Realtime)
  useEffect(() => {
    if (!activeGroupRoom?.roomCode) return;
    const unsubscribe = subscribeGroupRoom(activeGroupRoom.roomCode, (updatedRoom) => {
      setActiveGroupRoom(updatedRoom);
      if (updatedRoom.status === 'submitted' && updatedRoom.orderNumber) {
        setGroupToastMsg(`🎉 主揪已完成送單結帳！取餐編號: #${updatedRoom.orderNumber}`);
      }
    });
    return () => unsubscribe();
  }, [activeGroupRoom?.roomCode]);

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

  const featuredQuickItems = useMemo(() => {
    if (!menuItems || menuItems.length === 0) return [];
    const available = menuItems.filter(i => i.customizations?.is_available !== false);
    const withImages = available.filter(i => i.image);
    return (withImages.length >= 3 ? withImages : available).slice(0, 4);
  }, [menuItems]);

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
    linepay: { enabled: true, name: 'LINE Pay 行動支付', desc: '手機一鍵跳轉 LINE Pay 快速結帳' },
    twqr_transfer: { enabled: true, name: 'TWQR / 網銀轉帳', desc: '複製玉山銀行帳號轉帳，各大銀行皆可' },
    counter: { enabled: true, name: '店內結帳 (到店付款)', desc: '取餐時於櫃檯付款，支援現金與現場支付' },
    online: { enabled: false, name: '線上刷卡', desc: '下單即完成付款' }
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
            setPaymentMethodsConfig(prev => ({ ...prev, ...parsed }));
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
              setPaymentMethodsConfig(prev => ({ ...prev, ...parsed }));
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
        setCustomPickupNote(orderToEdit.items.pickupTime || '');
      }
      
      // Clear active order state
      localStorage.removeItem('active_customer_order_id');
      setActiveOrderId(null);
      setViewState('checkout');
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
    // 👥 若當前處於揪團點餐房間中，自動同步新增至雲端團體購物車
    if (activeGroupRoom && activeGroupRoom.status === 'open') {
      const isHost = isHostOfRoom(activeGroupRoom);
      const effectiveName = (participantName || custName || customerAuth?.displayName || (isHost ? activeGroupRoom.hostName : '')).trim();

      if (!effectiveName && !isHost) {
        setPendingCartItemForGroup(cartItem);
        setShowParticipantModal(true);
        return;
      }

      const finalName = effectiveName || (isHost ? activeGroupRoom.hostName : '團員');
      const itemWithPerson = {
        ...cartItem,
        forWhom: cartItem.forWhom || finalName
      };

      addItemToGroupRoom(activeGroupRoom.roomCode, itemWithPerson, finalName).catch(err => {
        console.error('Failed to sync item to group room:', err);
      });

      setGroupToastMsg(`✅ 已為【${finalName}】加入團體點餐！主揪與全體團員即時同步！`);
      setTimeout(() => setGroupToastMsg(''), 3500);
    }

    setCart(prev => {
      if (editingCartItem) {
        // Clear editing state and map cartItem to replace the match
        setEditingCartItem(null);
        return prev.map(item => item.cartId === cartItem.cartId ? cartItem : item);
      }

      const existingIdx = prev.findIndex(item => 
        item.id === cartItem.id && 
        JSON.stringify(item.specs) === JSON.stringify(cartItem.specs) &&
        (item.forWhom || '') === (cartItem.forWhom || '')
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

  const handleUpdateItemForWhom = (cartId, forWhom) => {
    setCart(prev => prev.map(item => 
      item.cartId === cartId ? { ...item, forWhom } : item
    ));
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

    // Validate customer name & delivery
    if (!tableNumber) {
      const currentName = custName.trim() || customerAuth?.displayName || lineUser?.displayName || '';
      if (!currentName) {
        alert('請填寫訂購姓名！');
        return;
      }
      if (!custName.trim() && currentName) {
        setCustName(currentName);
      }

      if (fulfillmentType === 'delivery') {
        const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
        if (subtotal < 300) {
          alert(`未達外送門檻：Lalamove 外送需滿 NT$ 300 元，目前小計 NT$ ${subtotal}，還差 NT$ ${300 - subtotal} 元。請再選購餐點！`);
          return;
        }
        if (!custPhone || !custPhone.trim()) {
          alert('請輸入外送連絡手機號碼，以便司機抵達時與您聯繫！');
          return;
        }
        if (!deliveryAddress || !deliveryAddress.trim()) {
          alert('請輸入完整外送送達地址！');
          return;
        }
      }

      if (custPhone && !isValidTaiwanMobile(custPhone)) {
        alert('請輸入正確的台灣手機號碼格式 (例如: 0912345678)');
        return;
      }
      if (custPhone && blacklist.some(b => b.phone === custPhone)) {
        alert("⚠️ 您的號碼已被系統列入黑名單，無法進行線上點餐。如有疑問請聯絡店家！");
        return;
      }

      if (paymentMethod === 'twqr_transfer' && (!transferLast5 || transferLast5.trim().length !== 5)) {
        alert('請填寫轉帳帳號末 5 碼（共 5 碼數字），以便店家為您核對款項！');
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

    const isDelivery = !tableNumber && fulfillmentType === 'delivery';
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const deliveryFee = isDelivery ? (subtotal >= 500 ? 0 : 50) : 0;
    const total = subtotal + deliveryFee;

    // Generate easy-to-read daily sequential serial number (max number + 1 logic to prevent duplicates)
    const orderType = tableNumber ? 'dine-in' : (isDelivery ? 'delivery' : 'takeout');
    const prefix = tableNumber ? 'I' : (isDelivery ? 'D' : 'O');
    
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
      let finalCustomerName = tableNumber 
        ? `內用 ${tableNumber} 號桌${authName ? ` (${authName})` : ''}`
        : `${custName.trim() || authName || (isDelivery ? '外送顧客' : '現場顧客')}`;

      if (activeGroupRoom?.roomCode) {
        finalCustomerName = `${finalCustomerName} (👥 揪團: ${activeGroupRoom.hostName}團 #${activeGroupRoom.roomCode})`;
      }

      const fullDeliveryAddress = isDelivery 
        ? `${deliveryAddress.trim()}${deliveryFloorNote.trim() ? ` (${deliveryFloorNote.trim()})` : ''}`
        : '';

      const pickupTimeDisplay = tableNumber 
        ? '' 
        : (isDelivery ? `🛵 Lalamove 外送 (${getFinalPickupTimeDisplay()})` : getFinalPickupTimeDisplay());

      const orderPayload = {
        order_number: serialNum,
        items: {
          source: 'customer',
          channel: isDelivery ? 'Lalamove外送' : '線上點餐',
          orderChannel: isDelivery ? 'Lalamove外送' : '線上點餐',
          storeCode: storeCode,
          store_code: storeCode,
          cart: cart,
          subtotal: subtotal,
          deliveryFee: deliveryFee,
          fulfillmentType: isDelivery ? 'delivery' : (tableNumber ? 'dine-in' : 'takeout'),
          deliveryType: isDelivery ? 'lalamove' : '',
          deliveryAddress: fullDeliveryAddress,
          transferLast5: paymentMethod === 'twqr_transfer' ? transferLast5.trim() : '',
          customerName: finalCustomerName,
          customerPhone: tableNumber ? '' : custPhone,
          pickupTime: pickupTimeDisplay,
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
        type: orderType,
        table_number: tableNumber || null,
        status: 'received',
        payment_status: paymentMethod === 'online' || paymentMethod === 'linepay' ? 'paid' : (paymentMethod === 'twqr_transfer' ? 'pending_verify' : 'unpaid')
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
      localStorage.removeItem(`${storeCode}_customer_cart`);
      setAllOrders([formatted]);
      setActiveOrderId(String(createdOrder.id));
      
      // 👥 若此筆為揪團送單，即時更新雲端房間狀態為 submitted，通知全體團員
      if (activeGroupRoom?.roomCode) {
        updateGroupRoomStatus(activeGroupRoom.roomCode, 'submitted', createdOrder.order_number || String(createdOrder.id)).catch(e => {
          console.warn('Failed to update group room status:', e);
        });
      }

      // Clear cart
      setCart([]);
      setViewState('tracking');
    } catch (err) {
      console.error("Failed to submit order to Supabase:", err);
      alert(`⚠️ 提交訂單失敗：${err.message || '請檢查網路連線或稍後再試'}`);
    }
  };

  // 👥 匯入揪團房間餐點至主揪購物車並直接進入結帳流程
  const handleImportGroupRoomToCheckout = (roomItems) => {
    if (!roomItems || roomItems.length === 0) return;
    const mappedItems = roomItems.map(it => ({
      ...it,
      itemPrice: it.price || (it.totalPrice && it.quantity ? Math.round(it.totalPrice / it.quantity) : 0),
      totalPrice: it.totalPrice || ((it.price || 0) * (it.quantity || 1))
    }));
    setCart(mappedItems);
    setViewState('checkout');
    setGroupToastMsg(`🛒 已匯入全團 ${mappedItems.length} 項餐點！請確認取餐資訊後送單！`);
    setTimeout(() => setGroupToastMsg(''), 3500);
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

      {/* 🔔 揪團即時動態浮動通知 Toast */}
      {groupToastMsg && (
        <div style={{
          position: 'fixed',
          top: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '30px',
          fontSize: '0.86rem',
          fontWeight: 800,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1.5px solid #38bdf8'
        }}>
          <span>{groupToastMsg}</span>
        </div>
      )}

      {/* 👥 多人即時協同揪團置頂狀態條 */}
      {activeGroupRoom && (
        <div style={{
          backgroundColor: '#eff6ff',
          borderBottom: '2px solid #3b82f6',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.25rem', backgroundColor: '#dbeafe', padding: '4px', borderRadius: '8px' }}>👥</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#1e3a8a' }}>
                  【{activeGroupRoom.hostName}】的揪團點餐
                </span>
                <span style={{ 
                  fontSize: '0.72rem', 
                  backgroundColor: '#1e293b', 
                  color: '#38bdf8', 
                  fontWeight: 900, 
                  padding: '2px 7px', 
                  borderRadius: '6px',
                  letterSpacing: '0.5px'
                }}>
                  {activeGroupRoom.roomCode}
                </span>
                {isHostOfRoom(activeGroupRoom) && (
                  <span style={{ fontSize: '0.7rem', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 800, padding: '1px 5px', borderRadius: '4px' }}>
                    👑 您是主揪
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: '2px' }}>
                全團點餐數: <strong>{(activeGroupRoom.items || []).length}</strong> 份
                {participantName && <span style={{ marginLeft: '6px', color: '#475569' }}>・您是: 【{participantName}】</span>}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGroupShareModal(true)}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              whiteSpace: 'nowrap'
            }}
          >
            {isHostOfRoom(activeGroupRoom) ? '👑 主揪管理 / 送單' : '👀 查看揪團進度'}
          </button>
        </div>
      )}

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
                onClick={() => setShowGroupShareModal(true)}
                style={{
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1.5px solid #a7f3d0',
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
                title="邀請同事好友點餐或分享明細對帳"
              >
                <span>👥</span> 揪團點餐
              </button>

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
          {/* =========================================================================
             1. 品牌封面與門市資訊區塊 (朝柴 / QuickClick 風格)
             ========================================================================= */}
          <div className="store-header-hero" style={{ position: 'relative', width: '100%', backgroundColor: '#ffffff', marginBottom: '8px' }}>
            {/* 封面照片 Banner */}
            <div style={{ position: 'relative', width: '100%', height: '145px', overflow: 'hidden', backgroundColor: '#fed7aa' }}>
              <img 
                src="/images/mee_sua_combo_set.jpg" 
                alt={storeName} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 60%, rgba(0,0,0,0.6) 100%)' }} />
              {/* 圓形門市 Logo 徽章 (右下懸浮) */}
              <div style={{
                position: 'absolute',
                bottom: '-16px',
                right: '16px',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                border: '3px solid #ffffff',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '900',
                fontSize: '0.92rem',
                letterSpacing: '1px',
                zIndex: 10
              }}>
                <span>龍城</span>
                <span style={{ fontSize: '0.52rem', opacity: 0.9 }}>麵線</span>
              </div>
            </div>

            {/* 門市名稱與評價/詳情列 */}
            <div style={{ padding: '12px 16px 8px 16px' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '0.5px' }}>
                {storeName}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap' }}>
                <span style={{ color: '#ea580c', fontWeight: 'bold' }}>📍 門市現場點餐</span>
                <span>•</span>
                <span style={{ color: '#eab308', fontWeight: 'bold' }}>⭐ 4.9 (120+)</span>
                <span>•</span>
                <button 
                  type="button" 
                  onClick={() => setShowStoreDetailsModal(true)}
                  style={{ background: 'none', border: 'none', color: '#0284c7', padding: 0, fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  店家詳情
                </button>
              </div>
            </div>

            {/* =========================================================================
               2. 履約模式切換 (自取 / 內用 / 外送) - 分段按鈕與時間卡片
               ========================================================================= */}
            <div style={{ padding: '0 16px 12px 16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                backgroundColor: '#f1f5f9',
                padding: '4px',
                borderRadius: '12px',
                gap: '4px'
              }}>
                {/* 1. 自取 */}
                <button
                  type="button"
                  onClick={() => {
                    setFulfillmentType('takeout');
                  }}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '9px',
                    border: 'none',
                    backgroundColor: (!tableNumber && fulfillmentType === 'takeout') ? '#ffffff' : 'transparent',
                    color: (!tableNumber && fulfillmentType === 'takeout') ? '#ea580c' : '#64748b',
                    fontWeight: (!tableNumber && fulfillmentType === 'takeout') ? 'bold' : 'normal',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: (!tableNumber && fulfillmentType === 'takeout') ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  自取
                </button>

                {/* 2. 內用 */}
                <button
                  type="button"
                  onClick={() => {
                    if (!tableNumber) {
                      const tb = prompt('請輸入您的內用桌號 (例: 1, 2, 3)：', tableNumber || '');
                      if (tb && tb.trim()) {
                        const params = new URLSearchParams(window.location.search);
                        params.set('table', tb.trim());
                        window.location.search = params.toString();
                      }
                    } else {
                      setFulfillmentType('takeout');
                    }
                  }}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '9px',
                    border: 'none',
                    backgroundColor: tableNumber ? '#ffffff' : 'transparent',
                    color: tableNumber ? '#ea580c' : '#64748b',
                    fontWeight: tableNumber ? 'bold' : 'normal',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: tableNumber ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tableNumber ? `內用 (${tableNumber}桌)` : '內用'}
                </button>

                {/* 3. 外送 */}
                <button
                  type="button"
                  onClick={() => {
                    setFulfillmentType('delivery');
                  }}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '9px',
                    border: 'none',
                    backgroundColor: (!tableNumber && fulfillmentType === 'delivery') ? '#ffffff' : 'transparent',
                    color: (!tableNumber && fulfillmentType === 'delivery') ? '#0284c7' : '#64748b',
                    fontWeight: (!tableNumber && fulfillmentType === 'delivery') ? 'bold' : 'normal',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: (!tableNumber && fulfillmentType === 'delivery') ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  外送
                </button>
              </div>

              {/* 履約模式即時動態卡片 (朝柴樣式) */}
              <div 
                onClick={() => setShowFulfillmentModal(true)}
                style={{
                  marginTop: '10px',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: (!tableNumber && fulfillmentType === 'delivery') ? '1.5px solid #bae6fd' : '1px solid #e2e8f0',
                  backgroundColor: (!tableNumber && fulfillmentType === 'delivery') ? '#f0f9ff' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {(!tableNumber && fulfillmentType === 'delivery') ? (
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ backgroundColor: '#0284c7', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>Lalamove</span>
                        <span>外送：今天 儘快送達 (約 25-35 分鐘)</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '2px' }}>
                        外送費規則 (滿 $300 起送 / 滿 $500 免運費)
                      </div>
                    </div>
                  ) : tableNumber ? (
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#0f172a' }}>
                        內用：{tableNumber} 號桌 ({getFinalPickupTimeDisplay() || '即刻出餐'})
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        送單後廚房將立即備料烹調
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#0f172a' }}>
                        自取：儘快 ({getFinalPickupTimeDisplay() || '約 10~15 分鐘備妥'})
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                        現點現做，到店直接取餐免排隊
                      </div>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#ea580c', flexShrink: 0, paddingLeft: '8px' }}>
                  更改 &gt;
                </span>
              </div>
            </div>

            {/* =========================================================================
               3. 曾經訂購 (Recently Ordered Carousel)
               ========================================================================= */}
            {featuredQuickItems.length > 0 && (
              <div style={{ padding: '0 16px 14px 16px' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>
                  曾經訂購
                </div>
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  paddingBottom: '4px'
                }}>
                  {featuredQuickItems.map((fItem, fIdx) => (
                    <div
                      key={fIdx}
                      onClick={() => setSelectedItem(fItem)}
                      style={{
                        flexShrink: 0,
                        width: '185px',
                        backgroundColor: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fItem.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                          人氣必點 • NT${fItem.price}
                        </div>
                      </div>
                      <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#f8fafc' }}>
                        {fItem.image ? (
                          <img src={fItem.image} alt={fItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                            🍜
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
             4. 現代化置頂分類選單 (朝柴標籤風格 - 粗括號 + 底部亮橘指示線)
             解決原先分類不易辨識的問題！
             ========================================================================= */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 90,
            backgroundColor: '#ffffff',
            borderBottom: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              display: 'flex',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              padding: '0 8px'
            }}>
              {productCategories.map(cat => {
                const isActive = (activeCategory === cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat.id);
                    }}
                    style={{
                      flexShrink: 0,
                      padding: '12px 14px',
                      background: 'none',
                      border: 'none',
                      borderBottom: isActive ? '3.5px solid #ea580c' : '3.5px solid transparent',
                      color: isActive ? '#ea580c' : '#475569',
                      fontWeight: isActive ? '800' : '600',
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>【{cat.name}】</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 搜尋欄位 */}
          <div className="search-container" style={{ padding: '12px 16px 8px 16px' }}>
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="搜尋美味餐點..." 
                className="search-bar-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem'
                }}
              />
            </div>
          </div>

          {/* =========================================================================
             5. 餐點列表 (朝柴 / Uber Eats 風格橫式大卡片 + 圓形 + 按鈕)
             ========================================================================= */}
          <div className="menu-list" style={{ padding: '8px 16px 100px 16px' }}>
            {/* 分類標題指示器 */}
            <div style={{ margin: '8px 0 12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
                  【{productCategories.find(c => c.id === activeCategory)?.name || '人氣美味'}】
                </h3>
                <span style={{ fontSize: '0.72rem', backgroundColor: '#fff7ed', color: '#ea580c', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {filteredItems.length} 項美味
                </span>
              </div>
              <div style={{ width: '42px', height: '3.5px', backgroundColor: '#ea580c', borderRadius: '2px', marginTop: '6px' }} />
            </div>

            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '50px 20px', backgroundColor: '#fff', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                <span style={{ fontSize: '2.5rem' }}>🍜</span>
                <p style={{ marginTop: '10px', fontSize: '0.9rem' }}>找不到符合條件的餐點，請點選上方其他分類！</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredItems.map(item => {
                  const isAvailable = item.customizations?.is_available !== false;
                  return (
                    <div 
                      key={item.id}
                      onClick={isAvailable ? () => setSelectedItem(item) : undefined}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'stretch',
                        gap: '12px',
                        backgroundColor: '#ffffff',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        border: '1px solid #f1f5f9',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                        opacity: isAvailable ? 1 : 0.6,
                        position: 'relative',
                        transition: 'transform 0.1s ease, box-shadow 0.1s ease'
                      }}
                    >
                      {/* 左側資訊欄 */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                              {item.name}
                            </span>
                            {(upgradeCombos || []).some(pkg => isComboApplicableToItem(pkg, item)) && (
                              <span style={{
                                backgroundColor: 'rgba(234, 88, 12, 0.1)',
                                color: '#ea580c',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                padding: '1px 6px',
                                borderRadius: '4px'
                              }}>
                                🍱 可升級
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p style={{
                              fontSize: '0.78rem',
                              color: '#64748b',
                              lineHeight: '1.4',
                              margin: '4px 0 0 0',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ea580c' }}>
                            ${item.price}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>起</span>
                        </div>
                      </div>

                      {/* 右側照片與加號按鈕 (朝柴風格) */}
                      <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              loading="lazy"
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                              {getItemIcon(item.name)}
                            </div>
                          )}
                        </div>
                        {isAvailable ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(item);
                            }}
                            style={{
                              position: 'absolute',
                              bottom: '-4px',
                              right: '-4px',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: '#ea580c',
                              color: '#ffffff',
                              border: '2px solid #ffffff',
                              fontSize: '1.1rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.4)'
                            }}
                          >
                            ＋
                          </button>
                        ) : (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            color: '#fff',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 'bold'
                          }}>
                            完售
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* =========================================================================
             店家詳情彈窗 (Store Details Modal)
             ========================================================================= */}
          {showStoreDetailsModal && (
            <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={() => setShowStoreDetailsModal(false)}>
              <div className="modal-content" style={{ maxWidth: '420px', padding: '20px', borderRadius: '16px' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>
                    🏪 店家詳細資訊
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => setShowStoreDetailsModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
                  >
                    &times;
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem', color: '#334155' }}>
                  <div>
                    <strong>店名：</strong><span>{storeName}</span>
                  </div>
                  {storeAddress && (
                    <div>
                      <strong>地址：</strong><span>{storeAddress}</span>
                    </div>
                  )}
                  {storePhone && (
                    <div>
                      <strong>電話：</strong><a href={`tel:${storePhone}`} style={{ color: '#0284c7', textDecoration: 'underline' }}>{storePhone}</a>
                    </div>
                  )}
                  <div>
                    <strong>營業時間：</strong><span>每日 06:00 ～ 22:00 (以門市現場公告為準)</span>
                  </div>
                  <div>
                    <strong>🛵 外送規則：</strong>
                    <span style={{ color: '#0369a1' }}>滿 $300 起送（運費 $50），滿 $500 享 Lalamove 免運費直送！</span>
                  </div>
                  <div>
                    <strong>💳 支援付款：</strong>
                    <span>現金、LINE Pay 一鍵付款、TWQR（台灣Pay/街口/全支付/各大網銀）</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStoreDetailsModal(false)}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#ea580c',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.92rem',
                    cursor: 'pointer'
                  }}
                >
                  確認關閉
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
             取餐與外送時間設定彈窗 (Fulfillment Modal)
             ========================================================================= */}
          {showFulfillmentModal && (
            <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={() => setShowFulfillmentModal(false)}>
              <div className="modal-content" style={{ maxWidth: '420px', padding: '20px', borderRadius: '16px' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: '#0f172a' }}>
                    ⚙️ 取送餐方式與時間設定
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => setShowFulfillmentModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
                  >
                    &times;
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* 模式切換 */}
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                      取餐模式：
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setFulfillmentType('takeout')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: (!tableNumber && fulfillmentType === 'takeout') ? '2px solid #ea580c' : '1px solid #cbd5e1',
                          backgroundColor: (!tableNumber && fulfillmentType === 'takeout') ? '#fff7ed' : '#ffffff',
                          color: (!tableNumber && fulfillmentType === 'takeout') ? '#ea580c' : '#334155',
                          fontWeight: (!tableNumber && fulfillmentType === 'takeout') ? 'bold' : 'normal',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        🥡 外帶自取
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tb = prompt('請輸入您的內用桌號：', tableNumber || '');
                          if (tb && tb.trim()) {
                            const params = new URLSearchParams(window.location.search);
                            params.set('table', tb.trim());
                            window.location.search = params.toString();
                          }
                        }}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: tableNumber ? '2px solid #ea580c' : '1px solid #cbd5e1',
                          backgroundColor: tableNumber ? '#fff7ed' : '#ffffff',
                          color: tableNumber ? '#ea580c' : '#334155',
                          fontWeight: tableNumber ? 'bold' : 'normal',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        🪑 內用點餐
                      </button>
                      <button
                        type="button"
                        onClick={() => setFulfillmentType('delivery')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: (!tableNumber && fulfillmentType === 'delivery') ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          backgroundColor: (!tableNumber && fulfillmentType === 'delivery') ? '#f0f9ff' : '#ffffff',
                          color: (!tableNumber && fulfillmentType === 'delivery') ? '#0284c7' : '#334155',
                          fontWeight: (!tableNumber && fulfillmentType === 'delivery') ? 'bold' : 'normal',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        🛵 Lalamove外送
                      </button>
                    </div>
                  </div>

                  {/* 若選擇外送，輸入地址 */}
                  {(!tableNumber && fulfillmentType === 'delivery') && (
                    <div style={{ backgroundColor: '#f0f9ff', padding: '10px 12px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#0369a1', display: 'block', marginBottom: '4px' }}>
                        📍 外送送達地址：
                      </label>
                      <input
                        type="text"
                        placeholder="例: 新北市蘆洲區民權路XX號"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #38bdf8',
                          fontSize: '0.88rem'
                        }}
                      />
                    </div>
                  )}

                  {/* 取餐時間三模式切換 */}
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                      預定時間：
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setPickupMode('asap')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: pickupMode === 'asap' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                          backgroundColor: pickupMode === 'asap' ? '#fff7ed' : '#ffffff',
                          color: pickupMode === 'asap' ? '#ea580c' : '#334155',
                          fontWeight: pickupMode === 'asap' ? 'bold' : 'normal',
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ 儘快
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickupMode('today_later')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: pickupMode === 'today_later' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                          backgroundColor: pickupMode === 'today_later' ? '#fff7ed' : '#ffffff',
                          color: pickupMode === 'today_later' ? '#ea580c' : '#334155',
                          fontWeight: pickupMode === 'today_later' ? 'bold' : 'normal',
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        ⏰ 今日稍後
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickupMode('future_date')}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: pickupMode === 'future_date' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                          backgroundColor: pickupMode === 'future_date' ? '#fff7ed' : '#ffffff',
                          color: pickupMode === 'future_date' ? '#ea580c' : '#334155',
                          fontWeight: pickupMode === 'future_date' ? 'bold' : 'normal',
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        📅 預約日期
                      </button>
                    </div>

                    {pickupMode === 'today_later' && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>指定時間：</span>
                        <input
                          type="time"
                          value={specificTime}
                          onChange={(e) => setSpecificTime(e.target.value)}
                          style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFulfillmentModal(false)}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#ea580c',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '0.92rem',
                    cursor: 'pointer'
                  }}
                >
                  確認儲存設定
                </button>
              </div>
            </div>
          )}

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGroupShareModal(true);
                  }}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.22)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.45)',
                    borderRadius: '20px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="分享明細給同事"
                >
                  <span>👥 分享</span>
                </button>
                <span className="view-cart-txt">查看購物籃 ➔</span>
              </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <h4 className="checkout-section-title" style={{ margin: 0 }}>
                  🛒 訂購明細與取餐資訊
                </h4>
                <button
                  type="button"
                  onClick={() => setShowGroupShareModal(true)}
                  style={{
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    borderRadius: '16px',
                    padding: '3px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="分享明細給同事核對或傳到 LINE"
                >
                  <span>👥 分享核對單</span>
                </button>
              </div>
              
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: 'var(--text-main)' }}>{item.name} x {item.quantity}</strong>
                        {item.forWhom && (
                          <span style={{ fontSize: '0.7rem', backgroundColor: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                            👤 {item.forWhom}
                          </span>
                        )}
                      </div>
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
                <h4 className="checkout-section-title">🛵 取餐 / 外送方式</h4>

                {/* 取餐與外送選擇區塊 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '4px'
                }}>
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('takeout')}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '12px',
                      border: fulfillmentType === 'takeout' ? '2.5px solid var(--primary, #ea580c)' : '1px solid var(--border, #e2e8f0)',
                      backgroundColor: fulfillmentType === 'takeout' ? '#fff7ed' : '#ffffff',
                      color: fulfillmentType === 'takeout' ? '#ea580c' : 'var(--text-main, #1e293b)',
                      fontWeight: 'bold',
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: fulfillmentType === 'takeout' ? '0 2px 8px rgba(234, 88, 12, 0.15)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '1.4rem' }}>🥡</span>
                    <span>外帶自取</span>
                    <span style={{ fontSize: '0.72rem', color: fulfillmentType === 'takeout' ? '#c2410c' : '#64748b', fontWeight: 'normal' }}>到店自取免運費</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sub = cart.reduce((sum, item) => sum + item.totalPrice, 0);
                      if (sub < 300) {
                        alert(`🛵 Lalamove 外送滿 NT$ 300 起送！目前餐點小計 NT$ ${sub}，還差 NT$ ${300 - sub} 元即可享受專車外送。請再選購餐點！`);
                        return;
                      }
                      setFulfillmentType('delivery');
                    }}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '12px',
                      border: fulfillmentType === 'delivery' ? '2.5px solid #0284c7' : '1px solid var(--border, #e2e8f0)',
                      backgroundColor: fulfillmentType === 'delivery' ? '#f0f9ff' : (cart.reduce((sum, item) => sum + item.totalPrice, 0) < 300 ? '#f8fafc' : '#ffffff'),
                      color: fulfillmentType === 'delivery' ? '#0284c7' : (cart.reduce((sum, item) => sum + item.totalPrice, 0) < 300 ? '#94a3b8' : 'var(--text-main, #1e293b)'),
                      fontWeight: 'bold',
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      position: 'relative',
                      boxShadow: fulfillmentType === 'delivery' ? '0 2px 8px rgba(2, 132, 199, 0.18)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-4px',
                      backgroundColor: cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? '#10b981' : '#f97316',
                      color: 'white',
                      fontSize: '0.65rem',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: '900'
                    }}>
                      {cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? '滿$500免運' : '滿$300起送'}
                    </span>
                    <span style={{ fontSize: '1.4rem' }}>🛵</span>
                    <span>Lalamove 外送</span>
                    <span style={{ fontSize: '0.72rem', color: fulfillmentType === 'delivery' ? '#0369a1' : '#64748b', fontWeight: 'normal' }}>
                      {cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? '🎉 享免運費 ($0)' : (cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 300 ? '運費 NT$ 50' : `差 $${300 - cart.reduce((sum, item) => sum + item.totalPrice, 0)} 起送`)}
                    </span>
                  </button>
                </div>

                {/* Lalamove 外送地址與備註區塊 */}
                {fulfillmentType === 'delivery' && (
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1.5px solid #bae6fd',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <div style={{ fontWeight: 'bold', color: '#0369a1', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🛵</span>
                        <span>Lalamove 專車直送設定</span>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        backgroundColor: cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? '#dcfce7' : '#ffedd5',
                        color: cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? '#15803d' : '#c2410c'
                      }}>
                        {cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? '✨ 已達滿$500免運費' : `運費 NT$ 50 (差 $${500 - cart.reduce((sum, item) => sum + item.totalPrice, 0)} 免運)`}
                      </div>
                    </div>

                    {cart.reduce((sum, item) => sum + item.totalPrice, 0) < 500 && (
                      <div style={{ fontSize: '0.78rem', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '6px 10px', borderRadius: '6px' }}>
                        💡 <strong>省運費小秘技：</strong>再加點 <strong>NT$ {500 - cart.reduce((sum, item) => sum + item.totalPrice, 0)}</strong>，整單享 Lalamove 免運費直送！
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="delivery-address" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                        📍 外送送達地址 <span style={{ color: 'var(--accent)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        id="delivery-address"
                        placeholder="例: 新北市蘆洲區民權路XX號"
                        required={fulfillmentType === 'delivery'}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          fontSize: '0.88rem',
                          borderRadius: '8px',
                          border: '1.5px solid #38bdf8',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="delivery-floor" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        🏢 樓層 / 門牌備註 (選填)
                      </label>
                      <input
                        type="text"
                        id="delivery-floor"
                        placeholder="例: 3樓 (無電梯)、請放一樓管理室、按電鈴等"
                        value={deliveryFloorNote}
                        onChange={(e) => setDeliveryFloorNote(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          fontSize: '0.85rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>
                  </div>
                )}

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
                  <label htmlFor="cust-phone">
                    {fulfillmentType === 'delivery' ? (
                      <span>連絡手機號碼 (外送司機通訊用) <span style={{ color: 'var(--accent)' }}>*</span></span>
                    ) : (
                      '手機號碼 (選填，方便到店備用連絡)'
                    )}
                  </label>
                  <input 
                    type="tel" 
                    id="cust-phone" 
                    placeholder={fulfillmentType === 'delivery' ? '例: 0912345678 (外送必填)' : '例: 0912345678 (選填)'} 
                    required={fulfillmentType === 'delivery'}
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
              <div className="payment-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 1. LINE Pay */}
                <div 
                  className={`payment-option-card ${paymentMethod === 'linepay' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('linepay')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: paymentMethod === 'linepay' ? '2px solid #06c755' : '1px solid var(--border)',
                    backgroundColor: paymentMethod === 'linepay' ? '#f0fdf4' : 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '1.6rem', color: '#06c755' }}>🟢</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: paymentMethod === 'linepay' ? '#047857' : 'inherit' }}>LINE Pay 行動支付</strong>
                      <span style={{ fontSize: '0.68rem', backgroundColor: '#06c755', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>推薦</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      手機直接喚起 LINE Pay App 快速付款，支援 LINE POINTS 折抵
                    </div>
                  </div>
                </div>

                {/* LINE Pay 說明 */}
                {paymentMethod === 'linepay' && (
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    color: '#166534',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                      <span>📱</span>
                      <span>LINE Pay 快速結帳</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#15803d', lineHeight: '1.4' }}>
                      下單後將提供一鍵開啟 LINE Pay 進行支付，支援綁定之一卡通 MONEY、各大銀行信用卡及 LINE POINTS 點數折抵！
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <img src="/images/linepay_card.jpg" alt="LINE Pay" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                      <div style={{ fontSize: '0.75rem', color: '#15803d' }}>
                        <div><strong>龍城麵線 官方 LINE Pay</strong></div>
                        <div style={{ color: '#64748b', fontSize: '0.7rem' }}>手機一鍵喚起 App，無須掃描條碼</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. TWQR / 網銀轉帳 */}
                <div 
                  className={`payment-option-card ${paymentMethod === 'twqr_transfer' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('twqr_transfer')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: paymentMethod === 'twqr_transfer' ? '2px solid #0284c7' : '1px solid var(--border)',
                    backgroundColor: paymentMethod === 'twqr_transfer' ? '#f0f9ff' : 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '1.6rem' }}>🏦</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: paymentMethod === 'twqr_transfer' ? '#0369a1' : 'inherit' }}>TWQR / 第一銀行 網銀轉帳</strong>
                      <span style={{ fontSize: '0.68rem', backgroundColor: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>跨機構共通</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      支援台灣Pay、街口、全支付、全盈+PAY、icash Pay 及各大網銀
                    </div>
                  </div>
                </div>

                {/* TWQR & 銀行匯款資訊 (當選中時展開) */}
                {paymentMethod === 'twqr_transfer' && (
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    color: '#0369a1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>
                      🏦 第一銀行 TWQR 付款資訊
                    </div>
                    <div style={{
                      backgroundColor: '#ffffff',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e0f2fe',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div>銀行名稱：<strong>第一商業銀行 (代碼 007)</strong></div>
                      <div>戶名：<strong>個人賣家_龍城麵線</strong></div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', lineHeight: '1.4' }}>
                        💡 <strong>手機免掃碼小撇步：</strong>可長按儲存下方 TWQR 碼圖片至相簿，開啟台灣Pay、街口、全支付或各大網銀 App，點選「掃描相簿相片」即可免第二支手機完成付款！
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                        <img 
                          src="/images/twqr_card.jpg" 
                          alt="TWQR 第一銀行 龍城麵線" 
                          style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid #bae6fd' }} 
                        />
                      </div>
                    </div>

                    {/* 轉帳末5碼輸入框 */}
                    <div style={{ marginTop: '2px' }}>
                      <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.82rem', marginBottom: '4px', color: '#0f172a' }}>
                        轉帳/付款扣款帳號末 5 碼 (選填/已付款請填，以利店家對帳)
                      </label>
                      <input
                        type="text"
                        maxLength="5"
                        placeholder="例: 12345 (請輸入您扣款帳號末5碼)"
                        value={transferLast5}
                        onChange={(e) => setTransferLast5(e.target.value.replace(/[^0-9]/g, ''))}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          fontSize: '0.9rem',
                          borderRadius: '6px',
                          border: '1.5px solid #38bdf8',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 3. 到店付款 / 司機代收 */}
                {paymentMethodsConfig.counter?.enabled !== false && (
                  <div 
                    className={`payment-option-card ${paymentMethod === 'counter' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('counter')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: paymentMethod === 'counter' ? '2px solid var(--primary, #ea580c)' : '1px solid var(--border)',
                      backgroundColor: paymentMethod === 'counter' ? '#fff7ed' : 'var(--bg-card)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: '1.6rem' }}>💵</span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: paymentMethod === 'counter' ? '#c2410c' : 'inherit' }}>
                        {fulfillmentType === 'delivery' ? '貨到付款 / 司機代收 (現金)' : '店內結帳 (到店付款)'}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {fulfillmentType === 'delivery' ? '餐點送達時以現金交付 Lalamove 司機' : '取餐時於櫃檯付款，支援現金與現場共同支付'}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. 線上刷卡 */}
                {paymentMethodsConfig.online?.enabled && (
                  <div 
                    className={`payment-option-card ${paymentMethod === 'online' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('online')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: paymentMethod === 'online' ? '2px solid var(--primary, #ea580c)' : '1px solid var(--border)',
                      backgroundColor: paymentMethod === 'online' ? '#fff7ed' : 'var(--bg-card)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: '1.6rem' }}>💳</span>
                    <div style={{ flex: 1 }}>
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
              <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                <span>餐點小計</span>
                <span>NT$ {cart.reduce((sum, item) => sum + item.totalPrice, 0)}</span>
              </div>
              {!tableNumber && fulfillmentType === 'delivery' && (
                <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#0369a1', margin: '4px 0' }}>
                  <span>🛵 Lalamove 外送運費</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? 'NT$ 0 (滿 $500 免運)' : 'NT$ 50'}
                  </span>
                </div>
              )}
              <div className="summary-row total" style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                <span>訂單總金額</span>
                <span>
                  NT$ {cart.reduce((sum, item) => sum + item.totalPrice, 0) + (!tableNumber && fulfillmentType === 'delivery' ? (cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? 0 : 50) : 0)}
                </span>
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
          onShareGroupOrder={() => setShowGroupShareModal(true)}
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
          onOpenShareModal={() => setShowGroupShareModal(true)}
          onUpdateForWhom={handleUpdateItemForWhom}
        />
      )}

      {/* 👥 Group Order Share Modal */}
      <GroupOrderShareModal
        isOpen={showGroupShareModal}
        onClose={() => setShowGroupShareModal(false)}
        storeName={storeName || '龍城麵線'}
        storeCode={storeCode || 'dragon'}
        cart={cart}
        order={viewState === 'tracking' ? activeOrder : null}
        activeGroupRoom={activeGroupRoom}
        setActiveGroupRoom={setActiveGroupRoom}
        currentUser={customerAuth}
        onImportToCheckout={handleImportGroupRoomToCheckout}
        onLeaveRoom={() => {
          try {
            localStorage.removeItem('last_active_group_room');
          } catch (e) {}
          setActiveGroupRoom(null);
        }}
        storeUrl={window.location.href}
      />

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
              <div><strong>訂購姓名：</strong>{custName.trim() || customerAuth?.displayName || lineUser?.displayName || '未填寫'}</div>
              {!tableNumber && <div><strong>聯絡電話：</strong>{custPhone || '未填寫'}</div>}
              {tableNumber && <div><strong>內用桌號：</strong>{tableNumber} 號桌</div>}
              <div><strong>取送方式：</strong>{tableNumber ? `內用 (${tableNumber} 號桌)` : (fulfillmentType === 'delivery' ? `🛵 Lalamove 外送 (${getFinalPickupTimeDisplay()})` : `外帶自取 (${getFinalPickupTimeDisplay()})`)}</div>
              {!tableNumber && fulfillmentType === 'delivery' && (
                <div><strong>外送地址：</strong><span style={{ color: '#0369a1', fontWeight: 'bold' }}>{deliveryAddress} {deliveryFloorNote ? `(${deliveryFloorNote})` : ''}</span></div>
              )}
              <div>
                <strong>付款方式：</strong>
                {paymentMethod === 'linepay' && <span style={{ color: '#047857', fontWeight: 'bold' }}>🟢 LINE Pay 行動支付</span>}
                {paymentMethod === 'twqr_transfer' && <span style={{ color: '#0369a1', fontWeight: 'bold' }}>🏦 TWQR / 網銀轉帳 (末5碼: {transferLast5 || '未填'})</span>}
                {paymentMethod === 'counter' && <span style={{ color: '#c2410c', fontWeight: 'bold' }}>{fulfillmentType === 'delivery' ? '💵 貨到付款 (司機代收現金)' : '💵 到店付款'}</span>}
                {paymentMethod === 'online' && <span style={{ fontWeight: 'bold' }}>💳 線上刷卡</span>}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '8px' }}>
                <strong>點購商品明細：</strong>
                <div style={{ maxHeight: '180px', overflowY: 'auto', paddingLeft: '4px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cart.map(item => (
                    <div key={item.cartId || item.id} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: '6px', marginBottom: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        <span>{item.name} x{item.quantity}</span>
                        <span>NT$ {item.totalPrice}</span>
                      </div>
                      {item.specs && item.specs.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '8px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {item.specs.map((spec, sIdx) => {
                            const specStr = typeof spec === 'string' ? spec : (spec?.value || spec?.name || spec?.label || JSON.stringify(spec));
                            const parts = String(specStr || '').split(/[|]/).map(p => p.trim()).filter(Boolean);
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
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  <span>餐點小計:</span>
                  <span>NT$ {cart.reduce((sum, item) => sum + item.totalPrice, 0)}</span>
                </div>
                {!tableNumber && fulfillmentType === 'delivery' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#0369a1' }}>
                    <span>🛵 Lalamove 外送運費:</span>
                    <span>{cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? 'NT$ 0 (滿 $500 免運)' : 'NT$ 50'}</span>
                  </div>
                )}
                <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>實付總額:</span>
                  <span>NT$ {cart.reduce((sum, item) => sum + item.totalPrice, 0) + (!tableNumber && fulfillmentType === 'delivery' ? (cart.reduce((sum, item) => sum + item.totalPrice, 0) >= 500 ? 0 : 50) : 0)}</span>
                </div>
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

              {/* LINE 登入小提示 (避免顧客在外部瀏覽器按到電子郵件密碼登入而失敗) */}
              <div style={{
                fontSize: '0.76rem',
                color: '#15803d',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '8px 10px',
                textAlign: 'left',
                lineHeight: '1.4'
              }}>
                💡 <strong>手機授權提醒：</strong>系統會優先<strong>直接開啟 LINE App</strong>授權；若在瀏覽器跳出 LINE 登入頁，請滑至畫面最下方點選<strong>【使用 LINE 應用程式登入】</strong>即可免打帳號密碼！
              </div>

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

              {/* 訪客直接送單按鈕 (免第三方帳號，保證不卡單) */}
              <button
                type="button"
                onClick={() => {
                  const guestProfile = {
                    provider: 'guest',
                    userId: 'guest_' + Date.now(),
                    displayName: custName.trim() || '現場顧客',
                    pictureUrl: '',
                    email: ''
                  };
                  setCustomerAuth(guestProfile);
                  setShowAuthModal(false);
                }}
                style={{
                  width: '100%',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '11px 16px',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>👤</span>
                  <span>免登入 / 訪客快速點餐 (填寫電話即可)</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>快速送單</span>
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

      {/* 👤 參與揪團點餐輸入稱呼 Modal */}
      {showParticipantModal && (
        <div 
          className="modal-backdrop" 
          style={{ 
            zIndex: 1200, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '16px', 
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)'
          }}
        >
          <div 
            className="modal-content animate-fade-in" 
            style={{ 
              maxWidth: '380px', 
              width: '100%', 
              borderRadius: '20px', 
              padding: '22px', 
              backgroundColor: '#ffffff', 
              color: '#1e293b', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>👥</span>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.18rem', fontWeight: 900, color: '#0f172a' }}>
              歡迎加入【{activeGroupRoom?.hostName}】的揪團！
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b', lineHeight: '1.4' }}>
              請輸入您的稱呼，您挑選的餐點會標記您的名字，方便主揪即時核對與分帳：
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              const nameInput = e.target.elements.pName.value.trim();
              if (!nameInput) return;
              setParticipantName(nameInput);
              try { localStorage.setItem('group_participant_name', nameInput); } catch(err) {}
              setShowParticipantModal(false);
              if (pendingCartItemForGroup && activeGroupRoom) {
                const itemWithPerson = { ...pendingCartItemForGroup, forWhom: nameInput };
                addItemToGroupRoom(activeGroupRoom.roomCode, itemWithPerson, nameInput).catch(console.error);
                setPendingCartItemForGroup(null);
                setGroupToastMsg(`✅ 已為【${nameInput}】加入團體點餐！`);
                setTimeout(() => setGroupToastMsg(''), 3000);
              }
            }}>
              <input
                name="pName"
                type="text"
                autoFocus
                required
                defaultValue={participantName || custName || customerAuth?.displayName || ''}
                placeholder="例如: 冠正、小美、大衛"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '2px solid #3b82f6',
                  fontSize: '1rem',
                  fontWeight: 800,
                  outline: 'none',
                  textAlign: 'center',
                  marginBottom: '16px'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowParticipantModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  稍後再填
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  確認進入點餐 ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
