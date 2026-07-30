import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { menuItems as defaultMenuItems } from '../data/menuData';

export default function ManagementView({ onBackToDemo, onLogout }) {
  const [menuItems, setMenuItems] = useState([]);
  const [storeName, setStoreName] = useState('龍城麵線');
  const [newStoreName, setNewStoreName] = useState('');
  const [adminPin, setAdminPin] = useState('8888');
  const [newAdminPin, setNewAdminPin] = useState('8888');
  const [isClosedToday, setIsClosedToday] = useState(false);
  const [prodPublished, setProdPublished] = useState(true);
  const [receiptConfig, setReceiptConfig] = useState({
    printReceivedAndChange: true,
    printType: true,
    printDateTime: true
  });
  const [menuOrder, setMenuOrder] = useState([]);
  const [globalAddons, setGlobalAddons] = useState([
    { label: '大腸', priceChange: 15 },
    { label: '豬肚', priceChange: 15 },
    { label: '肉羹', priceChange: 15 },
    { label: '花枝羹', priceChange: 15 },
    { label: '貢丸', priceChange: 15 }
  ]);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [tempAddons, setTempAddons] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
  
  // Product edit states
  const [editingItem, setEditingItem] = useState(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodCategory, setProdCategory] = useState('mee-sua');
  const [prodDescription, setProdDescription] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);

  // Staff list states (點名 / roster)
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [editingStaffIndex, setEditingStaffIndex] = useState(null);

  // Load menu items
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
          setNewStoreName(storeNameItem.description);
        } else {
          setNewStoreName('龍城麵線');
        }
        const adminPinItem = data.find(item => item.name === 'SYSTEM_SETTING_ADMIN_PIN');
        if (adminPinItem && adminPinItem.description) {
          setAdminPin(adminPinItem.description);
          setNewAdminPin(adminPinItem.description);
        } else {
          setNewAdminPin('8888');
        }
        
        // Load custom settings
        const orderItem = data.find(item => item.name === 'SYSTEM_SETTING_MENU_ORDER');
        if (orderItem && orderItem.description) {
          try { setMenuOrder(JSON.parse(orderItem.description)); } catch (e) { setMenuOrder([]); }
        } else {
          setMenuOrder([]);
        }
        
        const receiptItem = data.find(item => item.name === 'SYSTEM_SETTING_RECEIPT_CONFIG');
        if (receiptItem && receiptItem.description) {
          try { setReceiptConfig(JSON.parse(receiptItem.description)); } catch (e) {}
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
          try {
            currentAddons = JSON.parse(addonsItem.description);
            setGlobalAddons(currentAddons);
          } catch (e) {}
        } else {
          setGlobalAddons(currentAddons);
        }

        const visibleItems = data.filter(item => 
          !item.name.startsWith('SYSTEM_SETTING_')
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
        setMenuItems(visibleItems);

        // Check if store is closed today
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        supabase.from('orders')
          .select('*')
          .gte('created_at', todayStart.toISOString())
          .eq('table_number', 'CLOSED')
          .then(({ data: closedOrders }) => {
            setIsClosedToday(closedOrders && closedOrders.length > 0);
          });
      }
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  // Load staff list from localStorage
  const fetchStaffList = () => {
    const saved = localStorage.getItem('restaurant_staff_list');
    const defaultStaff = [
      { name: '店長 (Admin)', pin: '6666' },
      { name: '收銀員-小明', pin: '1111' },
      { name: '收銀員-小華', pin: '2222' },
      { name: '收銀員-阿強', pin: '3333' }
    ];
    if (saved) {
      setStaffList(JSON.parse(saved));
    } else {
      setStaffList(defaultStaff);
      localStorage.setItem('restaurant_staff_list', JSON.stringify(defaultStaff));
    }
  };

  useEffect(() => {
    fetchMenuItems();
    fetchStaffList();
  }, []);

  // Sort menu items based on setting
  const sortedMenuItems = [...menuItems].sort((a, b) => {
    const indexA = menuOrder.indexOf(String(a.id));
    const indexB = menuOrder.indexOf(String(b.id));
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const handleMoveItem = async (index, direction) => {
    const currentOrder = sortedMenuItems.map(item => String(item.id));
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;
    
    // Swap
    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[targetIndex];
    currentOrder[targetIndex] = temp;
    
    try {
      const { error } = await supabase.from('menu_items').upsert({
        name: 'SYSTEM_SETTING_MENU_ORDER',
        description: JSON.stringify(currentOrder),
        price: 0,
        category: 'system',
        image: ''
      }, { onConflict: 'name' });
      if (error) throw error;
      setMenuOrder(currentOrder);
      fetchMenuItems();
    } catch (err) {
      alert("儲存排序失敗：" + err.message);
    }
  };

  const handleSizePriceChange = (sizeIndex, value) => {
    const nextVal = parseFloat(value) || 0;
    setEditingItem(prev => {
      if (!prev || !prev.customizations || !prev.customizations.size) return prev;
      const sizeOptions = [...prev.customizations.size.options];
      sizeOptions[sizeIndex] = { ...sizeOptions[sizeIndex], priceChange: nextVal };
      return {
        ...prev,
        customizations: {
          ...prev.customizations,
          size: {
            ...prev.customizations.size,
            options: sizeOptions
          }
        }
      };
    });
  };

  const handleAddonPriceChange = (addonIndex, value) => {
    const nextVal = parseFloat(value) || 0;
    setEditingItem(prev => {
      if (!prev || !prev.customizations || !prev.customizations.addons) return prev;
      const addonOptions = [...prev.customizations.addons.options];
      addonOptions[addonIndex] = { ...addonOptions[addonIndex], priceChange: nextVal };
      return {
        ...prev,
        customizations: {
          ...prev.customizations,
          addons: {
            ...prev.customizations.addons,
            options: addonOptions
          }
        }
      };
    });
  };

  const handleSaveReceiptConfig = async (config) => {
    try {
      const { error } = await supabase.from('menu_items').upsert({
        name: 'SYSTEM_SETTING_RECEIPT_CONFIG',
        description: JSON.stringify(config),
        price: 0,
        category: 'system',
        image: ''
      }, { onConflict: 'name' });
      if (error) throw error;
      setReceiptConfig(config);
      alert("收據配置更新成功！");
    } catch (err) {
      alert("儲存收據配置失敗：" + err.message);
    }
  };

  // Save product details to Supabase
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodName.trim() || !prodPrice) {
      alert("請填寫商品名稱與單價！");
      return;
    }

    const priceNum = parseFloat(prodPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert("請輸入有效的商品單價！");
      return;
    }

    const updatedItem = {
      name: prodName.trim(),
      price: priceNum,
      image: prodImage.trim(),
      category: prodCategory,
      description: prodDescription.trim(),
      customizations: editingItem.customizations ? {
        ...editingItem.customizations,
        is_available: prodAvailable,
        is_published: prodPublished
      } : { is_available: prodAvailable, is_published: prodPublished }
    };

    try {
      if (editingItem === 'new') {
        const { error } = await supabase
          .from('menu_items')
          .insert([updatedItem]);
        if (error) throw error;
        alert("商品新增成功並已發布至雲端！");
      } else {
        const { error } = await supabase
          .from('menu_items')
          .update(updatedItem)
          .eq('id', editingItem.id);
        if (error) throw error;
        alert("商品修改成功並已同步雲端！");
      }
      setEditingItem(null);
      fetchMenuItems();
    } catch (err) {
      alert("儲存商品失敗：" + err.message);
    }
  };

  // Staff (點名) CRUD functions
  const handleSaveStaff = (e) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffPin.trim()) {
      alert("請輸入員工姓名與 4 位數 PIN 碼！");
      return;
    }
    if (newStaffPin.length !== 4 || isNaN(newStaffPin)) {
      alert("PIN 碼必須是 4 位純數字！");
      return;
    }

    let updatedList = [...staffList];
    if (editingStaffIndex !== null) {
      // Edit
      updatedList[editingStaffIndex] = { name: newStaffName.trim(), pin: newStaffPin.trim() };
      setEditingStaffIndex(null);
    } else {
      // Add
      updatedList.push({ name: newStaffName.trim(), pin: newStaffPin.trim() });
    }

    setStaffList(updatedList);
    localStorage.setItem('restaurant_staff_list', JSON.stringify(updatedList));
    setNewStaffName('');
    setNewStaffPin('');
  };

  const handleEditStaffClick = (idx) => {
    const staff = staffList[idx];
    setNewStaffName(staff.name);
    setNewStaffPin(staff.pin);
    setEditingStaffIndex(idx);
  };

  const handleDeleteStaff = (idx) => {
    if (!confirm(`確定要刪除員工「${staffList[idx].name}」的登入資料嗎？`)) return;
    const updatedList = staffList.filter((_, i) => i !== idx);
    setStaffList(updatedList);
    localStorage.setItem('restaurant_staff_list', JSON.stringify(updatedList));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-body)',
      color: 'var(--text-main)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Top Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>🛠️</span>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>{storeName} 後台管理系統</h1>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
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

      {/* Store Customization Settings Panel */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {/* Store Name */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🏪 店名設定:</span>
          <input 
            type="text" 
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}
          />
          <button
            onClick={async () => {
              if (!newStoreName.trim()) return;
              try {
                const { data: exist } = await supabase.from('menu_items').select('*').eq('name', 'SYSTEM_SETTING_STORE_NAME');
                if (exist && exist.length > 0) {
                  await supabase.from('menu_items').update({ description: newStoreName.trim() }).eq('name', 'SYSTEM_SETTING_STORE_NAME');
                } else {
                  await supabase.from('menu_items').insert([{
                    name: 'SYSTEM_SETTING_STORE_NAME',
                    price: 0,
                    category: 'settings',
                    description: newStoreName.trim()
                  }]);
                }
                setStoreName(newStoreName.trim());
                alert("店名修改成功！");
              } catch (e) {
                alert("修改店名失敗：" + e.message);
              }
            }}
            style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            儲存店名
          </button>
        </div>

        {/* Admin Password PIN */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderLeft: '1px solid var(--border)', paddingLeft: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🔑 管理員/公休密碼:</span>
          <input 
            type="text" 
            maxLength="8"
            value={newAdminPin}
            onChange={(e) => setNewAdminPin(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', width: '80px', textAlign: 'center' }}
          />
          <button
            onClick={async () => {
              if (!newAdminPin.trim()) return;
              try {
                const { data: exist } = await supabase.from('menu_items').select('*').eq('name', 'SYSTEM_SETTING_ADMIN_PIN');
                if (exist && exist.length > 0) {
                  await supabase.from('menu_items').update({ description: newAdminPin.trim() }).eq('name', 'SYSTEM_SETTING_ADMIN_PIN');
                } else {
                  await supabase.from('menu_items').insert([{
                    name: 'SYSTEM_SETTING_ADMIN_PIN',
                    price: 0,
                    category: 'settings',
                    description: newAdminPin.trim()
                  }]);
                }
                setAdminPin(newAdminPin.trim());
                alert("管理員/對帳/關店密碼修改成功！");
              } catch (e) {
                alert("修改密碼失敗：" + e.message);
              }
            }}
            style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            儲存密碼
          </button>
        </div>

        {/* Receipt configuration */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', borderLeft: '1px solid var(--border)', paddingLeft: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🖨️ 收據內容:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={!!receiptConfig.printReceivedAndChange}
              onChange={(e) => {
                const next = { ...receiptConfig, printReceivedAndChange: e.target.checked };
                handleSaveReceiptConfig(next);
              }}
            />
            實收與找零
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={!!receiptConfig.printType}
              onChange={(e) => {
                const next = { ...receiptConfig, printType: e.target.checked };
                handleSaveReceiptConfig(next);
              }}
            />
            交易類型
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={!!receiptConfig.printDateTime}
              onChange={(e) => {
                const next = { ...receiptConfig, printDateTime: e.target.checked };
                handleSaveReceiptConfig(next);
              }}
            />
            日期時間
          </label>
        </div>

        {/* Global Addons Toggle */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderLeft: '1px solid var(--border)', paddingLeft: '20px' }}>
          <button
            type="button"
            onClick={() => {
              setTempAddons(globalAddons.map(a => ({ ...a })));
              setShowAddonModal(true);
            }}
            style={{
              padding: '6px 14px', fontSize: '0.85rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
              backgroundColor: 'var(--primary)', color: 'white'
            }}
          >
            ⚙️ 全局加料項目管理
          </button>
        </div>

        {/* Close/Open Toggle */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderLeft: '1px solid var(--border)', paddingLeft: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🚪 營業開關:</span>
          <button
            onClick={async () => {
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              try {
                if (isClosedToday) {
                  await supabase.from('orders').delete().gte('created_at', todayStart.toISOString()).eq('table_number', 'CLOSED');
                  setIsClosedToday(false);
                  alert("營業重啟成功！POS 系統已解除鎖定狀態。");
                } else {
                  await supabase.from('orders').insert([{
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
                  }]);
                  setIsClosedToday(true);
                  alert("今日收店鎖定成功！POS 系統已鎖定。");
                }
              } catch (e) {
                alert("切換營業開關失敗：" + e.message);
              }
            }}
            style={{
              padding: '6px 14px', fontSize: '0.85rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
              backgroundColor: isClosedToday ? '#ef4444' : '#10b981', color: 'white'
            }}
          >
            {isClosedToday ? '🔴 今日已關店 (點選重開)' : '🟢 今日營業中 (點選收店)'}
          </button>
        </div>
      </div>

      {/* Selector Tabs */}
      <div style={{ display: 'flex', padding: '16px 24px', gap: '12px' }}>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '10px 20px', fontSize: '0.9rem', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer',
            backgroundColor: activeTab === 'products' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'products' ? 'white' : 'var(--text-main)'
          }}
        >
          📦 商品與價格管理
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          style={{
            padding: '10px 20px', fontSize: '0.9rem', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer',
            backgroundColor: activeTab === 'staff' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'staff' ? 'white' : 'var(--text-main)'
          }}
        >
          👥 員工與登入管理 (點名)
        </button>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, padding: '0 24px 40px 24px', display: 'flex', flexDirection: 'column' }}>
        
        {activeTab === 'products' ? (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Products List Table */}
            <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  onClick={() => {
                    setEditingItem('new');
                    setProdName('');
                    setProdPrice('');
                    setProdImage('');
                    setProdCategory('mee-sua');
                    setProdDescription('');
                    setProdAvailable(true);
                    setProdPublished(true);
                  }}
                  style={{
                    padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                  }}
                >
                  ＋ 新增商品項目
                </button>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>商品圖片</th>
                    <th style={{ padding: '12px' }}>名稱</th>
                    <th style={{ padding: '12px' }}>單價</th>
                    <th style={{ padding: '12px' }}>類別</th>
                    <th style={{ padding: '12px' }}>上下架</th>
                    <th style={{ padding: '12px' }}>排序</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMenuItems.map((item, idx) => {
                    const isAvailable = item.customizations?.is_available !== false;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <img src={item.image || '/images/plain_mee_sua.jpg'} alt={item.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.name}</td>
                        <td style={{ padding: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>${item.price}</td>
                        <td style={{ padding: '12px' }}>
                          {item.category === 'mee-sua' ? '🍜 麵線/主食' : '🍢 特色小吃'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: item.customizations?.is_published !== false ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                            {item.customizations?.is_published !== false ? '🟢 已上架' : '🔴 已下架'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              type="button"
                              disabled={idx === 0} 
                              onClick={() => handleMoveItem(idx, -1)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                            >
                              ▲
                            </button>
                            <button 
                              type="button"
                              disabled={idx === sortedMenuItems.length - 1} 
                              onClick={() => handleMoveItem(idx, 1)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', cursor: idx === sortedMenuItems.length - 1 ? 'not-allowed' : 'pointer' }}
                            >
                              ▼
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setProdName(item.name);
                              setProdPrice(String(item.price));
                              setProdImage(item.image || '');
                              setProdCategory(item.category);
                              setProdDescription(item.description || '');
                              setProdAvailable(isAvailable);
                              setProdPublished(item.customizations?.is_published !== false);
                            }}
                            style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--primary)', backgroundColor: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            編輯商品
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`確定要刪除商品「${item.name}」嗎？此動作無法復原。`)) {
                                try {
                                  const { error } = await supabase.from('menu_items').delete().eq('id', item.id);
                                  if (error) throw error;
                                  alert("商品刪除成功！");
                                  fetchMenuItems();
                                } catch (e) {
                                  alert("刪除失敗：" + e.message);
                                }
                              }
                            }}
                            style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', marginLeft: '6px' }}
                          >
                            刪除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

            {/* Product Edit Sidepanel Form */}
            {editingItem && (
              <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 'bold' }}>{editingItem === 'new' ? '➕ 新增商品項目' : '✏️ 編輯商品詳情'}</h3>
                <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>商品名稱</label>
                    <input type="text" value={prodName} onChange={(e) => setProdName(e.target.value)} required style={{ padding: '8px', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>單價 (NT$)</label>
                    <input type="number" min="0" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} required style={{ padding: '8px', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>商品圖片網址 (可貼連結或檔名)</label>
                    <input type="text" value={prodImage} onChange={(e) => setProdImage(e.target.value)} style={{ padding: '8px', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>類別</label>
                    <select value={prodCategory} onChange={(e) => setProdCategory(e.target.value)} style={{ padding: '8px', fontSize: '0.85rem' }}>
                      <option value="mee-sua">🍜 招牌麵線系列</option>
                      <option value="specialties">🔥 特色小吃系列</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>描述</label>
                    <textarea rows="3" value={prodDescription} onChange={(e) => setProdDescription(e.target.value)} style={{ padding: '8px', fontSize: '0.85rem' }} />
                  </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                    <input type="checkbox" id="publish-check" checked={prodPublished} onChange={(e) => setProdPublished(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    <label htmlFor="publish-check" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>上架此商品 (勾選為上架顯示，取消為下架隱藏)</label>
                  </div>

                  {/* Customization Prices Editor */}
                  {editingItem && editingItem.customizations && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold' }}>⚙️ 客製選項價錢編輯</h4>
                      
                      {/* Sizes list */}
                      {editingItem.customizations.size && editingItem.customizations.size.options && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>份量加價設定</label>
                          {editingItem.customizations.size.options.map((opt, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '0.8rem' }}>{opt.label}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.8rem' }}>+NT$</span>
                                <input 
                                  type="number" 
                                  value={opt.priceChange} 
                                  onChange={(e) => handleSizePriceChange(idx, e.target.value)}
                                  style={{ width: '60px', padding: '4px', fontSize: '0.8rem' }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}


                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button type="button" onClick={() => setEditingItem(null)} style={{ flex: 1, padding: '8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer' }}>
                      取消
                    </button>
                    <button type="submit" style={{ flex: 1.5, padding: '8px', fontSize: '0.8rem', border: 'none', borderRadius: '4px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                      💾 儲存並同步雲端
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* Staff Management (點名 / roster) */
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Staff list */}
            <div style={{ flex: 1.5, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'left' }}>👥 員工班表與登入 PIN 碼對照表</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>員工姓名/職稱</th>
                    <th style={{ padding: '12px' }}>登入 PIN 碼</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>管理操作</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((staff, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', textAlign: 'left' }}>{staff.name}</td>
                      <td style={{ padding: '12px', letterSpacing: '4px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'left' }}>{staff.pin}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button onClick={() => handleEditStaffClick(idx)} style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: '6px', cursor: 'pointer' }}>
                          修改 PIN 碼
                        </button>
                        {staff.name !== '店長 (Admin)' && (
                          <button onClick={() => handleDeleteStaff(idx)} style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', cursor: 'pointer' }}>
                            刪除員工
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Staff Add/Edit Form */}
            <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'left' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 'bold' }}>
                {editingStaffIndex !== null ? '✏️ 修改員工帳號/PIN' : '➕ 新增員工登入帳號'}
              </h3>
              <form onSubmit={handleSaveStaff} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>員工姓名/稱謂</label>
                  <input type="text" placeholder="例如: 收銀員-阿強" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} required style={{ padding: '8px', fontSize: '0.85rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>登入 PIN 碼 (4 位數數字)</label>
                  <input type="text" pattern="\d*" maxLength={4} placeholder="例如: 3333" value={newStaffPin} onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ''))} required style={{ padding: '8px', fontSize: '0.85rem' }} />
                </div>
                
                <button type="submit" style={{ padding: '8px 16px', fontSize: '0.8rem', border: 'none', borderRadius: '4px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginTop: '6px' }}>
                  {editingStaffIndex !== null ? '💾 儲存修改' : '➕ 儲存並新增'}
                </button>
                {editingStaffIndex !== null && (
                  <button type="button" onClick={() => { setEditingStaffIndex(null); setNewStaffName(''); setNewStaffPin(''); }} style={{ padding: '8px 16px', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer' }}>
                    取消編輯
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

      </div>

      {/* GLOBAL ADDON MANAGEMENT MODAL */}
      {showAddonModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
            border: '1px solid var(--border)', width: '400px', maxWidth: '90%',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>⚙️ 全局加料項目與價格管理</h3>
              <button 
                type="button"
                onClick={() => setShowAddonModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {tempAddons.map((addon, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder="配料名稱 (如: 蚵仔)"
                    value={addon.label}
                    onChange={(e) => {
                      const updated = [...tempAddons];
                      updated[idx].label = e.target.value;
                      setTempAddons(updated);
                    }}
                    style={{ flex: 2, padding: '6px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                    <span style={{ fontSize: '0.8rem' }}>$</span>
                    <input 
                      type="number" 
                      placeholder="價格"
                      value={addon.priceChange}
                      onChange={(e) => {
                        const updated = [...tempAddons];
                        updated[idx].priceChange = parseFloat(e.target.value) || 0;
                        setTempAddons(updated);
                      }}
                      style={{ width: '100%', padding: '6px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAddons(tempAddons.filter((_, i) => i !== idx));
                    }}
                    style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => {
                  setTempAddons([...tempAddons, { label: '', priceChange: 15 }]);
                }}
                style={{ padding: '8px', backgroundColor: 'var(--bg-body)', border: '1px dashed var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', width: '100%', marginTop: '6px', color: 'var(--text-main)' }}
              >
                ＋ 新增加料品項
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAddonModal(false)}
                style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const filtered = tempAddons.filter(a => a.label.trim() !== '');
                  handleSaveGlobalAddons(filtered);
                }}
                style={{ flex: 1.5, padding: '8px', border: 'none', borderRadius: '6px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
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
