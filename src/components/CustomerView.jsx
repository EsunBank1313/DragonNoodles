import React, { useState, useEffect, useRef } from 'react';
import { menuCategories, menuItems as defaultMenuItems } from '../data/menuData';
import ItemModal from './ItemModal';
import CartPanel from './CartPanel';
import OrderTracker from './OrderTracker';
import { supabase } from '../supabaseClient';

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
  return {
    id: String(dbOrder.id),
    serialNum: dbOrder.order_number,
    time: new Date(dbOrder.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    timestamp: new Date(dbOrder.created_at).getTime(),
    status: dbOrder.status,
    type: dbOrder.type === 'dine-in' ? 'dine-in' : 'takeout',
    tableName: dbOrder.table_number,
    customerName: itemsData.customerName || (dbOrder.type === 'dine-in' ? `內用 ${dbOrder.table_number} 號桌` : ''),
    customerPhone: itemsData.customerPhone || '',
    phoneVerified: true,
    pickupTime: itemsData.pickupTime || '',
    paymentMethod: itemsData.paymentMethod || 'cash',
    paymentStatus: dbOrder.payment_status,
    remarks: itemsData.remarks || '',
    items: itemsData.cart || [],
    total: Number(dbOrder.total),
    cashier: itemsData.cashier || ''
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

export default function CustomerView({ tableNumber, onBackToDemo }) {
  const [viewState, setViewState] = useState('menu'); // 'menu', 'checkout', 'tracking'
  const [activeCategory, setActiveCategory] = useState(menuCategories[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [cart, setCart] = useState([]);
  
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [lineNotifyToken, setLineNotifyToken] = useState('');
  const [generatedLineCode, setGeneratedLineCode] = useState('');
  const [simulatedNotification, setSimulatedNotification] = useState(null);
  const [pickupTime, setPickupTime] = useState('15');
  const [paymentMethod, setPaymentMethod] = useState('counter');

  const [allOrders, setAllOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);

  const [showCart, setShowCart] = useState(false);
  const [remarks, setRemarks] = useState('');

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

  const [menuItemsAvailability, setMenuItemsAvailability] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [storeName, setStoreName] = useState('{storeName}');

  const confirmationResultRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Fetch menu items from Supabase
  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const tokenItem = data.find(item => item.name === 'SYSTEM_SETTING_LINE_TOKEN');
        if (tokenItem) {
          setLineNotifyToken(tokenItem.description || '');
        }
        const storeNameItem = data.find(item => item.name === 'SYSTEM_SETTING_STORE_NAME');
        if (storeNameItem && storeNameItem.description) {
          setStoreName(storeNameItem.description);
        }
        const orderItem = data.find(item => item.name === 'SYSTEM_SETTING_MENU_ORDER');
        let orderList = [];
        if (orderItem && orderItem.description) {
          try { orderList = JSON.parse(orderItem.description); } catch (e) {}
        }

        const addonsItem = data.find(item => item.name === 'SYSTEM_SETTING_GLOBAL_ADDONS');
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

        const visibleItems = data.filter(item => 
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
        setMenuItems(JSON.parse(savedMenuItems).filter(item => item.name !== 'SYSTEM_SETTING_LINE_TOKEN'));
      } else {
        setMenuItems(defaultMenuItems);
      }
    }
  };

  // Load active order and all orders from Supabase
  useEffect(() => {
    fetchMenuItems();

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
  }, []);

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
          if (formatted.status === 'completed') {
            // Clear tracking state once order is completed
            localStorage.removeItem('active_customer_order_id');
            setActiveOrderId(null);
            setViewState('menu');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
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

  // Cart operations
  const handleAddToCart = (cartItem) => {
    setCart(prev => {
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

    setOtpError('');
    setOtpInput('');
    setIsVerifying(true);

    const code = String(Math.floor(1000 + Math.random() * 9000));
    setGeneratedLineCode(code);
    setShowOtpModal(true);
    setResendTimer(60);

    let hasSentReal = false;

    if (lineNotifyToken) {
      try {
        // Try parsing JSON settings
        let settings = {};
        try {
          settings = JSON.parse(lineNotifyToken);
        } catch (e) {
          // Fallback to plain LINE Notify token
          settings = { type: 'notify', notifyToken: lineNotifyToken };
        }

        const msgText = `\n【{storeName}】您的外帶點餐驗證碼為：${code}\n請於 5 分鐘內輸入此認證碼以完成驗證。`;

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
      // Fallback simulation banner
      setSimulatedNotification(`💬 LINE ({storeName}官方帳號): 您的點餐驗證碼為【${code}】。(請至後台系統設定 LINE 密鑰以開啟真實發送)`);
    }

    setTimeout(() => setSimulatedNotification(null), 10000);
    setIsVerifying(false);
  };

  // Confirming OTP entered
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    
    if (otpInput.length !== 4) {
      setOtpError('驗證碼應為 4 位數');
      return;
    }

    setOtpError('');
    setIsVerifying(true);

    if (otpInput === generatedLineCode) {
      setPhoneVerified(true);
      setShowOtpModal(false);
      setGeneratedLineCode('');
      submitOrder(true);
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
    }

    // Dine-in doesn't need phone verification (physical seated client)
    if (tableNumber) {
      submitOrder(true);
      return;
    }

    // Takeout needs phone verification
    if (phoneVerified) {
      submitOrder(true);
    } else {
      handleStartVerification();
    }
  };

  const submitOrder = async (verified = false) => {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal;

    // Generate easy-to-read daily sequential serial number (e.g., I-001 or O-001, counted separately)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    let count = 0;
    const orderType = tableNumber ? 'dine-in' : 'takeout';
    try {
      const { count: dbCount, error } = await supabase.from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString())
        .eq('type', orderType);
      if (!error && dbCount !== null) {
        count = dbCount;
      }
    } catch (err) {
      console.warn("Failed to fetch today's order count, default to 0:", err);
    }
    
    const prefix = tableNumber ? 'I' : 'O';
    const serialNum = `${prefix}-${String(count + 1).padStart(3, '0')}`;

    try {
      const { data: dbOrders, error: insertError } = await supabase.from('orders').insert([{
        order_number: serialNum,
        items: {
          cart: cart,
          customerName: tableNumber ? `內用 ${tableNumber} 號桌` : custName,
          customerPhone: tableNumber ? '' : custPhone,
          pickupTime: tableNumber ? '' : pickupTime,
          paymentMethod,
          remarks
        },
        total,
        type: tableNumber ? 'dine-in' : 'takeout',
        table_number: tableNumber || null,
        status: 'received',
        payment_status: paymentMethod === 'online' ? 'paid' : 'unpaid'
      }]).select();

      if (insertError) throw insertError;

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
      alert("提交訂單至雲端伺服器失敗，請檢查網路連線或稍後再試！");
    }
  };

  // Filtered menu items based on active category and search input
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleHomeClick = () => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table');
    const demo = params.get('demo');
    if (demo === 'true') {
      onBackToDemo();
    } else {
      window.location.href = table ? `/?table=${table}` : '/';
    }
  };

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
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#06c755', marginBottom: '2px' }}>系統通知 (模擬 LINE 官方帳號送達)</div>
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
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>傳統柴魚高湯・手工紅麵線・地獄麻辣挑戰</p>
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
          <div className="hero-banner">
            <div className="hero-tag">🔥 熱門推薦</div>
            <h2 className="hero-title">招牌綜合麵線配特製辣泡菜</h2>
            <p className="hero-desc">在地飄香的好味道！獨家配方柴魚高湯，搭配豐富滿載的配料與手作開胃辣泡菜，讓您一吃就愛上！</p>
          </div>

          {/* Category tabs */}
          <div className="category-tabs">
            {menuCategories.map(cat => (
              <button 
                key={cat.id} 
                className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.icon}</span>
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
              {menuCategories.find(c => c.id === activeCategory)?.name}
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
                    <img src={item.image} alt={item.name} className="item-img" onError={(e) => {
                      e.target.style.display = 'none';
                    }} />
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
                      <div className="item-name-row">
                        <div className="item-name">{item.name}</div>
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
            {/* Dining details */}
            {tableNumber ? (
              <div className="option-group" style={{ backgroundColor: 'rgba(255,107,53,0.03)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '4px' }}>🍽️ 掃碼內用確認</h4>
                <p style={{ fontSize: '0.9rem' }}>已鎖定 <strong>{tableNumber} 號桌</strong>。餐點製作完成後將會直接送至您的桌位。</p>
              </div>
            ) : (
              <div className="option-group" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 className="checkout-section-title">👤 外帶聯絡資訊 (需手機簡訊驗證)</h4>
                
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
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    * 為了防範惡意下單，外帶顧客下單時系統將會發送 LINE 點餐驗證碼至該手機帳戶。
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="pickup-time">預計取餐時間</label>
                  <select 
                    id="pickup-time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                  >
                    <option value="10-15分鐘後">10-15 分鐘後 (儘速製作)</option>
                    <option value="20分鐘後">20 分鐘後</option>
                    <option value="30分鐘後">30 分鐘後</option>
                    <option value="45分鐘後">45 分鐘後</option>
                    <option value="1小時後">1 小時後</option>
                  </select>
                </div>
              </div>
            )}

            {/* Payment options */}
            <div className="option-group">
              <h4 className="checkout-section-title">💳 付款方式</h4>
              <div className="payment-options">
                <div 
                  className={`payment-option-card ${paymentMethod === 'counter' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('counter')}
                >
                  <span className="payment-icon">💵</span>
                  <div>
                    <strong>店內結帳 (到店付款)</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {tableNumber ? '至櫃檯買單或餐後付款' : '取餐時於櫃檯付款，支援現金與LinePay'}
                    </div>
                  </div>
                </div>

                <div 
                  className={`payment-option-card ${paymentMethod === 'online' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('online')}
                >
                  <span className="payment-icon">💳</span>
                  <div>
                    <strong>線上刷卡</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      下單即完成付款
                    </div>
                  </div>
                </div>
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
                {isVerifying ? '傳送中...' : tableNumber ? '確認送出訂單' : phoneVerified ? '確認送出訂單' : '發送簡訊驗證碼以送出'}
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
            if (activeOrder.status === 'completed') {
              localStorage.removeItem('active_customer_order_id');
              setActiveOrderId(null);
            }
            setViewState('menu');
          }}
        />
      )}

      {/* Item Customize Modal */}
      {selectedItem && (
        <ItemModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          onAddToCart={handleAddToCart}
          condimentsAvailability={condimentsAvailability}
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
              <button className="close-btn" style={{ position: 'absolute', right: '16px', top: '16px' }} onClick={() => setShowOtpModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                我們已向您的 LINE 帳戶發送 <strong>4 位數</strong> 點餐認證碼。請在下方輸入驗證代碼：
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
                  maxLength={4} 
                  required
                  placeholder="請輸入 4 位數驗證碼"
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
    </div>
  );
}
