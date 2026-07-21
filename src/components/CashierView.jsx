import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { formatSupabaseOrder } from './CustomerView';
import ItemModal from './ItemModal';

export default function CashierView({ cashierName, onLogout, onBackToDemo }) {
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('mee-sua');
  const [cart, setCart] = useState([]);
  
  // Checkout details
  const [orderType, setOrderType] = useState('dine-in'); // 'dine-in' or 'takeout'
  const [tableNumber, setTableNumber] = useState(null);
  const [custName, setCustName] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Cash Register Calculations
  const [cashReceived, setCashReceived] = useState('');
  const [changeAmount, setChangeAmount] = useState(0);

  // View States
  const [viewState, setViewState] = useState('pos'); // 'pos' or 'success'
  const [latestOrder, setLatestOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' or 'orders' (Order Board)

  // Orders State (for Receiving & Tracking)
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState('all'); // 'all', 'received', 'preparing', 'completed', 'cancelled'
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Modals / Editors
  const [activeItemForModal, setActiveItemForModal] = useState(null);
  
  // Modify Order Modal
  const [modifyingOrder, setModifyingOrder] = useState(null);
  const [modifyCart, setModifyCart] = useState([]);

  // Sub-ticket Modal
  const [subTicketOrder, setSubTicketOrder] = useState(null);
  const [subTicketCart, setSubTicketCart] = useState([]);

  // Discount states
  const [discountType, setDiscountType] = useState('none'); // 'none', 'percent', 'amount'
  const [discountValue, setDiscountValue] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Closed Dates
  const [closedDates, setClosedDates] = useState(() => {
    return JSON.parse(localStorage.getItem('restaurant_closed_dates') || '[]');
  });

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
        fetchOrders();
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
      console.error("Failed to fetch closed dates:", err);
    }
  };

  // Fetch Menu Items
  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
      if (error) throw error;
      if (data) setMenuItems(data.filter(item => item.name !== 'SYSTEM_SETTING_LINE_TOKEN'));
    } catch (err) {
      console.error("Failed to load menu items:", err);
    }
  };

  // Fetch Orders
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const clientOrders = data.filter(o => {
          const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
          return itemsData?.customerName !== 'SYSTEM_STORE_CLOSE';
        });
        const mapped = clientOrders.map(formatSupabaseOrder).filter(Boolean);
        setOrders(mapped);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    }
  };

  useEffect(() => {
    fetchMenuItems();
    fetchClosedDatesFromCloud();
    fetchOrders();
  }, []);

  // Real-time listener for orders and menu updates
  useEffect(() => {
    const ordersChannel = supabase.channel('pos-orders-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        if (payload.eventType === 'INSERT') {
          const itemsData = typeof payload.new.items === 'string' ? JSON.parse(payload.new.items) : payload.new.items;
          if (itemsData?.customerName !== 'SYSTEM_STORE_CLOSE') {
            triggerChime();
          }
        }
      })
      .subscribe();

    const menuChannel = supabase.channel('pos-menu-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenuItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(menuChannel);
    };
  }, []);

  // Synthesize notification chime
  const triggerChime = () => {
    if (!audioEnabled) return;
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

  // Cart pricing
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round(cartTotal * (discountValue / 100));
  } else if (discountType === 'amount') {
    discountAmount = discountValue;
  }
  const finalTotal = Math.max(0, cartTotal - discountAmount);

  useEffect(() => {
    const received = parseFloat(cashReceived) || 0;
    if (received >= finalTotal) {
      setChangeAmount(received - finalTotal);
    } else {
      setChangeAmount(0);
    }
  }, [cashReceived, finalTotal]);

  const handleProductClick = (item) => {
    if (item.customizations?.is_available === false) {
      alert(`「${item.name}」已售完！`);
      return;
    }
    if (item.customizations) {
      setActiveItemForModal(item);
    } else {
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

  const handleUpdateQty = (cartId, delta) => {
    setCart(cart.map(c => {
      if (c.cartId === cartId) {
        const nextQty = Math.max(1, c.quantity + delta);
        return { ...c, quantity: nextQty, totalPrice: c.itemPrice * nextQty };
      }
      return c;
    }));
  };

  const handleRemoveFromCart = (cartId) => {
    setCart(cart.filter(c => c.cartId !== cartId));
  };

  const handleQuickCash = (amount) => {
    const current = parseFloat(cashReceived) || 0;
    setCashReceived(String(current + amount));
  };

  const handleClearCash = () => {
    setCashReceived('');
  };

  // Submit POS checkout order
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("購物車是空的！");
      return;
    }

    const received = parseFloat(cashReceived) || 0;
    if (received < finalTotal) {
      alert(`實收金額不足！還缺 NT$ ${finalTotal - received}`);
      return;
    }

    // Generate serial number
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let count = 0;
    try {
      const { count: dbCount, error } = await supabase.from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());
      if (!error && dbCount !== null) count = dbCount;
    } catch (err) {}
    const serialNum = `A-${String(count + 1).padStart(3, '0')}`;

    let discountDetail = '';
    if (discountType === 'percent') {
      discountDetail = ` [折價: ${(10 - discountValue/10)}折, 折抵 $${discountAmount}]`;
    } else if (discountType === 'amount') {
      discountDetail = ` [折抵 $${discountValue}]`;
    }

    try {
      const { data: dbOrders, error: insertError } = await supabase.from('orders').insert([{
        order_number: serialNum,
        items: {
          cart: cart.map(c => ({
            id: c.id,
            name: c.name,
            price: c.itemPrice,
            quantity: c.quantity,
            specs: c.specs
          })),
          customerName: orderType === 'dine-in' 
            ? `內用 ${tableNumber || '現場'} 桌` 
            : `現場外帶${custName ? ' (' + custName + ')' : ''}`,
          customerPhone: '',
          pickupTime: '',
          paymentMethod: 'counter',
          remarks: remarks.trim() + discountDetail
        },
        total: finalTotal,
        type: orderType,
        table_number: orderType === 'dine-in' ? (tableNumber || '現場') : null,
        status: 'completed',
        payment_status: 'paid'
      }]).select();

      if (insertError) throw insertError;
      if (dbOrders && dbOrders.length > 0) {
        const orderData = formatSupabaseOrder(dbOrders[0]);
        setLatestOrder({
          ...orderData,
          cashReceived: received,
          changeAmount: received - finalTotal
        });
        setViewState('success');
        
        // Reset states
        setCart([]);
        setRemarks('');
        setTableNumber(null);
        setCustName('');
        setCashReceived('');
        setDiscountType('none');
        setDiscountValue(0);
        fetchOrders();
      }
    } catch (err) {
      alert("結帳送單失敗，請確認資料與網路：" + err.message);
    }
  };

  // Order receiving board actions
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      alert("更新狀態失敗：" + err.message);
    }
  };

  // Decline Order (拒單)
  const handleDeclineOrder = async (orderId) => {
    if (!window.confirm("⚠️ 確定要對這筆訂單進行【拒單】嗎？此動作將會取消該訂單。")) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'declined', payment_status: 'unpaid' })
        .eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      alert("拒單失敗：" + err.message);
    }
  };

  // Return/Refund Order (退貨)
  const handleRefundOrder = async (orderId) => {
    if (!window.confirm("⚠️ 確定要對這筆已付費訂單辦理【退貨】嗎？此動作將會將該單設為退款狀態。")) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'refunded', payment_status: 'refunded' })
        .eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      alert("退貨失敗：" + err.message);
    }
  };

  // Modify Order Submit
  const handleSaveModifiedOrder = async () => {
    if (modifyCart.length === 0) {
      alert("修改後的訂單不能為空！");
      return;
    }
    const newTotal = modifyCart.reduce((sum, item) => sum + item.totalPrice, 0);
    try {
      const updatedItems = {
        cart: modifyCart.map(c => ({
          id: c.id,
          name: c.name,
          price: c.itemPrice,
          quantity: c.quantity,
          specs: c.specs
        })),
        customerName: modifyingOrder.customerName,
        customerPhone: modifyingOrder.customerPhone,
        pickupTime: modifyingOrder.pickupTime,
        paymentMethod: modifyingOrder.paymentMethod,
        remarks: modifyingOrder.remarks,
        subTickets: modifyingOrder.subTickets || []
      };

      const { error } = await supabase
        .from('orders')
        .update({
          items: updatedItems,
          total: newTotal
        })
        .eq('id', modifyingOrder.id);
      
      if (error) throw error;
      alert("訂單內容修改成功！");
      setModifyingOrder(null);
      fetchOrders();
    } catch (err) {
      alert("修改訂單失敗：" + err.message);
    }
  };

  // Add Sub-ticket Submit
  const handleAddSubTicketSubmit = async () => {
    if (subTicketCart.length === 0) {
      alert("副單內容不能為空！");
      return;
    }
    const subTicketTotal = subTicketCart.reduce((sum, item) => sum + item.totalPrice, 0);
    const newSubTicket = {
      id: `sub-${Date.now()}`,
      cart: subTicketCart.map(c => ({
        id: c.id,
        name: c.name,
        price: c.itemPrice,
        quantity: c.quantity,
        specs: c.specs
      })),
      total: subTicketTotal
    };

    const currentSubTickets = subTicketOrder.subTickets || [];
    const updatedSubTickets = [...currentSubTickets, newSubTicket];
    
    // Sum main cart total and all subtickets
    const mainTotal = subTicketOrder.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const allSubticketsTotal = updatedSubTickets.reduce((sum, st) => sum + st.total, 0);
    const finalTotalWithSubtickets = mainTotal + allSubticketsTotal;

    try {
      const updatedItems = {
        cart: subTicketOrder.cart,
        customerName: subTicketOrder.customerName,
        customerPhone: subTicketOrder.customerPhone,
        pickupTime: subTicketOrder.pickupTime,
        paymentMethod: subTicketOrder.paymentMethod,
        remarks: subTicketOrder.remarks,
        subTickets: updatedSubTickets
      };

      const { error } = await supabase
        .from('orders')
        .update({
          items: updatedItems,
          total: finalTotalWithSubtickets
        })
        .eq('id', subTicketOrder.id);
      
      if (error) throw error;
      alert("副單新增成功！");
      setSubTicketOrder(null);
      setSubTicketCart([]);
      fetchOrders();
    } catch (err) {
      alert("新增副單失敗：" + err.message);
    }
  };

  // Filtered menu search
  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Filtered orders list
  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return true;
    return o.status === orderFilter;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>💵</span>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>龍城麵線 整合收銀與接單管理</h1>
          </div>
          
          {/* Main navigation tabs */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-body)', padding: '4px', borderRadius: '8px' }}>
            <button 
              onClick={() => { setActiveTab('pos'); setViewState('pos'); }}
              style={{
                padding: '6px 16px', fontSize: '0.8rem', fontWeight: 'bold', border: 'none', borderRadius: '6px',
                backgroundColor: activeTab === 'pos' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'pos' ? 'white' : 'var(--text-muted)', cursor: 'pointer'
              }}
            >
              🛒 點餐收銀 (POS)
            </button>
            <button 
              onClick={() => { setActiveTab('orders'); }}
              style={{
                padding: '6px 16px', fontSize: '0.8rem', fontWeight: 'bold', border: 'none', borderRadius: '6px',
                backgroundColor: activeTab === 'orders' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'orders' ? 'white' : 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              📋 接單管理
              {orders.filter(o => o.status === 'received').length > 0 && (
                <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px' }}>
                  {orders.filter(o => o.status === 'received').length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {activeTab === 'orders' && (
            <button 
              onClick={() => setAudioEnabled(!audioEnabled)}
              style={{
                padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)',
                backgroundColor: 'transparent', color: audioEnabled ? '#10b981' : 'var(--text-muted)', cursor: 'pointer'
              }}
            >
              {audioEnabled ? '🔊 提示音已開啟' : '🔇 提示音已關閉'}
            </button>
          )}

          {onBackToDemo && (
            <button 
              onClick={onBackToDemo}
              style={{
                padding: '6px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                backgroundColor: 'transparent', color: 'var(--text-main)', cursor: 'pointer'
              }}
            >
              🏠 返回主頁
            </button>
          )}

          <button 
            onClick={() => {
              if (window.confirm("確定進行今日收店結帳嗎？這將會鎖定前台與收銀端。")) {
                const pwd = window.prompt("請輸入關店密碼以確認收店：");
                if (pwd === '8888') {
                  const todayStr = getTodayLocalDate();
                  const updated = [...closedDates, todayStr];
                  setClosedDates(updated);
                  localStorage.setItem('restaurant_closed_dates', JSON.stringify(updated));
                  window.dispatchEvent(new Event('storage'));
                  
                  supabase.from('orders').insert([{
                    order_number: 'CLOSE',
                    items: { customerName: 'SYSTEM_STORE_CLOSE', customerPhone: 'SYSTEM', cart: [] },
                    total: 0,
                    type: 'dine-in',
                    table_number: 'CLOSED',
                    status: 'completed',
                    payment_status: 'paid'
                  }]).then(({ error }) => {
                    if (error) console.error("Failed to sync store close:", error);
                  });

                  alert("收店結帳成功！系統已關店鎖定。");
                } else if (pwd !== null) {
                  alert("密碼錯誤！");
                }
              }
            }}
            style={{
              padding: '6px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid #ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444',
              cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            🏁 今日收店結帳
          </button>
          <button 
            onClick={onLogout}
            style={{
              padding: '6px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)',
              cursor: 'pointer', fontWeight: '600'
            }}
          >
            🔒 登出
          </button>
        </div>
      </header>

      {/* Main Mode Swapper */}
      {activeTab === 'pos' ? (
        viewState === 'pos' ? (
          /* POS Main Workspace */
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 57px)' }}>
            
            {/* Left Panel: Menu Item Grid */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden', padding: '12px 16px', borderRight: '1px solid var(--border)', gap: '10px' }}>
              
              {/* Category switcher */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setActiveCategory('mee-sua')}
                  style={{
                    flex: 1, padding: '12px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    backgroundColor: activeCategory === 'mee-sua' ? 'rgba(255,107,53,0.1)' : 'var(--bg-card)',
                    borderColor: activeCategory === 'mee-sua' ? 'var(--primary)' : 'var(--border)',
                    color: activeCategory === 'mee-sua' ? 'var(--primary)' : 'var(--text-main)'
                  }}
                >
                  🍜 招牌麵線系列
                </button>
                <button 
                  onClick={() => setActiveCategory('sides')}
                  style={{
                    flex: 1, padding: '12px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    backgroundColor: activeCategory === 'sides' ? 'rgba(255,107,53,0.1)' : 'var(--bg-card)',
                    borderColor: activeCategory === 'sides' ? 'var(--primary)' : 'var(--border)',
                    color: activeCategory === 'sides' ? 'var(--primary)' : 'var(--text-main)'
                  }}
                >
                  🍢 精緻小菜系列
                </button>
                <button 
                  onClick={() => setActiveCategory('drinks')}
                  style={{
                    flex: 1, padding: '12px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    backgroundColor: activeCategory === 'drinks' ? 'rgba(255,107,53,0.1)' : 'var(--bg-card)',
                    borderColor: activeCategory === 'drinks' ? 'var(--primary)' : 'var(--border)',
                    color: activeCategory === 'drinks' ? 'var(--primary)' : 'var(--text-main)'
                  }}
                >
                  🥤 暢快飲品系列
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="🔍 輸入名稱快速搜尋商品..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>

              {/* Items grid */}
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {filteredMenuItems.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => handleProductClick(item)}
                      style={{
                        backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', height: '220px', transition: 'transform 0.2s', position: 'relative',
                        opacity: item.customizations?.is_available === false ? 0.5 : 1
                      }}
                    >
                      {item.customizations?.is_available === false && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, fontSize: '1rem', fontWeight: 'bold' }}>
                          🚫 已沽清 (完售)
                        </div>
                      )}
                      
                      <div style={{ height: '110px', overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
                        <img 
                          src={item.image || '/images/plain_mee_sua.jpg'} 
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: '0 0 4px 0', color: 'var(--text-main)' }}>{item.name}</h3>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {item.description || '在地古早味美食'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--primary)' }}>${item.price}</span>
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255,107,53,0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px' }}>
                            點擊加點
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel: Checkout Panel */}
            <div style={{ width: '380px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', padding: '16px', boxSizing: 'border-box' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '0 0 12px 0', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                🛒 櫃檯結帳清單
              </h2>

              {/* Cart List */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
                {cart.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '0.85rem' }}>
                    櫃檯收銀車尚無餐點項目
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cart.map(c => (
                      <div key={c.cartId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{c.name}</div>
                          {c.specs && c.specs.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              規格: {c.specs.map(s => `${s.name}: ${s.value}`).join(', ')}
                            </div>
                          )}
                          <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2px' }}>${c.itemPrice}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => handleUpdateQty(c.cartId, -1)} style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'pointer' }}>-</button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{c.quantity}</span>
                          <button onClick={() => handleUpdateQty(c.cartId, 1)} style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'pointer' }}>+</button>
                          <button onClick={() => handleRemoveFromCart(c.cartId)} style={{ marginLeft: '6px', padding: '2px 6px', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}>刪除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing details and checkout form */}
              <form onSubmit={handleCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>小計:</span>
                  <span>NT$ {cartTotal}</span>
                </div>

                {/* Discount selectors */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem' }}>
                  <span>折扣:</span>
                  <select 
                    value={discountType} 
                    onChange={(e) => { setDiscountType(e.target.value); setDiscountValue(0); }}
                    style={{ flex: 1, padding: '4px' }}
                  >
                    <option value="none">無折扣</option>
                    <option value="percent">百分比折價 (%)</option>
                    <option value="amount">直接折抵金額 ($)</option>
                  </select>
                  {discountType !== 'none' && (
                    <input 
                      type="number" 
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ width: '60px', padding: '4px' }}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                  <span>應收總計:</span>
                  <span>NT$ {finalTotal}</span>
                </div>

                {/* Order Type */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => { setOrderType('dine-in'); setCustName(''); }}
                    style={{
                      flex: 1, padding: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', border: '1px solid',
                      backgroundColor: orderType === 'dine-in' ? 'var(--primary)' : 'transparent',
                      color: orderType === 'dine-in' ? 'white' : 'var(--text-main)',
                      borderColor: orderType === 'dine-in' ? 'var(--primary)' : 'var(--border)'
                    }}
                  >
                    🍽️ 內用
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setOrderType('takeout'); setTableNumber(null); }}
                    style={{
                      flex: 1, padding: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', border: '1px solid',
                      backgroundColor: orderType === 'takeout' ? 'var(--primary)' : 'transparent',
                      color: orderType === 'takeout' ? 'white' : 'var(--text-main)',
                      borderColor: orderType === 'takeout' ? 'var(--primary)' : 'var(--border)'
                    }}
                  >
                    🛍️ 外帶
                  </button>
                </div>

                {orderType === 'dine-in' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>桌號 (選填)</label>
                    <input 
                      type="text" 
                      placeholder="例如: 3"
                      value={tableNumber || ''}
                      onChange={(e) => setTableNumber(e.target.value)}
                      style={{ padding: '6px', fontSize: '0.8rem' }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>取餐姓名 (選填)</label>
                    <input 
                      type="text" 
                      placeholder="例如: 王先生"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      style={{ padding: '6px', fontSize: '0.8rem' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>訂單備註 (選填)</label>
                  <input 
                    type="text" 
                    placeholder="不要香菜, 辣多點"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    style={{ padding: '6px', fontSize: '0.8rem' }}
                  />
                </div>

                {/* Cash received calculator */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>💵 實收現金</label>
                    <input 
                      type="number" 
                      placeholder="輸入實收金額"
                      required
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      style={{ padding: '8px', fontSize: '1rem', fontWeight: 'bold', boxSizing: 'border-box', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>🪙 找零</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>$ {changeAmount}</span>
                  </div>
                </div>

                {/* Cash register shortcuts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  <button type="button" onClick={() => handleQuickCash(100)} style={{ padding: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>+100</button>
                  <button type="button" onClick={() => handleQuickCash(500)} style={{ padding: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>+500</button>
                  <button type="button" onClick={() => handleQuickCash(1000)} style={{ padding: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>+1000</button>
                  <button type="button" onClick={handleClearCash} style={{ padding: '6px', fontSize: '0.75rem', cursor: 'pointer', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>C</button>
                </div>

                <button 
                  type="submit" 
                  style={{
                    width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer',
                    backgroundColor: 'var(--primary)', color: 'white', marginTop: '6px'
                  }}
                >
                  ⚡ 完成結帳並列印送單
                </button>
              </form>
            </div>

          </div>
        ) : (
          /* Checkout Success Receipt View */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '16px', border: '1px solid var(--border)', width: '380px', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
              <span style={{ fontSize: '3rem' }}>🎉</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981', margin: '12px 0 6px 0' }}>結帳完成！交易明細</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>單號: {latestOrder?.orderNumber} | 類型: {latestOrder?.type === 'dine-in' ? '內用' : '外帶'}</p>

              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', padding: '12px 0', marginBottom: '20px' }}>
                {latestOrder?.cart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{item.name} x {item.quantity}</span>
                    <span>${item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>應收金額:</span>
                  <span style={{ fontWeight: 'bold' }}>${latestOrder?.total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>實收金額:</span>
                  <span>${latestOrder?.cashReceived}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 'bold' }}>
                  <span>找零金額:</span>
                  <span>${latestOrder?.changeAmount}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setViewState('pos')}
                  style={{ flex: 1, padding: '10px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'transparent', cursor: 'pointer' }}
                >
                  確認並返回 POS
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        /* Unified Incoming & Historical Orders Management Board */
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', height: 'calc(100vh - 57px)', overflow: 'hidden' }}>
          
          {/* Order board filter tabs */}
          <div style={{ display: 'flex', gap: '10px', padding: '12px 24px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <button 
              onClick={() => setOrderFilter('all')}
              style={{
                padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid', cursor: 'pointer',
                backgroundColor: orderFilter === 'all' ? 'var(--primary)' : 'transparent',
                color: orderFilter === 'all' ? 'white' : 'var(--text-main)',
                borderColor: orderFilter === 'all' ? 'var(--primary)' : 'var(--border)'
              }}
            >
              全部訂單
            </button>
            <button 
              onClick={() => setOrderFilter('received')}
              style={{
                padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid', cursor: 'pointer',
                backgroundColor: orderFilter === 'received' ? '#eab308' : 'transparent',
                color: orderFilter === 'received' ? 'white' : 'var(--text-main)',
                borderColor: orderFilter === 'received' ? '#eab308' : 'var(--border)'
              }}
            >
              待處理接單 ({orders.filter(o => o.status === 'received').length})
            </button>
            <button 
              onClick={() => setOrderFilter('preparing')}
              style={{
                padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid', cursor: 'pointer',
                backgroundColor: orderFilter === 'preparing' ? 'var(--primary)' : 'transparent',
                color: orderFilter === 'preparing' ? 'white' : 'var(--text-main)',
                borderColor: orderFilter === 'preparing' ? 'var(--primary)' : 'var(--border)'
              }}
            >
              製作出餐中 ({orders.filter(o => o.status === 'preparing').length})
            </button>
            <button 
              onClick={() => setOrderFilter('completed')}
              style={{
                padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid', cursor: 'pointer',
                backgroundColor: orderFilter === 'completed' ? '#10b981' : 'transparent',
                color: orderFilter === 'completed' ? 'white' : 'var(--text-main)',
                borderColor: orderFilter === 'completed' ? '#10b981' : 'var(--border)'
              }}
            >
              出餐完畢 ({orders.filter(o => o.status === 'completed').length})
            </button>
            <button 
              onClick={() => setOrderFilter('refunded')}
              style={{
                padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid', cursor: 'pointer',
                backgroundColor: orderFilter === 'refunded' ? '#ef4444' : 'transparent',
                color: orderFilter === 'refunded' ? 'white' : 'var(--text-main)',
                borderColor: orderFilter === 'refunded' ? '#ef4444' : 'var(--border)'
              }}
            >
              退貨與拒單
            </button>
          </div>

          {/* Orders list container */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', boxSizing: 'border-box' }}>
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>
                暫無對應狀態的訂單明細
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
                {filteredOrders.map(order => {
                  const isPending = order.status === 'received';
                  const isPreparing = order.status === 'preparing';
                  const isCompleted = order.status === 'completed';
                  const isCancelled = order.status === 'declined' || order.status === 'refunded';

                  return (
                    <div 
                      key={order.id} 
                      style={{
                        backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden',
                        boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', position: 'relative'
                      }}
                    >
                      {/* Order status card top banner */}
                      <div style={{
                        padding: '10px 14px', color: 'white', display: 'flex', justifyBetween: 'space-between', alignItems: 'center',
                        backgroundColor: isPending ? '#eab308' : isPreparing ? 'var(--primary)' : isCompleted ? '#10b981' : '#6b7280',
                        fontSize: '0.8rem', fontWeight: 'bold', justifyContent: 'space-between'
                      }}>
                        <span>單號: {order.orderNumber} ({order.type === 'dine-in' ? '內用' : '外帶'})</span>
                        <span>
                          {order.status === 'received' ? '⏳ 待處理' : 
                           order.status === 'preparing' ? '🔥 製作中' : 
                           order.status === 'completed' ? '✓ 待出餐' : 
                           order.status === 'declined' ? '🚫 已拒單' : '🪙 已退貨'}
                        </span>
                      </div>

                      {/* Order main details */}
                      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                          客戶: {order.customerName}
                          {order.customerPhone && ` | 手機: ${order.customerPhone}`}
                          {order.pickupTime && ` | 取餐時間: ${order.pickupTime}`}
                        </div>

                        {/* Items list */}
                        <div style={{ borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)', padding: '10px 0' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>點購品項:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                            {order.cart.map((item, idx) => (
                              <div key={idx} style={{ fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <strong style={{ color: 'var(--text-main)' }}>{item.name} x {item.quantity}</strong>
                                  <span style={{ fontWeight: 'bold' }}>${item.price * item.quantity}</span>
                                </div>
                                {item.specs && item.specs.length > 0 && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                    └ {item.specs.map(s => `${s.name}:${s.value}`).join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Sub-tickets details */}
                          {order.subTickets && order.subTickets.length > 0 && (
                            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#8b5cf6' }}>➕ 追加副單:</span>
                              {order.subTickets.map((st, idx) => (
                                <div key={st.id || idx} style={{ backgroundColor: 'rgba(139, 92, 246, 0.03)', padding: '6px', borderRadius: '4px', marginTop: '4px' }}>
                                  {st.cart.map((item, i) => (
                                    <div key={i} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                                      <span>{item.name} x {item.quantity}</span>
                                      <span>${item.price * item.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {order.remarks && (
                          <div style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-body)', padding: '6px 8px', borderRadius: '4px', borderLeft: '3px solid var(--primary)' }}>
                            備註: {order.remarks}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            時間: {new Date(order.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            應收總額: ${order.total}
                          </span>
                        </div>
                      </div>

                      {/* Card Operations/Actions Footer */}
                      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
                        {isPending && (
                          <>
                            <button 
                              onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                              style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              ✓ 接單
                            </button>
                            <button 
                              onClick={() => handleDeclineOrder(order.id)}
                              style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              🚫 拒單
                            </button>
                          </>
                        )}
                        {isPreparing && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ✓ 製作完成 (出餐)
                          </button>
                        )}
                        
                        {/* Allowed operations for active/non-cancelled orders */}
                        {!isCancelled && (
                          <>
                            <button 
                              onClick={() => {
                                setModifyingOrder(order);
                                setModifyCart(order.cart.map(item => ({
                                  cartId: `${item.id}-${Date.now()}-${Math.random()}`,
                                  id: item.id,
                                  name: item.name,
                                  itemPrice: item.price,
                                  basePrice: item.price,
                                  totalPrice: item.price * item.quantity,
                                  quantity: item.quantity,
                                  specs: item.specs || []
                                })));
                              }}
                              style={{ padding: '6px 10px', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              ✏️ 修改
                            </button>
                            <button 
                              onClick={() => {
                                setSubTicketOrder(order);
                                setSubTicketCart([]);
                              }}
                              style={{ padding: '6px 10px', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#8b5cf6', border: '1px solid #8b5cf6', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              ➕ 副單
                            </button>
                            <button 
                              onClick={() => handleRefundOrder(order.id)}
                              style={{ padding: '6px 10px', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              🪙 退貨
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modify Order Modal Component */}
      {modifyingOrder && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 'bold' }}>✏️ 修改訂單內容 ({modifyingOrder.orderNumber})</h3>
              <button className="close-btn" style={{ position: 'absolute', right: '16px', top: '16px' }} onClick={() => setModifyingOrder(null)}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              {/* Existing items editor */}
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>現有項目調整:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {modifyCart.map(c => (
                    <div key={c.cartId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: 'var(--bg-body)', borderRadius: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{c.name}</span>
                        {c.specs && c.specs.length > 0 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {c.specs.map(s => `${s.name}: ${s.value}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                          onClick={() => {
                            setModifyCart(modifyCart.map(x => x.cartId === c.cartId ? { ...x, quantity: Math.max(1, x.quantity - 1), totalPrice: x.itemPrice * Math.max(1, x.quantity - 1) } : x));
                          }}
                          style={{ width: '24px', height: '24px', cursor: 'pointer' }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{c.quantity}</span>
                        <button 
                          onClick={() => {
                            setModifyCart(modifyCart.map(x => x.cartId === c.cartId ? { ...x, quantity: x.quantity + 1, totalPrice: x.itemPrice * (x.quantity + 1) } : x));
                          }}
                          style={{ width: '24px', height: '24px', cursor: 'pointer' }}
                        >
                          +
                        </button>
                        <button 
                          onClick={() => setModifyCart(modifyCart.filter(x => x.cartId !== c.cartId))}
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '6px' }}
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add new items into modifying order */}
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>新增其他餐點:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {menuItems.map(item => (
                    <button 
                      key={item.id} 
                      type="button"
                      onClick={() => {
                        const existing = modifyCart.find(x => x.id === item.id && (!x.specs || x.specs.length === 0));
                        if (existing) {
                          setModifyCart(modifyCart.map(x => x.cartId === existing.cartId ? { ...x, quantity: x.quantity + 1, totalPrice: x.itemPrice * (x.quantity + 1) } : x));
                        } else {
                          setModifyCart([...modifyCart, {
                            cartId: `${item.id}-${Date.now()}`,
                            id: item.id,
                            name: item.name,
                            itemPrice: item.price,
                            basePrice: item.price,
                            totalPrice: item.price,
                            quantity: 1,
                            specs: []
                          }]);
                        }
                      }}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer' }}
                    >
                      ＋ {item.name} (${item.price})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                修改後總計金額: NT$ {modifyCart.reduce((sum, item) => sum + item.totalPrice, 0)}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setModifyingOrder(null)} style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer' }}>
                  取消
                </button>
                <button onClick={handleSaveModifiedOrder} style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                  💾 儲存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Sub-Ticket Modal Component */}
      {subTicketOrder && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontWeight: 'bold' }}>➕ 為此訂單新增追加副單 ({subTicketOrder.orderNumber})</h3>
              <button className="close-btn" style={{ position: 'absolute', right: '16px', top: '16px' }} onClick={() => setSubTicketOrder(null)}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              {/* Additional items selection */}
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>選擇要加點的商品:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {menuItems.map(item => (
                    <button 
                      key={item.id} 
                      type="button"
                      onClick={() => {
                        const existing = subTicketCart.find(x => x.id === item.id && (!x.specs || x.specs.length === 0));
                        if (existing) {
                          setSubTicketCart(subTicketCart.map(x => x.cartId === existing.cartId ? { ...x, quantity: x.quantity + 1, totalPrice: x.itemPrice * (x.quantity + 1) } : x));
                        } else {
                          setSubTicketCart([...subTicketCart, {
                            cartId: `${item.id}-${Date.now()}`,
                            id: item.id,
                            name: item.name,
                            itemPrice: item.price,
                            basePrice: item.price,
                            totalPrice: item.price,
                            quantity: 1,
                            specs: []
                          }]);
                        }
                      }}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer' }}
                    >
                      ＋ {item.name} (${item.price})
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-ticket list */}
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>已選追加項目:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {subTicketCart.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>尚無加點項目，請在上方點擊加選商品</span>
                  ) : (
                    subTicketCart.map(c => (
                      <div key={c.cartId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: 'var(--bg-body)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{c.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button 
                            onClick={() => {
                              setSubTicketCart(subTicketCart.map(x => x.cartId === c.cartId ? { ...x, quantity: Math.max(1, x.quantity - 1), totalPrice: x.itemPrice * Math.max(1, x.quantity - 1) } : x));
                            }}
                            style={{ width: '24px', height: '24px', cursor: 'pointer' }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{c.quantity}</span>
                          <button 
                            onClick={() => {
                              setSubTicketCart(subTicketCart.map(x => x.cartId === c.cartId ? { ...x, quantity: x.quantity + 1, totalPrice: x.itemPrice * (x.quantity + 1) } : x));
                            }}
                            style={{ width: '24px', height: '24px', cursor: 'pointer' }}
                          >
                            +
                          </button>
                          <button 
                            onClick={() => setSubTicketCart(subTicketCart.filter(x => x.cartId !== c.cartId))}
                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '6px' }}
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                本次追加副單總額: NT$ {subTicketCart.reduce((sum, item) => sum + item.totalPrice, 0)}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setSubTicketOrder(null)} style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer' }}>
                  取消
                </button>
                <button onClick={handleAddSubTicketSubmit} style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '6px', border: 'none', backgroundColor: '#8b5cf6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                  ⚡ 送出並新增副單
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item specs options modal */}
      {activeItemForModal && (
        <ItemModal 
          item={activeItemForModal} 
          onClose={() => setActiveItemForModal(null)} 
          onAddToCart={handleAddToCartFromModal}
        />
      )}
    </div>
  );
}
