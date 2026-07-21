import React, { useState, useEffect } from 'react';
import CustomerView from './components/CustomerView';
import CashierView from './components/CashierView';
import BookkeepingView from './components/BookkeepingView';
import ManagementView from './components/ManagementView';
import PinLockScreen from './components/PinLockScreen';
import StaffLoginScreen from './components/StaffLoginScreen';
import { supabase } from './supabaseClient';

function App() {
  const [role, setRole] = useState(null); // 'customer', 'pos', 'bookkeeping', 'management', or null (demo selection)
  const [tableNumber, setTableNumber] = useState(null);
  const [storeName, setStoreName] = useState('龍城麵線');
  
  // Authentication states
  const [isCashierAuth, setIsCashierAuth] = useState(() => {
    return localStorage.getItem('is_cashier_authenticated') === 'true' ||
           sessionStorage.getItem('is_cashier_authenticated') === 'true';
  });
  const [isBookkeepingAuth, setIsBookkeepingAuth] = useState(() => {
    return localStorage.getItem('is_bookkeeping_authenticated') === 'true' ||
           sessionStorage.getItem('is_bookkeeping_authenticated') === 'true';
  });
  const [isManagementAuth, setIsManagementAuth] = useState(() => {
    return localStorage.getItem('is_management_authenticated') === 'true' ||
           sessionStorage.getItem('is_management_authenticated') === 'true';
  });
  const [cashierName, setCashierName] = useState(() => {
    return localStorage.getItem('cashier_name') || sessionStorage.getItem('cashier_name') || '';
  });

  // Cache buster to clear stale local storage states across client devices
  useEffect(() => {
    const CURRENT_VERSION = "2.2.0";
    const localVersion = localStorage.getItem('app_version');
    if (localVersion !== CURRENT_VERSION) {
      localStorage.removeItem('restaurant_closed_dates');
      localStorage.removeItem('restaurant_orders');
      localStorage.removeItem('restaurant_purchases');
      localStorage.removeItem('restaurant_fixed_costs');
      localStorage.setItem('app_version', CURRENT_VERSION);
      
      // Unregister service workers if any
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let r of registrations) r.unregister();
        });
      }
      
      console.log("App version upgraded to " + CURRENT_VERSION + ", cleared local storage cache.");
      window.location.reload();
    }
  }, []);

  // Check hostname and URL parameters for immediate routing
  useEffect(() => {
    const hostname = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    const adminParam = params.get('admin');
    const posParam = params.get('pos');
    const bookkeepingParam = params.get('bookkeeping');
    const demoParam = params.get('demo');

    // 1. Subdomain-based routing (pos.* -> POS, admin.* -> Management, bookkeeping.* -> Bookkeeping)
    if (hostname.startsWith('pos.')) {
      setRole('pos');
    } else if (hostname.startsWith('admin.')) {
      setRole('management');
    } else if (hostname.startsWith('bookkeeping.')) {
      setRole('bookkeeping');
    }
    // 2. URL parameter routing
    else if (adminParam === 'true' || params.get('management') === 'true') {
      setRole('management');
    } else if (posParam === 'true') {
      setRole('pos');
    } else if (bookkeepingParam === 'true') {
      setRole('bookkeeping');
    } else if (tableParam) {
      setTableNumber(tableParam);
      setRole('customer');
    } else if (demoParam === 'true') {
      setRole(null);
    } else {
      // Default to customer view for other hostnames
      setRole('customer');
      setTableNumber(null);
    }
  }, []);

  const handleSelectCustomer = (tableNum = null) => {
    setTableNumber(tableNum);
    setRole('customer');
    const newUrl = tableNum 
      ? `${window.location.pathname}?table=${tableNum}` 
      : window.location.pathname;
    window.history.pushState({}, '', newUrl);
  };

  const handleSelectKitchen = () => {
    setRole('management');
    window.history.pushState({}, '', `${window.location.pathname}?management=true`);
  };

  const handleSelectPos = () => {
    setRole('pos');
    window.history.pushState({}, '', `${window.location.pathname}?pos=true`);
  };

  const handleSelectBookkeeping = () => {
    setRole('bookkeeping');
    window.history.pushState({}, '', `${window.location.pathname}?bookkeeping=true`);
  };

  const handleSelectManagement = () => {
    setRole('management');
    window.history.pushState({}, '', `${window.location.pathname}?management=true`);
  };

  useEffect(() => {
    supabase.from('menu_items')
      .select('*')
      .eq('name', 'SYSTEM_SETTING_STORE_NAME')
      .single()
      .then(({ data }) => {
        if (data && data.description) {
          setStoreName(data.description);
        }
      });
  }, [role]);

  const handleBackToDemo = () => {
    setRole(null);
    setTableNumber(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleCashierAuthSuccess = (employeeName) => {
    setIsCashierAuth(true);
    setCashierName(employeeName);
    localStorage.setItem('is_cashier_authenticated', 'true');
    localStorage.setItem('cashier_name', employeeName);
  };

  const handleCashierLogout = () => {
    setIsCashierAuth(false);
    setCashierName('');
    localStorage.removeItem('is_cashier_authenticated');
    sessionStorage.removeItem('is_cashier_authenticated');
    localStorage.removeItem('cashier_name');
    sessionStorage.removeItem('cashier_name');
  };

  const handleBookkeepingAuthSuccess = (remember) => {
    setIsBookkeepingAuth(true);
    if (remember) {
      localStorage.setItem('is_bookkeeping_authenticated', 'true');
    } else {
      sessionStorage.setItem('is_bookkeeping_authenticated', 'true');
    }
  };

  const handleBookkeepingLogout = () => {
    setIsBookkeepingAuth(false);
    localStorage.removeItem('is_bookkeeping_authenticated');
    sessionStorage.removeItem('is_bookkeeping_authenticated');
  };

  const handleManagementAuthSuccess = (remember) => {
    setIsManagementAuth(true);
    if (remember) {
      localStorage.setItem('is_management_authenticated', 'true');
    } else {
      sessionStorage.setItem('is_management_authenticated', 'true');
    }
  };

  const handleManagementLogout = () => {
    setIsManagementAuth(false);
    localStorage.removeItem('is_management_authenticated');
    sessionStorage.removeItem('is_management_authenticated');
  };

  // Render view based on active role
  if (role === 'customer') {
    return (
      <CustomerView 
        tableNumber={tableNumber} 
        onBackToDemo={handleBackToDemo} 
      />
    );
  }

  if (role === 'pos') {
    if (!isCashierAuth) {
      return (
        <StaffLoginScreen 
          onSuccess={handleCashierAuthSuccess}
          title="現場收銀系統 (POS)"
          subtitle="請選擇收銀人員並輸入 PIN 碼進行驗證"
        />
      );
    }
    return (
      <CashierView 
        cashierName={cashierName}
        onLogout={handleCashierLogout}
        onBackToDemo={handleBackToDemo}
      />
    );
  }

  if (role === 'bookkeeping') {
    if (!isBookkeepingAuth) {
      return (
        <PinLockScreen 
          expectedPin="8888" 
          onSuccess={handleBookkeepingAuthSuccess}
          title="營業記帳與報表系統"
          subtitle="請輸入四位數管理員 PIN 碼進行驗證"
        />
      );
    }
    return (
      <BookkeepingView 
        onBackToDemo={handleBackToDemo} 
        onLogout={handleBookkeepingLogout}
      />
    );
  }

  if (role === 'management') {
    if (!isManagementAuth) {
      return (
        <PinLockScreen 
          expectedPin="8888" 
          onSuccess={handleManagementAuthSuccess}
          title="餐廳後台管理系統"
          subtitle="請輸入管理員四位數 PIN 碼解鎖管理功能"
        />
      );
    }
    return (
      <ManagementView 
        onBackToDemo={handleBackToDemo}
        onLogout={handleManagementLogout}
      />
    );
  }

  return (
    <div className="demo-shell" style={{ paddingBottom: '50px' }}>
      <span className="demo-logo">🥢</span>
      <h1 className="demo-title">{storeName} 餐廳點餐與接單系統</h1>
      <p className="demo-subtitle">
        專為麵線店打造的點餐與櫃檯收銀系統。支援內用掃碼、預約外帶自取與現場實體 POS，跨視窗即時接單同步。
      </p>

      <div className="demo-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        {/* Dine-in customer mock */}
        <div className="demo-card" onClick={() => handleSelectCustomer('5')}>
          <span className="demo-card-icon">📱</span>
          <h2 className="demo-card-title">模擬內用點餐</h2>
          <p className="demo-card-desc">
            模擬顧客掃描「5號桌」QR Code。系統會自動鎖定為內用並帶入桌號，下單後免排隊。
          </p>
          <button className="demo-btn">以 5 號桌進入</button>
        </div>

        {/* Takeout customer mock */}
        <div className="demo-card" onClick={() => handleSelectCustomer(null)}>
          <span className="demo-card-icon">🛍️</span>
          <h2 className="demo-card-title">模擬外帶點餐</h2>
          <p className="demo-card-desc">
            模擬線上點餐。顧客可輸入姓名、手機與選擇取餐時間，到店後快速結帳取餐。
          </p>
          <button className="demo-btn">以 外帶模式進入</button>
        </div>

        {/* Cashier POS view */}
        <div className="demo-card" onClick={handleSelectPos}>
          <span className="demo-card-icon">💵</span>
          <h2 className="demo-card-title">現場收銀系統 (POS)</h2>
          <p className="demo-card-desc">
            櫃檯實體收銀結帳系統。支援選取品項、加料客製、現金找零與自動送單至廚房。
            <br />
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold' }}>(預設 PIN 碼：6666)</span>
          </p>
          <button className="demo-btn" style={{ backgroundColor: '#16a34a' }}>進入收銀系統</button>
        </div>

        {/* Bookkeeping view */}
        <div className="demo-card" onClick={handleSelectBookkeeping}>
          <span className="demo-card-icon">📊</span>
          <h2 className="demo-card-title">營業記帳與報表</h2>
          <p className="demo-card-desc">
            獨立財務對帳系統。登錄固定與進貨變動成本、調取流水明細、匯出月報表與每日收店。
            <br />
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold' }}>(預設 PIN 碼：8888)</span>
          </p>
          <button className="demo-btn" style={{ backgroundColor: '#8b5cf6' }}>進入記帳系統</button>
        </div>

        {/* Management view */}
        <div className="demo-card" onClick={handleSelectManagement}>
          <span className="demo-card-icon">🛠️</span>
          <h2 className="demo-card-title">後台管理系統</h2>
          <p className="demo-card-desc">
            產品與員工班表管理。可變更商品名稱、價格、圖片，並管理收銀員名單與登入密碼 ("點名")。
            <br />
            <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold' }}>(預設 PIN 碼：8888)</span>
          </p>
          <button className="demo-btn" style={{ backgroundColor: '#0284c7' }}>進入管理系統</button>
        </div>
      </div>

      <div 
        style={{ 
          marginTop: '40px', 
          padding: '16px', 
          backgroundColor: 'rgba(255, 107, 53, 0.05)', 
          borderRadius: 'var(--radius-md)',
          maxWidth: '650px',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          lineHeight: '1.6',
          border: '1px dashed var(--primary)',
          textAlign: 'left',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}
      >
        <strong style={{ color: 'var(--primary)' }}>💡 龍城麵線系統測試教學：</strong>
        <ol style={{ paddingLeft: '20px', marginTop: '6px' }}>
          <li>在新分頁開啟 <strong>「現場收銀系統 (POS)」</strong> (PIN `6666`) 進行收銀結帳，切換 📋 選單可即時接單與「自動列印收據」。</li>
          <li>在新分頁開啟 <strong>「模擬點餐」</strong> 進行顧客下單，下單的瞬間 POS 系統會自動發出提示音並開起列印收據。</li>
          <li>點選 <strong>「後台管理系統」</strong> (PIN `8888`) 可直接修改產品詳情（價格、圖片）與管理收銀人員。</li>
          <li>點選 <strong>「進入營業記帳與報表」</strong> (PIN `8888`) 可進行收店對帳。</li>
        </ol>
      </div>
    </div>
  );
}

export default App;
