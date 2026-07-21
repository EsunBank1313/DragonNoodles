import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { menuItems as defaultMenuItems } from '../data/menuData';

export default function ManagementView({ onBackToDemo, onLogout }) {
  const [menuItems, setMenuItems] = useState([]);
  const [storeName, setStoreName] = useState('龍城麵線');
  const [newStoreName, setNewStoreName] = useState('');
  const [prodPublished, setProdPublished] = useState(true);
  const [activeTab, setActiveTab] = useState('products'); // 'products' or 'staff'
  
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
        setMenuItems(data.filter(item => 
          item.name !== 'SYSTEM_SETTING_LINE_TOKEN' && 
          item.name !== 'SYSTEM_SETTING_STORE_NAME'
        ));
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

      {/* Store Name Customization Settings Panel */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
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
                // Upsert to Supabase setting row
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
                alert("店名修改成功！所有畫面重新整理後即可同步生效。");
              } catch (e) {
                alert("修改店名失敗：" + e.message);
              }
            }}
            style={{ padding: '6px 12px', fontSize: '0.85rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            儲存店名
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
                    <th style={{ padding: '12px' }}>供應狀態</th>
                    <th style={{ padding: '12px' }}>上下架</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map(item => {
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
                          <span style={{ color: isAvailable ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                            {isAvailable ? '🟢 供應中' : '🔴 已沽清'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: item.customizations?.is_published !== false ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                            {item.customizations?.is_published !== false ? '🟢 已上架' : '🔴 已下架'}
                          </span>
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
                    <input type="checkbox" id="avail-check" checked={prodAvailable} onChange={(e) => setProdAvailable(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    <label htmlFor="avail-check" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>此商品目前正常供應 (可點餐)</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                    <input type="checkbox" id="publish-check" checked={prodPublished} onChange={(e) => setProdPublished(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    <label htmlFor="publish-check" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>上架此商品 (勾選為上架顯示，取消為下架隱藏)</label>
                  </div>
                  
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
    </div>
  );
}
