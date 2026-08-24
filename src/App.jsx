import React, { useState, useEffect } from 'react';
import CustomerView from './components/CustomerView';
import CashierView from './components/CashierView';
import BookkeepingView from './components/BookkeepingView';
import ManagementView from './components/ManagementView';
import UnifiedLoginScreen from './components/UnifiedLoginScreen';
import { supabase } from './supabaseClient';
import { getActiveStoreCode, setActiveStoreCode, filterItemsByStore, getStoreSessionStorage, setStoreSessionStorage, isStaffTokenValid } from './utils/storeContext';

const getInitialRoleAndParams = () => {
  if (typeof window === 'undefined') {
    return { role: 'customer', table: null, store: 'dragon', isStaffValid: true };
  }
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const rawStore = params.get('store');
  const store = getActiveStoreCode();
  const table = params.get('table');

  const isStaffRoute = (
    hostname.startsWith('pos.') || hostname.startsWith('admin.') || hostname.startsWith('bookkeeping.') ||
    params.get('login') === 'true' || params.get('portal') === 'true' || params.get('demo') === 'true' ||
    params.get('admin') === 'true' || params.get('management') === 'true' ||
    params.get('pos') === 'true' || params.get('bookkeeping') === 'true'
  );

  // If user requests an internal staff portal, strictly verify the secret token!
  if (isStaffRoute) {
    if (!isStaffTokenValid(rawStore)) {
      return { role: 'dead_404', table: null, store, isStaffValid: false };
    }
  }

  if (hostname.startsWith('pos.')) return { role: 'pos', table: null, store, isStaffValid: true };
  if (hostname.startsWith('admin.')) return { role: 'management', table: null, store, isStaffValid: true };
  if (hostname.startsWith('bookkeeping.')) return { role: 'bookkeeping', table: null, store, isStaffValid: true };

  if (params.get('login') === 'true' || params.get('portal') === 'true' || params.get('demo') === 'true') {
    return { role: 'login', table: null, store, isStaffValid: true };
  }
  if (params.get('admin') === 'true' || params.get('management') === 'true') {
    return { role: 'management', table: null, store, isStaffValid: true };
  }
  if (params.get('pos') === 'true') {
    return { role: 'pos', table: null, store, isStaffValid: true };
  }
  if (params.get('bookkeeping') === 'true') {
    return { role: 'bookkeeping', table: null, store, isStaffValid: true };
  }
  if (table) {
    return { role: 'customer', table, store, isStaffValid: true };
  }
  return { role: 'customer', table: null, store, isStaffValid: true };
};

function App() {
  const initial = getInitialRoleAndParams();
  const [role, setRole] = useState(initial.role);
  const [tableNumber, setTableNumber] = useState(initial.table);
  const [storeCode, setStoreCode] = useState(() => initial.store || getActiveStoreCode());
  const [storeName, setStoreName] = useState('龍城麵線');
  const [adminPin, setAdminPin] = useState('8888');
  
  // 6 hours in milliseconds
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  const checkSessionValid = (authKey, timeKey) => {
    const scopedAuth = `${storeCode}_${authKey}`;
    const scopedTime = `${storeCode}_${timeKey}`;
    const isAuth = localStorage.getItem(scopedAuth) === 'true' || sessionStorage.getItem(scopedAuth) === 'true';
    if (!isAuth) return false;
    const loginTime = Number(localStorage.getItem(scopedTime) || sessionStorage.getItem(scopedTime) || 0);
    if (!loginTime || (Date.now() - loginTime > SIX_HOURS_MS)) {
      localStorage.removeItem(scopedAuth);
      sessionStorage.removeItem(scopedAuth);
      localStorage.removeItem(scopedTime);
      sessionStorage.removeItem(scopedTime);
      return false;
    }
    return true;
  };

  // Authentication states
  const [isCashierAuth, setIsCashierAuth] = useState(() => checkSessionValid('is_cashier_authenticated', 'pos_login_time'));
  const [isBookkeepingAuth, setIsBookkeepingAuth] = useState(() => checkSessionValid('is_bookkeeping_authenticated', 'bookkeeping_login_time'));
  const [isManagementAuth, setIsManagementAuth] = useState(() => checkSessionValid('is_management_authenticated', 'management_login_time'));
  const [cashierName, setCashierName] = useState(() => {
    return localStorage.getItem('cashier_name') || sessionStorage.getItem('cashier_name') || '';
  });
  const [posSessionId, setPosSessionId] = useState(() => {
    return (typeof window !== 'undefined') ? (sessionStorage.getItem(`${getActiveStoreCode()}_pos_session_id`) || '') : '';
  });

  // Cache buster to clear stale local storage states across client devices
  useEffect(() => {
    const CURRENT_VERSION = "2.5.0";
    const localVersion = localStorage.getItem('app_version');
    if (localVersion !== CURRENT_VERSION) {
      localStorage.clear();
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

  // Immediate URL routing and popstate listener (handles browser back/forward seamlessly!)
  const updateRouteFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const hostname = window.location.hostname;
    const rawStore = params.get('store');
    const resolvedStore = getActiveStoreCode();
    setStoreCode(resolvedStore);
    setActiveStoreCode(resolvedStore);

    const tableParam = params.get('table');
    const adminParam = params.get('admin');
    const posParam = params.get('pos');
    const bookkeepingParam = params.get('bookkeeping');
    const demoParam = params.get('demo');

    const isStaffRoute = (
      hostname.startsWith('pos.') || hostname.startsWith('admin.') || hostname.startsWith('bookkeeping.') ||
      params.get('login') === 'true' || params.get('portal') === 'true' || demoParam === 'true' ||
      adminParam === 'true' || params.get('management') === 'true' ||
      posParam === 'true' || bookkeepingParam === 'true'
    );

    if (isStaffRoute && !isStaffTokenValid(rawStore)) {
      setRole('dead_404');
      return;
    }

    if (hostname.startsWith('pos.')) {
      setRole('pos');
    } else if (hostname.startsWith('admin.')) {
      setRole('management');
    } else if (hostname.startsWith('bookkeeping.')) {
      setRole('bookkeeping');
    } else if (params.get('login') === 'true' || params.get('portal') === 'true' || demoParam === 'true') {
      setRole('login');
    } else if (adminParam === 'true' || params.get('management') === 'true') {
      setRole('management');
    } else if (posParam === 'true') {
      setRole('pos');
    } else if (bookkeepingParam === 'true') {
      setRole('bookkeeping');
    } else if (tableParam) {
      setTableNumber(tableParam);
      setRole('customer');
    } else {
      setRole('customer');
      setTableNumber(null);
    }
  };

  useEffect(() => {
    updateRouteFromUrl();
    window.addEventListener('popstate', updateRouteFromUrl);
    return () => window.removeEventListener('popstate', updateRouteFromUrl);
  }, []);

  // Build URL while safely preserving current secret store parameter
  const buildUrlWithStore = (extraParams = {}) => {
    const currentParams = new URLSearchParams(window.location.search);
    const rawStore = currentParams.get('store');
    const params = new URLSearchParams();
    if (rawStore) {
      params.set('store', rawStore);
    }
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== false) {
        params.set(k, String(v));
      }
    });
    const queryString = params.toString();
    return queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
  };

  const handleSelectCustomer = (tableNum = null) => {
    setTableNumber(tableNum);
    setRole('customer');
    window.history.pushState({}, '', buildUrlWithStore({ table: tableNum }));
  };

  const handleSelectKitchen = () => {
    setRole('management');
    window.history.pushState({}, '', buildUrlWithStore({ admin: 'true' }));
  };

  const handleSelectPos = () => {
    setRole('pos');
    window.history.pushState({}, '', buildUrlWithStore({ pos: 'true' }));
  };

  const handleSelectBookkeeping = () => {
    setRole('bookkeeping');
    window.history.pushState({}, '', buildUrlWithStore({ bookkeeping: 'true' }));
  };

  const handleSelectManagement = () => {
    setRole('management');
    window.history.pushState({}, '', buildUrlWithStore({ admin: 'true' }));
  };

  useEffect(() => {
    supabase.from('menu_items')
      .select('*')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const storeItems = filterItemsByStore(data, storeCode);
          const nameItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_STORE_NAME');
          if (nameItem && nameItem.description) {
            setStoreName(nameItem.description);
          }
          const pinItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_ADMIN_PIN');
          if (pinItem && pinItem.description) {
            setAdminPin(pinItem.description);
          }
        }
      });
  }, [role, storeCode]);

  const handleBackToDemo = () => {
    setRole(null);
    setTableNumber(null);
    window.history.pushState({}, '', buildUrlWithStore({ login: 'true' }));
  };

  const handleCashierAuthSuccess = (payload) => {
    const now = Date.now();
    const employeeName = typeof payload === 'object' && payload ? payload.staffName : String(payload || '');
    const sid = typeof payload === 'object' && payload ? payload.sessionId : '';
    
    setIsCashierAuth(true);
    setCashierName(employeeName);
    if (sid) {
      setPosSessionId(sid);
      setStoreSessionStorage('pos_session_id', sid, storeCode);
    }
    localStorage.setItem(`${storeCode}_is_cashier_authenticated`, 'true');
    localStorage.setItem(`${storeCode}_cashier_name`, employeeName);
    localStorage.setItem(`${storeCode}_pos_login_time`, String(now));
  };

  const handleCashierLogout = () => {
    setIsCashierAuth(false);
    setCashierName('');
    localStorage.removeItem(`${storeCode}_is_cashier_authenticated`);
    sessionStorage.removeItem(`${storeCode}_is_cashier_authenticated`);
    localStorage.removeItem(`${storeCode}_cashier_name`);
    sessionStorage.removeItem(`${storeCode}_cashier_name`);
    localStorage.removeItem(`${storeCode}_pos_session_id`);
    localStorage.removeItem(`${storeCode}_pos_login_time`);
    setRole('login');
    window.history.pushState({}, '', buildUrlWithStore({ login: 'true' }));
  };

  const handleBookkeepingAuthSuccess = (remember) => {
    const now = Date.now();
    setIsBookkeepingAuth(true);
    if (remember) {
      localStorage.setItem(`${storeCode}_is_bookkeeping_authenticated`, 'true');
      localStorage.setItem(`${storeCode}_bookkeeping_login_time`, String(now));
    } else {
      sessionStorage.setItem(`${storeCode}_is_bookkeeping_authenticated`, 'true');
      sessionStorage.setItem(`${storeCode}_bookkeeping_login_time`, String(now));
    }
  };

  const handleBookkeepingLogout = () => {
    setIsBookkeepingAuth(false);
    localStorage.removeItem(`${storeCode}_is_bookkeeping_authenticated`);
    sessionStorage.removeItem(`${storeCode}_is_bookkeeping_authenticated`);
    localStorage.removeItem(`${storeCode}_bookkeeping_login_time`);
    sessionStorage.removeItem(`${storeCode}_bookkeeping_login_time`);
    setRole('login');
    window.history.pushState({}, '', buildUrlWithStore({ login: 'true' }));
  };

  const handleManagementAuthSuccess = (remember) => {
    const now = Date.now();
    setIsManagementAuth(true);
    if (remember) {
      localStorage.setItem(`${storeCode}_is_management_authenticated`, 'true');
      localStorage.setItem(`${storeCode}_management_login_time`, String(now));
    } else {
      sessionStorage.setItem(`${storeCode}_is_management_authenticated`, 'true');
      sessionStorage.setItem(`${storeCode}_management_login_time`, String(now));
    }
  };

  const handleManagementLogout = () => {
    setIsManagementAuth(false);
    localStorage.removeItem(`${storeCode}_is_management_authenticated`);
    sessionStorage.removeItem(`${storeCode}_is_management_authenticated`);
    localStorage.removeItem(`${storeCode}_management_login_time`);
    sessionStorage.removeItem(`${storeCode}_management_login_time`);
    setRole('login');
    window.history.pushState({}, '', buildUrlWithStore({ login: 'true' }));
  };

  // Periodic 6-hour session expiration monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const now = Date.now();

      if (isCashierAuth) {
        const loginTime = Number(localStorage.getItem(`${storeCode}_pos_login_time`) || 0);
        if (loginTime && (now - loginTime > SIX_HOURS)) {
          handleCashierLogout();
          alert("⏱️ 登入已滿 6 小時，系統已自動登出 POS 收銀系統，請重新登入。");
        }
      }

      if (isBookkeepingAuth) {
        const loginTime = Number(localStorage.getItem(`${storeCode}_bookkeeping_login_time`) || sessionStorage.getItem(`${storeCode}_bookkeeping_login_time`) || 0);
        if (loginTime && (now - loginTime > SIX_HOURS)) {
          handleBookkeepingLogout();
          alert("⏱️ 登入已滿 6 小時，系統已自動登出記帳系統，請重新登入。");
        }
      }

      if (isManagementAuth) {
        const loginTime = Number(localStorage.getItem(`${storeCode}_management_login_time`) || sessionStorage.getItem(`${storeCode}_management_login_time`) || 0);
        if (loginTime && (now - loginTime > SIX_HOURS)) {
          handleManagementLogout();
          alert("⏱️ 登入已滿 6 小時，系統已自動登出後台管理系統，請重新登入。");
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isCashierAuth, isBookkeepingAuth, isManagementAuth, storeCode]);

  const handleUnifiedLoginSuccess = (targetRole, payload) => {
    setRole(targetRole);
    const param = targetRole === 'management' ? 'admin' : (targetRole === 'bookkeeping' ? 'bookkeeping' : 'pos');
    window.history.pushState({}, '', buildUrlWithStore({ [param]: 'true' }));
    if (targetRole === 'pos') {
      handleCashierAuthSuccess(payload);
    } else if (targetRole === 'bookkeeping') {
      handleBookkeepingAuthSuccess(payload);
    } else if (targetRole === 'management') {
      handleManagementAuthSuccess(payload);
    }
  };



  // 🚫 Completely Dead / 404 Blank Page for unauthorized internal staff attempts
  if (role === 'dead_404') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        color: '#222222',
        padding: '60px 24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 12px 0', color: '#111827' }}>404 Not Found</h1>
          <p style={{ fontSize: '1rem', color: '#6b7280', margin: '0 0 24px 0', lineHeight: '1.5' }}>
            The requested URL was not found on this server. Please check the URL for errors or contact the system administrator.
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0' }} />
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            server / v59.1
          </div>
        </div>
      </div>
    );
  }

  // 1. Customer Online Ordering View (for QR codes or main customer site)
  if (role === 'customer') {
    return (
      <CustomerView 
        storeCode={storeCode}
        tableNumber={tableNumber} 
      />
    );
  }

  // 2. POS Cashier View
  if (role === 'pos') {
    if (!isCashierAuth) {
      return (
        <UnifiedLoginScreen 
          storeCode={storeCode}
          onSwitchStore={(newCode) => {
            setStoreCode(newCode);
            setActiveStoreCode(newCode);
          }}
          initialRole="pos"
          onChangeRole={setRole}
          adminPin={adminPin}
          onSuccess={handleUnifiedLoginSuccess}
        />
      );
    }
    return (
      <CashierView 
        key={posSessionId || 'cashier-active'}
        storeCode={storeCode}
        cashierName={cashierName}
        sessionId={posSessionId}
        onLogout={handleCashierLogout}
      />
    );
  }

  // 3. Bookkeeping View
  if (role === 'bookkeeping') {
    if (!isBookkeepingAuth) {
      return (
        <UnifiedLoginScreen 
          storeCode={storeCode}
          onSwitchStore={(newCode) => {
            setStoreCode(newCode);
            setActiveStoreCode(newCode);
          }}
          initialRole="bookkeeping"
          onChangeRole={setRole}
          adminPin={adminPin}
          onSuccess={handleUnifiedLoginSuccess}
        />
      );
    }
    return (
      <BookkeepingView 
        storeCode={storeCode}
        onLogout={handleBookkeepingLogout}
      />
    );
  }

  // 4. Management Admin View
  if (role === 'management') {
    if (!isManagementAuth) {
      return (
        <UnifiedLoginScreen 
          storeCode={storeCode}
          onSwitchStore={(newCode) => {
            setStoreCode(newCode);
            setActiveStoreCode(newCode);
          }}
          initialRole="management"
          onChangeRole={setRole}
          adminPin={adminPin}
          onSuccess={handleUnifiedLoginSuccess}
        />
      );
    }
    return (
      <ManagementView 
        storeCode={storeCode}
        onSwitchStore={(newCode) => {
          setStoreCode(newCode);
          setActiveStoreCode(newCode);
        }}
        onLogout={handleManagementLogout}
      />
    );
  }

  // 5. Default Staff Unified Login Portal (for ?login=true or any unauthenticated staff entry)
  return (
    <UnifiedLoginScreen 
      storeCode={storeCode}
      onSwitchStore={(newCode) => {
        setStoreCode(newCode);
        setActiveStoreCode(newCode);
      }}
      initialRole="pos"
      onChangeRole={setRole}
      adminPin={adminPin}
      onSuccess={handleUnifiedLoginSuccess}
    />
  );
}

export default App;
