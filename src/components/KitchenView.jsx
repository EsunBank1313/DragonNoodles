import React, { useState, useEffect, useRef } from 'react';
import { menuItems as defaultMenuItems } from '../data/menuData';
import { supabase } from '../supabaseClient';
import { formatSupabaseOrder } from './CustomerView';
import BookkeepingView from './BookkeepingView';

export default function KitchenView({ onBackToDemo, onLogout }) {
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

  const isClosedToday = closedDates.includes(getTodayLocalDate());

  const [orders, setOrders] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const prevOrdersCountRef = useRef(0);

  const [condimentsAvailability, setCondimentsAvailability] = useState({
    '香菜': true,
    '蒜末': true,
    '烏醋': true,
    '辣醬': true
  });

  const [menuItemsAvailability, setMenuItemsAvailability] = useState({});
  const [menuItems, setMenuItems] = useState([]);

  // Product add/edit form states
  const [editingItemId, setEditingItemId] = useState(null); // null if adding
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('mee-sua');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodCustomization, setProdCustomization] = useState('mee-sua-standard'); // 'mee-sua-standard', 'none'

  // UI management dropdown states
  const [selectedManageType, setSelectedManageType] = useState('general'); // 'general', 'specialties', 'condiment', 'add-new'

  // Fetch Menu Items from Supabase
  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        setMenuItems(data.filter(item => item.name !== 'SYSTEM_SETTING_LINE_TOKEN'));
      } else {
        // Seed if empty
        const defaultWithNullCustomizations = defaultMenuItems.map(item => ({
          ...item,
          customizations: item.customizations || null
        }));
        await supabase.from('menu_items').insert(defaultWithNullCustomizations);
        const { data: seeded } = await supabase.from('menu_items').select('*').order('id', { ascending: true });
        if (seeded) setMenuItems(seeded);
      }
    } catch (err) {
      console.error("Failed to load from Supabase menu_items in KitchenView:", err);
      const savedMenuItems = localStorage.getItem('restaurant_menu_items');
      if (savedMenuItems) {
        setMenuItems(JSON.parse(savedMenuItems));
      } else {
        setMenuItems(defaultMenuItems);
      }
    }
  };

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
      console.error("Failed to fetch closed dates from cloud in KitchenView:", err);
    }
  };

  // Fetch Orders from Supabase
  const fetchOrders = async () => {
    fetchClosedDatesFromCloud();
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        // Filter out SYSTEM_STORE_CLOSE orders
        const clientOrders = data.filter(o => {
          const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
          return itemsData?.customerName !== 'SYSTEM_STORE_CLOSE';
        });
        const mapped = clientOrders.map(formatSupabaseOrder).filter(Boolean);
        setOrders(mapped);
        prevOrdersCountRef.current = mapped.length;
      }
    } catch (err) {
      console.error("Failed to load orders from Supabase:", err);
      // Fallback
      const loadedOrders = JSON.parse(localStorage.getItem('restaurant_orders') || '[]');
      setOrders(loadedOrders);
      prevOrdersCountRef.current = loadedOrders.length;
    }
  };

  // Load orders, settings on mount
  useEffect(() => {
    fetchMenuItems();
    fetchOrders();

    const savedCondiments = localStorage.getItem('condiments_availability');
    if (savedCondiments) {
      setCondimentsAvailability(JSON.parse(savedCondiments));
    }

    const savedMenuItemsAvail = localStorage.getItem('menu_items_availability');
    if (savedMenuItemsAvail) {
      setMenuItemsAvailability(JSON.parse(savedMenuItemsAvail));
    }
  }, []);

  // Listen to Supabase postgres changes in Realtime for live order notifications
  useEffect(() => {
    const ordersChannel = supabase.channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        fetchOrders();
        // If a new order is received, trigger chime sound
        if (payload.eventType === 'INSERT') {
          triggerNotification();
        }
      })
      .subscribe();

    const menuChannel = supabase.channel('kitchen-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenuItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(menuChannel);
    };
  }, []);

  // Listen for local changes to availability state
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

  // Product CRUD Handlers
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodName.trim() || !prodPrice) {
      alert('請填寫商品名稱與單價！');
      return;
    }

    const priceNum = parseFloat(prodPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('請輸入有效的商品單價！');
      return;
    }

    // Determine customization object
    let customizations = null;
    if (prodCustomization === 'mee-sua-standard') {
      customizations = {
        size: {
          title: '份量',
          type: 'radio',
          options: [
            { label: '小碗', priceChange: 0 },
            { label: '大碗', priceChange: 15 }
          ],
          default: '小碗'
        },
        addons: {
          title: '加料選項 (可多選)',
          type: 'checkbox',
          options: [
            { label: '大腸', priceChange: 20 },
            { label: '豬肚', priceChange: 20 },
            { label: '肉羹', priceChange: 15 },
            { label: '花枝羹', priceChange: 20 },
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
        }
      };
    }

    let imgUrl = prodImage.trim();
    if (!imgUrl) {
      imgUrl = prodCategory === 'mee-sua' ? '/images/taiwanese_mee_sua.jpg' : '/images/spicy_kimchi.jpg';
    }

    try {
      if (editingItemId) {
        // Edit mode
        const { error } = await supabase.from('menu_items').update({
          name: prodName.trim(),
          category: prodCategory,
          price: priceNum,
          description: prodDescription.trim(),
          image: imgUrl,
          customizations: customizations
        }).eq('id', editingItemId);
        if (error) throw error;
        setEditingItemId(null);
      } else {
        // Add mode
        const { error } = await supabase.from('menu_items').insert([{
          category: prodCategory,
          name: prodName.trim(),
          description: prodDescription.trim(),
          price: priceNum,
          image: imgUrl,
          customizations: customizations
        }]);
        if (error) throw error;
      }
      fetchMenuItems();
    } catch (err) {
      console.error("Failed to save product in Supabase:", err);
      alert("儲存商品失敗！");
    }

    // Reset form fields
    setProdName('');
    setProdPrice('');
    setProdDescription('');
    setProdImage('');
    setProdCustomization('mee-sua-standard');
  };

  const handleStartEdit = (item) => {
    setEditingItemId(item.id);
    setProdName(item.name);
    setProdPrice(item.price.toString());
    setProdCategory(item.category);
    setProdDescription(item.description || '');
    setProdImage(item.image || '');
    setProdCustomization(item.customizations ? 'mee-sua-standard' : 'none');
    
    // Scroll to the product form
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
        console.error("Failed to delete product from Supabase:", err);
        alert("刪除商品失敗！");
      }
    }
  };

  // Synthetic beep notification using Web Audio API
  const triggerNotification = () => {
    if (!audioEnabled) return;
    
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // First beep (pitch 587.33Hz - D5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.value = 587.33;
      gain1.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.15);

      // Second beep (pitch 880Hz - A5) slightly delayed
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.value = 880;
        gain2.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc2.start(audioCtx.currentTime);
        osc2.stop(audioCtx.currentTime + 0.3);
      }, 120);
    } catch (e) {
      console.warn("Failed to play synthetic audio notification:", e);
    }
  };

  // Helper to update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase.from('orders').update({
        status: newStatus
      }).eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err) {
      console.error("Failed to update order status in Supabase:", err);
      alert("更新訂單狀態失敗！");
    }
  };

  const handleClearOrders = async () => {
    if (window.confirm('確定要清空所有訂單記錄嗎？這將會清除雲端資料庫上所有歷史與進行中的訂單。')) {
      try {
        const { error } = await supabase.from('orders').delete().neq('id', 0); // deletes all rows
        if (error) throw error;
        localStorage.removeItem('active_customer_order_id');
        fetchOrders();
      } catch (err) {
        console.error("Failed to clear orders in Supabase:", err);
        alert("清空訂單失敗！");
      }
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('確定要取消並刪除這筆訂單嗎？')) {
      try {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;
        fetchOrders();
      } catch (err) {
        console.error("Failed to delete order from Supabase:", err);
        alert("刪除訂單失敗！");
      }
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
      console.error("Failed to toggle menu item availability in DB:", err);
      alert("切換商品供應狀態失敗，請確認網路連線！");
    }
  };

  // Filter orders by status
  const isTodayOrder = (order) => {
    if (!order.timestamp) return false;
    try {
      const dateStr = new Date(order.timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
      return dateStr === todayStr;
    } catch (e) {
      return false;
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'received').reverse();
  const preparingOrders = orders.filter(o => o.status === 'preparing').reverse();
  const readyOrders = orders.filter(o => (o.status === 'ready' || o.status === 'completed') && isTodayOrder(o))
    .reverse()
    .sort((a, b) => {
      if (a.status === 'completed' && b.status === 'ready') return 1;
      if (a.status === 'ready' && b.status === 'completed') return -1;
      return 0;
    });

  // Format order customize specification display
  const getElapsedMinutes = (timestamp) => {
    const elapsed = Date.now() - timestamp;
    const mins = Math.floor(elapsed / 60000);
    if (mins < 1) return '剛剛';
    return `${mins} 分鐘前`;
  };

  // Force tick state update every 30s to refresh elapsed minutes
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleHomeClick = () => {
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo');
    if (demo === 'true') {
      onBackToDemo();
    } else {
      window.location.href = '/?admin=true';
    }
  };

  if (isClosedToday) {
    return (
      <BookkeepingView 
        onLogout={onLogout} 
        parentClosedDates={closedDates}
        parentSetClosedDates={setClosedDates}
      />
    );
  }

  return (
    <div className="staff-view">
      <header className="staff-header">
        <div className="staff-title-area">
          <span className="staff-logo">👨‍🍳</span>
          <div>
            <h1 style={{ fontSize: '1.25rem' }}>龍城麵線 接單與廚房系統</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              即時狀態同步中
            </p>
          </div>
        </div>

        <div className="staff-controls-top" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onLogout && (
            <button 
              onClick={onLogout}
              className="btn-secondary"
              style={{ height: '33px', fontWeight: 'bold' }}
            >
              🔒 登出鎖定
            </button>
          )}
        </div>
      </header>

      {/* Main dashboard columns */}
      <main className="staff-dashboard" style={{ paddingTop: '10px' }}>
        {/* Column 1: Received / Pending */}
        <div className="staff-column">
          <div className="column-header">
            <h3 className="column-title">
              <span>📥 新訂單 / 待處理</span>
            </h3>
            <span className="column-count">{pendingOrders.length}</span>
          </div>

          {pendingOrders.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '40px 0', fontSize: '0.85rem' }}>
              目前沒有新訂單
            </p>
          ) : (
            pendingOrders.map(order => (
              <div 
                key={order.id} 
                className={`staff-order-card ${order.isNew ? 'new-pulse' : ''}`}
              >
                <div className="card-top-row">
                  <div className="order-num-type">
                    <span className="order-num" style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: '800' }}>
                      {order.serialNum || `ORD-${order.id.slice(-6)}`}
                    </span>
                    <span className="order-type-lbl">
                      {order.type === 'dine-in' ? '🍽️ 內用' : '🛍️ 外帶自取'}
                    </span>
                  </div>
                  <span className="time-passed">{getElapsedMinutes(order.timestamp)}</span>
                </div>

                {order.type === 'takeout' && (
                  <div className="customer-detail-box">
                    <strong>取餐人:</strong> {order.customerName} <br />
                    <strong>電話:</strong> {order.customerPhone} &nbsp;
                    {order.phoneVerified ? (
                      <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.75rem' }}>✓ 手機已驗證</span>
                    ) : (
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.75rem' }}>⚠️ 手機未驗證</span>
                    )} <br />
                    <strong>預約時間:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{order.pickupTime}</span>
                  </div>
                )}

                <div className="card-item-list">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="card-item">
                      <div className="card-item-title-row">
                        <span>{item.name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                      {item.specs.length > 0 && (
                        <div className="card-item-options">
                          {item.specs.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {order.remarks && order.type !== 'dine-in' && (
                  <div className="card-order-remarks">
                    備註: {order.remarks}
                  </div>
                )}

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>付款: {order.paymentMethod === 'online' ? '✅ 已線上付款' : '💵 到店付/未付'}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>共 NT$ {order.total}</span>
                </div>

                <div className="card-actions">
                  <button 
                    className="btn-card-primary" 
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                  >
                    開始製作 ➔
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: '8px', flexGrow: 0 }}
                    onClick={() => handleDeleteOrder(order.id)}
                    title="取消訂單"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Column 2: Preparing */}
        <div className="staff-column">
          <div className="column-header">
            <h3 className="column-title">
              <span>🍳 廚房製作中</span>
            </h3>
            <span className="column-count">{preparingOrders.length}</span>
          </div>

          {preparingOrders.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '40px 0', fontSize: '0.85rem' }}>
              沒有正在製作的餐點
            </p>
          ) : (
            preparingOrders.map(order => (
              <div key={order.id} className="staff-order-card">
                <div className="card-top-row">
                  <div className="order-num-type">
                    <span className="order-num" style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: '800' }}>
                      {order.serialNum || `ORD-${order.id.slice(-6)}`}
                    </span>
                    <span className="order-type-lbl">
                      {order.type === 'dine-in' ? '🍽️ 內用' : '🛍️ 外帶自取'}
                    </span>
                  </div>
                  <span className="time-passed">{getElapsedMinutes(order.timestamp)}</span>
                </div>

                {order.type === 'takeout' && (
                  <div className="customer-detail-box">
                    <strong>取餐人:</strong> {order.customerName} &nbsp;
                    {order.phoneVerified ? (
                      <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.75rem' }}>✓ 已驗證</span>
                    ) : (
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.75rem' }}>⚠️ 未驗證</span>
                    )} <br />
                    <strong>預約時間:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{order.pickupTime}</span>
                  </div>
                )}

                <div className="card-item-list">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="card-item">
                      <div className="card-item-title-row">
                        <span>{item.name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                      {item.specs.length > 0 && (
                        <div className="card-item-options">
                          {item.specs.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {order.remarks && order.type !== 'dine-in' && (
                  <div className="card-order-remarks">
                    備註: {order.remarks}
                  </div>
                )}

                <div className="card-actions">
                  <button 
                    className="btn-card-success" 
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                  >
                    製作完成 / 通知取餐 ➔
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Column 3: Ready / Completed */}
        <div className="staff-column">
          <div className="column-header">
            <h3 className="column-title">
              <span>🔔 待取餐 / 已完成</span>
            </h3>
            <span className="column-count">{readyOrders.length}</span>
          </div>

          {readyOrders.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '40px 0', fontSize: '0.85rem' }}>
              沒有等待取餐的訂單
            </p>
          ) : (
            readyOrders.map(order => (
              <div 
                key={order.id} 
                className="staff-order-card"
                style={{ opacity: order.status === 'completed' ? 0.7 : 1 }}
              >
                <div className="card-top-row">
                  <div className="order-num-type">
                    <span className="order-num" style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: '800' }}>
                      {order.serialNum || `ORD-${order.id.slice(-6)}`}
                    </span>
                    <span className="order-type-lbl">
                      {order.type === 'dine-in' ? '🍽️ 內用' : '🛍️ 外帶自取'}
                    </span>
                  </div>
                  <span className="time-passed">{getElapsedMinutes(order.timestamp)}</span>
                </div>

                <div className="customer-detail-box" style={{ backgroundColor: order.status === 'completed' ? 'rgba(0,0,0,0.02)' : 'rgba(34,197,94,0.05)' }}>
                  <strong>狀態:</strong> {order.status === 'completed' ? '✅ 已結案完成' : '📢 等待顧客取餐/已送餐'} <br />
                  {order.type === 'takeout' && (
                    <>
                      <strong>取餐人:</strong> {order.customerName} <br />
                      <strong>手機:</strong> {order.customerPhone} &nbsp;
                      {order.phoneVerified ? (
                        <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.75rem' }}>✓ 已驗證</span>
                      ) : (
                        <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.75rem' }}>⚠️ 未驗證</span>
                      )}
                    </>
                  )}
                </div>

                <div className="card-item-list">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="card-item" key={idx}>
                      <div className="card-item-title-row">
                        <span>{item.name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>付款: {order.paymentStatus === 'paid' ? '✅ 已付款' : '💵 現場未付款'}</span>
                  <strong>NT$ {order.total}</strong>
                </div>

                {order.status !== 'completed' ? (
                  <div className="card-actions">
                    <button 
                      className="btn-card-primary" 
                      style={{ backgroundColor: '#475569' }}
                      onClick={async () => {
                        try {
                          const { error } = await supabase.from('orders').update({
                            status: 'completed',
                            payment_status: 'paid'
                          }).eq('id', order.id);
                          if (error) throw error;
                          fetchOrders();
                        } catch (err) {
                          console.error("Failed to complete order in Supabase:", err);
                          alert("結案失敗，請重試！");
                        }
                      }}
                    >
                      💳 完成結帳與取餐結案
                    </button>
                  </div>
                ) : (
                  <div className="card-status-done">
                    ✓ 訂單已結案
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
