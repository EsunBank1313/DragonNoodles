import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { formatSupabaseOrder } from './CustomerView';
import ItemModal from './ItemModal';
import ThermalPrintPortal from './ThermalPrintPortal';
import { defaultStoreProfile, defaultReceiptConfig, printThermalReceipt, printDailyClosingReport } from '../utils/printHelpers';
import { getActiveStoreCode, filterItemsByStore, filterOrdersByStore, prefixNameForStore, stripNameForStore, getStoreStorage, setStoreStorage, getStoreSessionStorage, setStoreSessionStorage, removeStoreSessionStorage } from '../utils/storeContext';

export default function CashierView({ storeCode: propStoreCode, cashierName, sessionId: propSessionId, onLogout }) {
  const storeCode = propStoreCode || getActiveStoreCode();

  const getTodayLocalDate = () => {
    try {
      return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    } catch (e) {
      const d = new Date();
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
    }
  };
  const [sessionId] = useState(() => {
    let sid = propSessionId || getStoreSessionStorage('pos_session_id', storeCode);
    if (!sid) {
      sid = `${cashierName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setStoreSessionStorage('pos_session_id', sid, storeCode);
    }
    return sid;
  });
  
  const [isSessionRegistered, setIsSessionRegistered] = useState(false);

  const systemStartTime = useRef(Date.now());
  const locallyPrintedOrders = useRef(new Set());
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([
    { id: 'mee-sua', name: '招牌麵線', icon: '🍜' },
    { id: 'specialties', name: '精選推薦', icon: '🔥' }
  ]);
  const [activeCategory, setActiveCategory] = useState('mee-sua');
  const [cart, setCart] = useState([]);

  // Inventory & Watched Items Restock Warning
  const [inventory, setInventory] = useState([]);
  const [showStockAlertModal, setShowStockAlertModal] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const invKey = prefixNameForStore('SYSTEM_SETTING_INVENTORY', storeCode);
        const { data } = await supabase.from('menu_items').select('*').eq('name', invKey);
        if (data && data.length > 0) {
          const parsed = JSON.parse(data[0].description);
          if (Array.isArray(parsed)) {
            setInventory(parsed);
          }
        }
      } catch (err) {
        console.error("Failed to load inventory in CashierView:", err);
      }
    };
    fetchInventory();

    const channel = supabase.channel('pos-inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: 'name=eq.SYSTEM_SETTING_INVENTORY' }, () => {
        fetchInventory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const watchedLowStockItems = inventory.filter(item => {
    const isWatched = item.isWatched !== false;
    return isWatched && (Number(item.qty) <= Number(item.minStock));
  });

  // Single-Device Active Session Heartbeat & In-UI Kickout Overlay
  const [kickoutState, setKickoutState] = useState({ isKickedOut: false, user: '' });
  const isKickedOutRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    const sessionKey = prefixNameForStore('SYSTEM_SETTING_ACTIVE_POS_SESSION', storeCode);
    isKickedOutRef.current = false;

    const handleDeviceKickout = (otherUser) => {
      if (isKickedOutRef.current) return;
      isKickedOutRef.current = true;
      try {
        sessionStorage.removeItem(`${storeCode}_pos_session_id`);
      } catch (e) {}
      setKickoutState({ isKickedOut: true, user: otherUser || '其他人員' });
    };

    const checkAndSendHeartbeat = async () => {
      if (isKickedOutRef.current) return;
      try {
        const { data } = await supabase.from('menu_items').select('description').eq('name', sessionKey);
        if (data && data.length > 0 && data[0].description) {
          const cloudSession = JSON.parse(data[0].description);
          if (cloudSession && cloudSession.sessionId && cloudSession.sessionId !== sessionId && (Date.now() - Number(cloudSession.lastActive || 0) <= 25000)) {
            handleDeviceKickout(cloudSession.user);
            return;
          }
        }

        if (!isKickedOutRef.current) {
          const sessionPayload = { user: cashierName, sessionId, lastActive: Date.now() };
          await supabase
            .from('menu_items')
            .update({ description: JSON.stringify(sessionPayload) })
            .eq('name', sessionKey);
        }
      } catch (err) {
        console.warn("Heartbeat error:", err);
      }
    };

    checkAndSendHeartbeat();
    const interval = setInterval(checkAndSendHeartbeat, 6000);

    const channel = supabase.channel(`pos-active-session-${storeCode}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `name=eq.${sessionKey}` }, (payload) => {
        if (isKickedOutRef.current) return;
        if (payload.new && payload.new.description) {
          try {
            const cloudSession = JSON.parse(payload.new.description);
            if (cloudSession && cloudSession.sessionId && cloudSession.sessionId !== sessionId && (Date.now() - Number(cloudSession.lastActive || 0) <= 25000)) {
              handleDeviceKickout(cloudSession.user);
            }
          } catch (e) {}
        }
      })
      .subscribe();

    return () => {
      isKickedOutRef.current = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionId, cashierName, storeCode]);
  
  // Checkout details
  const [orderType, setOrderType] = useState('dine-in'); // Default to counter takeout
  const [posDefaultOrderType, setPosDefaultOrderType] = useState('dine-in');
  const [posPaymentMethods, setPosPaymentMethods] = useState(['現金', '信用卡', 'LINE Pay']);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('現金');
  
  const isCash = selectedPaymentMethod && (
    selectedPaymentMethod === '現金' ||
    selectedPaymentMethod.includes('現金') ||
    selectedPaymentMethod.toLowerCase().includes('cash')
  );
  
  const [tableNumber, setTableNumber] = useState(null);
  const [custName, setCustName] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Cash Register Calculations
  const [cashReceived, setCashReceived] = useState('');
  const [changeAmount, setChangeAmount] = useState(0);

  // Success view details
  const [viewState, setViewState] = useState('pos'); // 'pos' or 'success'
  const [latestOrder, setLatestOrder] = useState(null);
  const [printPayload, setPrintPayload] = useState(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Modal active item & Cart Editing
  const [activeItemForModal, setActiveItemForModal] = useState(null);
  const [editingCartItem, setEditingCartItem] = useState(null);

  // POS Order Editing States
  const [editingPosOrder, setEditingPosOrder] = useState(null);
  const [editOrderType, setEditOrderType] = useState('dine-in');
  const [editOrderTable, setEditOrderTable] = useState('');
  const [editOrderCust, setEditOrderCust] = useState('');
  const [editOrderRemarks, setEditOrderRemarks] = useState('');
  const [editOrderTotal, setEditOrderTotal] = useState('');
  const [editOrderItems, setEditOrderItems] = useState([]);
  const [editOrderPayment, setEditOrderPayment] = useState('');

  // Discount states
  const [discountType, setDiscountType] = useState('none'); // 'none', 'percent', 'amount'
  const [discountValue, setDiscountValue] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Closed Dates for Locking
  const [closedDates, setClosedDates] = useState([]);

  // Orders state and printing integration
  const [orders, setOrders] = useState([]);
  const [storeProfile, setStoreProfile] = useState(defaultStoreProfile);
  const [storeName, setStoreName] = useState('龍城麵線');
  const [adminPin, setAdminPin] = useState('8888');
  const [receiptConfig, setReceiptConfig] = useState(defaultReceiptConfig);
  
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(() => localStorage.getItem('is_auto_print_enabled') === 'true');
  const isAutoPrintEnabledRef = useRef(isAutoPrintEnabled);
  useEffect(() => {
    isAutoPrintEnabledRef.current = isAutoPrintEnabled;
  }, [isAutoPrintEnabled]);

  const [printKitchenTicket, setPrintKitchenTicket] = useState(() => {
    const saved = localStorage.getItem('pos_print_kitchen_ticket');
    return saved !== null ? saved === 'true' : true;
  });

  const [posUiScale, setPosUiScale] = useState(() => localStorage.getItem('pos_ui_scale') || 'compact');
  const [showPosSettingsModal, setShowPosSettingsModal] = useState(false);
  const [isPrintBlocked, setIsPrintBlocked] = useState(false);
  
  // Shift Handover (X-Report) States
  const [showShiftHandoverModal, setShowShiftHandoverModal] = useState(false);
  const [isManagingSoldOut, setIsManagingSoldOut] = useState(false);

  // Offline Queue Resilience
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`${storeCode}_offline_orders_queue`) || '[]');
    } catch {
      return [];
    }
  });

  // Synthesize notification chime
  const triggerChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.warn("Notification audio failed:", e);
    }
  };

  // Voice Announcement (TTS) state
  const [isVoiceAnnounceEnabled, setIsVoiceAnnounceEnabled] = useState(() => {
    return localStorage.getItem('is_voice_announce_enabled') !== 'false';
  });

  // Pre-fetch Web Speech voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
  }, []);

  // Format order into natural Chinese speech
  const generateOrderSpeechText = (order) => {
    if (!order) return '';
    let parts = [];

    const isTakeout = order.type === 'takeout' || order.type === '自取' || order.type === '外帶';
    if (isTakeout) {
      parts.push('收到新外帶訂單！');
    } else {
      const tableStr = order.table_number || order.tableNumber ? `${order.table_number || order.tableNumber}號桌。` : '';
      parts.push(`收到新內用訂單！${tableStr}`);
    }

    const serialNum = order.serialNum || order.order_number || '';
    if (serialNum) {
      const serialSpaced = serialNum.replace(/([A-Z0-9])/g, '$1 ').trim();
      parts.push(`單號 ${serialSpaced}。` );
    }

    if (order.items && Array.isArray(order.items)) {
      const itemsSpeech = order.items.map(item => {
        let itemText = `${item.name} ${item.quantity || 1}份`;
        let specsArr = [];

        if (item.specs) {
          const rawSpecs = String(item.specs).split(/[,|\n]/).map(s => s.trim()).filter(Boolean);
          rawSpecs.forEach(s => {
            const cleaned = s.replace(/調料客製\s*\([^)]*\)\s*:\s*/g, '').trim();
            if (cleaned && !cleaned.includes('免加錢')) {
              specsArr.push(cleaned);
            }
          });
        }

        if (specsArr.length > 0) {
          itemText += `，${specsArr.join('、')}`;
        }
        return itemText;
      }).join('。');

      parts.push(itemsSpeech + '。');
    }

    if (order.remarks && String(order.remarks).trim()) {
      parts.push(`備註：${String(order.remarks).trim()}。` );
    }

    return parts.join(' ');
  };

  // Trigger TTS voice announcement
  const speakOrderAnnouncement = (order) => {
    if (!isVoiceAnnounceEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn("Speech synthesis is not supported in this browser.");
      return;
    }

    const text = generateOrderSpeechText(order);
    if (!text) return;

    try {
      window.speechSynthesis.cancel(); // Stop previous voice to avoid queue backup

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.95; // Clear natural speed
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const twVoice = voices.find(v => v.lang === 'zh-TW' || v.lang.includes('zh-TW') || v.name.includes('Taiwan') || v.name.includes('Traditional')) ||
                    voices.find(v => v.lang.startsWith('zh'));
      if (twVoice) {
        utterance.voice = twVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech announcement error:", e);
    }
  };

  // Test Voice Function for POS Cashier
  const testVoiceAnnouncement = () => {
    const sampleOrder = {
      type: 'takeout',
      serialNum: 'O-001',
      items: [
        { name: '招牌大腸麵線', quantity: 1, specs: '小辣, 不要香菜' },
        { name: '綜合大碗麵線', quantity: 2, specs: '中辣' }
      ],
      remarks: '外帶需要辣椒醬'
    };
    speakOrderAnnouncement(sampleOrder);
  };

  // Native Portal Thermal Print Handler (Zero Popups, Full Continuous Paper Roll)
  const printReceipt = (order) => {
    if (!order) return;
    setPrintPayload({
      type: 'receipt',
      order,
      storeProfile: {
        ...storeProfile,
        storeName: storeName || storeProfile.storeName
      },
      receiptConfig: {
        ...receiptConfig,
        printKitchenTicket: printKitchenTicket
      },
      timestamp: Date.now()
    });
  };

  // Daily Closing Report Printout Handler
  const handlePrintDailyClosing = () => {
    const todayStr = getTodayLocalDate();
    const todayOrders = orders.filter(o => o.status === 'completed' || o.status === 'received');
    const totalRev = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const onlineRev = todayOrders.filter(o => o.paymentMethod === 'online').reduce((sum, o) => sum + o.total, 0);
    const cashRev = totalRev - onlineRev;
    const dineInCount = todayOrders.filter(o => o.type === 'dine-in').length;
    const takeoutCount = todayOrders.length - dineInCount;
    const avgOrderVal = todayOrders.length > 0 ? Math.round(totalRev / todayOrders.length) : 0;

    const itemCounts = {};
    todayOrders.forEach(o => {
      (o.items || []).forEach(item => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
      });
    });
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);

    const dailyData = {
      date: todayStr,
      cashier: cashierName || '店長 (Admin)',
      totalRevenue: totalRev,
      cashRevenue: cashRev,
      onlineRevenue: onlineRev,
      totalOrders: todayOrders.length,
      dineInCount,
      takeoutCount,
      avgOrderValue: avgOrderVal,
      topItems
    };

    setPrintPayload({
      type: 'daily',
      data: dailyData,
      storeProfile: {
        ...storeProfile,
        storeName: storeName || storeProfile.storeName
      },
      receiptConfig,
      timestamp: Date.now()
    });
    setTimeout(() => {
      window.focus();
      window.print();
    }, 80);
  };

  useEffect(() => {
    const handleStorageChange = () => {
      setClosedDates(JSON.parse(localStorage.getItem('restaurant_closed_dates') || '[]'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchClosedDatesFromCloud();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Offline Queue Auto-Flusher
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineOrders();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [storeCode]);

  const flushOfflineOrders = async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${storeCode}_offline_orders_queue`) || '[]');
      if (saved && saved.length > 0) {
        for (const offlineOrder of saved) {
          const { error } = await supabase.from('orders').insert([offlineOrder]);
          if (!error) {
            console.log("Uploaded offline order to Supabase:", offlineOrder.order_number);
          }
        }
        localStorage.removeItem(`${storeCode}_offline_orders_queue`);
        setOfflineQueue([]);
        triggerChime();
        fetchOrders();
      }
    } catch (e) {
      console.warn("Failed flushing offline orders:", e);
    }
  };

  // Quick Sold-out Toggle Handler
  const handleToggleItemAvailability = async (item, e) => {
    if (e) e.stopPropagation();
    const currentStatus = item.customizations?.is_available !== false;
    const newStatus = !currentStatus;

    // Optimistic local update
    setMenuItems(prev => prev.map(m => {
      if (m.id === item.id) {
        return {
          ...m,
          customizations: {
            ...(m.customizations || {}),
            is_available: newStatus
          }
        };
      }
      return m;
    }));

    try {
      const updatedCust = {
        ...(item.customizations || {}),
        is_available: newStatus
      };
      await supabase.from('menu_items').update({ customizations: updatedCust }).eq('id', item.id);
    } catch (err) {
      console.error("Failed toggling item availability:", err);
      fetchMenuItems();
    }
  };

  // Shift Handover Data & Printout Handler (X-Report)
  const getShiftHandoverData = () => {
    const loginTimeStr = localStorage.getItem(`${storeCode}_pos_login_time`);
    const loginTime = loginTimeStr ? Number(loginTimeStr) : (Date.now() - 4 * 3600 * 1000);
    const todayOrders = orders.filter(o => o.status === 'completed' || o.status === 'received');
    
    // Filter orders created after login time
    const shiftOrders = todayOrders.filter(o => {
      const oTime = new Date(o.timestamp || o.created_at).getTime();
      return oTime >= (loginTime - 60000); // 1 min buffer
    });

    const targetOrders = shiftOrders.length > 0 ? shiftOrders : todayOrders;
    const totalRev = targetOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    
    // Dynamic payment breakdown strictly matching posPaymentMethods configured in backend
    const paymentBreakdown = {};
    (posPaymentMethods && posPaymentMethods.length > 0 ? posPaymentMethods : ['現金', '信用卡', 'LINE Pay']).forEach(m => {
      paymentBreakdown[m] = 0;
    });

    let onlinePaymentTotal = 0;

    targetOrders.forEach(o => {
      const orderTotal = Number(o.total) || 0;
      const rawPay = o.paymentMethod || '現金';

      if (rawPay === 'online' || rawPay === '線上付' || rawPay === '線上點餐') {
        onlinePaymentTotal += orderTotal;
        return;
      }

      if (paymentBreakdown[rawPay] !== undefined) {
        paymentBreakdown[rawPay] += orderTotal;
      } else if (rawPay === 'cash' || rawPay === '現金') {
        if (paymentBreakdown['現金'] !== undefined) paymentBreakdown['現金'] += orderTotal;
        else paymentBreakdown[rawPay] = (paymentBreakdown[rawPay] || 0) + orderTotal;
      } else if (rawPay === 'card' || rawPay === '信用卡' || rawPay === '刷卡') {
        if (paymentBreakdown['信用卡'] !== undefined) paymentBreakdown['信用卡'] += orderTotal;
        else paymentBreakdown[rawPay] = (paymentBreakdown[rawPay] || 0) + orderTotal;
      } else if (rawPay === 'linepay' || rawPay === 'LINE Pay') {
        if (paymentBreakdown['LINE Pay'] !== undefined) paymentBreakdown['LINE Pay'] += orderTotal;
        else paymentBreakdown[rawPay] = (paymentBreakdown[rawPay] || 0) + orderTotal;
      } else {
        paymentBreakdown[rawPay] = (paymentBreakdown[rawPay] || 0) + orderTotal;
      }
    });

    const cashRev = paymentBreakdown['現金'] || paymentBreakdown['cash'] || 0;
    const dineInCount = targetOrders.filter(o => o.type === 'dine-in').length;
    const takeoutCount = targetOrders.length - dineInCount;
    const avgOrderVal = targetOrders.length > 0 ? Math.round(totalRev / targetOrders.length) : 0;

    return {
      storeCode,
      cashierName: cashierName || '店長 (Admin)',
      loginTime,
      orderCount: targetOrders.length,
      totalRevenue: totalRev,
      cashRevenue: cashRev,
      paymentBreakdown,
      onlineRevenue: onlinePaymentTotal,
      dineInCount,
      takeoutCount,
      avgOrderValue: avgOrderVal
    };
  };

  const handlePrintShiftHandover = () => {
    const shiftData = getShiftHandoverData();
    setPrintPayload({
      type: 'shift',
      data: shiftData,
      storeProfile: {
        ...storeProfile,
        storeName: storeName || storeProfile.storeName
      },
      receiptConfig,
      timestamp: Date.now()
    });
    setTimeout(() => {
      window.focus();
      window.print();
    }, 80);
  };

  const handleShiftLogoutOnly = async () => {
    try {
      const sessionKey = prefixNameForStore('SYSTEM_SETTING_ACTIVE_POS_SESSION', storeCode);
      await supabase.from('menu_items').update({ description: JSON.stringify({ user: '', sessionId: '', lastActive: 0 }) }).eq('name', sessionKey);
    } catch (e) {}
    onLogout();
  };

  const handleShiftHandoverAndLogout = async () => {
    handlePrintShiftHandover();
    setTimeout(async () => {
      handleShiftLogoutOnly();
    }, 500);
  };

  const fetchClosedDatesFromCloud = async () => {
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
    } catch (err) {
      console.error("Failed to fetch closed dates from cloud in CashierView:", err);
    }
  };

  // Fetch Menu Items from Supabase
  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      if (data) {
        const storeItems = filterItemsByStore(data, storeCode);

        const storeProfileItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_PROFILE');
        if (storeProfileItem && storeProfileItem.description) {
          try {
            const parsed = JSON.parse(storeProfileItem.description);
            setStoreProfile(parsed);
            if (parsed.storeName) setStoreName(parsed.storeName);
          } catch (e) {}
        }

        const storeNameItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_NAME');
        if (storeNameItem && storeNameItem.description) {
          setStoreName(storeNameItem.description);
        }

        const posOrderTypeItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_POS_DEFAULT_ORDER_TYPE');
        if (posOrderTypeItem && posOrderTypeItem.description) {
          setPosDefaultOrderType(posOrderTypeItem.description);
          setOrderType(posOrderTypeItem.description);
        }

        const posPaymentsItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_POS_PAYMENT_METHODS');
        if (posPaymentsItem && posPaymentsItem.description) {
          try {
            const parsed = JSON.parse(posPaymentsItem.description);
            setPosPaymentMethods(parsed);
            if (parsed.length > 0) setSelectedPaymentMethod(parsed[0]);
          } catch (e) {
            setPosPaymentMethods(['現金', '信用卡', 'LINE Pay']);
          }
        }
        const adminPinItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_ADMIN_PIN');
        if (adminPinItem && adminPinItem.description) {
          setAdminPin(adminPinItem.description);
        }
        const orderItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_MENU_ORDER');
        let orderList = [];
        if (orderItem && orderItem.description) {
          try { orderList = JSON.parse(orderItem.description); } catch (e) {}
        }
        
        const categoriesItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_PRODUCT_CATEGORIES');
        if (categoriesItem && categoriesItem.description) {
          try {
            const parsed = JSON.parse(categoriesItem.description);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCategories(parsed);
              if (!parsed.some(c => c.id === activeCategory)) {
                setActiveCategory(parsed[0].id);
              }
            }
          } catch (e) {}
        }

        const receiptItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_RECEIPT_CONFIG');
        if (receiptItem && receiptItem.description) {
          try { setReceiptConfig({ ...defaultReceiptConfig, ...JSON.parse(receiptItem.description) }); } catch (e) {}
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
            name: stripNameForStore(item.name, storeCode),
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
        setMenuItems(visibleItems);
      }
    } catch (err) {
      console.error("Failed to load menu items in CashierView:", err);
      // Fallback from localStorage or default
      const saved = localStorage.getItem('restaurant_menu_items');
      if (saved) setMenuItems(JSON.parse(saved));
    }
  };

  const fetchOrders = async () => {
    try {
      // Query latest 500 orders descending by ID so newest orders are NEVER truncated by Supabase 1000 limit!
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('id', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (data) {
        const todayStr = getTodayLocalDate();
        const storeOrders = filterOrdersByStore(data, storeCode);
        const clientOrders = storeOrders.filter(o => {
          const orderDate = new Date(o.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
          const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
          return orderDate === todayStr && itemsData?.customerName !== 'SYSTEM_STORE_CLOSE';
        });
        const mapped = clientOrders.map(formatSupabaseOrder).filter(Boolean);
        
        // Sorting priority: 1. Serial number (smallest to largest), 2. Takeout first then Dine-in
        const getSerialNum = (order) => {
          const s = String(order.serialNum || order.order_number || order.id || '');
          const m = s.match(/\d+/);
          return m ? parseInt(m[0], 10) : 999999;
        };

        const getTypePriority = (order) => {
          const isTakeout = order.type === 'takeout' || order.type === '外帶' || order.type === '自取';
          return isTakeout ? 1 : 2; // 1 for Takeout, 2 for Dine-in
        };

        const sorted = mapped.sort((a, b) => {
          // 1. 數字小到大 (Number from smallest to largest)
          const numA = getSerialNum(a);
          const numB = getSerialNum(b);
          if (numA !== numB) return numA - numB;

          // 2. 先外帶再內用 (Takeout first, then Dine-in)
          const typeA = getTypePriority(a);
          const typeB = getTypePriority(b);
          if (typeA !== typeB) return typeA - typeB;

          return b.timestamp - a.timestamp;
        });

        setOrders(sorted);
      }
    } catch (err) {
      console.error("Failed to load orders in CashierView:", err);
    }
  };

  useEffect(() => {
    fetchMenuItems();
    fetchClosedDatesFromCloud();
    fetchOrders();
  }, [storeCode]);

  // Listen to incoming orders (Permanent Realtime Channel with Dynamic Ref Check)
  useEffect(() => {
    const channelId = `pos_realtime_${storeCode || 'dragon'}_${Date.now()}`;
    const ordersChannel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        // If a new order is received, play chime and speak announcement
        if (payload.eventType === 'INSERT') {
          const itemsData = typeof payload.new.items === 'string' ? JSON.parse(payload.new.items) : payload.new.items;
          if (itemsData?.customerName !== 'SYSTEM_STORE_CLOSE') {
            const orderNum = payload.new.order_number;
            const orderId = String(payload.new.id);

            // Skip if already printed by this POS terminal
            if (locallyPrintedOrders.current.has(orderNum) || locallyPrintedOrders.current.has(orderId)) {
              return;
            }

            triggerChime();
            const mappedOrder = formatSupabaseOrder(payload.new);
            if (mappedOrder) {
              speakOrderAnnouncement(mappedOrder);
              // Check live ref to guarantee auto-print status even after toggling without refresh
              if (isAutoPrintEnabledRef.current) {
                locallyPrintedOrders.current.add(orderNum);
                locallyPrintedOrders.current.add(orderId);
                printReceipt(mappedOrder);
              }
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [storeCode]);

  // Background Auto-Print Polling Daemon (Runs continuously & reads live isAutoPrintEnabledRef)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isAutoPrintEnabledRef.current) return;

      try {
        const { data: newOrders, error } = await supabase
          .from('orders')
          .select('*')
          .eq('status', 'received')
          .gte('created_at', new Date(systemStartTime.current).toISOString())
          .order('id', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (newOrders && newOrders.length > 0) {
          const unprintedOrders = newOrders.filter(o => {
            const orderId = String(o.id);
            const orderNum = o.order_number;
            if (locallyPrintedOrders.current.has(orderId) || locallyPrintedOrders.current.has(orderNum)) {
              return false;
            }
            const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
            return !itemsData || !itemsData.is_printed;
          });

          for (const order of unprintedOrders) {
            if (!isAutoPrintEnabledRef.current) break;

            const orderId = String(order.id);
            const orderNum = order.order_number;
            locallyPrintedOrders.current.add(orderId);
            locallyPrintedOrders.current.add(orderNum);

            const itemsData = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            const updatedItems = { ...itemsData, is_printed: true };
            
            await supabase
              .from('orders')
              .update({ items: updatedItems })
              .eq('id', order.id);

            const mappedOrder = formatSupabaseOrder(order);
            triggerChime();
            if (mappedOrder && isAutoPrintEnabledRef.current) {
              printReceipt(mappedOrder);
              speakOrderAnnouncement(mappedOrder);
            }
          }

          fetchOrders();
        }
      } catch (err) {
        console.error("Error polling for auto-print:", err);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [storeCode]);

  // Calculate total price in cart
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  // Calculate discount amount and final total
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round(cartTotal * (discountValue / 100));
  } else if (discountType === 'amount') {
    discountAmount = discountValue;
  }
  const finalTotal = Math.max(0, cartTotal - discountAmount);

  // Calculate change
  useEffect(() => {
    const received = parseFloat(cashReceived) || 0;
    if (received >= finalTotal) {
      setChangeAmount(received - finalTotal);
    } else {
      setChangeAmount(0);
    }
  }, [cashReceived, finalTotal]);

  // Handle adding product to cart
  const handleProductClick = (item) => {
    if (item.customizations?.is_available === false) {
      alert(`「${item.name}」已售完！無法加入訂單。`);
      return;
    }
    if (item.customizations) {
      // Open customization modal
      setActiveItemForModal(item);
    } else {
      // Add straight to cart (no customizations)
      const existing = cart.find(c => c.id === item.id && (!c.specs || c.specs.length === 0));
      if (existing) {
        setCart(cart.map(c => 
          c.cartId === existing.cartId 
            ? { ...c, quantity: c.quantity + 1, totalPrice: c.totalPrice + item.price }
            : c
        ));
      } else {
        const cartItem = {
          cartId: `${item.id}-${Date.now()}`,
          id: item.id,
          name: item.name,
          basePrice: item.price,
          itemPrice: item.price,
          totalPrice: item.price,
          quantity: 1,
          specs: [],
          image: item.image
        };
        setCart([...cart, cartItem]);
      }
    }
  };

  const handleEditCartItem = (cartItem) => {
    const matchedProduct = menuItems.find(p => p.id === cartItem.id) || {
      id: cartItem.id,
      name: cartItem.name,
      price: cartItem.basePrice || cartItem.itemPrice,
      image: cartItem.image,
      customizations: cartItem.customizations
    };
    setEditingCartItem(cartItem);
    setActiveItemForModal(matchedProduct);
  };

  const handleAddToCartFromModal = (newCartItem) => {
    if (editingCartItem) {
      setCart(cart.map(c => c.cartId === editingCartItem.cartId ? { ...newCartItem, cartId: editingCartItem.cartId } : c));
      setEditingCartItem(null);
    } else {
      setCart([...cart, newCartItem]);
    }
    setActiveItemForModal(null);
  };

  // Open edit modal for submitted POS order
  const handleOpenEditPosOrderModal = (order) => {
    setEditingPosOrder(order);
    setEditOrderType(order.type || 'dine-in');
    setEditOrderTable(order.tableNumber || order.tableName || '');
    setEditOrderCust(order.customerName || '');
    setEditOrderRemarks(order.remarks || '');
    setEditOrderTotal(String(order.total || 0));
    setEditOrderPayment(order.paymentMethod || '現金');
    setEditOrderItems(Array.isArray(order.items) ? order.items.map(i => ({ ...i })) : []);
  };

  const handleSavePosOrderEdit = async (e) => {
    e.preventDefault();
    if (!editingPosOrder) return;

    try {
      const numericId = Number(editingPosOrder.id);
      const newTotal = Number(editOrderTotal) || 0;

      const updatedItemsPayload = {
        cart: editOrderItems,
        cashier: editingPosOrder.cashier,
        remarks: editOrderRemarks.trim(),
        pickupTime: editingPosOrder.pickupTime,
        customerName: editOrderCust.trim() || (editOrderType === 'dine-in' && editOrderTable ? `內用 ${editOrderTable} 號桌` : '現場外帶'),
        customerPhone: editingPosOrder.customerPhone,
        paymentMethod: editOrderPayment.trim()
      };

      const { error } = await supabase
        .from('orders')
        .update({
          total: newTotal,
          type: editOrderType,
          table_number: editOrderType === 'dine-in' ? (editOrderTable || null) : null,
          items: updatedItemsPayload
        })
        .eq('id', isNaN(numericId) ? editingPosOrder.id : numericId);

      if (error) throw error;

      alert("🎉 訂單內容修改成功！");
      setEditingPosOrder(null);
      fetchOrders();
    } catch (err) {
      console.error("Failed to save POS order edit:", err);
      alert("修改失敗：" + (err.message || "請檢查網路連線"));
    }
  };

  // Modify item quantity in POS cart
  const handleUpdateQty = (cartId, delta) => {
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        const nextQty = Math.max(1, c.quantity + delta);
        return {
          ...c,
          quantity: nextQty,
          totalPrice: c.itemPrice * nextQty
        };
      }
      return c;
    }));
  };

  // Remove item from POS cart
  const handleRemoveFromCart = (cartId) => {
    setCart(cart.filter(c => c.cartId !== cartId));
  };

  // Quick cash keypad actions
  const handleQuickCash = (amount) => {
    const current = parseFloat(cashReceived) || 0;
    setCashReceived(String(current + amount));
  };

  const handleClearCash = () => {
    setCashReceived('');
  };

  // Submit POS Order to Supabase with auto-retry and print isolation
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingOrder) return;

    if (cart.length === 0) {
      alert("收銀購物車內尚無餐點項目！");
      return;
    }

    const received = isCash ? (parseFloat(cashReceived) || 0) : finalTotal;
    if (isCash && received < finalTotal) {
      alert(`實收現金金額不足！還缺 NT$ ${finalTotal - received}`);
      return;
    }

    setIsSubmittingOrder(true);

    try {
      // 1. Generate serial number (I-001 or O-001 daily format, max number + 1 logic)
      const prefix = orderType === 'dine-in' ? 'I' : 'O';
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
        console.warn("Failed to get today max order num:", err);
      }

      const serialNum = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
      locallyPrintedOrders.current.add(serialNum);

      const orderPayload = {
        order_number: serialNum,
        items: {
          store_code: storeCode,
          cart: cart.map(c => ({
            id: c.id,
            name: c.name,
            price: c.price,
            quantity: c.quantity,
            totalPrice: c.totalPrice,
            specs: c.specs
          })),
          customerName: orderType === 'dine-in' ? '內用點餐 (POS)' : (custName.trim() || '現場外帶'),
          customerPhone: '',
          pickupTime: '',
          paymentMethod: isCash ? 'cash' : selectedPaymentMethod,
          remarks: "",
          cashier: cashierName || localStorage.getItem('cashier_name') || '店長 (Admin)'
        },
        total: finalTotal,
        type: orderType,
        table_number: orderType === 'dine-in' ? tableNumber : null,
        status: 'received',
        payment_status: 'paid'
      };

      // 2. Insert with automatic 3-attempt retry loop
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
          console.warn(`POS order submission attempt ${attempt} failed:`, retryErr);
          if (attempt < 3) {
            await new Promise(res => setTimeout(res, attempt * 400));
          }
        }
      }

      if (!dbOrders || dbOrders.length === 0) {
        throw (lastErr || new Error("伺服器無回應，請確認網路連線"));
      }

      const createdOrder = dbOrders[0];
      const orderToPrint = {
        ...formatSupabaseOrder(createdOrder),
        cashReceived: received,
        changeAmount: received - finalTotal
      };

      // 3. Print receipt automatically ONLY if isAutoPrintEnabled is true
      // 3. Print receipt automatically ONLY if isAutoPrintEnabled is true
      if (isAutoPrintEnabledRef.current) {
        try {
          printReceipt(orderToPrint);
        } catch (printErr) {
          console.warn("Print receipt warning:", printErr);
        }
      }

      setLatestOrder({
        ...createdOrder,
        ...formatSupabaseOrder(createdOrder),
        cashReceived: received,
        changeAmount: received - finalTotal
      });
      setViewState('success');

      // 4. Immediately refresh cloud orders list in POS so new order shows right away!
      try {
        await fetchOrders();
      } catch (fErr) {
        console.warn("Immediate fetchOrders warning:", fErr);
      }
    } catch (err) {
      console.warn("Supabase order submit failed, falling back to local offline queue:", err);
      
      const fallbackSerial = `${orderType === 'dine-in' ? 'I' : 'O'}-${Date.now().toString().slice(-4)}`;
      const offlineOrder = {
        order_number: fallbackSerial,
        items: {
          store_code: storeCode,
          cart: cart,
          customerName: orderType === 'dine-in' ? '內用點餐 (POS)' : (custName.trim() || '現場外帶'),
          paymentMethod: isCash ? 'cash' : selectedPaymentMethod,
          cashier: cashierName || '店長 (Admin)'
        },
        total: finalTotal,
        type: orderType,
        table_number: orderType === 'dine-in' ? tableNumber : null,
        status: 'completed',
        payment_status: 'paid',
        created_at: new Date().toISOString()
      };

      try {
        const savedQueue = JSON.parse(localStorage.getItem(`${storeCode}_offline_orders_queue`) || '[]');
        savedQueue.push(offlineOrder);
        localStorage.setItem(`${storeCode}_offline_orders_queue`, JSON.stringify(savedQueue));
        setOfflineQueue(savedQueue);
      } catch (storageErr) {
        console.warn("Storage error for offline queue:", storageErr);
      }

      const fallbackPrintOrder = {
        ...offlineOrder,
        serialNum: fallbackSerial,
        cashReceived: received,
        changeAmount: received - finalTotal
      };

      if (isAutoPrintEnabledRef.current) {
        try {
          printReceipt(fallbackPrintOrder);
        } catch (e) {}
      }

      setLatestOrder(fallbackPrintOrder);
      setViewState('success');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Reset screen for next customer
  const handleResetPos = () => {
    setCart([]);
    setCashReceived('');
    setOrderType(posDefaultOrderType);
    if (posPaymentMethods.length > 0) setSelectedPaymentMethod(posPaymentMethods[0]);
    setRemarks('');
    setCustName('');
    setViewState('pos');
    setLatestOrder(null);
    setDiscountType('none');
    setDiscountValue(0);
    setSearchQuery('');
  };

  // Filter items by category and search query
  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  if (closedDates.includes(getTodayLocalDate())) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-body)',
        color: 'var(--text-main)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '40px 30px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <span style={{ fontSize: '3rem' }}>🔒</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '900', margin: '15px 0 8px 0', color: 'var(--text-main)' }}>
            今日收銀系統已結案鎖定
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '24px' }}>
            今日 ({getTodayLocalDate()}) 已完成收店結帳。本 POS 系統已關閉服務並安全鎖定，直到明日才會自動解鎖恢復。
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={async () => {
                if (window.confirm("解鎖帳目後今日收銀功能將恢復營運。確定重新開店嗎？")) {
                  const todayStr = getTodayLocalDate();
                  const updated = closedDates.filter(d => d !== todayStr);
                  setClosedDates(updated);
                  localStorage.setItem('restaurant_closed_dates', JSON.stringify(updated));
                  window.dispatchEvent(new Event('storage'));

                  try {
                    const closedKey = prefixNameForStore('SYSTEM_SETTING_CLOSED_DATES', storeCode);
                    const { data: exist } = await supabase.from('menu_items').select('*').eq('name', closedKey);
                    if (exist && exist.length > 0) {
                      await supabase.from('menu_items').update({ description: JSON.stringify(updated) }).eq('name', closedKey);
                    }
                  } catch (e) {
                    console.warn("Failed to update closed dates on unlock:", e);
                  }

                  alert("🔓 已成功解鎖，今日 POS 收銀系統已恢復營運。");
                }
              }}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-body)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔓 重開帳目
            </button>
            {onLogout && (
              <button 
                onClick={onLogout}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🚪 登出鎖定
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-body)',
      color: 'var(--text-main)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative'
    }}>
      {/* 🔄 Shift Handover Modal (X-Report) */}
      {showShiftHandoverModal && (() => {
        const shiftData = getShiftHandoverData();
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px'
          }}>
            <div style={{
              maxWidth: '440px', width: '100%', backgroundColor: 'var(--bg-card)',
              border: '2px solid #3b82f6', borderRadius: '16px', padding: '28px 24px',
              textAlign: 'left', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔄 員工換班結算 (X-Report)
                </h3>
                <button
                  onClick={() => setShowShiftHandoverModal(false)}
                  style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>交班人員:</span>
                  <strong>{shiftData.cashierName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>開班時間:</span>
                  <span>{new Date(shiftData.loginTime).toLocaleTimeString('zh-TW', { hour12: false })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>當前時間:</span>
                  <span>{new Date().toLocaleTimeString('zh-TW', { hour12: false })}</span>
                </div>
                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 'bold', color: '#16a34a' }}>
                  <span>💰 當班營業總額:</span>
                  <span>NT$ {shiftData.totalRevenue.toLocaleString()}</span>
                </div>
                {shiftData.paymentBreakdown && Object.entries(shiftData.paymentBreakdown).map(([methodName, amount]) => {
                  const isCash = methodName === '現金' || methodName === 'cash';
                  return (
                    <div key={methodName} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '10px', color: isCash ? '#16a34a' : 'var(--text-main)', fontWeight: isCash ? 'bold' : 'normal' }}>
                      <span>└ {methodName}:</span>
                      <span>NT$ {amount.toLocaleString()}</span>
                    </div>
                  );
                })}
                {shiftData.onlineRevenue > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '10px', color: 'var(--text-muted)' }}>
                    <span>└ 線上點餐付款:</span>
                    <span>NT$ {shiftData.onlineRevenue.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>🧾 成交訂單筆數:</span>
                  <span>{shiftData.orderCount} 筆 (內用 {shiftData.dineInCount} / 外帶 {shiftData.takeoutCount})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>平均客單價:</span>
                  <span>NT$ {shiftData.avgOrderValue}</span>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handlePrintShiftHandover}
                  style={{
                    height: '52px', fontSize: '1rem', fontWeight: 'bold',
                    backgroundColor: '#3b82f6', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  🖨️ 列印交班小票
                </button>
                <button
                  type="button"
                  onClick={handleShiftLogoutOnly}
                  style={{
                    height: '52px', fontSize: '1rem', fontWeight: 'bold',
                    backgroundColor: '#2563eb', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                    boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  🚪 換班登出
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftHandoverModal(false)}
                style={{
                  width: '100%', marginTop: '10px', padding: '10px', fontSize: '0.85rem', fontWeight: 'bold',
                  backgroundColor: 'transparent', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                ✕ 關閉返回
              </button>
            </div>
          </div>
        );
      })()}

      {/* In-UI Kickout Full-Screen Overlay */}
      {kickoutState.isKickedOut && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: '20px'
        }}>
          <div style={{
            maxWidth: '400px', width: '100%', backgroundColor: 'var(--bg-card)',
            border: '2px solid #ef4444', borderRadius: '16px', padding: '36px 28px',
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🔒</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: '900', color: '#ef4444' }}>
              本機已被自動登出
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              偵測到收銀系統已於其他裝置登入使用 (<strong style={{ color: 'var(--text-main)' }}>{kickoutState.user}</strong>)。<br />
              為確保收銀單號與帳目一致，本機已安全登出。
            </p>
            <button
              onClick={onLogout}
              style={{
                width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 'bold',
                backgroundColor: '#ef4444', color: 'white', border: 'none',
                borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
              }}
            >
              🚪 返回登入畫面
            </button>
          </div>
        </div>
      )}
      {isPrintBlocked && (
        <div style={{
          backgroundColor: '#fee2e2',
          borderBottom: '1px solid #fca5a5',
          color: '#b91c1c',
          padding: '8px 24px',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100
        }}>
          <span>⚠️ 偵測到自動列印收據的彈出視窗被您的瀏覽器封鎖！請點擊瀏覽器網址列右側的彈出視窗圖示，並選擇「永遠允許此網站的彈出視窗」以啟動自動出單。</span>
          <button 
            onClick={() => setIsPrintBlocked(false)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#b91c1c', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              fontSize: '1rem',
              padding: '0 8px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>💵</span>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>{storeName} 現場收銀系統 (POS)</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Offline Mode Indicator Badge */}
          {!isOnline && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '20px',
              backgroundColor: '#fee2e2',
              border: '2px solid #ef4444',
              color: '#b91c1c',
              fontSize: '0.8rem',
              fontWeight: '900',
              animation: 'pulse 1.5s infinite'
            }}>
              📶 離線模式 {offlineQueue.length > 0 ? `(待同步 ${offlineQueue.length} 筆)` : ''}
            </div>
          )}

          {/* Quick Sold-out Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setIsManagingSoldOut(!isManagingSoldOut)}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: isManagingSoldOut ? '2px solid #ea580c' : '1px solid #ea580c',
              backgroundColor: isManagingSoldOut ? '#ea580c' : 'rgba(234, 88, 12, 0.08)',
              color: isManagingSoldOut ? 'white' : '#ea580c',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: isManagingSoldOut ? '0 0 10px rgba(234, 88, 12, 0.5)' : 'none'
            }}
          >
            ⚡ {isManagingSoldOut ? '✓ 結束沽清設定' : '沽清/售完管理'}
          </button>

          {/* Unified POS Settings & Print Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowPosSettingsModal(true)}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--primary)',
                backgroundColor: 'rgba(255, 107, 53, 0.08)',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              ⚙️ POS 功能與列印設定
              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: isAutoPrintEnabled ? '#16a34a' : '#64748b', color: 'white' }}>
                {isAutoPrintEnabled ? '🖨️自動出單:開' : '🖨️自動出單:關'}
              </span>
              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: printKitchenTicket ? '#0284c7' : '#64748b', color: 'white' }}>
                {printKitchenTicket ? '🍳廚房單:開' : '🍳廚房單:關'}
              </span>
              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: isVoiceAnnounceEnabled ? '#10b981' : '#64748b', color: 'white' }}>
                {isVoiceAnnounceEnabled ? '🗣️語音:開' : '🗣️語音:關'}
              </span>
            </button>

            {/* Shift Handover (X-Report) Button */}
            <button
              type="button"
              onClick={() => setShowShiftHandoverModal(true)}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: '#2563eb',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🔄 換班交接
            </button>

            {watchedLowStockItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowStockAlertModal(true)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #ef4444',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="點擊查看缺貨與偏低之關注項目"
              >
                ⚠️ 補貨提醒 ({watchedLowStockItems.length})
              </button>
            )}
          </div>
          <button 
            onClick={async () => {
              try {
                const sessionKey = prefixNameForStore('SYSTEM_SETTING_ACTIVE_POS_SESSION', storeCode);
                await supabase.from('menu_items').update({ description: JSON.stringify({ user: '', sessionId: '', lastActive: 0 }) }).eq('name', sessionKey);
              } catch (e) {}
              onLogout();
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🔒 登出鎖定
          </button>
        </div>
      </header>

      {/* POS Watched Low Stock Alert Banner */}
      {watchedLowStockItems.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          borderBottom: '2px solid #ef4444',
          color: '#991b1b',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.82rem',
          fontWeight: 'bold',
          zIndex: 90
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <span style={{ color: '#b91c1c', whiteSpace: 'nowrap' }}>【關注品項補貨提醒】</span>
            <span style={{ fontWeight: 'normal', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {watchedLowStockItems.map(i => `${i.name} (剩 ${i.qty}${i.unit} / 警戒 ${i.minStock}${i.unit})`).join('、')}
              &nbsp;庫存偏低或缺貨，請及時叫貨補庫存！
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowStockAlertModal(true)}
            style={{
              padding: '3px 8px',
              fontSize: '0.75rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              marginLeft: '12px'
            }}
          >
            📋 查看明細 ({watchedLowStockItems.length})
          </button>
        </div>
      )}

      {viewState === 'pos' ? (
        /* POS Main Workspace */
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          height: 'calc(100vh - 57px)'
        }}>
          {/* Left Panel: Menu Item Grid with Giant Switch Tabs */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'hidden',
            padding: '12px 16px',
            borderRight: '1px solid var(--border)',
            gap: '10px',
            minHeight: 0
          }}>
            {/* Giant Category switcher tabs */}
            <div style={{
              display: 'flex',
              gap: '12px',
              overflowX: 'auto',
              paddingBottom: '4px'
            }}>
              {categories.map((cat) => {
                const isCatActive = activeCategory === cat.id;
                const catItemCount = menuItems.filter(i => (i.category === cat.id) || (cat.id === 'combos' && (i.category === 'combos' || i.customizations?.is_combo))).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    style={{
                      flex: '1 1 auto',
                      minWidth: '150px',
                      height: '52px',
                      fontSize: '1.05rem',
                      fontWeight: '900',
                      borderRadius: '10px',
                      border: '2px solid',
                      borderColor: isCatActive ? 'var(--primary)' : 'var(--border)',
                      backgroundColor: isCatActive ? 'var(--primary)' : 'var(--bg-card)',
                      color: isCatActive ? 'white' : 'var(--text-main)',
                      cursor: 'pointer',
                      boxShadow: isCatActive ? 'var(--shadow-md)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>{cat.icon || '🍜'}</span>
                    <span>{cat.name} ({catItemCount})</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setActiveCategory('orders')}
                style={{
                  flex: '1 1 auto',
                  minWidth: '180px',
                  height: '52px',
                  fontSize: '1.05rem',
                  fontWeight: '900',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: activeCategory === 'orders' ? '#10b981' : 'var(--border)',
                  backgroundColor: activeCategory === 'orders' ? '#10b981' : 'var(--bg-card)',
                  color: activeCategory === 'orders' ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  boxShadow: activeCategory === 'orders' ? 'var(--shadow-md)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap'
                }}
              >
                📋 雲端接單與紀錄 ({orders.filter(o => o.status === 'received').length})
              </button>
            </div>

            {/* Giant Grid Container - filling height */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              paddingBottom: '10px'
            }}>
              {activeCategory === 'orders' ? (
                /* Orders list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                  {orders.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>暫無訂單</div>
                  ) : (
                    orders.map(order => {
                      const isPending = order.status === 'received';
                      return (
                        <div key={order.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-card)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '6px' }}>
                            <span>
                              單號: {order.serialNum} ({order.type === 'dine-in' ? '內用' : '外帶'})
                              <span style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: isPending ? 'rgba(234, 88, 12, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                                color: isPending ? 'var(--primary)' : '#16a34a'
                              }}>
                                {isPending ? '處理中' : '已完成'}
                              </span>
                            </span>
                            <span>NT$ {order.total}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {(order.items || []).map((it, idx) => (
                              <div key={idx}>
                                • {it.name} x{it.quantity} {it.specs && it.specs.length > 0 ? `(${it.specs.join(', ')})` : ''}
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {order.customerName ? `顧客: ${order.customerName}` : ''} {order.tableName ? `(${order.tableName}桌)` : ''}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {isPending ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                  style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  ✔ 完成
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm("確定要將此訂單標記為退貨嗎？")) {
                                      handleUpdateOrderStatus(order.id, 'deleted');
                                    }
                                  }}
                                  style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  退貨
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditPosOrderModal(order)}
                                style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: 'rgba(234, 88, 12, 0.08)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                title="編輯已送出訂單內容"
                              >
                                ✏️ 編輯
                              </button>
                              <button
                                onClick={() => printReceipt(order)}
                                style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                🖨️ 列印
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Products grid for the active category (Supports combos, mee-sua, specialties, and any category!) */
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: activeCategory === 'combos' ? 'repeat(auto-fit, minmax(210px, 1fr))' : 'repeat(3, 1fr)',
                  gap: '12px'
                }}>
                  {menuItems.filter(item => (item.category === activeCategory) || (activeCategory === 'combos' && (item.category === 'combos' || item.customizations?.is_combo))).map(item => {
                    const isAvailable = item.customizations?.is_available !== false;
                    const isCombo = item.customizations?.is_combo || item.category === 'combos';
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isManagingSoldOut) {
                            handleToggleItemAvailability(item);
                          } else {
                            handleProductClick(item);
                          }
                        }}
                        style={{
                          backgroundColor: isAvailable 
                            ? (isCombo ? 'rgba(255, 107, 53, 0.08)' : (item.category === 'specialties' ? 'rgba(220, 38, 38, 0.05)' : 'rgba(255, 107, 53, 0.05)'))
                            : 'var(--bg-body)',
                          border: isAvailable 
                            ? (isCombo ? '2px solid var(--primary)' : (item.category === 'specialties' ? '2px solid rgba(220, 38, 38, 0.3)' : '2px solid rgba(255, 107, 53, 0.3)'))
                            : '2px solid var(--border)',
                          borderRadius: '12px',
                          padding: '12px 10px',
                          minHeight: '105px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                          userSelect: 'none',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'all 0.1s ease',
                          textAlign: 'center',
                          position: 'relative',
                          opacity: isAvailable ? 1 : 0.55
                        }}
                      >
                        {isCombo && <span style={{ fontSize: '1.4rem' }}>🍱</span>}
                        <div style={{ fontSize: isCombo ? '1.1rem' : '1.3rem', fontWeight: '900', lineHeight: '1.2' }}>
                          {item.name}
                        </div>
                        <span className="price-tag" style={{ fontSize: '1.05rem', fontWeight: '900', color: isAvailable ? 'var(--primary)' : 'var(--text-muted)' }}>
                          NT$ {item.price} {isCombo ? '起' : ''}
                        </span>
                        {isManagingSoldOut ? (
                          <button
                            type="button"
                            onClick={(e) => handleToggleItemAvailability(item, e)}
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              backgroundColor: isAvailable ? '#10b981' : '#ef4444',
                              color: 'white',
                              border: 'none',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              zIndex: 10,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                          >
                            {isAvailable ? '🟢 供應中' : '🔴 已售完'}
                          </button>
                        ) : (
                          <>
                            {!isAvailable ? (
                              <span style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                🔴 售完
                              </span>
                            ) : isCombo ? (
                              <span style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                fontSize: '0.6rem',
                                fontWeight: 'bold',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                🍱 套餐組合
                              </span>
                            ) : item.customizations && (
                              <span style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                fontSize: '0.55rem',
                                fontWeight: 'bold',
                                backgroundColor: 'rgba(255, 107, 53, 0.12)',
                                color: 'var(--primary)',
                                padding: '1px 5px',
                                borderRadius: '4px'
                              }}>
                                ⚙️客製
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Cart Items List */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '10px 14px',
              border: '1px solid var(--border)',
              marginTop: '6px',
              overflow: 'hidden',
              boxSizing: 'border-box',
              minHeight: 0
            }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '4px', margin: '0 0 6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>🛒 點餐清單 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({cart.length} 品項)</span></span>
                {cart.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => { if(confirm("確定要清空點餐清單嗎？")) setCart([]); }}
                    style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
                  >
                    🧹 清空所有
                  </button>
                )}
              </h2>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {cart.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '1.8rem' }}>🛒</span>
                    <span style={{ fontSize: '0.75rem' }}>點餐清單為空，請點選上方商品</span>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    {cart.map((cartItem) => (
                      <div 
                        key={cartItem.cartId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          backgroundColor: 'var(--bg-body)',
                          boxSizing: 'border-box'
                        }}
                      >
                        {/* Name and specs (Left) */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', minWidth: '120px' }}>{cartItem.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {cartItem.specs && cartItem.specs
                              .map(s => typeof s === 'object' && s ? (s.value || `${s.name ? s.name + ': ' : ''}${s.value}`) : String(s))
                              .filter(Boolean)
                              .map(s => s.replace(/^undefined:\s*/i, ''))
                              .map(s => `• ${s}`)
                              .join(' ')}
                          </span>
                        </div>

                        {/* Controls & Price (Right) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Edit Item Customizations */}
                          <button
                            type="button"
                            onClick={() => handleEditCartItem(cartItem)}
                            style={{
                              padding: '3px 7px',
                              fontSize: '0.75rem',
                              borderRadius: '4px',
                              border: '1px solid var(--primary)',
                              backgroundColor: 'rgba(234, 88, 12, 0.08)',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                            title="修改餐點加料與調料客製"
                          >
                            ✏️ 修改
                          </button>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>單價: NT$ {cartItem.itemPrice}</span>
                          
                          {/* Qty edit */}
                          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--bg-card)' }}>
                            <button 
                              type="button"
                              onClick={() => handleUpdateQty(cartItem.cartId, -1)}
                              style={{ border: 'none', background: 'none', width: '22px', height: '22px', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                            >-</button>
                            <span style={{ width: '24px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>{cartItem.quantity}</span>
                            <button 
                              type="button"
                              onClick={() => handleUpdateQty(cartItem.cartId, 1)}
                              style={{ border: 'none', background: 'none', width: '22px', height: '22px', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                            >+</button>
                          </div>

                          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', minWidth: '70px', textAlign: 'right' }}>
                            NT$ {cartItem.totalPrice}
                          </span>

                          {/* Delete item */}
                          <button 
                            type="button"
                            onClick={() => handleRemoveFromCart(cartItem.cartId)}
                            style={{
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#ef4444',
                              fontSize: '1rem',
                              cursor: 'pointer',
                              padding: '2px 6px'
                            }}
                            title="刪除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}              </div>
            </div>
</div>

          {/* Right Panel: Transaction Cart & Checkout */}
          <div style={{
            width: '360px',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Checkout Form & Register Panel */}
            <form onSubmit={handleCheckoutSubmit} style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-body)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              height: '100%',
              boxSizing: 'border-box',
              justifyContent: 'space-between',
              overflowY: 'auto'
            }}>
              {/* Order Type Toggle buttons side-by-side (Scaled) */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '2px', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setOrderType('dine-in')}
                  style={{
                    flex: 1,
                    height: posUiScale === 'large' ? '50px' : posUiScale === 'medium' ? '42px' : '36px',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: orderType === 'dine-in' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: orderType === 'dine-in' ? 'var(--primary)' : 'var(--bg-card)',
                    color: orderType === 'dine-in' ? 'white' : 'var(--text-main)',
                    fontWeight: '900',
                    cursor: 'pointer',
                    fontSize: posUiScale === 'large' ? '1.15rem' : posUiScale === 'medium' ? '1.05rem' : '0.95rem',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: orderType === 'dine-in' ? '0 2px 8px rgba(255, 107, 53, 0.25)' : 'none'
                  }}
                >
                  🏠 內用
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('takeout')}
                  style={{
                    flex: 1,
                    height: posUiScale === 'large' ? '50px' : posUiScale === 'medium' ? '42px' : '36px',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: orderType === 'takeout' ? '2px solid #dc2626' : '1px solid var(--border)',
                    backgroundColor: orderType === 'takeout' ? '#dc2626' : 'var(--bg-card)',
                    color: orderType === 'takeout' ? 'white' : 'var(--text-main)',
                    fontWeight: '900',
                    cursor: 'pointer',
                    fontSize: posUiScale === 'large' ? '1.15rem' : posUiScale === 'medium' ? '1.05rem' : '0.95rem',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: orderType === 'takeout' ? '0 2px 8px rgba(220, 38, 38, 0.25)' : 'none'
                  }}
                >
                  🥡 外帶
                </button>
              </div>


              {/* Total & Discount display */}
              <div style={{
                borderTop: '1px dashed var(--border)',
                paddingTop: '10px',
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                {/* Discount Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>折扣折讓</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" onClick={() => { setDiscountType('amount'); setDiscountValue(5); }} style={{ flex: 1, padding: '5px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: discountType === 'amount' && discountValue === 5 ? 'var(--primary)' : 'var(--bg-card)', color: discountType === 'amount' && discountValue === 5 ? 'white' : 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}>-5元</button>
                    <button type="button" onClick={() => { setDiscountType('amount'); setDiscountValue(10); }} style={{ flex: 1, padding: '5px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: discountType === 'amount' && discountValue === 10 ? 'var(--primary)' : 'var(--bg-card)', color: discountType === 'amount' && discountValue === 10 ? 'white' : 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}>-10元</button>
                    <button type="button" onClick={() => { setDiscountType('percent'); setDiscountValue(10); }} style={{ flex: 1, padding: '5px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: discountType === 'percent' && discountValue === 10 ? 'var(--primary)' : 'var(--bg-card)', color: discountType === 'percent' && discountValue === 10 ? 'white' : 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}>9折</button>
                    <button type="button" onClick={() => {
                      const amt = prompt("請輸入折讓金額 (元)：");
                      if (amt !== null && amt !== '') {
                        setDiscountType('amount');
                        setDiscountValue(parseInt(amt) || 0);
                      }
                    }} style={{ flex: 1, padding: '5px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: discountType === 'amount' && discountValue !== 5 && discountValue !== 10 ? 'var(--primary)' : 'var(--bg-card)', color: discountType === 'amount' && discountValue !== 5 && discountValue !== 10 ? 'white' : 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}>折抵 $</button>
                    <button type="button" onClick={() => { setDiscountType('none'); setDiscountValue(0); }} style={{ padding: '5px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)', cursor: 'pointer', fontWeight: 'bold' }}>清除</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>商品小計:</span>
                  <span>NT$ {cartTotal}</span>
                </div>
                {discountType !== 'none' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444' }}>
                    <span>折扣折讓:</span>
                    <span>- NT$ {discountAmount}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: '900', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                  <span>應收金額:</span>
                  <span style={{ color: 'var(--primary)' }}>NT$ {finalTotal}</span>
                </div>
              </div>

              {/* POS Payment Methods Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>選擇支付方式</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {posPaymentMethods.map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setSelectedPaymentMethod(method);
                        if (method !== '現金') {
                          setCashReceived(String(finalTotal));
                        } else {
                          setCashReceived('');
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: selectedPaymentMethod === method ? '2px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: selectedPaymentMethod === method ? 'var(--primary)' : 'var(--bg-card)',
                        color: selectedPaymentMethod === method ? 'white' : 'var(--text-main)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {isCash ? (
                <>
                  {/* Cash input and Change calculations */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>實收現金 (NT$) *</label>
                      <input 
                        type="text" 
                        placeholder="點選下方鍵盤輸入"
                        value={cashReceived ? `NT$ ${cashReceived}` : ''}
                        readOnly
                        style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.9rem', fontWeight: 'bold', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', textAlign: 'right' }}
                        required
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>找零金額</label>
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: '0.9rem',
                        fontWeight: '800',
                        color: changeAmount > 0 ? '#16a34a' : 'var(--text-main)',
                        backgroundColor: 'var(--bg-input)',
                        textAlign: 'right'
                      }}>
                        NT$ {changeAmount}
                      </div>
                    </div>
                  </div>

                  {/* POS Built-in Cash Preset Buttons (Prominent Exact Cash + Quick Bill Selector) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {/* Top High-Visibility Exact Cash Button */}
                    <button
                      type="button"
                      onClick={() => setCashReceived(String(finalTotal))}
                      style={{
                        width: '100%',
                        height: posUiScale === 'large' ? '44px' : posUiScale === 'medium' ? '36px' : '32px',
                        fontSize: posUiScale === 'large' ? '1.15rem' : posUiScale === 'medium' ? '1.05rem' : '0.95rem',
                        borderRadius: '8px',
                        border: cashReceived === String(finalTotal) ? '2px solid #047857' : 'none',
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: '900',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 3px 8px rgba(22, 163, 74, 0.35)',
                        letterSpacing: '0.5px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>💰 剛好收</span>
                      <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)', padding: '2px 8px', borderRadius: '4px', textDecoration: 'underline' }}>
                        NT$ {finalTotal}
                      </span>
                      {cashReceived === String(finalTotal) && <span>✓</span>}
                    </button>

                    {/* Quick Bill Preset Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['50', '100', '200', '500', '1000'].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashReceived(amt)}
                          style={{
                            flex: 1,
                            height: posUiScale === 'large' ? '36px' : posUiScale === 'medium' ? '30px' : '26px',
                            fontSize: posUiScale === 'large' ? '0.95rem' : '0.85rem',
                            borderRadius: '6px',
                            border: cashReceived === amt ? '2px solid var(--primary)' : '1px solid var(--border)',
                            backgroundColor: cashReceived === amt ? 'rgba(255, 107, 53, 0.1)' : 'var(--bg-card)',
                            color: cashReceived === amt ? 'var(--primary)' : 'var(--text-main)',
                            cursor: 'pointer',
                            fontWeight: '900'
                          }}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Built-in Visual Keypad (Scaled: Compact fits 100% without scroll) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: posUiScale === 'large' ? '5px' : '3px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: posUiScale === 'large' ? '6px' : '4px',
                    backgroundColor: 'var(--bg-card)'
                  }}>
                    {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setCashReceived(prev => {
                            const next = prev + String(num);
                            return next.length > 8 ? prev : next;
                          });
                        }}
                        style={{
                          height: posUiScale === 'large' ? '52px' : posUiScale === 'medium' ? '42px' : '35px',
                          fontSize: posUiScale === 'large' ? '1.4rem' : posUiScale === 'medium' ? '1.25rem' : '1.1rem',
                          fontWeight: '900',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-body)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: 'var(--text-main)'
                        }}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCashReceived(prev => {
                          const next = prev + '00';
                          return next.length > 8 ? prev : next;
                        });
                      }}
                      style={{
                        height: posUiScale === 'large' ? '52px' : posUiScale === 'medium' ? '42px' : '35px',
                        fontSize: posUiScale === 'large' ? '1.25rem' : posUiScale === 'medium' ? '1.1rem' : '1rem',
                        fontWeight: '900',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-body)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-main)'
                      }}
                    >
                      00
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCashReceived(prev => {
                          const next = prev + '0';
                          return next.length > 8 ? prev : next;
                        });
                      }}
                      style={{
                        height: posUiScale === 'large' ? '52px' : posUiScale === 'medium' ? '42px' : '35px',
                        fontSize: posUiScale === 'large' ? '1.4rem' : posUiScale === 'medium' ? '1.25rem' : '1.1rem',
                        fontWeight: '900',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-body)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-main)'
                      }}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCashReceived(prev => prev.slice(0, -1));
                      }}
                      style={{
                        height: posUiScale === 'large' ? '52px' : posUiScale === 'medium' ? '42px' : '35px',
                        fontSize: posUiScale === 'large' ? '1.25rem' : posUiScale === 'medium' ? '1.1rem' : '1rem',
                        fontWeight: '900',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        backgroundColor: 'rgba(239,68,68,0.05)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ⌫
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border)',
                  backgroundColor: 'rgba(234, 88, 12, 0.03)',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}>
                  💳 預計以【{selectedPaymentMethod}】結帳，無須找零。
                </div>
              )}

              {/* Submit transaction */}
              <button
                type="submit"
                disabled={cart.length === 0 || isSubmittingOrder}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: (cart.length === 0 || isSubmittingOrder) ? 'var(--border)' : '#16a34a',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: (cart.length === 0 || isSubmittingOrder) ? 'not-allowed' : 'pointer',
                  marginTop: '4px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {isSubmittingOrder ? '⏳ 正在送單出單中...' : '💸 確認收銀結帳送單'}
              </button>
            </form>
            

          </div>
        </div>
      ) : (
        /* POS Receipt Success view */
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
          padding: '40px 20px',
          backgroundColor: 'var(--bg-body)'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '30px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <span style={{ fontSize: '3rem' }}>✅</span>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 4px 0', color: 'var(--text-main)' }}>結帳送單成功！</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>訂單已寫入雲端並通知廚房製作</p>
            </div>

            {/* Receipt Summary */}
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              backgroundColor: 'var(--bg-body)',
              textAlign: 'left',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontWeight: 'bold' }}>
                <span>流水單號: {latestOrder?.order_number}</span>
                <span>現金支付</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>交易類型:</span>
                <strong>{latestOrder?.type === 'dine-in' ? '內用' : '現場外帶'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>應收總額:</span>
                <strong>NT$ {latestOrder?.total}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>實收現金:</span>
                <strong>NT$ {latestOrder?.cashReceived}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 'bold', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                <span>找零金額:</span>
                <strong>NT$ {latestOrder?.changeAmount}</strong>
              </div>
            </div>

            {/* Print trigger */}
            <button
              type="button"
              onClick={() => {
                if (latestOrder) {
                  printReceipt(latestOrder);
                }
              }}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--primary)',
                backgroundColor: 'rgba(255, 107, 53, 0.1)',
                color: 'var(--primary)',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              🖨️ 列印實體收據 (標準熱感應格式)
            </button>

            {/* Continue to next order */}
            <button
              onClick={handleResetPos}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              繼續下一筆收銀 ➔
            </button>
          </div>
        </div>
      )}

      {/* Item Customization Modal */}
      {activeItemForModal && (
        <ItemModal 
          item={activeItemForModal}
          onClose={() => {
            setActiveItemForModal(null);
            setEditingCartItem(null);
          }}
          onAddToCart={handleAddToCartFromModal}
          condimentsAvailability={null} // POS cashier has full options
          isPos={true}
          editingCartItem={editingCartItem}
        />
      )}

      {/* POS EDIT SUBMITTED ORDER MODAL */}
      {editingPosOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
            maxWidth: '540px',
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
                ✏️ 編輯已送出訂單 (單號: {editingPosOrder.serialNum || editingPosOrder.order_number || editingPosOrder.id})
              </h3>
              <button 
                onClick={() => setEditingPosOrder(null)}
                style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePosOrderEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
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

                {editOrderType === 'dine-in' ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>內用桌號</label>
                    <input 
                      type="text" 
                      value={editOrderTable}
                      onChange={(e) => setEditOrderTable(e.target.value)}
                      placeholder="例: 1, 2, 3"
                      style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                    />
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>顧客備註名稱</label>
                    <input 
                      type="text" 
                      value={editOrderCust}
                      onChange={(e) => setEditOrderCust(e.target.value)}
                      placeholder="例: 現場外帶 或 陳小姐"
                      style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>應收/實收總金額 (NT$)</label>
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
                  placeholder="特別說明或顧客備註"
                  style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>訂單品項數量調整：</label>
                {editOrderItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-body)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{item.name}</span>
                      {item.specs && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {Array.isArray(item.specs) 
                            ? item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(', ')
                            : String(item.specs)}
                        </span>
                      )}
                    </div>
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
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editOrderItems.filter((_, i) => i !== idx);
                          setEditOrderItems(updated);
                        }}
                        style={{ marginLeft: '6px', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
                        title="移除此項"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPosOrder(null)}
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

      {/* WATCHED STOCK ALERT MODAL */}
      {showStockAlertModal && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px', borderRadius: '16px', boxSizing: 'border-box', textAlign: 'left' }}>
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚠️ 關注物料庫存偏低與補貨提醒
              </h3>
              <button className="close-btn" style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowStockAlertModal(false)}>&times;</button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '14px' }}>
              以下是已被設為「關注項目」且目前庫存低於安全警戒線或缺貨的物料，請儘速安排進貨：
            </p>

            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>物料名稱</th>
                    <th style={{ padding: '8px 12px' }}>目前庫存</th>
                    <th style={{ padding: '8px 12px' }}>警戒值</th>
                    <th style={{ padding: '8px 12px' }}>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {watchedLowStockItems.map(item => {
                    const isOut = Number(item.qty) <= 0;
                    return (
                      <tr key={item.name} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{item.name}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold', color: isOut ? '#ef4444' : '#f59e0b' }}>
                          {item.qty} {item.unit}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{item.minStock} {item.unit}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            backgroundColor: isOut ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: isOut ? '#ef4444' : '#f59e0b'
                          }}>
                            {isOut ? '🔴 缺貨' : '🟡 偏低'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowStockAlertModal(false)}
                style={{ padding: '8px 18px', fontSize: '0.85rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
              >
                我知道了 (關閉)
              </button>
            </div>
          </div>
        </div>
      )}


      {/* =========================================================================
          UNIFIED POS SETTINGS MODAL (Auto-print, Kitchen ticket, Voice, Scale, Reports)
          ========================================================================= */}
      {showPosSettingsModal && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setShowPosSettingsModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: '24px', borderRadius: '16px', boxSizing: 'border-box', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚙️ POS 功能與列印設定
              </h3>
              <button className="close-btn" style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowPosSettingsModal(false)}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Section 1: Thermal Printing Options */}
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🖨️ 熱感應出單機設定
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: isAutoPrintEnabled ? '#16a34a' : 'var(--text-main)' }}>
                    <span>🖨️ 新單自動出單</span>
                    <input 
                      type="checkbox" 
                      checked={isAutoPrintEnabled} 
                      onChange={(e) => {
                        const val = e.target.checked;
                        setIsAutoPrintEnabled(val);
                        isAutoPrintEnabledRef.current = val;
                        localStorage.setItem('is_auto_print_enabled', String(val));
                      }}
                      style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                    />
                  </label>

                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: printKitchenTicket ? '#0284c7' : 'var(--text-main)' }}>
                    <span>🍳 同時列印廚房備餐切單 (雙聯)</span>
                    <input 
                      type="checkbox" 
                      checked={printKitchenTicket} 
                      onChange={(e) => {
                        const val = e.target.checked;
                        setPrintKitchenTicket(val);
                        localStorage.setItem('pos_print_kitchen_ticket', String(val));
                      }}
                      style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                    />
                  </label>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                    💡 提示：開啟「同時列印廚房單」時，出單機會自動切刀分成【收據】與【廚房備餐單】兩聯。
                  </div>
                </div>
              </div>

              {/* Section 2: Voice Announcement */}
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🗣️ 新單語音播報</span>
                  <button
                    type="button"
                    onClick={testVoiceAnnouncement}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    🔊 測試聲音
                  </button>
                </div>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: isVoiceAnnounceEnabled ? '#10b981' : 'var(--text-main)' }}>
                  <span>開啟語音報單提醒</span>
                  <input 
                    type="checkbox" 
                    checked={isVoiceAnnounceEnabled} 
                    onChange={(e) => {
                      const val = e.target.checked;
                      setIsVoiceAnnounceEnabled(val);
                      localStorage.setItem('is_voice_announce_enabled', String(val));
                    }}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Section 3: UI Scale Control */}
              <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '8px' }}>
                  🔍 介面與按鍵文字大小
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[
                    { id: 'compact', label: '標準 (預設)', desc: '右側免滾動' },
                    { id: 'medium', label: '適中 (110%)', desc: '適度放大' },
                    { id: 'large', label: '大字 (120%)', desc: '大觸控螢幕' }
                  ].map(scale => (
                    <button
                      key={scale.id}
                      type="button"
                      onClick={() => {
                        setPosUiScale(scale.id);
                        localStorage.setItem('pos_ui_scale', scale.id);
                      }}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '6px',
                        border: posUiScale === scale.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: posUiScale === scale.id ? 'var(--primary)' : 'var(--bg-card)',
                        color: posUiScale === scale.id ? 'white' : 'var(--text-main)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div>{scale.label}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>{scale.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 4: Daily Closing & Shift Reports */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPosSettingsModal(false);
                    if (window.confirm("確定要列印換班交接小票 (X-Report) 嗎？")) {
                      handlePrintShiftHandover();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📋 換班對帳小票
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setShowPosSettingsModal(false);
                    if (window.confirm("確定要執行今日收店結帳嗎？結帳後今日收銀系統將安全結案鎖定。")) {
                      handlePrintDailyClosing();
                      const todayStr = getTodayLocalDate();
                      const updated = [...closedDates, todayStr];
                      setClosedDates(updated);
                      localStorage.setItem('restaurant_closed_dates', JSON.stringify(updated));
                      window.dispatchEvent(new Event('storage'));

                      try {
                        const closedKey = prefixNameForStore('SYSTEM_SETTING_CLOSED_DATES', storeCode);
                        const { data: exist } = await supabase.from('menu_items').select('*').eq('name', closedKey);
                        if (exist && exist.length > 0) {
                          await supabase.from('menu_items').update({
                            description: JSON.stringify(updated)
                          }).eq('name', closedKey);
                        } else {
                          await supabase.from('menu_items').insert([{
                            name: closedKey,
                            price: 0,
                            category: 'settings',
                            description: JSON.stringify(updated)
                          }]);
                        }
                      } catch (e) {
                        console.warn("Failed to sync closed dates to menu_items:", e);
                      }

                      alert("🎉 收店結帳成功！今日營業已完成結算並安全鎖定。");
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  🏁 印日結單並收店
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Native Body Thermal Print Portal */}
      <ThermalPrintPortal printPayload={printPayload} onClose={() => setPrintPayload(null)} />
    </div>
  );
}
