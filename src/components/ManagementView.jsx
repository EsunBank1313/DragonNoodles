import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import QRCode from 'qrcode';
import { defaultStoreProfile, defaultReceiptConfig, printViaHiddenIframe } from '../utils/printHelpers';
import { getActiveStoreCode, filterItemsByStore, prefixNameForStore, stripNameForStore, getStoreLinks, syncRegisteredStoresCache, generateRandomStoreToken } from '../utils/storeContext';
import ThemeSelector from './ThemeSelector';
import { menuItems as defaultMenuItems, defaultUpgradeCombos } from '../data/menuData';


// Preset categories and rich icon collection
const PRESET_ICONS = [
  { category: '🍜 主食', icons: ['🍜', '🍲', '🥣', '🥢', '🍛', '🍚', '🍱', '🥟', '🍢', '🥩', '🍗', '🍖', '🥪', '🍔', '🍕', '🍳', '🌮', '🌯'] },
  { category: '🔥 熱門', icons: ['🔥', '⭐', '👑', '🏆', '⚡', '🌶️', '💖', '🌟', '🎯', '🥇', '👍', '💥', '🏮', '✨', '🚩', '🏅'] },
  { category: '🥬 小菜', icons: ['🥬', '🥦', '🥒', '🧄', '🧅', '🍄', '🌽', '🥕', '🥗', '🥚', '🍤', '🦪', '🐟', '🥓', '🥑', '🧀'] },
  { category: '🧋 飲品', icons: ['🧋', '🥤', '🍵', '☕', '🍺', '🧃', '🍧', '🍦', '🍰', '🍮', '🍩', '🍪', '🥂', '🍾'] },
  { category: '🏷️ 標籤', icons: ['🏷️', '🏪', '🍽️', '🛒', '🎁', '📦', '🔔', '📣', '🧾', '💡', '💰', '💯', '📋', '❤️'] }
];

function IconPicker({ value, onChange, placeholder = '圖示' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState(0);

  const handleSelectIcon = (icon, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChange(icon);
    setIsOpen(false);
  };

  const modalContent = isOpen && typeof document !== 'undefined' ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        backdropFilter: 'blur(5px)',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '24px',
          width: '420px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
          textAlign: 'left',
          color: 'var(--text-main)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>🎨</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                選擇商品類別圖示
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>點選預設圖示或直接自訂輸入</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Current Selected & Custom Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '2rem', width: '44px', textAlign: 'center' }}>{value || '🍜'}</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>自訂輸入或貼上 Emoji：</span>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="可直接鍵入/貼上任意圖示..."
              style={{
                padding: '8px 12px',
                fontSize: '1rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontWeight: 'bold'
              }}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {PRESET_ICONS.map((cat, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setSelectedCat(idx);
              }}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                borderRadius: '8px',
                border: selectedCat === idx ? '2px solid var(--primary)' : '1px solid var(--border)',
                backgroundColor: selectedCat === idx ? 'rgba(255, 107, 53, 0.12)' : 'var(--bg-body)',
                color: selectedCat === idx ? 'var(--primary)' : 'var(--text-main)',
                fontWeight: selectedCat === idx ? 'bold' : 'normal',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              {cat.category}
            </button>
          ))}
        </div>

        {/* Large Emojis Grid (Full view, spacious, no clipping) */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '8px',
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '6px 2px',
            borderRadius: '8px'
          }}
        >
          {PRESET_ICONS[selectedCat].icons.map((icon, iIdx) => (
            <button
              key={iIdx}
              type="button"
              onClick={(e) => handleSelectIcon(icon, e)}
              style={{
                fontSize: '1.6rem',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: value === icon ? '2px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: '10px',
                backgroundColor: value === icon ? 'rgba(255, 107, 53, 0.18)' : 'var(--bg-body)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: value === icon ? '0 2px 8px rgba(255, 107, 53, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = value === icon ? 'rgba(255, 107, 53, 0.18)' : 'var(--bg-body)';
              }}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Bottom Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '2px' }}>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              padding: '8px 22px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            ✓ 確定選定
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Unified Single Input Box + Palette Trigger Button (Fixed Width, Flex-Safe) */}
      <div 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1.5px solid var(--border)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-body)',
          overflow: 'hidden',
          height: '38px',
          width: '76px',
          minWidth: '76px',
          maxWidth: '76px',
          flexShrink: 0,
          boxShadow: 'var(--shadow-sm)',
          boxSizing: 'border-box'
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '44px',
            minWidth: '44px',
            height: '100%',
            fontSize: '1.25rem',
            textAlign: 'center',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-main)',
            cursor: 'text',
            padding: 0,
            lineHeight: '38px'
          }}
          title="可在此直接輸入或貼上任何自訂圖示"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
          style={{
            width: '32px',
            minWidth: '32px',
            height: '100%',
            padding: 0,
            border: 'none',
            borderLeft: '1px solid var(--border)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="點擊開啟獨立圖示選擇面板"
        >
          🎨
        </button>
      </div>

      {modalContent}
    </>
  );
}
export default function ManagementView({ storeCode: propStoreCode, onSwitchStore, onBackToDemo, onLogout }) {
  const storeCode = propStoreCode || getActiveStoreCode();
  const isMasterAdmin = (storeCode === 'dragon') || (typeof window !== 'undefined' && sessionStorage.getItem('is_master_admin_session') === 'true');
  
  // SaaS Multi-Store States
  const [registeredStores, setRegisteredStores] = useState([
    { code: 'dragon', name: '龍城麵線', isDefault: true, createdAt: '2026-01-01' }
  ]);
  const [showNewStoreModal, setShowNewStoreModal] = useState(false);
  const [newClientStoreName, setNewClientStoreName] = useState('');
  const [newClientStoreCode, setNewClientStoreCode] = useState('');
  const [newClientStaffToken, setNewClientStaffToken] = useState('');
  const [newClientAdminPin, setNewClientAdminPin] = useState('8888');
  const [newClientTemplate, setNewClientTemplate] = useState('noodle');
  const [createdStoreLinks, setCreatedStoreLinks] = useState(null);

  // Edit Existing Store States
  const [editingStore, setEditingStore] = useState(null);
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreCode, setEditStoreCode] = useState('');
  const [editStaffToken, setEditStaffToken] = useState('');
  const [editAdminPin, setEditAdminPin] = useState('8888');
  const [menuItems, setMenuItems] = useState([]);
  const [storeProfile, setStoreProfile] = useState(defaultStoreProfile);
  const [storeName, setStoreName] = useState('龍城麵線');
  const [newStoreName, setNewStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [newStorePhone, setNewStorePhone] = useState('');
  const [storeTaxId, setStoreTaxId] = useState('');
  const [newStoreTaxId, setNewStoreTaxId] = useState('');
  const [storeWifi, setStoreWifi] = useState('');
  const [newStoreWifi, setNewStoreWifi] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('謝謝惠顧，歡迎再度光臨！');
  const [newReceiptFooter, setNewReceiptFooter] = useState('謝謝惠顧，歡迎再度光臨！');
  
  // Customer Online Ordering Hero & Slogan Customization
  const [storeSlogan, setStoreSlogan] = useState('傳統柴魚高湯・手工紅麵線・地獄麻辣挑戰');
  const [newStoreSlogan, setNewStoreSlogan] = useState('傳統柴魚高湯・手工紅麵線・地獄麻辣挑戰');
  const [heroTag, setHeroTag] = useState('🔥 熱門推薦');
  const [newHeroTag, setNewHeroTag] = useState('🔥 熱門推薦');
  const [heroTitle, setHeroTitle] = useState('招牌綜合麵線配特製辣泡菜');
  const [newHeroTitle, setNewHeroTitle] = useState('招牌綜合麵線配特製辣泡菜');
  const [heroDesc, setHeroDesc] = useState('在地飄香的好味道！獨家配方柴魚高湯，搭配豐富滿載的配料與手作開胃辣泡菜，讓您一吃就愛上！');
  const [newHeroDesc, setNewHeroDesc] = useState('在地飄香的好味道！獨家配方柴魚高湯，搭配豐富滿載的配料與手作開胃辣泡菜，讓您一吃就愛上！');
  const [showHeroBanner, setShowHeroBanner] = useState(true);

  const [paymentMethods, setPaymentMethods] = useState({
    counter: { enabled: true, name: '店內結帳 (到店付款)', desc: '取餐時於櫃檯付款，支援現金與TWQR共同支付' },
    online: { enabled: true, name: '線上刷卡', desc: '下單即完成付款' }
  });
  const [adminPin, setAdminPin] = useState('8888');
  const [newAdminPin, setNewAdminPin] = useState('8888');
  const [showAdminPinText, setShowAdminPinText] = useState(true);
  const [isClosedToday, setIsClosedToday] = useState(false);
  const [prodPublished, setProdPublished] = useState(true);
  const [receiptConfig, setReceiptConfig] = useState(defaultReceiptConfig);

  // QR Code Generator States
  const [tableCount, setTableCount] = useState(12);
  const [customTableNames, setCustomTableNames] = useState('');
  const [qrBaseUrl, setQrBaseUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      const base = window.location.origin + window.location.pathname;
      return storeCode && storeCode !== 'dragon' ? `${base}?store=${storeCode}` : base;
    }
    return 'https://dragon.twabc.com/';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const base = window.location.origin + window.location.pathname;
      setQrBaseUrl(storeCode && storeCode !== 'dragon' ? `${base}?store=${storeCode}` : base);
    }
  }, [storeCode]);
  const [generatedQrs, setGeneratedQrs] = useState([]);
  const [isGeneratingQrs, setIsGeneratingQrs] = useState(false);
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
  
  const [upgradeCombos, setUpgradeCombos] = useState(defaultUpgradeCombos);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [tempUpgradeCombos, setTempUpgradeCombos] = useState(() => JSON.parse(JSON.stringify(defaultUpgradeCombos)));
  const [canUpgradeCombo, setCanUpgradeCombo] = useState(true);

  const [globalCondiments, setGlobalCondiments] = useState([
    { name: '香菜', choices: ['正常', '多一點', '不要香菜'], default: '正常' },
    { name: '蒜末', choices: ['正常', '多一點', '不要蒜頭'], default: '正常' },
    { name: '烏醋', choices: ['正常', '多一點', '不要烏醋'], default: '正常' },
    { name: '辣醬', choices: ['不辣', '微辣', '中辣', '大辣'], default: '不辣' }
  ]);
  const [tempCondiments, setTempCondiments] = useState([]);
  const [showCondimentModal, setShowCondimentModal] = useState(false);
  
  const [productCategories, setProductCategories] = useState([
    { id: 'mee-sua', name: '招牌麵線', icon: '🍜' },
    { id: 'specialties', name: '特色產品', icon: '🔥' }
  ]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('🍜');
const [closedDates, setClosedDates] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('restaurant_closed_dates') || '[]');
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState('products');
  
  // Product edit states
  const [editingItem, setEditingItem] = useState(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCost, setProdCost] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodCategory, setProdCategory] = useState('mee-sua');
  const [prodDescription, setProdDescription] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);
  const [hasSizeVariants, setHasSizeVariants] = useState(false);
  const [prodSizes, setProdSizes] = useState([
    { label: '小碗', priceChange: 0 },
    { label: '大碗', priceChange: 15 }
  ]);
  // Staff list states (點名 / roster)
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [editingStaffIndex, setEditingStaffIndex] = useState(null);

  // Blacklist states
  const [blacklist, setBlacklist] = useState([]);
  const [newBlacklistPhone, setNewBlacklistPhone] = useState('');
  const [newBlacklistReason, setNewBlacklistReason] = useState('');
  const [posDefaultOrderType, setPosDefaultOrderType] = useState('dine-in');
  const [posPaymentMethods, setPosPaymentMethods] = useState(['現金', '信用卡', 'LINE Pay']);
  const [newPosPaymentMethod, setNewPosPaymentMethod] = useState('');

  // Load menu items
  // Generate QR Codes for Tables
  const generateTableQrs = async () => {
    setIsGeneratingQrs(true);
    try {
      let tables = [];
      if (customTableNames.trim()) {
        tables = customTableNames.split(/[,，\n]/).map(t => t.trim()).filter(Boolean);
      } else {
        const count = Math.max(1, Math.min(50, parseInt(tableCount, 10) || 12));
        for (let i = 1; i <= count; i++) {
          tables.push(String(i));
        }
      }

      const results = [];

      for (const table of tables) {
        let targetUrl;
        try {
          const urlObj = new URL(qrBaseUrl.startsWith('http') ? qrBaseUrl : `${window.location.origin}${qrBaseUrl}`);
          if (storeCode && storeCode !== 'dragon') {
            urlObj.searchParams.set('store', storeCode);
          }
          urlObj.searchParams.set('table', table);
          targetUrl = urlObj.toString();
        } catch (e) {
          const cleanBase = qrBaseUrl.replace(/\?.*$/, '');
          targetUrl = storeCode && storeCode !== 'dragon' 
            ? `${cleanBase}?store=${encodeURIComponent(storeCode)}&table=${encodeURIComponent(table)}`
            : `${cleanBase}?table=${encodeURIComponent(table)}`;
        }

        const qrDataUrl = await QRCode.toDataURL(targetUrl, {
          width: 350,
          margin: 1,
          color: {
            dark: '#1e293b',
            light: '#ffffff'
          }
        });
        results.push({
          tableName: table,
          url: targetUrl,
          qrDataUrl
        });
      }
      setGeneratedQrs(results);
    } catch (err) {
      console.error("Failed to generate QR codes:", err);
    } finally {
      setIsGeneratingQrs(false);
    }
  };

  useEffect(() => {
    generateTableQrs();
  }, [tableCount, customTableNames, qrBaseUrl]);

  // Batch Print Table QR Code Cards
  const handlePrintAllQrCodes = () => {
    if (generatedQrs.length === 0) return;
    // Use silent iframe printing to avoid popup blocker completely

    const currentStore = newStoreName.trim() || storeName || '龍城麵線';

    const html = `
      <html>
        <head>
          <title>${currentStore} - 內用桌號點餐立牌</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 0;
              color: #1e293b;
              background-color: #fff;
            }
            .grid-container {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15mm;
            }
            .qr-card {
              border: 2px dashed #94a3b8;
              border-radius: 16px;
              padding: 16px;
              text-align: center;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justifyContent: center;
              box-sizing: border-box;
              height: 120mm;
              background: #fff;
            }
            .store-title {
              font-size: 18px;
              font-weight: 900;
              color: #ea580c;
              margin-bottom: 4px;
            }
            .table-badge {
              font-size: 26px;
              font-weight: 900;
              background: #1e293b;
              color: #fff;
              padding: 6px 24px;
              border-radius: 30px;
              margin: 6px 0 10px 0;
            }
            .qr-img {
              width: 170px;
              height: 170px;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 4px;
            }
            .instructions {
              font-size: 13px;
              font-weight: bold;
              color: #334155;
              margin-top: 8px;
            }
            .sub-desc {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body onload="window.print();">
          <div class="grid-container">
            ${generatedQrs.map(item => `
              <div class="qr-card">
                <div class="store-title">${currentStore}</div>
                <div class="table-badge">【 ${item.tableName} 號桌 】</div>
                <img src="${item.qrDataUrl}" class="qr-img" alt="QR Code" />
                <div class="instructions">📱 手機掃碼．免排隊入座即點</div>
                <div class="sub-desc">掃描上方 QR Code 即可進入專屬點餐頁面</div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `;

    printViaHiddenIframe(html);
  };

  // Save edited store basic info
  const handleSaveEditedStore = async (e) => {
    e.preventDefault();
    if (!editingStore) return;
    const cleanName = editStoreName.trim();
    const cleanCode = editStoreCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanToken = editStaffToken.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const pin = editAdminPin.trim() || '8888';

    if (!cleanName || !cleanCode || !cleanToken) {
      alert("請填寫完整的門市名稱、公開代碼與內部安全金鑰！");
      return;
    }

    try {
      const oldCode = editingStore.code;
      const updatedList = registeredStores.map(st => {
        if (st.code === oldCode) {
          return {
            ...st,
            name: cleanName,
            code: cleanCode,
            staffToken: cleanToken,
            adminPin: pin
          };
        }
        return st;
      });

      // 1. Update SYSTEM_SETTING_REGISTERED_STORES
      await supabase.from('menu_items').update({ description: JSON.stringify(updatedList) }).eq('name', 'SYSTEM_SETTING_REGISTERED_STORES');

      // 2. Update store name, staff token, and admin pin for this store in cloud
      const nameKey = prefixNameForStore('SYSTEM_SETTING_STORE_NAME', cleanCode);
      const tokenKey = prefixNameForStore('SYSTEM_SETTING_STORE_STAFF_TOKEN', cleanCode);
      const pinKey = prefixNameForStore('SYSTEM_SETTING_ADMIN_PIN', cleanCode);

      await supabase.from('menu_items').upsert([
        { name: nameKey, price: 0, category: 'settings', description: cleanName },
        { name: tokenKey, price: 0, category: 'settings', description: cleanToken },
        { name: pinKey, price: 0, category: 'settings', description: pin }
      ], { onConflict: 'name' });

      setRegisteredStores(updatedList);
      syncRegisteredStoresCache(updatedList);
      setEditingStore(null);
      alert("🎉 門市【" + cleanName + "】資料已成功儲存並同步雲端！");
    } catch (err) {
      console.error("Failed to save edited store:", err);
      alert("儲存門市資料失敗：" + err.message);
    }
  };

  // Delete registered store
  const handleDeleteStore = async (storeToDelete) => {
    if (!storeToDelete || storeToDelete.code === 'dragon') {
      alert("預設龍城總店不可刪除！");
      return;
    }
    if (!confirm(`⚠️ 確定要從門市列表中移除【${storeToDelete.name}】嗎？移除後該門市的系統連結將無法再被索引。${'\n\n'}請確認是否繼續？`)) {
      return;
    }

    try {
      const updatedList = registeredStores.filter(st => st.code !== storeToDelete.code);
      await supabase.from('menu_items').update({ description: JSON.stringify(updatedList) }).eq('name', 'SYSTEM_SETTING_REGISTERED_STORES');
      setRegisteredStores(updatedList);
      syncRegisteredStoresCache(updatedList);
      alert(`已成功移除【${storeToDelete.name}】！`);
    } catch (err) {
      alert("移除門市失敗：" + err.message);
    }
  };

  // Load registered stores list from cloud
  const fetchRegisteredStores = async () => {
    try {
      const { data } = await supabase.from('menu_items').select('*').eq('name', 'SYSTEM_SETTING_REGISTERED_STORES');
      if (data && data.length > 0 && data[0].description) {
        const parsed = JSON.parse(data[0].description);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRegisteredStores(parsed);
          syncRegisteredStoresCache(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch registered stores:", e);
    }
  };

  // Create New Tenant Store Handler
  const handleCreateNewTenantStore = async (e) => {
    e.preventDefault();
    const rawCode = newClientStoreCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanName = newClientStoreName.trim();
    if (!rawCode || !cleanName) {
      alert("請填寫完整的門市名稱與門市代碼 (僅支援英文數字)！");
      return;
    }
    if (rawCode === 'dragon') {
      alert("門市代碼不能為預設 dragon，請使用其他代碼！");
      return;
    }
    if (registeredStores.some(s => s.code === rawCode)) {
      alert("門市代碼「" + rawCode + "」已存在，請使用其他代碼！");
      return;
    }

    try {
      const pin = newClientAdminPin.trim() || '8888';
      const prefix = "[" + rawCode + "] ";

      // 1. Initial Categories
      let initialCategories = [
        { id: 'main', name: '人氣主餐', icon: '🍲' },
        { id: 'side', name: '精選小吃', icon: '🍢' },
        { id: 'drink', name: '冷熱飲品', icon: '🥤' }
      ];

      // 2. Initial Sample Menu based on template
      let initialItems = [];
      if (newClientTemplate === 'noodle') {
        initialCategories = [
          { id: 'mee-sua', name: '招牌麵線', icon: '🍜' },
          { id: 'specialties', name: '精選推薦', icon: '🔥' }
        ];
        initialItems = [
          { name: prefix + "綜合麵線", price: 70, category: 'mee-sua', description: '招牌大腸、肉羹、貢丸雙料', customizations: { is_available: true, is_published: true, cost_price: 25 } },
          { name: prefix + "大腸麵線", price: 65, category: 'mee-sua', description: '獨家滷汁滷透大腸', customizations: { is_available: true, is_published: true, cost_price: 22 } },
          { name: prefix + "清麵線", price: 40, category: 'mee-sua', description: '純高湯熬煮手工紅麵線', customizations: { is_available: true, is_published: true, cost_price: 11 } },
          { name: prefix + "特製小菜", price: 35, category: 'specialties', description: '店內主廚精選小菜', customizations: { is_available: true, is_published: true, cost_price: 12 } },
          { name: prefix + "清涼冷飲", price: 30, category: 'specialties', description: '古早味手工熬煮飲品', customizations: { is_available: true, is_published: true, cost_price: 8 } }
        ];
      } else if (newClientTemplate === 'general') {
        initialItems = [
          { name: prefix + "招牌排骨飯", price: 110, category: 'main', description: '金黃酥脆厚切排骨', customizations: { is_available: true, is_published: true, cost_price: 45 } },
          { name: prefix + "經典魯肉飯", price: 45, category: 'main', description: '肥瘦黃金比例香醇濃郁', customizations: { is_available: true, is_published: true, cost_price: 15 } },
          { name: prefix + "燙季節時蔬", price: 40, category: 'side', description: '每日產地直送時令青菜', customizations: { is_available: true, is_published: true, cost_price: 12 } },
          { name: prefix + "特選貢丸湯", price: 35, category: 'side', description: '手工爆汁彈牙貢丸', customizations: { is_available: true, is_published: true, cost_price: 10 } },
          { name: prefix + "冬瓜檸檬飲", price: 35, category: 'drink', description: '古法熬煮檸檬冬瓜', customizations: { is_available: true, is_published: true, cost_price: 8 } }
        ];
      }

      // 3. Batch insert settings and items
      const settingsToInsert = [
        { name: prefix + "SYSTEM_SETTING_STORE_NAME", price: 0, category: 'settings', description: cleanName },
        { name: prefix + "SYSTEM_SETTING_STORE_PROFILE", price: 0, category: 'settings', description: JSON.stringify({ storeName: cleanName, storeTaxId: '', storePhone: '', storeAddress: '', storeWifi: '', receiptFooter: '謝謝惠顧，歡迎再度光臨！' }) },
        { name: prefix + "SYSTEM_SETTING_ADMIN_PIN", price: 0, category: 'settings', description: pin },
        { name: prefix + "SYSTEM_SETTING_PRODUCT_CATEGORIES", price: 0, category: 'settings', description: JSON.stringify(initialCategories) },
        { name: prefix + "SYSTEM_SETTING_PAYMENT_METHODS", price: 0, category: 'settings', description: JSON.stringify({ counter: { enabled: true, name: '店內結帳 (到店付款)', desc: '取餐時於櫃檯付款' }, online: { enabled: true, name: '線上刷卡', desc: '下單即完成付款' } }) },
        { name: prefix + "SYSTEM_SETTING_RECEIPT_CONFIG", price: 0, category: 'system', description: JSON.stringify(defaultReceiptConfig) },
        { name: prefix + "SYSTEM_SETTING_POS_DEFAULT_ORDER_TYPE", price: 0, category: 'settings', description: 'dine-in' },
        { name: prefix + "SYSTEM_SETTING_POS_PAYMENT_METHODS", price: 0, category: 'settings', description: JSON.stringify(['現金', '信用卡', 'LINE Pay']) },
        { name: prefix + "SYSTEM_SETTING_STAFF_LIST", price: 0, category: 'settings', description: JSON.stringify([
          { name: '店長 (Admin)', pin: pin },
          { name: '收銀員-小明', pin: '1111' },
          { name: '收銀員-小華', pin: '2222' }
        ]) },
        { name: prefix + "SYSTEM_SETTING_STORE_HERO", price: 0, category: 'settings', description: JSON.stringify({
          storeSlogan: '在地飄香・精選特製・歡迎蒞臨品嚐',
          heroTag: '🔥 熱門推薦',
          heroTitle: `${name} 招牌推薦`,
          heroDesc: '嚴選新鮮食材，傳承經典美味，給您最實在的好滋味！',
          showHeroBanner: true
        }) },
        { name: prefix + "SYSTEM_SETTING_VENDORS_V2", price: 0, category: 'settings', description: '[]' },
        { name: prefix + "SYSTEM_SETTING_INVENTORY", price: 0, category: 'settings', description: '[]' },
        { name: prefix + "SYSTEM_SETTING_INVENTORY_LOGS", price: 0, category: 'settings', description: '[]' },
        { name: prefix + "SYSTEM_SETTING_CONDIMENTS_AVAILABILITY", price: 0, category: 'settings', description: '{}' },
        { name: prefix + "SYSTEM_SETTING_CLOSED_DATES", price: 0, category: 'settings', description: '[]' },
        { name: prefix + "SYSTEM_SETTING_PROCESSED_ORDERS", price: 0, category: 'settings', description: '[]' },
        ...initialItems
      ];

      for (const row of settingsToInsert) {
        const { data: exist } = await supabase.from('menu_items').select('*').eq('name', row.name);
        if (exist && exist.length > 0) {
          await supabase.from('menu_items').update(row).eq('name', row.name);
        } else {
          await supabase.from('menu_items').insert([row]);
        }
      }

      // 4. Use specified or auto-generated Secret Staff Token for this new store!
      const randomStaffToken = (newClientStaffToken.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || generateRandomStoreToken(rawCode));

      // Save secret staff token row
      const tokenRow = {
        name: prefix + "SYSTEM_SETTING_STORE_STAFF_TOKEN",
        price: 0,
        category: 'settings',
        description: randomStaffToken
      };
      await supabase.from('menu_items').upsert([tokenRow], { onConflict: 'name' });

      // Update registered stores list in cloud
      const newStoreEntry = {
        code: rawCode,
        name: cleanName,
        adminPin: pin,
        staffToken: randomStaffToken,
        createdAt: new Date().toISOString().slice(0, 10)
      };
      const updatedList = [...registeredStores.filter(s => s.code !== rawCode), newStoreEntry];
      syncRegisteredStoresCache(updatedList);
      
      const { data: existList } = await supabase.from('menu_items').select('*').eq('name', 'SYSTEM_SETTING_REGISTERED_STORES');
      if (existList && existList.length > 0) {
        await supabase.from('menu_items').update({ description: JSON.stringify(updatedList) }).eq('name', 'SYSTEM_SETTING_REGISTERED_STORES');
      } else {
        await supabase.from('menu_items').insert([{ name: 'SYSTEM_SETTING_REGISTERED_STORES', price: 0, category: 'settings', description: JSON.stringify(updatedList) }]);
      }

      setRegisteredStores(updatedList);
      const links = getStoreLinks(rawCode);
      setCreatedStoreLinks({ ...links, name: cleanName, code: rawCode, pin });
      setShowNewStoreModal(false);
      setNewClientStoreName('');
      setNewClientStoreCode('');
      setNewClientStaffToken('');
      setNewClientAdminPin('8888');

      alert("🎉 恭喜！新客戶門市【" + cleanName + "】已在 1 秒內開通成功！");
    } catch (err) {
      console.error("Failed to create new tenant store:", err);
      alert("開通新門市失敗：" + err.message);
    }
  };

  const fetchMenuItems = async () => {
    try {
      fetchRegisteredStores();
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      if (data) {
        const storeItems = filterItemsByStore(data, storeCode);

        // Load store profile
        const profileItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_PROFILE');
        if (profileItem && profileItem.description) {
          try {
            const p = JSON.parse(profileItem.description);
            setStoreProfile(p);
            if (p.storeName) {
              setStoreName(p.storeName);
              setNewStoreName(p.storeName);
            }
            if (p.storeTaxId) {
              setStoreTaxId(p.storeTaxId);
              setNewStoreTaxId(p.storeTaxId);
            }
            if (p.storePhone) {
              setStorePhone(p.storePhone);
              setNewStorePhone(p.storePhone);
            }
            if (p.storeAddress) {
              setStoreAddress(p.storeAddress);
              setNewStoreAddress(p.storeAddress);
            }
            if (p.storeWifi) {
              setStoreWifi(p.storeWifi);
              setNewStoreWifi(p.storeWifi);
            }
            if (p.receiptFooter) {
              setReceiptFooter(p.receiptFooter);
              setNewReceiptFooter(p.receiptFooter);
            }
            if (p.storeSlogan) {
              setStoreSlogan(p.storeSlogan);
              setNewStoreSlogan(p.storeSlogan);
            }
            if (p.heroTag) {
              setHeroTag(p.heroTag);
              setNewHeroTag(p.heroTag);
            }
            if (p.heroTitle) {
              setHeroTitle(p.heroTitle);
              setNewHeroTitle(p.heroTitle);
            }
            if (p.heroDesc) {
              setHeroDesc(p.heroDesc);
              setNewHeroDesc(p.heroDesc);
            }
            if (p.showHeroBanner !== undefined) {
              setShowHeroBanner(p.showHeroBanner);
            }
          } catch (e) {}
        }

        const heroItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_HERO');
        if (heroItem && heroItem.description) {
          try {
            const h = JSON.parse(heroItem.description);
            if (h.storeSlogan) { setStoreSlogan(h.storeSlogan); setNewStoreSlogan(h.storeSlogan); }
            if (h.heroTag) { setHeroTag(h.heroTag); setNewHeroTag(h.heroTag); }
            if (h.heroTitle) { setHeroTitle(h.heroTitle); setNewHeroTitle(h.heroTitle); }
            if (h.heroDesc) { setHeroDesc(h.heroDesc); setNewHeroDesc(h.heroDesc); }
            if (h.showHeroBanner !== undefined) setShowHeroBanner(h.showHeroBanner);
          } catch (e) {}
        }

        const storeNameItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_NAME');
        if (storeNameItem && storeNameItem.description) {
          setStoreName(storeNameItem.description);
          setNewStoreName(storeNameItem.description);
        } else if (!profileItem) {
          setNewStoreName(storeCode === 'dragon' ? '龍城麵線' : `門市 [${storeCode}]`);
        }

        const adminPinItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_ADMIN_PIN');
        if (adminPinItem && adminPinItem.description) {
          setAdminPin(adminPinItem.description);
          setNewAdminPin(adminPinItem.description);
        } else {
          setNewAdminPin('8888');
        }

        const storeAddrItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_ADDRESS');
        if (storeAddrItem && storeAddrItem.description) {
          setStoreAddress(storeAddrItem.description);
          setNewStoreAddress(storeAddrItem.description);
        }

        const storePhoneItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_PHONE');
        if (storePhoneItem && storePhoneItem.description) {
          setStorePhone(storePhoneItem.description);
          setNewStorePhone(storePhoneItem.description);
        }

        const storeTaxIdItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_TAX_ID');
        if (storeTaxIdItem && storeTaxIdItem.description) {
          setStoreTaxId(storeTaxIdItem.description);
          setNewStoreTaxId(storeTaxIdItem.description);
        }

        const storeWifiItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STORE_WIFI');
        if (storeWifiItem && storeWifiItem.description) {
          setStoreWifi(storeWifiItem.description);
          setNewStoreWifi(storeWifiItem.description);
        }

        const receiptFooterItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_RECEIPT_FOOTER');
        if (receiptFooterItem && receiptFooterItem.description) {
          setReceiptFooter(receiptFooterItem.description);
          setNewReceiptFooter(receiptFooterItem.description);
        }

        const posOrderTypeItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_POS_DEFAULT_ORDER_TYPE');
        if (posOrderTypeItem && posOrderTypeItem.description) {
          setPosDefaultOrderType(posOrderTypeItem.description);
        }

        const posPaymentsItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_POS_PAYMENT_METHODS');
        if (posPaymentsItem && posPaymentsItem.description) {
          try {
            setPosPaymentMethods(JSON.parse(posPaymentsItem.description));
          } catch (e) {
            setPosPaymentMethods(['現金', '信用卡', 'LINE Pay']);
          }
        }

        const paymentItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_PAYMENT_METHODS');
        if (paymentItem && paymentItem.description) {
          try {
            setPaymentMethods(JSON.parse(paymentItem.description));
          } catch (e) {
            console.error("Failed to parse payment settings in management:", e);
          }
        }
        
        // Load custom settings
        const orderItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_MENU_ORDER');
        if (orderItem && orderItem.description) {
          try { setMenuOrder(JSON.parse(orderItem.description)); } catch (e) { setMenuOrder([]); }
        } else {
          setMenuOrder([]);
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
          try {
            currentAddons = JSON.parse(addonsItem.description);
            setGlobalAddons(currentAddons);
          } catch (e) {}
        } else {
          setGlobalAddons(currentAddons);
        }

        const condimentsItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_GLOBAL_CONDIMENTS');
        let currentCondiments = [
          { name: '香菜', choices: ['正常', '多一點', '不要香菜'], default: '正常' },
          { name: '蒜末', choices: ['正常', '多一點', '不要蒜頭'], default: '正常' },
          { name: '烏醋', choices: ['正常', '多一點', '不要烏醋'], default: '正常' },
          { name: '辣醬', choices: ['不辣', '微辣', '中辣', '大辣'], default: '不辣' }
        ];
        if (condimentsItem && condimentsItem.description) {
          try {
            currentCondiments = JSON.parse(condimentsItem.description);
            setGlobalCondiments(currentCondiments);
          } catch (e) {}
        } else {
          setGlobalCondiments(currentCondiments);
        }

        const visibleItems = storeItems.filter(item => 
          !item.name.startsWith('SYSTEM_SETTING_')
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
        setMenuItems(visibleItems);

        
        // Load upgrade combos setting
        const upgradeCombosItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_UPGRADE_COMBOS');
        if (upgradeCombosItem && upgradeCombosItem.description) {
          try {
            const parsed = JSON.parse(upgradeCombosItem.description);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setUpgradeCombos(parsed);
              setTempUpgradeCombos(parsed);
            }
          } catch (e) {
            console.error("Failed to parse upgrade combos in management:", e);
          }
        }

        // Load categories setting
        const categoriesItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_PRODUCT_CATEGORIES');
        if (categoriesItem && categoriesItem.description) {
          try {
            setProductCategories(JSON.parse(categoriesItem.description));
          } catch (e) {}
        }

        // Load blacklist setting
        const blacklistItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_BLACKLIST');
        if (blacklistItem && blacklistItem.description) {
          try {
            setBlacklist(JSON.parse(blacklistItem.description));
          } catch (e) {
            console.error("Failed to parse blacklist in management:", e);
          }
        }

        // Load staff list setting
        const staffListItem = storeItems.find(item => item.name === 'SYSTEM_SETTING_STAFF_LIST');
        if (staffListItem && staffListItem.description) {
          try {
            setStaffList(JSON.parse(staffListItem.description));
            localStorage.setItem('restaurant_staff_list', staffListItem.description);
          } catch (e) {
            console.error("Failed to parse staff list in management:", e);
          }
        }
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

        // Sync closedDates from cloud
        supabase.from('orders')
          .select('created_at, items')
          .then(({ data: ordersData }) => {
            if (ordersData) {
              const cloudDates = ordersData
                .filter(o => {
                  const itemsData = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
                  return itemsData?.customerName === 'SYSTEM_STORE_CLOSE';
                })
                .map(o => new Date(o.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }));
              setClosedDates(cloudDates);
              localStorage.setItem('restaurant_closed_dates', JSON.stringify(cloudDates));
            }
          });
      }
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  
  const handleSaveGlobalCategories = async (newCats) => {
    try {
      const catKey = prefixNameForStore('SYSTEM_SETTING_PRODUCT_CATEGORIES', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', catKey);
      if (exist && exist.length > 0) {
        await supabase.from('menu_items').update({ description: JSON.stringify(newCats) }).eq('name', catKey);
      } else {
        await supabase.from('menu_items').insert([{ name: catKey, price: 0, category: 'settings', description: JSON.stringify(newCats) }]);
      }
      setProductCategories(newCats);
      alert("類別設定已儲存！");
    } catch (e) {
      alert("儲存類別失敗：" + e.message);
    }
  };

  const handleSaveBlacklist = async (newBlacklist) => {
    try {
      const blKey = prefixNameForStore('SYSTEM_SETTING_BLACKLIST', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', blKey);
      if (exist && exist.length > 0) {
        await supabase.from('menu_items').update({ description: JSON.stringify(newBlacklist) }).eq('name', blKey);
      } else {
        await supabase.from('menu_items').insert([{ name: blKey, price: 0, category: 'settings', description: JSON.stringify(newBlacklist) }]);
      }
      setBlacklist(newBlacklist);
    } catch (e) {
      console.error("Failed to save blacklist:", e);
      alert("儲存黑名單失敗：" + e.message);
    }
  };

  const handleAddBlacklist = () => {
    const phone = newBlacklistPhone.trim();
    if (!phone) return alert("請輸入電話號碼！");
    if (blacklist.some(b => b.phone === phone)) {
      return alert("此電話號碼已在黑名單中！");
    }
    const reason = newBlacklistReason.trim() || '未填寫原因';
    const updated = [...blacklist, { phone, reason, createdAt: Date.now() }];
    handleSaveBlacklist(updated);
    setNewBlacklistPhone('');
    setNewBlacklistReason('');
    alert(`號碼 ${phone} 已成功加入黑名單！`);
  };

  const handleRemoveBlacklist = (phone) => {
    if (!confirm(`確定要將號碼 ${phone} 移出黑名單嗎？`)) return;
    const updated = blacklist.filter(b => b.phone !== phone);
    handleSaveBlacklist(updated);
    alert(`號碼 ${phone} 已移出黑名單！`);
  };
const handleSaveGlobalAddons = async (newAddons) => {
    try {
      const addonKey = prefixNameForStore('SYSTEM_SETTING_GLOBAL_ADDONS', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', addonKey);
      
      if (exist && exist.length > 0) {
        const { error } = await supabase.from('menu_items').update({
          description: JSON.stringify(newAddons)
        }).eq('name', addonKey);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert([{
          name: addonKey,
          description: JSON.stringify(newAddons),
          price: 0,
          category: 'system',
          image: ''
        }]);
        if (error) throw error;
      }
      
      // Update local state
      setGlobalAddons(newAddons);
      
      // Also update the addon options on all menuItems in the local state so the UI updates immediately!
      setMenuItems(prev => prev.map(item => {
        if (item.customizations && item.customizations.addons) {
          return {
            ...item,
            customizations: {
              ...item.customizations,
              addons: {
                ...item.customizations.addons,
                options: newAddons
              }
            }
          };
        }
        return item;
      }));

      alert("全域加料設定已成功儲存並同步雲端！");
      setShowAddonModal(false);
    } catch (e) {
      console.error("Failed to save global addons:", e);
      alert("儲存加料設定失敗：" + e.message);
    }
  };

  const handleSaveGlobalUpgradeCombos = async (updatedList) => {
    try {
      const upgradeKey = prefixNameForStore('SYSTEM_SETTING_UPGRADE_COMBOS', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', upgradeKey);
      
      if (exist && exist.length > 0) {
        const { error } = await supabase.from('menu_items').update({
          description: JSON.stringify(updatedList)
        }).eq('name', upgradeKey);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert([{
          name: upgradeKey,
          description: JSON.stringify(updatedList),
          price: 0,
          category: 'settings',
          image: ''
        }]);
        if (error) throw error;
      }
      
      setUpgradeCombos(updatedList);
      setTempUpgradeCombos(updatedList);
      alert("🎉 全店加價升級套餐方案已成功儲存並同步雲端！");
      setShowUpgradeModal(false);
    } catch (e) {
      console.error("Failed to save global upgrade combos:", e);
      alert("儲存升級套餐方案失敗：" + e.message);
    }
  };

  const handleSaveGlobalCondiments = async (newCondiments) => {
    try {
      const condKey = prefixNameForStore('SYSTEM_SETTING_GLOBAL_CONDIMENTS', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', condKey);
      
      if (exist && exist.length > 0) {
        const { error } = await supabase.from('menu_items').update({
          description: JSON.stringify(newCondiments)
        }).eq('name', condKey);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert([{
          name: condKey,
          description: JSON.stringify(newCondiments),
          price: 0,
          category: 'system',
          image: ''
        }]);
        if (error) throw error;
      }
      
      // Update local state
      setGlobalCondiments(newCondiments);
      
      // Also update the condiment options on all menuItems in the local state so the UI updates immediately!
      setMenuItems(prev => prev.map(item => {
        if (item.customizations && item.customizations.condiments) {
          return {
            ...item,
            customizations: {
              ...item.customizations,
              condiments: {
                ...item.customizations.condiments,
                options: newCondiments
              }
            }
          };
        }
        return item;
      }));

      alert("全域調料客製設定已成功儲存並同步雲端！");
      setShowCondimentModal(false);
    } catch (e) {
      console.error("Failed to save global condiments:", e);
      alert("儲存調料設定失敗：" + e.message);
    }
  };

  // Load staff list from Supabase
  const fetchStaffList = async () => {
    try {
      const staffKey = prefixNameForStore('SYSTEM_SETTING_STAFF_LIST', storeCode);
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('name', staffKey);
      const defaultStaff = [
        { name: '店長 (Admin)', pin: '6666' },
        { name: '收銀員-小明', pin: '1111' },
        { name: '收銀員-小華', pin: '2222' },
        { name: '收銀員-阿強', pin: '3333' }
      ];
      if (data && data.length > 0) {
        setStaffList(JSON.parse(data[0].description));
        localStorage.setItem('restaurant_staff_list', data[0].description);
      } else {
        setStaffList(defaultStaff);
        localStorage.setItem('restaurant_staff_list', JSON.stringify(defaultStaff));
      }
    } catch (err) {
      console.error("Failed to fetch staff list from Supabase:", err);
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
      const orderKey = prefixNameForStore('SYSTEM_SETTING_MENU_ORDER', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', orderKey);
      if (exist && exist.length > 0) {
        const { error } = await supabase.from('menu_items').update({
          description: JSON.stringify(currentOrder)
        }).eq('name', orderKey);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert([{
          name: orderKey,
          description: JSON.stringify(currentOrder),
          price: 0,
          category: 'system',
          image: ''
        }]);
        if (error) throw error;
      }
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
      const configKey = prefixNameForStore('SYSTEM_SETTING_RECEIPT_CONFIG', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', configKey);
      if (exist && exist.length > 0) {
        const { error } = await supabase.from('menu_items').update({
          description: JSON.stringify(config)
        }).eq('name', configKey);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').insert([{
          name: configKey,
          description: JSON.stringify(config),
          price: 0,
          category: 'system',
          image: ''
        }]);
        if (error) throw error;
      }
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

    const costNum = prodCost !== '' ? parseFloat(prodCost) : null;
    const dbName = prefixNameForStore(prodName.trim(), storeCode);
    let existingCust = (editingItem && typeof editingItem === 'object' && editingItem.customizations) 
      ? { ...editingItem.customizations } 
      : {};

    existingCust.cost_price = costNum;
    existingCust.is_available = prodAvailable;
    existingCust.is_published = prodPublished;

    // Handle Size Variants
    if (hasSizeVariants && prodSizes.length > 0) {
      const validSizes = prodSizes
        .filter(s => s.label.trim())
        .map(s => ({
          label: s.label.trim(),
          priceChange: Number(s.priceChange) || 0
        }));

      if (validSizes.length > 0) {
        existingCust.size = {
          type: 'radio',
          name: '份量大小',
          default: validSizes[0].label,
          options: validSizes
        };
      } else {
        delete existingCust.size;
      }
    } else {
      delete existingCust.size;
    }

    // Attach global addons & condiments if category is mee-sua or food
    if (globalAddons && globalAddons.length > 0) {
      existingCust.addons = {
        type: 'checkbox',
        name: '加料專區',
        options: globalAddons
      };
    }
    if (globalCondiments && globalCondiments.length > 0) {
      existingCust.condiments = {
        type: 'selects',
        name: '佐料客製',
        options: globalCondiments
      };
    }

    const updatedItem = {
      name: dbName,
      price: priceNum,
      image: prodImage.trim(),
      category: prodCategory,
      description: prodDescription.trim(),
      customizations: existingCust
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
  const handleSaveStaffToCloud = async (updatedList) => {
    try {
      const staffKey = prefixNameForStore('SYSTEM_SETTING_STAFF_LIST', storeCode);
      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', staffKey);
      if (exist && exist.length > 0) {
        await supabase.from('menu_items').update({ description: JSON.stringify(updatedList) }).eq('name', staffKey);
      } else {
        await supabase.from('menu_items').insert([{ name: staffKey, price: 0, category: 'settings', description: JSON.stringify(updatedList) }]);
      }
      setStaffList(updatedList);
      alert("員工資料儲存成功！");
    } catch (e) {
      console.error("Failed to sync staff list to cloud:", e);
      alert("儲存至雲端失敗：" + e.message);
    }
  };

  const handleSaveStaff = async (e) => {
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
      updatedList[editingStaffIndex] = { name: newStaffName.trim(), pin: newStaffPin.trim() };
      setEditingStaffIndex(null);
    } else {
      updatedList.push({ name: newStaffName.trim(), pin: newStaffPin.trim() });
    }

    await handleSaveStaffToCloud(updatedList);
    setNewStaffName('');
    setNewStaffPin('');
  };

  const handleEditStaffClick = (idx) => {
    const staff = staffList[idx];
    setNewStaffName(staff.name);
    setNewStaffPin(staff.pin);
    setEditingStaffIndex(idx);
  };

  const handleDeleteStaff = async (idx) => {
    if (!confirm(`確定要刪除員工「${staffList[idx].name}」的登入資料嗎？`)) return;
    const updatedList = staffList.filter((_, i) => i !== idx);
    await handleSaveStaffToCloud(updatedList);
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
          <ThemeSelector />
          <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 6px' }}></div>
          <button 
            onClick={() => {
              if (typeof window !== 'undefined') sessionStorage.removeItem('is_master_admin_session');
              onLogout();
            }}
            style={{
              padding: '6px 14px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--primary)',
              cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            🚪 登出 / 切換系統
          </button>
        </div>
      </header>

      
      {/* Branch Store Management Active Banner */}
      {storeCode !== 'dragon' && isMasterAdmin && (
        <div style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '10px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏢</span>
            <span>您目前正在管理分店：【 {storeName} 】(可修改該店菜單、營業設定與員工班表)</span>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.search = '?store=dg_8f2a1c&admin=true';
            }}
            style={{
              padding: '4px 12px',
              backgroundColor: '#ffffff',
              color: '#1d4ed8',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '900',
              fontSize: '0.8rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
            }}
          >
            ↩️ 返回龍城總店管理總台
          </button>
        </div>
      )}

      {/* Store Customization Settings Panel */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>🏪 後台管理系統 ({storeName})</span>
        <button 
          onClick={async () => {
            const todayStr = getTodayLocalDate();
            try {
              const closedKey = prefixNameForStore('SYSTEM_SETTING_CLOSED_DATES', storeCode);
              let updated = [];
              if (isClosedToday) {
                updated = closedDates.filter(d => d !== todayStr);
                setClosedDates(updated);
                setIsClosedToday(false);
                alert("今天營業已成功重新開啟！");
              } else {
                updated = Array.from(new Set([...closedDates, todayStr]));
                setClosedDates(updated);
                setIsClosedToday(true);
                alert("今天已設定打烊收店。");
              }
              localStorage.setItem('restaurant_closed_dates', JSON.stringify(updated));
              window.dispatchEvent(new Event('storage'));

              const { data: exist } = await supabase.from('menu_items').select('*').eq('name', closedKey);
              if (exist && exist.length > 0) {
                await supabase.from('menu_items').update({ description: JSON.stringify(updated) }).eq('name', closedKey);
              } else {
                await supabase.from('menu_items').insert([{ name: closedKey, price: 0, category: 'settings', description: JSON.stringify(updated) }]);
              }
            } catch (e) {
              alert("切換營業開關失敗：" + e.message);
            }
          }}
          style={{
            padding: '8px 16px', fontSize: '0.85rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
            backgroundColor: isClosedToday ? '#ef4444' : '#10b981', color: 'white'
          }}
        >
          {isClosedToday ? '🔴 今日已打烊/公休 (點擊重開)' : '🟢 今日營業中 (點擊收店/公休)'}
        </button>
      </div>
      
      {/* Selector Tabs - Clean, Grouped, High-Contrast */}
      <div style={{ display: 'flex', flexWrap: 'wrap', padding: '16px 24px 8px 24px', gap: '8px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-body)' }}>
        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
            backgroundColor: activeTab === 'products' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'products' ? 'white' : 'var(--text-main)',
            boxShadow: activeTab === 'products' ? 'var(--shadow-sm)' : 'none',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          🍲 菜單與商品管理
        </button>
        <button
          onClick={() => {
            setActiveTab('upgrades');
            setTempUpgradeCombos(JSON.parse(JSON.stringify(upgradeCombos || defaultUpgradeCombos)));
          }}
          style={{
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
            backgroundColor: activeTab === 'upgrades' ? '#ea580c' : 'var(--bg-card)',
            color: activeTab === 'upgrades' ? 'white' : 'var(--text-main)',
            boxShadow: activeTab === 'upgrades' ? '0 2px 8px rgba(234, 88, 12, 0.25)' : 'none',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          🍱 加價升級套餐設定 ({upgradeCombos.length})
        </button>
        <button
          onClick={() => setActiveTab('customer')}
          style={{
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
            backgroundColor: activeTab === 'customer' ? '#ea580c' : 'var(--bg-card)',
            color: activeTab === 'customer' ? 'white' : 'var(--text-main)',
            boxShadow: activeTab === 'customer' ? '0 2px 8px rgba(234, 88, 12, 0.25)' : 'none',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          🎨 顧客點餐首頁設定
        </button>
        <button
          onClick={() => setActiveTab('pos')}
          style={{
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
            backgroundColor: activeTab === 'pos' ? '#0284c7' : 'var(--bg-card)',
            color: activeTab === 'pos' ? 'white' : 'var(--text-main)',
            boxShadow: activeTab === 'pos' ? '0 2px 8px rgba(2, 132, 199, 0.25)' : 'none',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          💻 現場 POS 與收據設定
        </button>
        <button
          onClick={() => setActiveTab('store')}
          style={{
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
            backgroundColor: activeTab === 'store' ? '#059669' : 'var(--bg-card)',
            color: activeTab === 'store' ? 'white' : 'var(--text-main)',
            boxShadow: activeTab === 'store' ? '0 2px 8px rgba(5, 150, 105, 0.25)' : 'none',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          🏪 門市檔案與營運
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          style={{
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
            backgroundColor: activeTab === 'staff' ? '#4f46e5' : 'var(--bg-card)',
            color: activeTab === 'staff' ? 'white' : 'var(--text-main)',
            boxShadow: activeTab === 'staff' ? '0 2px 8px rgba(79, 70, 229, 0.25)' : 'none',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          👥 員工班表與登入 PIN
        </button>
        <button
          onClick={() => setActiveTab('qrcode')}
          style={{
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
            backgroundColor: activeTab === 'qrcode' ? '#16a34a' : 'var(--bg-card)',
            color: activeTab === 'qrcode' ? 'white' : 'var(--text-main)',
            boxShadow: activeTab === 'qrcode' ? '0 2px 8px rgba(22, 163, 74, 0.25)' : 'none',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          📱 桌號 QR Code 立牌
        </button>
        <button
          onClick={() => setActiveTab('blacklist')}
          style={{
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer',
            backgroundColor: activeTab === 'blacklist' ? '#dc2626' : 'var(--bg-card)',
            color: activeTab === 'blacklist' ? 'white' : 'var(--text-main)',
            boxShadow: activeTab === 'blacklist' ? '0 2px 8px rgba(220, 38, 38, 0.25)' : 'none',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          🚫 黑名單管理
        </button>
        {isMasterAdmin && (
          <button
            onClick={() => setActiveTab('saas')}
            style={{
              padding: '10px 18px', fontSize: '0.88rem', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer',
              backgroundColor: activeTab === 'saas' ? '#7c3aed' : 'var(--bg-card)',
              color: activeTab === 'saas' ? 'white' : 'var(--text-main)',
              boxShadow: activeTab === 'saas' ? '0 2px 8px rgba(124, 58, 237, 0.35)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            🏢 SaaS 加盟門市管理
          </button>
        )}
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, padding: '0 24px 40px 24px', display: 'flex', flexDirection: 'column' }}>
                {/* 🍱 Dedicated Upgrade Combos Workspace Tab */}
        {activeTab === 'upgrades' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px', textAlign: 'left' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🍱 全店主餐加價升級套餐方案
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    當顧客在線上點餐或收銀員在 POS 機點選招牌麵線/主餐時，可選擇以下套餐方案以特惠價加購小菜與冷飲。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const current = tempUpgradeCombos.length > 0 ? tempUpgradeCombos : (upgradeCombos || defaultUpgradeCombos);
                    setTempUpgradeCombos([...current, {
                      id: 'upgrade_' + Date.now().toString(36),
                      name: '新自選升級套餐',
                      tag: '⭐ 推薦',
                      price: 45,
                      description: '精選小菜 ＋ 沁涼特調冷飲 1杯',
                      slots: [
                        {
                          id: 'side',
                          title: '🥬 開胃小菜 (選 1)',
                          options: [
                            { name: '特製黃金辣泡菜', priceChange: 0, default: true },
                            { name: '熱騰騰招牌大肉包 (1顆)', priceChange: 0 }
                          ]
                        },
                        {
                          id: 'drink',
                          title: '🥤 沁涼冷飲 (選 1)',
                          hasDrinkOptions: true,
                          options: [
                            { name: '古早味冰紅茶 (500cc)', priceChange: 0, default: true },
                            { name: '鮮檸冬瓜露', priceChange: 5 }
                          ]
                        }
                      ]
                    }]);
                  }}
                  style={{
                    padding: '10px 16px', backgroundColor: '#10b981', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  ➕ 新增升級方案
                </button>
              </div>

              {/* Package cards list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(tempUpgradeCombos.length > 0 ? tempUpgradeCombos : (upgradeCombos || defaultUpgradeCombos)).map((pkg, pIdx) => {
                  const currentList = tempUpgradeCombos.length > 0 ? tempUpgradeCombos : (upgradeCombos || defaultUpgradeCombos);
                  return (
                    <div key={pkg.id || pIdx} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '12px', backgroundColor: 'var(--bg-body)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>方案名稱</span>
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) => {
                              const updated = [...currentList];
                              updated[pIdx].name = e.target.value;
                              setTempUpgradeCombos(updated);
                            }}
                            placeholder="如: A. 開胃小資套餐"
                            style={{ padding: '8px 12px', fontSize: '0.9rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                          />
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#ea580c' }}>加價金額 (NT$)</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ea580c' }}>+NT$</span>
                            <input
                              type="number"
                              min="0"
                              value={pkg.price}
                              onChange={(e) => {
                                const updated = [...currentList];
                                updated[pIdx].price = Number(e.target.value) || 0;
                                setTempUpgradeCombos(updated);
                              }}
                              style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: '#ea580c' }}
                            />
                          </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>促銷標籤 (可選)</span>
                          <input
                            type="text"
                            value={pkg.tag || ''}
                            onChange={(e) => {
                              const updated = [...currentList];
                              updated[pIdx].tag = e.target.value;
                              setTempUpgradeCombos(updated);
                            }}
                            placeholder="如: 🔥 超值省 $20"
                            style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (currentList.length <= 1) return alert("至少須保留一個升級套餐方案！");
                            setTempUpgradeCombos(currentList.filter((_, i) => i !== pIdx));
                          }}
                          style={{ alignSelf: 'flex-end', height: '38px', padding: '0 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                          title="刪除此方案"
                        >
                          🗑️ 刪除
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>方案優惠說明</span>
                        <input
                          type="text"
                          value={pkg.description || ''}
                          onChange={(e) => {
                            const updated = [...currentList];
                            updated[pIdx].description = e.target.value;
                            setTempUpgradeCombos(updated);
                          }}
                          placeholder="例如: 特製黃金辣泡菜 1份 ＋ 沁涼冷飲 1杯 (現省 $20)"
                          style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                        />
                      </div>

                      {/* Applicability Scope Filter */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            🎯 此套餐可被套用之商品範圍：
                          </span>
                          <div style={{ display: 'flex', gap: '14px', fontSize: '0.82rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: (pkg.applicableScope === 'all' || !pkg.applicableScope) ? 'bold' : 'normal' }}>
                              <input
                                type="radio"
                                name={`scope_${pIdx}`}
                                checked={pkg.applicableScope === 'all' || !pkg.applicableScope}
                                onChange={() => {
                                  const updated = [...currentList];
                                  updated[pIdx].applicableScope = 'all';
                                  setTempUpgradeCombos(updated);
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              全部主餐/允許商品
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: pkg.applicableScope === 'category' ? 'bold' : 'normal' }}>
                              <input
                                type="radio"
                                name={`scope_${pIdx}`}
                                checked={pkg.applicableScope === 'category'}
                                onChange={() => {
                                  const updated = [...currentList];
                                  updated[pIdx].applicableScope = 'category';
                                  if (!updated[pIdx].applicableCategories) {
                                    updated[pIdx].applicableCategories = ['mee-sua'];
                                  }
                                  setTempUpgradeCombos(updated);
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              指定商品分類
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: pkg.applicableScope === 'items' ? 'bold' : 'normal' }}>
                              <input
                                type="radio"
                                name={`scope_${pIdx}`}
                                checked={pkg.applicableScope === 'items'}
                                onChange={() => {
                                  const updated = [...currentList];
                                  updated[pIdx].applicableScope = 'items';
                                  if (!updated[pIdx].applicableItemNames) {
                                    updated[pIdx].applicableItemNames = [];
                                  }
                                  setTempUpgradeCombos(updated);
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              指定特定品項
                            </label>
                          </div>
                        </div>

                        {/* Category Filter Selection */}
                        {pkg.applicableScope === 'category' && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-body)', borderRadius: '6px', border: '1px dashed var(--border)' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', width: '100%' }}>請勾選允許套用此套餐的商品分類：</span>
                            {productCategories.map(cat => {
                              const isChecked = (pkg.applicableCategories || []).includes(cat.id);
                              return (
                                <label key={cat.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '6px', border: isChecked ? '1.5px solid var(--primary)' : '1px solid var(--border)', backgroundColor: isChecked ? 'rgba(255, 107, 53, 0.1)' : 'var(--bg-card)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: isChecked ? 'bold' : 'normal' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const updated = [...currentList];
                                      let list = updated[pIdx].applicableCategories ? [...updated[pIdx].applicableCategories] : [];
                                      if (e.target.checked) {
                                        if (!list.includes(cat.id)) list.push(cat.id);
                                      } else {
                                        list = list.filter(c => c !== cat.id);
                                      }
                                      updated[pIdx].applicableCategories = list;
                                      setTempUpgradeCombos(updated);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <span>{cat.icon || '🏷️'} {cat.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {/* Specific Items Selection */}
                        {pkg.applicableScope === 'items' && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-body)', borderRadius: '6px', border: '1px dashed var(--border)', maxHeight: '180px', overflowY: 'auto' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', width: '100%' }}>請勾選允許套用此套餐的特定商品（勾選的商品點餐時才會顯示此升級方案）：</span>
                            {menuItems.filter(item => !item.name.startsWith('SYSTEM_SETTING_')).map(item => {
                              const isChecked = (pkg.applicableItemNames || []).includes(item.name);
                              return (
                                <label key={item.id || item.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '6px', border: isChecked ? '1.5px solid var(--primary)' : '1px solid var(--border)', backgroundColor: isChecked ? 'rgba(255, 107, 53, 0.1)' : 'var(--bg-card)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: isChecked ? 'bold' : 'normal' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const updated = [...currentList];
                                      let list = updated[pIdx].applicableItemNames ? [...updated[pIdx].applicableItemNames] : [];
                                      if (e.target.checked) {
                                        if (!list.includes(item.name)) list.push(item.name);
                                      } else {
                                        list = list.filter(n => n !== item.name);
                                      }
                                      updated[pIdx].applicableItemNames = list;
                                      setTempUpgradeCombos(updated);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <span>{item.name} (NT$ {item.price})</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Package slots (Fully Editable) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            📋 內含自選分組與可選品項設定 (供顧客自由挑選)：
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...currentList];
                              const slots = updated[pIdx].slots ? [...updated[pIdx].slots] : [];
                              slots.push({
                                id: 'slot_' + Date.now().toString(36),
                                title: '新自選分組 (選 1)',
                                hasDrinkOptions: false,
                                options: [
                                  { name: '新可選品項', priceChange: 0, default: true }
                                ]
                              });
                              updated[pIdx].slots = slots;
                              setTempUpgradeCombos(updated);
                            }}
                            style={{ padding: '4px 10px', fontSize: '0.78rem', backgroundColor: 'rgba(255, 107, 53, 0.1)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ＋ 新增自選分組 (如小菜/飲品)
                          </button>
                        </div>

                        {(pkg.slots || []).map((slot, sIdx) => (
                          <div key={slot.id || sIdx} style={{ padding: '12px', backgroundColor: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>分組名稱:</span>
                                <input
                                  type="text"
                                  value={slot.title}
                                  onChange={(e) => {
                                    const updated = [...currentList];
                                    updated[pIdx].slots[sIdx].title = e.target.value;
                                    setTempUpgradeCombos(updated);
                                  }}
                                  placeholder="如: 🥬 開胃小菜 (選 1)"
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 'bold', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                                />
                              </div>

                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={slot.hasDrinkOptions === true}
                                  onChange={(e) => {
                                    const updated = [...currentList];
                                    updated[pIdx].slots[sIdx].hasDrinkOptions = e.target.checked;
                                    setTempUpgradeCombos(updated);
                                  }}
                                  style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                                />
                                🥤 包含甜度/冰塊選擇
                              </label>

                              <button
                                type="button"
                                onClick={() => {
                                  if (pkg.slots.length <= 1) return alert("每個套餐至少須保留一個自選分組！");
                                  const updated = [...currentList];
                                  updated[pIdx].slots = updated[pIdx].slots.filter((_, i) => i !== sIdx);
                                  setTempUpgradeCombos(updated);
                                }}
                                style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                ✕ 刪除分組
                              </button>
                            </div>

                            {/* Options list for this slot */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--border)' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>供顧客選擇之品項清單與升級加價差額：</span>
                              {(slot.options || []).map((opt, oIdx) => (
                                <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
                                  <input
                                    type="text"
                                    value={opt.name}
                                    onChange={(e) => {
                                      const updated = [...currentList];
                                      updated[pIdx].slots[sIdx].options[oIdx].name = e.target.value;
                                      setTempUpgradeCombos(updated);
                                    }}
                                    placeholder="品項名稱 (如: 特製黃金辣泡菜)"
                                    style={{ flex: 2, padding: '4px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                                  />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, maxWidth: '140px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+NT$</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={opt.priceChange || 0}
                                      onChange={(e) => {
                                        const updated = [...currentList];
                                        updated[pIdx].slots[sIdx].options[oIdx].priceChange = Number(e.target.value) || 0;
                                        setTempUpgradeCombos(updated);
                                      }}
                                      style={{ width: '100%', padding: '4px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 'bold' }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (slot.options.length <= 1) return alert("每個分組至少須保留一個可選品項！");
                                      const updated = [...currentList];
                                      updated[pIdx].slots[sIdx].options = updated[pIdx].slots[sIdx].options.filter((_, i) => i !== oIdx);
                                      setTempUpgradeCombos(updated);
                                    }}
                                    style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', padding: '0 4px' }}
                                    title="刪除此品項"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}

                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...currentList];
                                  if (!updated[pIdx].slots[sIdx].options) updated[pIdx].slots[sIdx].options = [];
                                  updated[pIdx].slots[sIdx].options.push({ name: '', priceChange: 0 });
                                  setTempUpgradeCombos(updated);
                                }}
                                style={{ alignSelf: 'flex-start', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', border: '1px dashed var(--border)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold', marginTop: '2px' }}
                              >
                                ＋ 新增可選品項
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const listToSave = tempUpgradeCombos.length > 0 ? tempUpgradeCombos : (upgradeCombos || defaultUpgradeCombos);
                    handleSaveGlobalUpgradeCombos(listToSave);
                  }}
                  style={{
                    padding: '12px 28px', backgroundColor: 'var(--primary)', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: '900', fontSize: '0.95rem',
                    boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  💾 儲存並同步雲端升級方案
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Products List Table */}
            <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setEditingItem('new');
                      setProdName('');
                      setProdPrice('');
                      setProdCost('');
                      setProdImage('');
                      setProdCategory(productCategories[0]?.id || 'mee-sua');
                      setProdDescription('');
                      setProdAvailable(true);
                      setProdPublished(true);
                      setHasSizeVariants(false);
                      setProdSizes([
                        { label: '小碗', priceChange: 0 },
                        { label: '大碗', priceChange: 15 }
                      ]);
                    }}
                    style={{
                      padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none',
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    ➕ 新增商品項目
                  </button>
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    style={{
                      padding: '8px 14px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)',
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    🏷️ 商品分類管理
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAddons(globalAddons.map(a => ({ label: a.label || '', priceChange: Number(a.priceChange) || 0 })));
                      setShowAddonModal(true);
                    }}
                    style={{
                      padding: '8px 14px', backgroundColor: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', border: '1px solid rgba(234, 88, 12, 0.3)',
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    ⚙️ 全店加料品項設定 ({globalAddons.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempCondiments(globalCondiments.map(c => ({ name: c.name || '', mode: c.mode || 'checkbox', choices: c.choices || ['加', '不加'], default: c.default || '加' })));
                      setShowCondimentModal(true);
                    }}
                    style={{
                      padding: '8px 14px', backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    🌶️ 全店調料/佐料設定 ({globalCondiments.length})
                  </button>
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>商品圖片</th>
                    <th style={{ padding: '12px' }}>名稱</th>
                    <th style={{ padding: '12px' }}>單價</th>
                    <th style={{ padding: '12px' }}>成本價</th>
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
                          {item.image ? (
                                <img src={item.image} alt={item.name} onError={(e) => { e.target.style.display = 'none'; }} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                              ) : (
                                <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: 'rgba(255, 107, 53, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                  {item.name.includes('包') ? '🥟' : item.name.includes('泡菜') ? '🌶️' : item.name.includes('要你命') ? '🔥' : item.name.includes('飲') ? '🥤' : '🍜'}
                                </div>
                              )}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.name}</td>
                        <td style={{ padding: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>${item.price}</td>
                        <td style={{ padding: '12px', color: '#ef4444', fontWeight: 'bold' }}>
                          {item.customizations?.cost_price !== undefined && item.customizations?.cost_price !== null ? `${item.customizations.cost_price}` : '-'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {(() => {
                            const cat = productCategories.find(c => c.id === item.category);
                            if (cat) return `${cat.icon || '🏷️'} ${cat.name}`;
                            if (item.category === 'mee-sua') return '🍜 麵線/主食';
                            if (item.category === 'specialties') return '🔥 精選推薦';
                            return item.category || '-';
                          })()}
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
                              setProdCost(item.customizations?.cost_price !== undefined && item.customizations?.cost_price !== null ? String(item.customizations.cost_price) : '');
                              setProdImage(item.image || '');
                              setProdCategory(item.category);
                              setProdDescription(item.description || '');
                              setProdAvailable(isAvailable);
                              setProdPublished(item.customizations?.is_published !== false);
                              setCanUpgradeCombo(item.customizations?.can_upgrade_combo !== false);

                              if (item.customizations?.size?.options && Array.isArray(item.customizations.size.options) && item.customizations.size.options.length > 0) {
                                setHasSizeVariants(true);
                                setProdSizes(item.customizations.size.options.map(opt => ({
                                  label: opt.label || '',
                                  priceChange: Number(opt.priceChange) || 0
                                })));
                              } else {
                                setHasSizeVariants(false);
                                setProdSizes([
                                  { label: '小碗', priceChange: 0 },
                                  { label: '大碗', priceChange: 15 }
                                ]);
                              }
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
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>銷售單價 (NT$)</label>
                      <input type="number" min="0" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} required style={{ padding: '8px', fontSize: '0.85rem' }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>成本價 (NT$)</label>
                      <input type="number" min="0" placeholder="例如: 15" value={prodCost} onChange={(e) => setProdCost(e.target.value)} style={{ padding: '8px', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>商品圖片</label>
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              let w = img.width;
                              let h = img.height;
                              const max = 320;
                              if (w > h) {
                                if (w > max) { h *= max / w; w = max; }
                              } else {
                                if (h > max) { w *= max / h; h = max; }
                              }
                              canvas.width = w;
                              canvas.height = h;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, w, h);
                              setProdImage(canvas.toDataURL('image/jpeg', 0.85));
                            };
                            img.src = ev.target.result;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{
                        border: '2px dashed var(--border)',
                        borderRadius: '8px',
                        padding: '16px',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-body)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {prodImage ? (
                        <div style={{ position: 'relative' }}>
                          <img src={prodImage} alt="Preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} />
                          <button 
                            type="button" 
                            onClick={() => setProdImage('')}
                            style={{
                              position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#ef4444', color: 'white',
                              border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', fontSize: '10px', cursor: 'pointer'
                            }}
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>拖曳圖片至此處 (Drag & Drop)</span>
                      )}
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                        <label 
                          style={{
                            padding: '6px 12px', fontSize: '0.75rem', backgroundColor: 'var(--primary)', color: 'white',
                            borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                          }}
                        >
                          📁 瀏覽電腦檔案
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const img = new Image();
                                  img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    let w = img.width;
                                    let h = img.height;
                                    const max = 320;
                                    if (w > h) {
                                      if (w > max) { h *= max / w; w = max; }
                                    } else {
                                      if (h > max) { w *= max / h; h = max; }
                                    }
                                    canvas.width = w;
                                    canvas.height = h;
                                    const ctx = canvas.getContext('2d');
                                    ctx.drawImage(img, 0, 0, w, h);
                                    setProdImage(canvas.toDataURL('image/jpeg', 0.85));
                                  };
                                  img.src = ev.target.result;
                                };
                                reader.readAsDataURL(file);
                              }
                            }} 
                            style={{ display: 'none' }} 
                          />
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>或直接輸入圖片網址：</span>
                      </div>
                      
                      <input 
                        type="text" 
                        placeholder="可貼上圖片連結網址..."
                        value={prodImage.startsWith('data:') ? '(已選擇上傳本地檔案)' : prodImage} 
                        onChange={(e) => setProdImage(e.target.value)} 
                        style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', width: '100%', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>類別</label>
                    
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select value={prodCategory} onChange={(e) => setProdCategory(e.target.value)} style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}>
                        {productCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon || '🍜'} {cat.name}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        onClick={() => setShowCategoryModal(true)} 
                        style={{ padding: '8px 12px', fontSize: '0.8rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ⚙️ 管理類別
                      </button>
                    </div>

                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>描述</label>
                    <textarea rows="3" value={prodDescription} onChange={(e) => setProdDescription(e.target.value)} style={{ padding: '8px', fontSize: '0.85rem' }} />
                  </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                    <input type="checkbox" id="publish-check" checked={prodPublished} onChange={(e) => setProdPublished(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                    <label htmlFor="publish-check" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>上架此商品 (勾選為上架顯示，取消為下架隱藏)</label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', margin: '4px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 'bold', cursor: 'pointer', color: 'var(--text-main)' }}>
                      <input 
                        type="checkbox"
                        checked={canUpgradeCombo}
                        onChange={(e) => setCanUpgradeCombo(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      🍱 允許此商品加價升級套餐 (顧客點餐時可加購小菜與冷飲)
                    </label>
                    <span style={{ fontSize: '0.75rem', color: canUpgradeCombo ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                      {canUpgradeCombo ? '🟢 支援加價升級' : '⚪ 不支援升級'}
                    </span>
                  </div>

                  {/* ⚙️ Full-Featured Size Variants & Price Editor (Add & Edit) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-body)', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 'bold', cursor: 'pointer', color: 'var(--text-main)' }}>
                        <input 
                          type="checkbox"
                          checked={hasSizeVariants}
                          onChange={(e) => setHasSizeVariants(e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        啟用「規格 / 份量大小加價」選項
                      </label>
                      <span style={{ fontSize: '0.75rem', color: hasSizeVariants ? '#10b981' : 'var(--text-muted)', fontWeight: 'bold' }}>
                        {hasSizeVariants ? '🟢 已開啟份量規格' : '⚪ 未開啟 (單一規格)'}
                      </span>
                    </div>

                    {hasSizeVariants && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>規格名稱 (如: 小碗/大碗)</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>加價金額 (NT$)</span>
                        </div>

                        {prodSizes.map((sizeOpt, sIdx) => (
                          <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="text"
                              placeholder="例如: 小碗、大碗、特大"
                              value={sizeOpt.label}
                              onChange={(e) => {
                                const next = [...prodSizes];
                                next[sIdx].label = e.target.value;
                                setProdSizes(next);
                              }}
                              style={{ flex: 2, padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1.5 }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>+NT$</span>
                              <input 
                                type="number"
                                min="0"
                                placeholder="0"
                                value={sizeOpt.priceChange}
                                onChange={(e) => {
                                  const next = [...prodSizes];
                                  next[sIdx].priceChange = Number(e.target.value) || 0;
                                  setProdSizes(next);
                                }}
                                style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 'bold' }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (prodSizes.length <= 1) return alert("至少須保留一個規格選項！若不需要請直接取消勾選上方開關。");
                                setProdSizes(prodSizes.filter((_, i) => i !== sIdx));
                              }}
                              style={{ width: '32px', height: '32px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="刪除此規格"
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setProdSizes([...prodSizes, { label: '', priceChange: 0 }]);
                            }}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ➕ 新增一個規格選項
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProdSizes([
                                { label: '小碗', priceChange: 0 },
                                { label: '大碗', priceChange: 15 }
                              ]);
                            }}
                            style={{ padding: '6px 10px', fontSize: '0.75rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            🍜 套用「小碗 / 大碗(+15)」
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProdSizes([
                                { label: '小份', priceChange: 0 },
                                { label: '大份', priceChange: 20 }
                              ]);
                            }}
                            style={{ padding: '6px 10px', fontSize: '0.75rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            🍢 套用「小份 / 大份(+20)」
                          </button>
                        </div>
                      </div>
                    )}
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
        )}

        {activeTab === 'staff' && (
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
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>登入 PIN 碼 (可自訂 4 碼、6 碼等 4~8 位數字)</label>
                  <input type="text" pattern="\d*" minLength={4} maxLength={8} placeholder="例如: 3333 或 666666" value={newStaffPin} onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ''))} required style={{ padding: '8px', fontSize: '0.85rem' }} />
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

        {activeTab === 'qrcode' && (() => {
          const storeLinks = getStoreLinks(storeCode);
          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
            {/* 🔐 Secret Token Links Card */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '2px solid #3b82f6', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🔐 本店專屬安全金鑰網址 (不可猜測之獨立安全連結)
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    網址已全面啟用亂數安全代碼 (<strong>{storeLinks.publicToken}</strong>)，外部人員無法透過猜測店名進入本店系統。
                  </p>
                </div>
                <div style={{ padding: '4px 12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  🛡️ 安全金鑰已啟用
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {[
                  { label: '📱 顧客手機掃碼點餐', url: storeLinks.customerUrl, color: '#16a34a' },
                  { label: '💵 現場 POS 收銀系統', url: storeLinks.posUrl, color: '#ea580c' },
                  { label: '📊 營業記帳與財務系統', url: storeLinks.bookkeepingUrl, color: '#0284c7' },
                  { label: '🛠️ 後台管理系統', url: storeLinks.adminUrl, color: '#4f46e5' }
                ].map(linkItem => (
                  <div key={linkItem.label} style={{ backgroundColor: 'var(--bg-body)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: linkItem.color }}>{linkItem.label}</div>
                    <input 
                      type="text" 
                      readOnly 
                      value={linkItem.url} 
                      style={{ padding: '6px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'monospace' }} 
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(linkItem.url);
                        alert(`✅ 已複製【${linkItem.label}】專屬安全網址至剪貼簿！`);
                      }}
                      style={{ padding: '6px', fontSize: '0.75rem', fontWeight: 'bold', border: 'none', borderRadius: '4px', backgroundColor: linkItem.color, color: 'white', cursor: 'pointer' }}
                    >
                      📋 複製專屬網址
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>📱 內用桌號 QR Code 自動生成與列印專區</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    為每張桌子自動生成專屬點餐連結與 QR Code，顧客入座掃碼即可直接點餐並自動帶入桌號！
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrintAllQrCodes}
                  style={{
                    padding: '10px 20px',
                    fontSize: '0.9rem',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  🖨️ 一鍵批次列印全店桌牌 (A4 排版)
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>店內總桌數 (快速設定 1 ~ N 桌)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={tableCount}
                    onChange={(e) => setTableCount(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>或 自訂桌號清單 (以逗號分隔)</label>
                  <input
                    type="text"
                    placeholder="例: 1, 2, 3, 包廂A, 戶外1"
                    value={customTableNames}
                    onChange={(e) => setCustomTableNames(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>點餐基礎網址 (預設自動抓取)</label>
                  <input
                    type="text"
                    value={qrBaseUrl}
                    onChange={(e) => setQrBaseUrl(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                  />
                </div>
              </div>
            </div>

            {/* Live QR Code Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '16px'
            }}>
              {generatedQrs.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '2px dashed var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {newStoreName.trim() || storeName || '龍城麵線'}
                  </span>
                  <div style={{
                    fontSize: '1.2rem',
                    fontWeight: '900',
                    backgroundColor: 'var(--bg-body)',
                    color: 'var(--text-main)',
                    padding: '4px 16px',
                    borderRadius: '20px',
                    border: '1px solid var(--border)'
                  }}>
                    【 {item.tableName} 號桌 】
                  </div>
                  {item.qrDataUrl ? (
                    <img
                      src={item.qrDataUrl}
                      alt={`桌號 ${item.tableName} QR Code`}
                      style={{ width: '150px', height: '150px', borderRadius: '8px', border: '1px solid var(--border)', padding: '4px', backgroundColor: 'white' }}
                    />
                  ) : (
                    <div style={{ width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      產生中...
                    </div>
                  )}
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                    📱 手機掃碼．免排隊入座即點
                  </span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', width: '100%' }}>
                    <a
                      href={item.qrDataUrl}
                      download={`${newStoreName.trim() || storeName}_${item.tableName}號桌_點餐QRCode.png`}
                      style={{
                        flex: 1,
                        padding: '6px',
                        fontSize: '0.75rem',
                        textAlign: 'center',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-body)',
                        color: 'var(--text-main)',
                        textDecoration: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      💾 下載圖檔
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );})()}

        {/* TAB 2: Customer Online Ordering Settings */}
        {activeTab === 'customer' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', textAlign: 'left' }}>
            {/* Left Card: Hero Banner & Brand Slogan */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🌟 顧客點餐首頁宣傳橫幅 (Hero Banner) 與品牌口號
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  自訂顧客以手機掃碼開啟點餐系統時，頂部最顯眼的推薦橫幅與品牌介紹。
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', padding: '10px 14px', backgroundColor: 'var(--bg-body)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <input 
                  type="checkbox" 
                  checked={showHeroBanner} 
                  onChange={(e) => setShowHeroBanner(e.target.checked)} 
                />
                啟用顧客點餐頁頂部宣傳橫幅 (Hero Banner)
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🏷️ 門市宣傳副標題 / 品牌口號 (Slogan):</span>
                <input 
                  type="text" 
                  value={newStoreSlogan}
                  onChange={(e) => setNewStoreSlogan(e.target.value)}
                  placeholder="例如: 傳統柴魚高湯・手工紅麵線・精選推薦"
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🔥 橫幅右上角標籤 (Tag):</span>
                <input 
                  type="text" 
                  value={newHeroTag}
                  onChange={(e) => setNewHeroTag(e.target.value)}
                  placeholder="例如: 🔥 熱門推薦、👑 店長激推、🎉 開幕特惠"
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>📌 橫幅主標題 (Title):</span>
                <input 
                  type="text" 
                  value={newHeroTitle}
                  onChange={(e) => setNewHeroTitle(e.target.value)}
                  placeholder="例如: 招牌綜合麵線配特製辣泡菜"
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>📝 橫幅宣傳內容詳細介紹 (Description):</span>
                <textarea 
                  rows={3}
                  value={newHeroDesc}
                  onChange={(e) => setNewHeroDesc(e.target.value)}
                  placeholder="例如: 在地飄香的好味道！獨家配方柴魚高湯，搭配豐富滿載的配料與手作開胃辣泡菜，讓您一吃就愛上！"
                  style={{ padding: '10px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)', resize: 'vertical' }}
                />
              </div>

              <button
                onClick={async () => {
                  try {
                    const heroData = {
                      storeSlogan: newStoreSlogan.trim(),
                      heroTag: newHeroTag.trim(),
                      heroTitle: newHeroTitle.trim(),
                      heroDesc: newHeroDesc.trim(),
                      showHeroBanner: showHeroBanner
                    };

                    const heroKey = prefixNameForStore('SYSTEM_SETTING_STORE_HERO', storeCode);
                    const { data: exist } = await supabase.from('menu_items').select('*').eq('name', heroKey);
                    if (exist && exist.length > 0) {
                      await supabase.from('menu_items').update({ description: JSON.stringify(heroData) }).eq('name', heroKey);
                    } else {
                      await supabase.from('menu_items').insert([{ name: heroKey, price: 0, category: 'settings', description: JSON.stringify(heroData) }]);
                    }

                    const updatedProfile = {
                      ...storeProfile,
                      ...heroData
                    };
                    const profKey = prefixNameForStore('SYSTEM_SETTING_STORE_PROFILE', storeCode);
                    const { data: existProfile } = await supabase.from('menu_items').select('*').eq('name', profKey);
                    if (existProfile && existProfile.length > 0) {
                      await supabase.from('menu_items').update({ description: JSON.stringify(updatedProfile) }).eq('name', profKey);
                    }

                    setStoreSlogan(heroData.storeSlogan);
                    setHeroTag(heroData.heroTag);
                    setHeroTitle(heroData.heroTitle);
                    setHeroDesc(heroData.heroDesc);
                    setStoreProfile(updatedProfile);

                    alert("🎉 顧客點餐系統首頁宣傳橫幅與口號設定已成功儲存並同步雲端！");
                  } catch (e) {
                    alert("儲存失敗：" + e.message);
                  }
                }}
                style={{ padding: '12px 20px', fontSize: '0.9rem', backgroundColor: '#ea580c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '8px', boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)' }}
              >
                💾 儲存點餐首頁橫幅設定
              </button>
            </div>

            {/* Right Card: Live Preview & Payment Methods */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Preview Card */}
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '16px' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📱 顧客端手機即時預覽效果
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    顧客以手機掃描桌上立牌後，首頁頂部看到的實際視覺呈現：
                  </p>
                </div>

                <div style={{ backgroundColor: 'var(--bg-body)', padding: '16px', borderRadius: '10px', border: '1px dashed var(--border)' }}>
                  {showHeroBanner ? (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.12) 0%, rgba(220, 38, 38, 0.08) 100%)',
                      borderRadius: '12px',
                      padding: '18px',
                      border: '1px solid rgba(255, 107, 53, 0.3)',
                      textAlign: 'left'
                    }}>
                      <div style={{
                        display: 'inline-block',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        marginBottom: '8px'
                      }}>
                        {newHeroTag || '🔥 熱門推薦'}
                      </div>
                      <div style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>
                        {newHeroTitle || '招牌綜合麵線配特製辣泡菜'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        {newHeroDesc || '在地飄香的好味道！獨家配方柴魚高湯，搭配豐富滿載的配料與手作開胃辣泡菜，讓您一吃就愛上！'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>
                      (頂部宣傳橫幅已設為停用隱藏)
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods Card */}
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    💳 顧客點餐系統付款方式管理
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    控制顧客手機送出訂單時，提供哪些結帳管道。
                  </p>
                </div>

                {/* Counter Option */}
                <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-body)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={paymentMethods.counter?.enabled !== false}
                      onChange={(e) => {
                        setPaymentMethods({
                          ...paymentMethods,
                          counter: { ...paymentMethods.counter, enabled: e.target.checked }
                        });
                      }}
                    />
                    啟用「店內結帳 / 到店付款」
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>顯示名稱</span>
                      <input 
                        type="text"
                        value={paymentMethods.counter?.name || ''}
                        onChange={(e) => setPaymentMethods({ ...paymentMethods, counter: { ...paymentMethods.counter, name: e.target.value } })}
                        style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                      />
                    </div>
                    <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>說明文字</span>
                      <input 
                        type="text"
                        value={paymentMethods.counter?.desc || ''}
                        onChange={(e) => setPaymentMethods({ ...paymentMethods, counter: { ...paymentMethods.counter, desc: e.target.value } })}
                        style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Online Option */}
                <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-body)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={paymentMethods.online?.enabled !== false}
                      onChange={(e) => {
                        setPaymentMethods({
                          ...paymentMethods,
                          online: { ...paymentMethods.online, enabled: e.target.checked }
                        });
                      }}
                    />
                    啟用「線上刷卡 / 行動支付」
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>顯示名稱</span>
                      <input 
                        type="text"
                        value={paymentMethods.online?.name || ''}
                        onChange={(e) => setPaymentMethods({ ...paymentMethods, online: { ...paymentMethods.online, name: e.target.value } })}
                        style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                      />
                    </div>
                    <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>說明文字</span>
                      <input 
                        type="text"
                        value={paymentMethods.online?.desc || ''}
                        onChange={(e) => setPaymentMethods({ ...paymentMethods, online: { ...paymentMethods.online, desc: e.target.value } })}
                        style={{ padding: '8px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    try {
                      const payKey = prefixNameForStore('SYSTEM_SETTING_PAYMENT_METHODS', storeCode);
                      const { data: exist } = await supabase.from('menu_items').select('*').eq('name', payKey);
                      if (exist && exist.length > 0) {
                        await supabase.from('menu_items').update({ description: JSON.stringify(paymentMethods) }).eq('name', payKey);
                      } else {
                        await supabase.from('menu_items').insert([{ name: payKey, price: 0, category: 'settings', description: JSON.stringify(paymentMethods) }]);
                      }
                      alert("付款方式設定已成功更新！");
                    } catch (e) {
                      alert("儲存付款方式失敗：" + e.message);
                    }
                  }}
                  style={{ padding: '10px 16px', fontSize: '0.85rem', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  💾 儲存付款方式設定
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: POS & Receipt Printer Settings */}
        {activeTab === 'pos' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', textAlign: 'left' }}>
            {/* Left Card: POS Terminal Preferences */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💻 現場 POS 收銀機偏好設定
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  自訂收銀機預設單別與支援的結帳收款方式。
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>預設點單單別:</span>
                <select
                  value={posDefaultOrderType}
                  onChange={(e) => setPosDefaultOrderType(e.target.value)}
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  <option value="dine-in">🍜 預設為「內用」</option>
                  <option value="takeout">🥡 預設為「外帶」</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>POS 付款方式設定:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {posPaymentMethods.map((method, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-body)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      <span>{method}</span>
                      <button 
                        onClick={() => {
                          if (posPaymentMethods.length <= 1) return alert("至少須保留一種付款方式！");
                          setPosPaymentMethods(posPaymentMethods.filter((_, i) => i !== idx));
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input 
                    type="text" 
                    placeholder="新增付款方式 (如: 街口、悠遊卡)" 
                    value={newPosPaymentMethod}
                    onChange={(e) => setNewPosPaymentMethod(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                  />
                  <button 
                    onClick={() => {
                      if (!newPosPaymentMethod.trim()) return;
                      if (posPaymentMethods.includes(newPosPaymentMethod.trim())) return alert("已存在相同的付款方式！");
                      setPosPaymentMethods([...posPaymentMethods, newPosPaymentMethod.trim()]);
                      setNewPosPaymentMethod('');
                    }}
                    style={{ padding: '8px 16px', fontSize: '0.85rem', backgroundColor: '#ea580c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    新增
                  </button>
                </div>
              </div>

              <button
                onClick={async () => {
                  try {
                    const typeKey = prefixNameForStore('SYSTEM_SETTING_POS_DEFAULT_ORDER_TYPE', storeCode);
                    const { data: existType } = await supabase.from('menu_items').select('*').eq('name', typeKey);
                    if (existType && existType.length > 0) {
                      await supabase.from('menu_items').update({ description: posDefaultOrderType }).eq('name', typeKey);
                    } else {
                      await supabase.from('menu_items').insert([{ name: typeKey, price: 0, category: 'settings', description: posDefaultOrderType }]);
                    }

                    const payKey = prefixNameForStore('SYSTEM_SETTING_POS_PAYMENT_METHODS', storeCode);
                    const { data: existPay } = await supabase.from('menu_items').select('*').eq('name', payKey);
                    if (existPay && existPay.length > 0) {
                      await supabase.from('menu_items').update({ description: JSON.stringify(posPaymentMethods) }).eq('name', payKey);
                    } else {
                      await supabase.from('menu_items').insert([{ name: payKey, price: 0, category: 'settings', description: JSON.stringify(posPaymentMethods) }]);
                    }

                    alert("POS 偏好設定已成功儲存！");
                  } catch (e) {
                    alert("儲存失敗：" + e.message);
                  }
                }}
                style={{ padding: '12px 20px', fontSize: '0.9rem', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '12px' }}
              >
                💾 儲存 POS 偏好設定
              </button>
            </div>

            {/* Right Card: Thermal Receipt Printing Config */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🧾 熱感應出單機 (收據) 規格與列印設定
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  設定出單機紙張尺寸規格與勾選要列印在小白單上的內容項目。
                </p>
              </div>

              {/* Thermal Paper Width / Size Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🖨️ 熱感應出單紙張規格 / 尺寸類型:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                    borderRadius: '8px', border: receiptConfig.paperWidth !== '58mm' ? '2px solid #4f46e5' : '1px solid var(--border)',
                    backgroundColor: receiptConfig.paperWidth !== '58mm' ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-body)',
                    cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                  }}>
                    <input 
                      type="radio" 
                      name="paperWidth" 
                      checked={receiptConfig.paperWidth !== '58mm'} 
                      onChange={() => setReceiptConfig({ ...receiptConfig, paperWidth: '80mm' })} 
                    />
                    <span>📄 80mm (標準出單機大票)</span>
                  </label>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                    borderRadius: '8px', border: receiptConfig.paperWidth === '58mm' ? '2px solid #4f46e5' : '1px solid var(--border)',
                    backgroundColor: receiptConfig.paperWidth === '58mm' ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-body)',
                    cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                  }}>
                    <input 
                      type="radio" 
                      name="paperWidth" 
                      checked={receiptConfig.paperWidth === '58mm'} 
                      onChange={() => setReceiptConfig({ ...receiptConfig, paperWidth: '58mm' })} 
                    />
                    <span>📑 58mm (便攜式出單機小票)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { key: 'printKitchenTicket', label: '🍳 同時列印「廚房大字備餐切單」(雙聯出單)', highlight: true },
                  { key: 'showTaxId', label: '印出「統一編號 (統編)」' },
                  { key: 'showPhone', label: '印出「門市聯絡電話」' },
                  { key: 'showAddress', label: '印出「門市營業地址」' },
                  { key: 'showWifi', label: '印出「顧客 Wi-Fi 帳密」' },
                  { key: 'showRemarks', label: '印出「座席/單號/備註」' },
                  { key: 'printReceivedAndChange', label: '印出「實收金額與找零」' },
                  { key: 'printType', label: '印出「內用/外帶交易類型」' },
                  { key: 'printDateTime', label: '印出「交易日期與時間」' }
                ].map(item => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', padding: '8px', backgroundColor: 'var(--bg-body)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <input 
                      type="checkbox"
                      checked={receiptConfig[item.key] !== false}
                      onChange={(e) => {
                        const updated = { ...receiptConfig, [item.key]: e.target.checked };
                        setReceiptConfig(updated);
                      }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>💬 收據頁尾問候語:</span>
                <input 
                  type="text" 
                  placeholder="例如: 謝謝惠顧，歡迎再度光臨！"
                  value={newReceiptFooter}
                  onChange={(e) => setNewReceiptFooter(e.target.value)}
                  style={{ padding: '10px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <button
                onClick={async () => {
                  try {
                    const receiptKey = prefixNameForStore('SYSTEM_SETTING_RECEIPT_CONFIG', storeCode);
                    const { data: exist } = await supabase.from('menu_items').select('*').eq('name', receiptKey);
                    if (exist && exist.length > 0) {
                      await supabase.from('menu_items').update({ description: JSON.stringify(receiptConfig) }).eq('name', receiptKey);
                    } else {
                      await supabase.from('menu_items').insert([{ name: receiptKey, price: 0, category: 'settings', description: JSON.stringify(receiptConfig) }]);
                    }

                    const footerKey = prefixNameForStore('SYSTEM_SETTING_RECEIPT_FOOTER', storeCode);
                    await supabase.from('menu_items').upsert([{ name: footerKey, price: 0, category: 'settings', description: newReceiptFooter.trim() }], { onConflict: 'name' });
                    setReceiptFooter(newReceiptFooter.trim());

                    alert("🧾 收據出單設定已成功更新！");
                  } catch (e) {
                    alert("儲存收據設定失敗：" + e.message);
                  }
                }}
                style={{ padding: '12px 20px', fontSize: '0.9rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '8px' }}
              >
                💾 儲存收據列印設定
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Store Profile & Security Settings */}
        {activeTab === 'store' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', textAlign: 'left' }}>
            {/* Left Card: Store Basic Information */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🏪 門市基本資料與資訊設定
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  管理門市對外顯示的名稱、統編、電話與實體店面營業地址。
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>門市名稱:</span>
                <input 
                  type="text" 
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="例如: 龍城麵線"
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>統一編號 (統編):</span>
                <input 
                  type="text" 
                  placeholder="8 位數統編，例如: 12345678"
                  value={newStoreTaxId}
                  onChange={(e) => setNewStoreTaxId(e.target.value)}
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>📞 門市聯絡電話:</span>
                <input 
                  type="text" 
                  placeholder="例如: 02-2345-6789"
                  value={newStorePhone}
                  onChange={(e) => setNewStorePhone(e.target.value)}
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>📍 門市營業地址:</span>
                <input 
                  type="text" 
                  placeholder="例如: 台北市大安區新生南路一段..."
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>📶 顧客 Wi-Fi 帳密:</span>
                <input 
                  type="text" 
                  placeholder="例如: Dragon_WiFi / 88888888"
                  value={newStoreWifi}
                  onChange={(e) => setNewStoreWifi(e.target.value)}
                  style={{ padding: '10px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)' }}
                />
              </div>

              <button
                onClick={async () => {
                  try {
                    const profileData = {
                      ...storeProfile,
                      storeName: newStoreName.trim() || '龍城麵線',
                      storeTaxId: newStoreTaxId.trim(),
                      storePhone: newStorePhone.trim(),
                      storeAddress: newStoreAddress.trim(),
                      storeWifi: newStoreWifi.trim(),
                      receiptFooter: newReceiptFooter.trim() || '謝謝惠顧，歡迎再度光臨！'
                    };

                    const profKey = prefixNameForStore('SYSTEM_SETTING_STORE_PROFILE', storeCode);
                    const { data: existProfile } = await supabase.from('menu_items').select('*').eq('name', profKey);
                    if (existProfile && existProfile.length > 0) {
                      await supabase.from('menu_items').update({ description: JSON.stringify(profileData) }).eq('name', profKey);
                    } else {
                      await supabase.from('menu_items').insert([{ name: profKey, price: 0, category: 'settings', description: JSON.stringify(profileData) }]);
                    }

                    await supabase.from('menu_items').upsert([
                      { name: prefixNameForStore('SYSTEM_SETTING_STORE_NAME', storeCode), price: 0, category: 'settings', description: profileData.storeName },
                      { name: prefixNameForStore('SYSTEM_SETTING_STORE_TAX_ID', storeCode), price: 0, category: 'settings', description: profileData.storeTaxId },
                      { name: prefixNameForStore('SYSTEM_SETTING_STORE_PHONE', storeCode), price: 0, category: 'settings', description: profileData.storePhone },
                      { name: prefixNameForStore('SYSTEM_SETTING_STORE_ADDRESS', storeCode), price: 0, category: 'settings', description: profileData.storeAddress },
                      { name: prefixNameForStore('SYSTEM_SETTING_STORE_WIFI', storeCode), price: 0, category: 'settings', description: profileData.storeWifi }
                    ], { onConflict: 'name' });

                    setStoreName(profileData.storeName);
                    setStoreTaxId(profileData.storeTaxId);
                    setStorePhone(profileData.storePhone);
                    setStoreAddress(profileData.storeAddress);
                    setStoreWifi(profileData.storeWifi);
                    setStoreProfile(profileData);

                    alert("門市基本資訊已成功儲存並同步雲端！");
                  } catch (e) {
                    alert("儲存失敗：" + e.message);
                  }
                }}
                style={{ padding: '12px 20px', fontSize: '0.9rem', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '8px' }}
              >
                💾 儲存門市基本資訊
              </button>
            </div>

            {/* Right Card: Security PIN & Custom Addons / Sauces triggers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Admin PIN Card */}
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 'bold', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🔐 管理員後台登入 PIN 密碼
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    用於店長登入後台管理系統、營業記帳系統與執行今日打烊收店。
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <input 
                      type={showAdminPinText ? "text" : "password"}
                      maxLength={8}
                      value={newAdminPin}
                      onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="4~8 位數字 (例如 8888)"
                      style={{ width: '100%', padding: '10px 40px 10px 14px', fontSize: '1.15rem', letterSpacing: '4px', fontFamily: 'monospace', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-body)', textAlign: 'center', fontWeight: 'bold' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPinText(prev => !prev)}
                      title={showAdminPinText ? "隱藏密碼" : "顯示密碼"}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        padding: '4px',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {showAdminPinText ? '👁️' : '🙈'}
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      if (!newAdminPin.trim() || newAdminPin.length < 4 || newAdminPin.length > 8) {
                        return alert("密碼長度必須為 4 至 8 位純數字（例如 4 碼或 6 碼）！");
                      }
                      try {
                        const pinKey = prefixNameForStore('SYSTEM_SETTING_ADMIN_PIN', storeCode);
                        const { data: exist } = await supabase.from('menu_items').select('*').eq('name', pinKey);
                        if (exist && exist.length > 0) {
                          await supabase.from('menu_items').update({ description: newAdminPin.trim() }).eq('name', pinKey);
                        } else {
                          await supabase.from('menu_items').insert([{ name: pinKey, price: 0, category: 'settings', description: newAdminPin.trim() }]);
                        }
                        setAdminPin(newAdminPin.trim());
                        alert("🎉 管理員密碼已成功更新！");
                      } catch (e) {
                        alert("儲存密碼失敗：" + e.message);
                      }
                    }}
                    style={{ padding: '10px 20px', fontSize: '0.9rem', backgroundColor: '#ea580c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  >
                    儲存密碼
                  </button>
                </div>
              </div>


            </div>
          </div>
        )}

        {/* SaaS Multi-Store Management Tab (Master Only) */}
        {isMasterAdmin && activeTab === 'saas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
            
            {/* Store switcher banner */}
            <div style={{
              backgroundColor: '#7c3aed',
              color: 'white',
              borderRadius: '12px',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
            }}>
              <div>
                <span style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: 'bold' }}>SaaS 多門市加盟與客戶管理總台</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.4rem', fontWeight: '900' }}>
                  🏢 目前管理門市：【 {newStoreName.trim() || storeName || '龍城麵線'} 】
                  <span style={{ fontSize: '0.9rem', fontWeight: 'normal', opacity: 0.85, marginLeft: '8px' }}>
                    (代碼: {storeCode})
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewClientStaffToken(generateRandomStoreToken('st'));
                  setShowNewStoreModal(true);
                }}
                style={{
                  padding: '12px 24px',
                  fontSize: '0.95rem',
                  fontWeight: '900',
                  backgroundColor: '#ffffff',
                  color: '#7c3aed',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ➕ 一鍵開通新客戶門市
              </button>
            </div>

            {/* Registered Stores Table */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📋 已開通客戶門市列表 ({registeredStores.length} 間)
              </h4>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-body)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>門市名稱</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>公開代碼 (顧客端)</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>🔐 內部安全金鑰 (POS/後台)</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>預設管理 PIN</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>開通日期</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>操作與專屬連結</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredStores.map((st, idx) => {
                      const links = getStoreLinks(st.code);
                      const isCurrent = st.code === storeCode;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)', backgroundColor: isCurrent ? 'rgba(124, 58, 237, 0.05)' : 'transparent' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>
                            {st.name} {isCurrent && <span style={{ fontSize: '0.7rem', color: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>目前選中</span>}
                          </td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {st.code}
                          </td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#7c3aed' }}>
                            {st.staffToken || (st.code === 'dragon' ? 'dg_8f2a1c' : (st.code === 'luzhou' ? 'lz_9b7e41' : '自動配發'))}
                          </td>
                          <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                            {st.adminPin || '8888'}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                            {st.createdAt || '2026-01-01'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                              {!isCurrent ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetToken = st.staffToken || (st.code === 'dragon' ? 'dg_8f2a1c' : (st.code === 'luzhou' ? 'lz_9b7e41' : st.code));
                                    window.location.search = `?store=${targetToken}&admin=true`;
                                  }}
                                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #7c3aed', color: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.05)', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  🔄 切換管理此店菜單
                                </button>
                              ) : (
                                <span style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold' }}>
                                  ✓ 目前管理中
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStore(st);
                                  setEditStoreName(st.name);
                                  setEditStoreCode(st.code);
                                  setEditStaffToken(st.staffToken || (st.code === 'dragon' ? 'dg_8f2a1c' : (st.code === 'luzhou' ? 'lz_9b7e41' : '')));
                                  setEditAdminPin(st.adminPin || '8888');
                                }}
                                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #ea580c', color: '#ea580c', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                ✏️ 編輯基本資料
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCreatedStoreLinks({ ...links, name: st.name, code: st.code, pin: st.adminPin || '8888' });
                                }}
                                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                🔗 網址
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const text = `【${st.name}】專屬餐飲系統入口\n\n📱 顧客掃碼點餐：${links.customerUrl}\n💵 現場 POS 收銀：${links.posUrl}\n📊 營業記帳系統：${links.bookkeepingUrl}\n🛠️ 後台管理系統：${links.adminUrl}\n🔐 統一登入入口：${links.loginUrl}\n\n🔑 預設後台管理 PIN 碼：${st.adminPin || '8888'}`;
                                  navigator.clipboard.writeText(text);
                                  alert(`已成功複製【${st.name}】全套系統連結與登入 PIN 碼！可直接傳給客戶。`);
                                }}
                                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                📋 複製
                              </button>
                              {st.code !== 'dragon' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStore(st)}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                                  title="移除門市"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal: Create New Client Store */}
            {showNewStoreModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', boxShadow: 'var(--shadow-lg)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    ➕ 開通新客戶門市 (1 秒即時建置)
                  </h3>

                  <form onSubmit={handleCreateNewTenantStore} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>1. 客戶店名 (門市顯示名稱) *</label>
                      <input
                        type="text"
                        placeholder="例如: 清心涼麵、阿財古早味"
                        value={newClientStoreName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewClientStoreName(val);
                          if (!newClientStaffToken) {
                            setNewClientStaffToken(generateRandomStoreToken(newClientStoreCode || 'st'));
                          }
                        }}
                        required
                        style={{ padding: '9px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>2. 門市公開代碼 (顧客點餐使用) *</label>
                        <button
                          type="button"
                          onClick={() => {
                            const randCode = 'st_' + Math.random().toString(36).substr(2, 5);
                            setNewClientStoreCode(randCode);
                            if (!newClientStaffToken) {
                              setNewClientStaffToken(generateRandomStoreToken(randCode));
                            }
                          }}
                          style={{ padding: '2px 8px', fontSize: '0.72rem', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                          🎲 隨機代碼
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="例如: qingxin、a-cai、shop88"
                        value={newClientStoreCode}
                        onChange={(e) => {
                          const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                          setNewClientStoreCode(clean);
                          if (!newClientStaffToken && clean) {
                            setNewClientStaffToken(generateRandomStoreToken(clean));
                          }
                        }}
                        required
                        style={{ padding: '9px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', fontFamily: 'monospace' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        📱 顧客點餐網址：https://dragon.twabc.com/?store={newClientStoreCode || '代碼'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#7c3aed' }}>
                          3. 🔐 內部專屬安全金鑰 (POS / 記帳 / 後台私鑰) *
                        </label>
                        <button
                          type="button"
                          onClick={() => setNewClientStaffToken(generateRandomStoreToken(newClientStoreCode || 'st'))}
                          style={{ padding: '2px 8px', fontSize: '0.72rem', backgroundColor: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: '1px solid #7c3aed', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          🎲 重新生成金鑰
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="例如: qx_9b7e41"
                          value={newClientStaffToken}
                          onChange={(e) => setNewClientStaffToken(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                          required
                          style={{ flex: 1, padding: '9px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '2px solid #7c3aed', backgroundColor: 'var(--bg-body)', color: '#7c3aed', fontFamily: 'monospace', fontWeight: 'bold' }}
                        />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#7c3aed', lineHeight: '1.4' }}>
                        🛡️ 僅有帶此金鑰網址才能開啟內部系統；若外部人員嘗試用公開代碼進入，將直接顯示 404 死頁！
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>4. 預設管理員 PIN 碼 (4~8 位數字)</label>
                      <input
                        type="text"
                        placeholder="預設 8888"
                        value={newClientAdminPin}
                        onChange={(e) => setNewClientAdminPin(e.target.value.replace(/\D/g, ''))}
                        maxLength={8}
                        style={{ padding: '9px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', letterSpacing: '2px', fontFamily: 'monospace' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>初始範本菜單</label>
                      <select
                        value={newClientTemplate}
                        onChange={(e) => setNewClientTemplate(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                      >
                        <option value="noodle">🍜 麵線小吃類初始菜單範本</option>
                        <option value="general">🍱 便當簡餐類初始菜單範本</option>
                        <option value="blank">⚪ 空白菜單 (由客戶自行在後台新增)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setShowNewStoreModal(false)}
                        style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        style={{ flex: 1.5, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}
                      >
                        🚀 立即開通新門市
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Edit Existing Client Store */}
            {editingStore && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                      ✏️ 編輯門市資料：【{editingStore.name}】
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingStore(null)}
                      style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveEditedStore} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>1. 門市顯示名稱 *</label>
                      <input
                        type="text"
                        value={editStoreName}
                        onChange={(e) => setEditStoreName(e.target.value)}
                        required
                        style={{ padding: '9px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>2. 門市公開代碼 (顧客點餐使用) *</label>
                      <input
                        type="text"
                        value={editStoreCode}
                        disabled={editingStore.code === 'dragon'}
                        onChange={(e) => setEditStoreCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        required
                        style={{ padding: '9px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: editingStore.code === 'dragon' ? 'var(--bg-body)' : 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'monospace', opacity: editingStore.code === 'dragon' ? 0.7 : 1 }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        📱 顧客點餐網址：https://dragon.twabc.com/?store={editStoreCode}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#7c3aed' }}>
                          3. 🔐 內部專屬安全金鑰 (POS / 記帳 / 後台私鑰) *
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditStaffToken(generateRandomStoreToken(editStoreCode || 'st'))}
                          style={{ padding: '2px 8px', fontSize: '0.72rem', backgroundColor: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: '1px solid #7c3aed', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          🎲 重新生成金鑰
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editStaffToken}
                        onChange={(e) => setEditStaffToken(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        required
                        style={{ padding: '9px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '2px solid #7c3aed', backgroundColor: 'var(--bg-body)', color: '#7c3aed', fontFamily: 'monospace', fontWeight: 'bold' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>4. 管理員後台登入 PIN 碼 (4~8 位數字)</label>
                      <input
                        type="text"
                        value={editAdminPin}
                        onChange={(e) => setEditAdminPin(e.target.value.replace(/\D/g, ''))}
                        maxLength={8}
                        style={{ padding: '9px 12px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', letterSpacing: '2px', fontFamily: 'monospace' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setEditingStore(null)}
                        style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        style={{ flex: 1.5, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#ea580c', color: 'white', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(234,88,12,0.3)' }}
                      >
                        💾 儲存修改
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Store Links Display */}
            {createdStoreLinks && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '100%', boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '2.5rem' }}>🎉</span>
                    <h3 style={{ margin: '4px 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                      【{createdStoreLinks.name}】專屬系統網址
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      門市代碼: <strong>{createdStoreLinks.code}</strong> ｜ 後台 PIN: <strong>{createdStoreLinks.pin}</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 'bold', color: '#ea580c' }}>📱 顧客線上點餐網址:</div>
                      <a href={createdStoreLinks.customerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', wordBreak: 'break-all' }}>
                        {createdStoreLinks.customerUrl}
                      </a>
                    </div>
                    <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 'bold', color: '#2563eb' }}>💵 現場 POS 收銀網址:</div>
                      <a href={createdStoreLinks.posUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#2563eb', wordBreak: 'break-all' }}>
                        {createdStoreLinks.posUrl}
                      </a>
                    </div>
                    <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 'bold', color: '#16a34a' }}>📊 營業記帳系統網址:</div>
                      <a href={createdStoreLinks.bookkeepingUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#16a34a', wordBreak: 'break-all' }}>
                        {createdStoreLinks.bookkeepingUrl}
                      </a>
                    </div>
                    <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 'bold', color: '#7c3aed' }}>🔐 統一登入入口網址:</div>
                      <a href={createdStoreLinks.loginUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#7c3aed', wordBreak: 'break-all' }}>
                        {createdStoreLinks.loginUrl}
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                    <button
                      type="button"
                      onClick={() => setCreatedStoreLinks(null)}
                      style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      關閉視窗
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const text = `【${createdStoreLinks.name}】專屬餐飲系統入口\n\n📱 顧客掃碼點餐：${createdStoreLinks.customerUrl}\n💵 現場 POS 收銀：${createdStoreLinks.posUrl}\n📊 營業記帳系統：${createdStoreLinks.bookkeepingUrl}\n🛠️ 後台管理系統：${createdStoreLinks.adminUrl}\n🔐 統一登入入口：${createdStoreLinks.loginUrl}\n\n🔑 預設後台管理 PIN 碼：${createdStoreLinks.pin}`;
                        navigator.clipboard.writeText(text);
                        alert("已成功複製全套連結與 PIN 碼！");
                      }}
                      style={{ flex: 1.5, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      📋 一鍵複製給客戶
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}


        {activeTab === 'blacklist' && (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', textAlign: 'left' }}>
            {/* Add to Blacklist panel */}
            <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                🚫 新增黑名單號碼
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>顧客電話號碼</label>
                <input
                  type="text"
                  placeholder="例如: 0912345678"
                  value={newBlacklistPhone}
                  onChange={(e) => setNewBlacklistPhone(e.target.value)}
                  style={{ padding: '10px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>黑名單備註原因</label>
                <input
                  type="text"
                  placeholder="例如: 送單後未取餐 / 惡意電話騷擾"
                  value={newBlacklistReason}
                  onChange={(e) => setNewBlacklistReason(e.target.value)}
                  style={{ padding: '10px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>
              <button
                onClick={handleAddBlacklist}
                style={{ padding: '10px', fontSize: '0.9rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '6px' }}
              >
                ➕ 加入黑名單
              </button>
            </div>

            {/* Blacklist List panel */}
            <div style={{ flex: 2, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                📋 已封鎖清單 ({blacklist.length} 筆)
              </h4>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '10px', color: 'var(--text-muted)' }}>電話號碼</th>
                      <th style={{ padding: '10px', color: 'var(--text-muted)' }}>備註原因</th>
                      <th style={{ padding: '10px', color: 'var(--text-muted)' }}>封鎖時間</th>
                      <th style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blacklist.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          目前沒有任何黑名單號碼。
                        </td>
                      </tr>
                    ) : (
                      blacklist.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold', color: 'var(--text-main)' }}>{item.phone}</td>
                          <td style={{ padding: '10px', color: 'var(--text-main)' }}>{item.reason}</td>
                          <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-TW', { hour12: false }) : '無'}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleRemoveBlacklist(item.phone)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: 'transparent', color: '#16a34a', border: '1px solid #16a34a', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              🔓 解除封鎖
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
            border: '1px solid var(--border)', width: '500px', maxWidth: '95%',
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
                    value={addon.label || ''}
                    onChange={(e) => {
                      const updated = [...tempAddons];
                      updated[idx].label = e.target.value;
                      setTempAddons(updated);
                    }}
                    style={{ flex: 2, minWidth: 0, padding: '6px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: '0 0 70px' }}>
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
                    disabled={idx === 0}
                    onClick={() => {
                      const updated = [...tempAddons];
                      const temp = updated[idx];
                      updated[idx] = updated[idx - 1];
                      updated[idx - 1] = temp;
                      setTempAddons(updated);
                    }}
                    style={{ padding: '4px 6px', fontSize: '0.75rem', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1, color: 'var(--text-main)', flexShrink: 0 }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={idx === tempAddons.length - 1}
                    onClick={() => {
                      const updated = [...tempAddons];
                      const temp = updated[idx];
                      updated[idx] = updated[idx + 1];
                      updated[idx + 1] = temp;
                      setTempAddons(updated);
                    }}
                    style={{ padding: '4px 6px', fontSize: '0.75rem', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', cursor: idx === tempAddons.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === tempAddons.length - 1 ? 0.3 : 1, color: 'var(--text-main)', flexShrink: 0 }}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAddons(tempAddons.filter((_, i) => i !== idx));
                    }}
                    style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}
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
                  const filtered = tempAddons.filter(a => a && a.label && typeof a.label === 'string' && a.label.trim() !== '');
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

      {/* GLOBAL CONDIMENT MANAGEMENT MODAL */}
      {showCondimentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
            border: '1px solid var(--border)', width: '500px', maxWidth: '95%',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>🌶️ 全局調料品項與客製管理</h3>
              <button 
                type="button"
                onClick={() => setShowCondimentModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
              {tempCondiments.map((cond, idx) => (
                <div key={idx} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-body)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>調料品項名稱</span>
                      <input 
                        type="text" 
                        placeholder="例如: 香菜、蒜泥、烏醋、辣醬..."
                        value={cond.name || ''}
                        onChange={(e) => {
                          const updated = [...tempCondiments];
                          updated[idx].name = e.target.value;
                          setTempCondiments(updated);
                        }}
                        style={{ padding: '8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                      />
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>模式</span>
                      <select
                        value={cond.mode || 'checkbox'}
                        onChange={(e) => {
                          const updated = [...tempCondiments];
                          updated[idx].mode = e.target.value;
                          if (e.target.value === 'checkbox') {
                            updated[idx].choices = ['加', '不加'];
                            updated[idx].default = '加';
                          } else {
                            updated[idx].choices = ['不辣', '微辣', '中辣', '大辣'];
                            updated[idx].default = '不辣';
                          }
                          setTempCondiments(updated);
                        }}
                        style={{ padding: '8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                      >
                        <option value="checkbox">✔️ 勾選模式</option>
                        <option value="multi">📋 多選項模式</option>
                      </select>
                    </div>
                    
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const updated = [...tempCondiments];
                        const temp = updated[idx];
                        updated[idx] = updated[idx - 1];
                        updated[idx - 1] = temp;
                        setTempCondiments(updated);
                      }}
                      style={{ alignSelf: 'flex-end', height: '34px', padding: '0 8px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1, color: 'var(--text-main)' }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === tempCondiments.length - 1}
                      onClick={() => {
                        const updated = [...tempCondiments];
                        const temp = updated[idx];
                        updated[idx] = updated[idx + 1];
                        updated[idx + 1] = temp;
                        setTempCondiments(updated);
                      }}
                      style={{ alignSelf: 'flex-end', height: '34px', padding: '0 8px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: '4px', cursor: idx === tempCondiments.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === tempCondiments.length - 1 ? 0.3 : 1, color: 'var(--text-main)' }}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempCondiments(tempCondiments.filter((_, i) => i !== idx));
                      }}
                      style={{ alignSelf: 'flex-end', height: '34px', padding: '0 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                    >
                      🗑️ 刪除
                    </button>
                  </div>

                  {cond.mode === 'multi' ? (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ flex: 2.5, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>選項內容 (以半角逗號隔開)</span>
                        <input 
                          type="text"
                          placeholder="例如: 不辣,微辣,中辣,大辣"
                          value={cond.choices ? cond.choices.join(',') : ''}
                          onChange={(e) => {
                            const updated = [...tempCondiments];
                            updated[idx].choices = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            setTempCondiments(updated);
                          }}
                          style={{ padding: '6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                        />
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>預設選項</span>
                        <select
                          value={cond.default || ''}
                          onChange={(e) => {
                            const updated = [...tempCondiments];
                            updated[idx].default = e.target.value;
                            setTempCondiments(updated);
                          }}
                          style={{ padding: '6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                        >
                          {(cond.choices || []).map(choice => (
                            <option key={choice} value={choice}>{choice}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>預設行為</span>
                        <select
                          value={cond.default === '不加' ? '不加' : '加'}
                          onChange={(e) => {
                            const updated = [...tempCondiments];
                            updated[idx].default = e.target.value;
                            setTempCondiments(updated);
                          }}
                          style={{ padding: '6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                        >
                          <option value="加">預設要加 (預設打勾)</option>
                          <option value="不加">預設不加 (預設不勾)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => {
                  setTempCondiments([...tempCondiments, { name: '', mode: 'checkbox', choices: ['加', '不加'], default: '加' }]);
                }}
                style={{ padding: '8px', backgroundColor: 'var(--bg-body)', border: '1px dashed var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', width: '100%', marginTop: '6px', color: 'var(--text-main)' }}
              >
                ＋ 新增調料項目
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCondimentModal(false)}
                style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const formatted = tempCondiments
                    .filter(c => c && c.name && typeof c.name === 'string' && c.name.trim() !== '')
                    .map(c => ({
                      name: c.name.trim(),
                      mode: c.mode || 'checkbox',
                      choices: c.choices || ['加', '不加'],
                      default: c.default || '加'
                    }));
                  handleSaveGlobalCondiments(formatted);
                }}
                style={{ flex: 1.5, padding: '8px', border: 'none', borderRadius: '6px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                💾 儲存並同步雲端
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* CATEGORY MANAGER MODAL */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1010,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
            border: '1px solid var(--border)', width: '480px', maxWidth: '96%', boxSizing: 'border-box',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>🏪 商品類別管理</h3>
              <button 
                type="button"
                onClick={() => setShowCategoryModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {productCategories.map((cat, idx) => (
                <div key={cat.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-body)' }}>
                  <IconPicker
                    value={cat.icon || '🍜'}
                    onChange={(icon) => {
                      const updated = [...productCategories];
                      updated[idx].icon = icon;
                      setProductCategories(updated);
                    }}
                  />
                  <input 
                    type="text" 
                    value={cat.name} 
                    onChange={(e) => {
                      const updated = [...productCategories];
                      updated[idx].name = e.target.value;
                      setProductCategories(updated);
                    }}
                    placeholder="類別名稱"
                    style={{ flex: 1, padding: '8px 10px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                      if (cat.id === 'mee-sua' || cat.id === 'specialties') {
                        alert("預設核心類別無法刪除！");
                        return;
                      }
                      setProductCategories(productCategories.filter(c => c.id !== cat.id));
                    }} 
                    style={{ padding: '8px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                    title="刪除此類別"
                  >
                    🗑️
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '8px', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>➕ 新增自訂商品類別：</span>
                
                {/* Single Clean Row: Icon Picker + Category Name + Add Button */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                  <IconPicker
                    value={newCategoryIcon}
                    onChange={setNewCategoryIcon}
                  />
                  <input 
                    type="text" 
                    placeholder="輸入類別名稱 (如: 沁涼飲料、精選小菜)" 
                    value={newCategoryName} 
                    onChange={(e) => setNewCategoryName(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!newCategoryName.trim()) {
                          alert("請輸入類別名稱！");
                          return;
                        }
                        const autoId = 'cat_' + Date.now().toString(36);
                        setProductCategories([...productCategories, {
                          id: autoId,
                          name: newCategoryName.trim(),
                          icon: newCategoryIcon.trim() || '🍜'
                        }]);
                        setNewCategoryName('');
                        setNewCategoryIcon('🍜');
                      }
                    }}
                    style={{ flex: 1, minWidth: 0, padding: '8px 12px', fontSize: '0.88rem', borderRadius: '6px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', boxSizing: 'border-box' }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                      if (!newCategoryName.trim()) {
                        alert("請輸入類別名稱！");
                        return;
                      }
                      const autoId = 'cat_' + Date.now().toString(36);
                      setProductCategories([...productCategories, {
                        id: autoId,
                        name: newCategoryName.trim(),
                        icon: newCategoryIcon.trim() || '🍜'
                      }]);
                      setNewCategoryName('');
                      setNewCategoryIcon('🍜');
                    }}
                    style={{ padding: '8px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    ➕ 新增
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setShowCategoryModal(false)}
                style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}
              >
                取消
              </button>
              <button 
                type="button" 
                onClick={() => {
                  handleSaveGlobalCategories(productCategories);
                  setShowCategoryModal(false);
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
