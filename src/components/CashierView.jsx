import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { formatSupabaseOrder } from './CustomerView';
import ItemModal from './ItemModal';

export default function CashierView({ cashierName, onLogout }) {
  const locallyPrintedOrders = useRef(new Set());
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('mee-sua');
  const [cart, setCart] = useState([]);
  
  // Checkout details
  const [orderType, setOrderType] = useState('dine-in'); // Default to counter takeout
  
  const [tableNumber, setTableNumber] = useState(null);
  const [custName, setCustName] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Cash Register Calculations
  const [cashReceived, setCashReceived] = useState('');
  const [changeAmount, setChangeAmount] = useState(0);

  // Success view details
  const [viewState, setViewState] = useState('pos'); // 'pos' or 'success'
  const [latestOrder, setLatestOrder] = useState(null);

  // Modal active item
  const [activeItemForModal, setActiveItemForModal] = useState(null);

  // Discount states
  const [discountType, setDiscountType] = useState('none'); // 'none', 'percent', 'amount'
  const [discountValue, setDiscountValue] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Closed Dates for Locking
  const [closedDates, setClosedDates] = useState(() => {
    return JSON.parse(localStorage.getItem('restaurant_closed_dates') || '[]');
  });

  // Orders state and printing integration
  const [orders, setOrders] = useState([]);
  const [storeName, setStoreName] = useState('龍城麵線');
  const [adminPin, setAdminPin] = useState('8888');

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

  // Receipt printing function
  const printReceipt = (order) => {
    const printWindow = window.open('', '_blank', 'width=350,height=500');
    if (!printWindow) {
      alert("⚠️ 自動列印收據彈出視窗被瀏覽器封鎖！請在瀏覽器網址列設定「永遠允許此網站彈出視窗」以啟動自動出單。");
      return;
    }
    
    let cartItems = [];
    if (order) {
      if (Array.isArray(order.items)) {
        cartItems = order.items;
      } else if (order.items && Array.isArray(order.items.cart)) {
        cartItems = order.items.cart;
      } else if (Array.isArray(order.cart)) {
        cartItems = order.cart;
      }
    }

    const orderNumStr = order.serialNum || order.orderNumber || order.order_number || '';
    const nameStr = order.customerName || '';
    const totalNum = order.total || 0;
    const dateStr = order.timestamp || order.createdAt || order.created_at || new Date().toISOString();
    const typeStr = order.type === 'dine-in' ? '內用' : '外帶';
    
    const html = `
      <html>
        <head>
          <title>收據列印</title>
          <style>
            @media print {
              body { margin: 0; }
            }
            body { font-family: monospace; font-size: 16px; line-height: 1.5; padding: 10px; width: 280px; }
            .center { text-align: center; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 6px; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; }
            .item { font-weight: bold; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 500);">
          <div class="center title">${storeName}</div>
          <div class="center" style="font-size: 14px; font-weight: bold;">=== 交易收據明細 ===</div>
          <div class="divider"></div>
          <div style="font-size: 17px; font-weight: bold; margin-bottom: 2px;">單號: ${orderNumStr}</div>
          <div>類型: ${typeStr}</div>
          <div style="font-size: 13px;">時間: ${new Date(dateStr).toLocaleString('zh-TW', { hour12: false })}</div>
          <div class="divider"></div>
          ${cartItems.map(item => {
            const unitPrice = item.price || (item.totalPrice && item.quantity ? Math.round(item.totalPrice / item.quantity) : 0);
            return `
              <div class="row" style="font-size: 16px; color: #000;">
                <span class="item">${item.name} x${item.quantity}</span>
                <span>$${unitPrice}</span>
              </div>
              ${item.specs && item.specs.length > 0 ? `
                <div style="font-size: 14px; color: #000; padding-left: 12px; font-weight: bold;">
                  └ ${item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(', ')}
                </div>
              ` : ''}
            `;
          }).join('')}
          <div class="divider"></div>
          <div class="row" style="font-size: 18px; font-weight: bold;">
            <span>應收總計:</span>
            <span>$${totalNum}</span>
          </div>
          ${(order.cashReceived !== undefined && order.cashReceived !== null) ? `
            <div class="row" style="font-size: 16px; color: #000; font-weight: bold;">
              <span>實收金額:</span>
              <span>$${order.cashReceived}</span>
            </div>
            <div class="row" style="font-size: 16px; color: #000; font-weight: bold;">
              <span>找零:</span>
              <span>$${order.changeAmount}</span>
            </div>
          ` : ''}
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const getTodayLocalDate = () => {
    try {
      return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    } catch (e) {
      const d = new Date();
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
    }
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

  const fetchClosedDatesFromCloud = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at, items');
      if (error) throw error;
      if (data) {
        const cloudDates = data
          .filter(o => {
            const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
            return itemsData?.customerName === 'SYSTEM_STORE_CLOSE';
          })
          .map(o => {
            return new Date(o.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
          });
        const merged = cloudDates;
        setClosedDates(merged);
        localStorage.setItem('restaurant_closed_dates', JSON.stringify(merged));
      }
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
        const storeNameItem = data.find(item => item.name === 'SYSTEM_SETTING_STORE_NAME');
        if (storeNameItem && storeNameItem.description) {
          setStoreName(storeNameItem.description);
        }
        const adminPinItem = data.find(item => item.name === 'SYSTEM_SETTING_ADMIN_PIN');
        if (adminPinItem && adminPinItem.description) {
          setAdminPin(adminPinItem.description);
        }
        const visibleItems = data.filter(item => 
          item.name !== 'SYSTEM_SETTING_LINE_TOKEN' && 
          item.name !== 'SYSTEM_SETTING_STORE_NAME' &&
          item.customizations?.is_published !== false
        );
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
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (data) {
        const todayStr = getTodayLocalDate();
        const clientOrders = data.filter(o => {
          const orderDate = new Date(o.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
          const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
          return orderDate === todayStr && itemsData?.customerName !== 'SYSTEM_STORE_CLOSE';
        });
        const mapped = clientOrders.map(formatSupabaseOrder).filter(Boolean);
        
        // Status priorities: received/preparing (1) > completed (2) > archived (3) > others (4)
        const getStatusPriority = (status) => {
          if (status === 'received' || status === 'preparing') return 1;
          if (status === 'completed') return 2;
          if (status === 'archived') return 3;
          return 4;
        };

        const sorted = mapped.sort((a, b) => {
          const priA = getStatusPriority(a.status);
          const priB = getStatusPriority(b.status);
          if (priA !== priB) return priA - priB;
          return a.timestamp - b.timestamp; // oldest first within same status group
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
  }, []);

  // Listen to incoming orders and trigger automatic printing popup
  useEffect(() => {
    const ordersChannel = supabase.channel('pos-incoming-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        // If a new order is received, play chime and AUTO-PRINT immediately
        if (payload.eventType === 'INSERT') {
          const itemsData = typeof payload.new.items === 'string' ? JSON.parse(payload.new.items) : payload.new.items;
          if (itemsData?.customerName !== 'SYSTEM_STORE_CLOSE') {
            const orderNum = payload.new.order_number;
            if (locallyPrintedOrders.current.has(orderNum)) {
              return;
            }
            const mappedOrder = formatSupabaseOrder(payload.new);
            triggerChime();
            if (mappedOrder) {
              printReceipt(mappedOrder);
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, []);

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

  const handleAddToCartFromModal = (cartItem) => {
    setCart([...cart, cartItem]);
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

  // Submit POS Order to Supabase
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("收銀購物車內尚無餐點項目！");
      return;
    }

    const received = parseFloat(cashReceived) || 0;
    if (received < finalTotal) {
      alert(`實收現金金額不足！還缺 NT$ ${finalTotal - received}`);
      return;
    }

    // Generate serial number (I-001 or O-001 daily format, counted separately)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    let count = 0;
    try {
      const { count: dbCount, error } = await supabase.from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString())
        .eq('type', orderType);
      if (!error && dbCount !== null) {
        count = dbCount;
      }
    } catch (err) {
      console.warn("Failed to get today count, using fallback:", err);
    }
    const prefix = orderType === 'dine-in' ? 'I' : 'O';
    const serialNum = `${prefix}-${String(count + 1).padStart(3, '0')}`;
    locallyPrintedOrders.current.add(serialNum);

    try {
      const { data: dbOrders, error: insertError } = await supabase.from('orders').insert([{
        order_number: serialNum,
        items: {
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
          paymentMethod: 'cash',
          remarks: "",
          cashier: cashierName
        },
        total: finalTotal,
        type: orderType,
        table_number: orderType === 'dine-in' ? tableNumber : null,
        status: 'received',
        payment_status: 'paid'
      }]).select();

      if (insertError) throw insertError;

      const createdOrder = dbOrders[0];
      const orderToPrint = {
        ...formatSupabaseOrder(createdOrder),
        cashReceived: received,
        changeAmount: received - finalTotal
      };
      printReceipt(orderToPrint);

      setLatestOrder({
        ...createdOrder,
        cashReceived: received,
        changeAmount: received - finalTotal
      });
      setViewState('success');
    } catch (err) {
      console.error("Failed to submit POS order to Supabase:", err);
      alert("提交收銀訂單失敗，請確認資料庫連線！");
    }
  };

  // Reset screen for next customer
  const handleResetPos = () => {
    setCart([]);
    setCashReceived('');
    setRemarks('');
    setCustName('');
    setViewState('pos');
    setLatestOrder(null);
    setDiscountType('none');
    setDiscountValue(0);
    setSearchQuery('');
    setOrderType('dine-in');
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
              onClick={() => {
                if (window.confirm("警告：重開帳目後收銀功能將恢復，今日對帳資訊將會重新變動。確定重開嗎？")) {
                  const pwd = window.prompt("請輸入管理員對帳密碼以重開：");
                  if (pwd === adminPin) {
                    const updated = closedDates.filter(d => d !== getTodayLocalDate());
                    setClosedDates(updated);
                    localStorage.setItem('restaurant_closed_dates', JSON.stringify(updated));
                    window.dispatchEvent(new Event('storage'));
                  } else if (pwd !== null) {
                    alert("密碼錯誤！");
                  }
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => {
              if (window.confirm("⚠️ 警告：收店結帳後今日的收銀系統將會關閉鎖定，直到明日才會自動重開。確定進行今日收店結帳嗎？")) {
                const pwd = window.prompt("請輸入關店密碼以確認收店：");
                if (pwd === adminPin) {
                  const todayStr = getTodayLocalDate();
                  const updated = [...closedDates, todayStr];
                  setClosedDates(updated);
                  localStorage.setItem('restaurant_closed_dates', JSON.stringify(updated));
                  window.dispatchEvent(new Event('storage'));
                  
                  // Also upload to Supabase orders to sync other devices (RLS-friendly)
                  supabase.from('orders').insert([{
                    order_number: 'CLOSE',
                    items: {
                      customerName: 'SYSTEM_STORE_CLOSE',
                      customerPhone: 'SYSTEM',
                      cart: []
                    },
                    total: 0,
                    type: 'dine-in',
                    table_number: 'CLOSED',
                    status: 'completed',
                    payment_status: 'paid'
                  }]).then(({ error }) => {
                    if (error) console.error("Failed to sync store close to Supabase orders:", error);
                  });

                  alert("收店結帳成功！今日收銀系統已安全鎖定。");
                } else if (pwd !== null) {
                  alert("密碼錯誤，收店失敗！");
                }
              }
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              color: '#ef4444',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🏁 今日收店結帳
          </button>
          <button 
            onClick={onLogout}
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
              gap: '16px'
            }}>
              <button
                type="button"
                onClick={() => setActiveCategory('mee-sua')}
                style={{
                  flex: 1,
                  height: '55px',
                  fontSize: '1.1rem',
                  fontWeight: '900',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: activeCategory === 'mee-sua' ? 'var(--primary)' : 'var(--border)',
                  backgroundColor: activeCategory === 'mee-sua' ? 'var(--primary)' : 'var(--bg-card)',
                  color: activeCategory === 'mee-sua' ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  boxShadow: activeCategory === 'mee-sua' ? 'var(--shadow-md)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🍜 招牌麵線 / 主食 ({menuItems.filter(i => i.category === 'mee-sua').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('specialties')}
                style={{
                  flex: 1,
                  height: '55px',
                  fontSize: '1.1rem',
                  fontWeight: '900',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: activeCategory === 'specialties' ? '#dc2626' : 'var(--border)',
                  backgroundColor: activeCategory === 'specialties' ? '#dc2626' : 'var(--bg-card)',
                  color: activeCategory === 'specialties' ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  boxShadow: activeCategory === 'specialties' ? 'var(--shadow-md)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🔥 特色小吃 / 辣系列 ({menuItems.filter(i => i.category === 'specialties').length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('orders')}
                style={{
                  flex: 1,
                  height: '55px',
                  fontSize: '1.1rem',
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
                  gap: '8px'
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
                    orders.slice(0, 20).map(order => {
                      const isPending = order.status === 'received';
                      return (
                        <div key={order.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-card)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '6px' }}>
                            <span>單號: {order.serialNum} ({order.type === 'dine-in' ? '內用' : '外帶'})</span>
                            {(order.status === 'declined' || order.status === 'refunded') && (
                              <span style={{ color: '#ef4444' }}>🪙 已退貨</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>客戶: {order.customerName} {order.pickupTime ? `(取餐: ${order.pickupTime})` : ''}</div>
                          <div style={{ fontSize: '0.75rem', margin: '4px 0', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', padding: '4px 0' }}>
                            {(order.items || []).map((item, idx) => (
                              <div key={idx}>• {item.name} x {item.quantity} {item.specs && item.specs.length > 0 ? `(${item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(', ')})` : ''}</div>
                            ))}
                          </div>
                          {order.remarks && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>備註: {order.remarks}</div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>總額: ${order.total}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {order.status !== 'declined' && order.status !== 'refunded' && order.status !== 'archived' && (
                                <button
                                  onClick={async () => {
                                    if (confirm("確定退貨此訂單嗎？")) {
                                      await supabase.from('orders').update({ status: 'refunded', payment_status: 'refunded' }).eq('id', order.id);
                                      fetchOrders();
                                    }
                                  }}
                                  style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  退貨
                                </button>
                              )}
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
              ) : activeCategory === 'mee-sua' ? (
                /* Mee-sua: 8 items, 3 columns x 3 rows */
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px'
                }}>
                  {menuItems.filter(item => item.category === 'mee-sua').map(item => {
                    const isAvailable = item.customizations?.is_available !== false;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleProductClick(item)}
                        style={{
                          backgroundColor: isAvailable ? 'rgba(255, 107, 53, 0.05)' : 'var(--bg-body)',
                          border: isAvailable ? '2px solid rgba(255, 107, 53, 0.3)' : '2px solid var(--border)',
                          borderRadius: '12px',
                          padding: '10px 6px',
                          height: '80px',
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
                        onPointerDown={(e) => {
                          if (!isAvailable) return;
                          e.currentTarget.style.transform = 'scale(0.96)';
                          e.currentTarget.style.backgroundColor = 'var(--primary)';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          const priceSpan = e.currentTarget.querySelector('.price-tag');
                          if (priceSpan) priceSpan.style.color = '#ffffff';
                        }}
                        onPointerUp={(e) => {
                          if (!isAvailable) return;
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.05)';
                          e.currentTarget.style.color = 'var(--text-main)';
                          e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                          const priceSpan = e.currentTarget.querySelector('.price-tag');
                          if (priceSpan) priceSpan.style.color = 'var(--primary)';
                        }}
                        onPointerLeave={(e) => {
                          if (!isAvailable) return;
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.05)';
                          e.currentTarget.style.color = 'var(--text-main)';
                          e.currentTarget.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                          const priceSpan = e.currentTarget.querySelector('.price-tag');
                          if (priceSpan) priceSpan.style.color = 'var(--primary)';
                        }}
                      >
                        <div style={{ fontSize: '1.05rem', fontWeight: '800', lineHeight: '1.2' }}>
                          {item.name}
                        </div>
                        <span className="price-tag" style={{ fontSize: '1.05rem', fontWeight: '900', color: isAvailable ? 'var(--primary)' : 'var(--text-muted)', transition: 'color 0.1s ease' }}>
                          NT$ {item.price}
                        </span>
                        {!isAvailable ? (
                          <span style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            fontSize: '0.55rem',
                            fontWeight: 'bold',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            🔴 售完
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
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Specialties: 4 items, 3 columns x 2 rows */
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px'
                }}>
                  {menuItems.filter(item => item.category === 'specialties').map(item => {
                    const isAvailable = item.customizations?.is_available !== false;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleProductClick(item)}
                        style={{
                          backgroundColor: isAvailable ? 'rgba(220, 38, 38, 0.05)' : 'var(--bg-body)',
                          border: isAvailable ? '2px solid rgba(220, 38, 38, 0.3)' : '2px solid var(--border)',
                          borderRadius: '12px',
                          padding: '10px 6px',
                          height: '80px',
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
                        onPointerDown={(e) => {
                          if (!isAvailable) return;
                          e.currentTarget.style.transform = 'scale(0.96)';
                          e.currentTarget.style.backgroundColor = '#dc2626';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.borderColor = '#dc2626';
                          const priceSpan = e.currentTarget.querySelector('.price-tag');
                          if (priceSpan) priceSpan.style.color = '#ffffff';
                        }}
                        onPointerUp={(e) => {
                          if (!isAvailable) return;
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.05)';
                          e.currentTarget.style.color = 'var(--text-main)';
                          e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)';
                          const priceSpan = e.currentTarget.querySelector('.price-tag');
                          if (priceSpan) priceSpan.style.color = '#dc2626';
                        }}
                        onPointerLeave={(e) => {
                          if (!isAvailable) return;
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.05)';
                          e.currentTarget.style.color = 'var(--text-main)';
                          e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)';
                          const priceSpan = e.currentTarget.querySelector('.price-tag');
                          if (priceSpan) priceSpan.style.color = '#dc2626';
                        }}
                      >
                        <div style={{ fontSize: '1.05rem', fontWeight: '800', lineHeight: '1.2' }}>
                          {item.name}
                        </div>
                        <span className="price-tag" style={{ fontSize: '1.05rem', fontWeight: '900', color: isAvailable ? '#dc2626' : 'var(--text-muted)', transition: 'color 0.1s ease' }}>
                          NT$ {item.price}
                        </span>
                        {!isAvailable ? (
                          <span style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            fontSize: '0.55rem',
                            fontWeight: 'bold',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            🔴 售完
                          </span>
                        ) : item.customizations && (
                          <span style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            fontSize: '0.55rem',
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(220, 38, 38, 0.12)',
                            color: '#dc2626',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            ⚙️客製
                          </span>
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
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {cartItem.specs && cartItem.specs.map(spec => `• ${spec}`).join(' ')}
                          </span>
                        </div>

                        {/* Controls & Price (Right) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
              {/* Order Type Checkbox (Default is Dine-in, check for Takeout) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: orderType === 'takeout' ? 'rgba(220, 38, 38, 0.06)' : 'rgba(255, 107, 53, 0.06)',
                border: orderType === 'takeout' ? '1px solid #dc2626' : '1px solid var(--primary)',
                marginBottom: '2px',
                cursor: 'pointer'
              }} onClick={() => setOrderType(prev => prev === 'takeout' ? 'dine-in' : 'takeout')}>
                <input
                  type="checkbox"
                  id="takeout-checkbox"
                  checked={orderType === 'takeout'}
                  onChange={(e) => setOrderType(e.target.checked ? 'takeout' : 'dine-in')}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="takeout-checkbox" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: orderType === 'takeout' ? '#dc2626' : 'var(--primary)', cursor: 'pointer', margin: 0 }}>
                  {orderType === 'takeout' ? '🛍️ 這筆訂單為【外帶】' : '🍜 這筆訂單為【內用】'}
                </label>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: '800', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                  <span>應收金額:</span>
                  <span style={{ color: 'var(--primary)' }}>NT$ {finalTotal}</span>
                </div>
              </div>

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

              {/* POS Built-in Cash Preset Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>快速選定鈔票金額</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setCashReceived(String(finalTotal))} style={{ flex: 2, padding: '6px 0', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #16a34a', color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.05)', cursor: 'pointer', fontWeight: 'bold' }}>剛好收 NT$ {finalTotal}</button>
                  <button type="button" onClick={() => setCashReceived('50')} style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold' }}>$50</button>
                  <button type="button" onClick={() => setCashReceived('100')} style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold' }}>$100</button>
                  <button type="button" onClick={() => setCashReceived('200')} style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold' }}>$200</button>
                  <button type="button" onClick={() => setCashReceived('500')} style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold' }}>$500</button>
                  <button type="button" onClick={() => setCashReceived('1000')} style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold' }}>$1000</button>
                </div>
              </div>

              {/* Built-in Visual Keypad (No system keyboard popup) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px',
                backgroundColor: 'var(--bg-card)'
              }}>
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setCashReceived(prev => {
                        if (prev === '0') return String(num);
                        return prev + String(num);
                      });
                    }}
                    style={{ height: '36px', fontSize: '1.05rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', cursor: 'pointer' }}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCashReceived(prev => {
                      if (!prev || prev === '0') return '0';
                      return prev + '0';
                    });
                  }}
                  style={{ height: '36px', fontSize: '1.05rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', cursor: 'pointer' }}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashReceived(prev => {
                      if (!prev || prev === '0') return '0';
                      return prev + '00';
                    });
                  }}
                  style={{ height: '36px', fontSize: '1.05rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', cursor: 'pointer' }}
                >
                  00
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashReceived(prev => {
                      if (prev.length <= 1) return '';
                      return prev.slice(0, -1);
                    });
                  }}
                  style={{ height: '36px', fontSize: '1.05rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', cursor: 'pointer', color: '#ef4444' }}
                >
                  ⌫
                </button>
              </div>

              {/* Submit transaction */}
              <button
                type="submit"
                disabled={cart.length === 0}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: cart.length === 0 ? 'var(--border)' : '#16a34a',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  marginTop: '4px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                💸 確認收銀結帳送單
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

            {/* Printable Receipt (Visible only during printing) */}
            <div id="printable-receipt" style={{ display: 'none' }}>
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #printable-receipt, #printable-receipt * {
                    visibility: visible;
                  }
                  #printable-receipt {
                    display: block !important;
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    max-width: 80mm;
                    margin: 0;
                    padding: 10px;
                    background: white;
                    color: black;
                    font-family: monospace;
                    font-size: 12px;
                    line-height: 1.4;
                  }
                }
              `}</style>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '16px', color: 'black' }}>{storeName}</h3>
                <p style={{ margin: 0, fontSize: '11px', color: 'black' }}>收執聯收據 (客戶存根)</p>
              </div>
              <div style={{ borderBottom: '1px dashed black', paddingBottom: '5px', marginBottom: '5px', color: 'black' }}>
                <div>時間: {latestOrder?.created_at ? new Date(latestOrder.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : new Date().toLocaleString()}</div>
                <div>單號: {latestOrder?.order_number}</div>
                <div>類型: {latestOrder?.type === 'dine-in' ? '內用' : '現場外帶'}</div>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px', color: 'black' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid black' }}>
                    <th style={{ textAlign: 'left' }}>品項</th>
                    <th style={{ textAlign: 'center', width: '40px' }}>數量</th>
                    <th style={{ textAlign: 'right', width: '60px' }}>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {latestOrder?.items?.cart?.map((item, idx) => (
                    <tr key={idx} style={{ verticalAlign: 'top' }}>
                      <td style={{ textAlign: 'left', padding: '3px 0' }}>
                        <div>{item.name}</div>
                        {item.specs?.map((spec, sIdx) => {
                          const specText = typeof spec === 'object' && spec ? (spec.value || `${spec.name}: ${spec.value}`) : String(spec);
                          return (
                            <div key={sIdx} style={{ fontSize: '11px', color: 'black', paddingLeft: '5px' }}>- {specText}</div>
                          );
                        })}
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 0' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '3px 0' }}>NT$ {item.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '1px dashed black', paddingTop: '5px', marginTop: '5px', color: 'black' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>應收總額:</span>
                  <strong>NT$ {latestOrder?.total}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>實收現金:</span>
                  <span>NT$ {latestOrder?.cashReceived}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>找零金額:</span>
                  <span>NT$ {latestOrder?.changeAmount}</span>
                </div>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px dashed black', paddingTop: '10px', fontSize: '11px', color: 'black' }}>
                謝謝惠顧，歡迎再度光臨！
              </div>
            </div>

            {/* Print trigger */}
            <button
              onClick={() => window.print()}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🖨️ 列印實體收執聯收據
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
          onClose={() => setActiveItemForModal(null)}
          onAddToCart={handleAddToCartFromModal}
          condimentsAvailability={null} // POS cashier has full options
          isPos={true}
        />
      )}
    </div>
  );
}
