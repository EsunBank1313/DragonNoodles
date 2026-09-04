import React, { useState, useEffect } from 'react';
import CustomerView from './components/CustomerView';
import CashierView from './components/CashierView';
import BookkeepingView from './components/BookkeepingView';
import ManagementView from './components/ManagementView';
import UnifiedLoginScreen from './components/UnifiedLoginScreen';
import SetupWizardModal from './components/SetupWizardModal';
import { supabase } from './supabaseClient';
import { isAuthorizedStaffToken, getPinLockoutStatus, recordFailedPinAttempt, resetPinAttempts } from './utils/securityConfig';
import { resolveStoreCode, getActiveStoreCode, syncRegisteredStoresCache } from './utils/storeContext';
import { getActiveModuleSettings, isModuleEnabled } from './utils/moduleContext';

const getInitialRoleAndParams = () => {
  if (typeof window === 'undefined') {
    return { role: 'customer', table: null, isStaffAuthorized: false, storeCode: 'dragon' };
  }
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const table = params.get('table');

  // Check secret security token from ?store=xxx or ?staff=xxx
  const rawToken = params.get('store') || params.get('staff');
  const isAuthorized = isAuthorizedStaffToken(rawToken);
  const storeCode = resolveStoreCode(rawToken);

  // Subdomain support (pos.domain.com, admin.domain.com, bookkeeping.domain.com)
  const isSubdomainStaff = hostname.startsWith('pos.') || hostname.startsWith('admin.') || hostname.startsWith('bookkeeping.');

  const wantsPos = params.get('pos') !== null || params.get('cashier') !== null || hostname.startsWith('pos.');
  const wantsBookkeeping = params.get('bookkeeping') !== null || hostname.startsWith('bookkeeping.');
  const wantsAdmin = params.get('admin') !== null || params.get('management') !== null || hostname.startsWith('admin.');
  const wantsLogin = params.get('portal') !== null || params.get('login') !== null || params.get('demo') !== null;

  if (wantsPos || wantsBookkeeping || wantsAdmin || wantsLogin) {
    // Strictly require authorized security token!
    if (!isAuthorized && !isSubdomainStaff) {
      // 🚫 No secret token provided: Strictly hide backend and show customer menu!
      return { role: 'customer', table: table || null, isStaffAuthorized: false, storeCode };
    }

    if (wantsPos) return { role: 'pos', table: null, isStaffAuthorized: true, storeCode };
    if (wantsBookkeeping) return { role: 'bookkeeping', table: null, isStaffAuthorized: true, storeCode };
    if (wantsAdmin) return { role: 'management', table: null, isStaffAuthorized: true, storeCode };
    if (wantsLogin) return { role: 'login', table: null, isStaffAuthorized: true, storeCode };
  }

  return { role: 'customer', table: table || null, isStaffAuthorized: false, storeCode };
};

function App() {
  const initial = getInitialRoleAndParams();
  const [role, setRole] = useState(initial.role);
  const [storeCode, setStoreCode] = useState(initial.storeCode || 'dragon');
  const [tableNumber, setTableNumber] = useState(initial.table);
  const [storeName, setStoreName] = useState(() => localStorage.getItem('app_store_name') || '龍城麵線');
  const [adminPin, setAdminPin] = useState(() => localStorage.getItem('app_admin_pin') || '8888');
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // 6 hours in milliseconds
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  const checkSessionValid = (authKey, timeKey) => {
    const isAuth = localStorage.getItem(authKey) === 'true' || sessionStorage.getItem(authKey) === 'true';
    if (!isAuth) return false;
    const loginTime = Number(localStorage.getItem(timeKey) || sessionStorage.getItem(timeKey) || 0);
    if (!loginTime || (Date.now() - loginTime > SIX_HOURS_MS)) {
      localStorage.removeItem(authKey);
      sessionStorage.removeItem(authKey);
      localStorage.removeItem(timeKey);
      sessionStorage.removeItem(timeKey);
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
    return (typeof window !== 'undefined') ? (sessionStorage.getItem('pos_session_id') || '') : '';
  });

  // Cache buster to clear stale local storage states across client devices
  useEffect(() => {
    const CURRENT_VERSION = "3.0.0";
    const localVersion = localStorage.getItem('app_version');
    if (localVersion !== CURRENT_VERSION) {
      localStorage.setItem('app_version', CURRENT_VERSION);
    }
  }, []);

  // Sync Store Profile from Supabase
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await supabase.from('menu_items').select('*');
        if (data && data.length > 0) {
          // Data exists! Existing store -> ensure wizard is never shown
          localStorage.setItem('app_setup_wizard_completed', 'true');
          setShowSetupWizard(false);
          const profileItem = data.find(i => i.name === 'SYSTEM_SETTING_STORE_PROFILE');
          if (profileItem && profileItem.description) {
            try {
              const p = JSON.parse(profileItem.description);
              if (p.name) {
                setStoreName(p.name);
                localStorage.setItem('app_store_name', p.name);
              }
              if (p.pin) {
                setAdminPin(p.pin);
                localStorage.setItem('app_admin_pin', p.pin);
              }
            } catch (e) {}
          }
          // Also load module settings if exists
          const moduleItem = data.find(i => i.name === 'SYSTEM_SETTING_ENABLED_MODULES');
          if (moduleItem && moduleItem.description) {
            try {
              localStorage.setItem('app_enabled_modules', moduleItem.description);
            } catch (e) {}
          }

          // Load staff secret token from cloud
          const tokenItem = data.find(i => i.name === 'SYSTEM_SETTING_STAFF_TOKEN' || i.name === `${storeCode}_SYSTEM_SETTING_STAFF_TOKEN`);
          if (tokenItem && tokenItem.description) {
            const cleanToken = String(tokenItem.description).trim();
            if (cleanToken) {
              localStorage.setItem('app_staff_secret_token', cleanToken);
              localStorage.setItem(`${storeCode}_staff_secret_token`, cleanToken);
            }
          }

          // Sync registered stores from cloud into local cache for all devices
          const regItem = data.find(i => i.name === 'SYSTEM_SETTING_REGISTERED_STORES');
          if (regItem && regItem.description) {
            try {
              const parsed = JSON.parse(regItem.description);
              if (Array.isArray(parsed) && parsed.length > 0) {
                syncRegisteredStoresCache(parsed);
              }
            } catch (e) {}
          }
        }
      } catch (err) {}
    };
    loadProfile();
  }, []);

  // Handle Logout
  const handleLogout = (targetRole = 'login') => {
    if (targetRole === 'pos' || role === 'pos') {
      localStorage.removeItem('is_cashier_authenticated');
      sessionStorage.removeItem('is_cashier_authenticated');
      localStorage.removeItem('pos_login_time');
      sessionStorage.removeItem('pos_login_time');
      localStorage.removeItem('cashier_name');
      sessionStorage.removeItem('cashier_name');
      setIsCashierAuth(false);
      setCashierName('');
    }
    if (targetRole === 'bookkeeping' || role === 'bookkeeping') {
      localStorage.removeItem('is_bookkeeping_authenticated');
      sessionStorage.removeItem('is_bookkeeping_authenticated');
      localStorage.removeItem('bookkeeping_login_time');
      sessionStorage.removeItem('bookkeeping_login_time');
      setIsBookkeepingAuth(false);
    }
    if (targetRole === 'management' || role === 'management') {
      localStorage.removeItem('is_management_authenticated');
      sessionStorage.removeItem('is_management_authenticated');
      localStorage.removeItem('management_login_time');
      sessionStorage.removeItem('management_login_time');
      setIsManagementAuth(false);
    }
    setRole('login');
  };

  return (
    <div>
      {/* 🚀 First-time Setup Wizard for New Installations */}
      <SetupWizardModal
        isOpen={showSetupWizard && initial.isStaffAuthorized}
        onComplete={({ storeName: newName, adminPin: newPin }) => {
          setStoreName(newName);
          setAdminPin(newPin);
          setShowSetupWizard(false);
        }}
      />

      {/* 📱 Customer Ordering View (Default Public Front-facing UI) */}
      {role === 'customer' && (
        <CustomerView
          storeCode={storeCode}
          tableNumber={tableNumber}
          storeName={storeName}
          onSwitchToLogin={() => setRole('login')}
        />
      )}

      {/* 🔐 Unified Staff Login Portal */}
      {role === 'login' && (
        <UnifiedLoginScreen
          storeCode={storeCode}
          storeName={storeName}
          adminPin={adminPin}
          onSuccess={(targetRole, payload) => {
            const staffName = typeof payload === 'object' ? (payload.staffName || '') : (typeof payload === 'string' ? payload : '');
            const sid = typeof payload === 'object' ? (payload.sessionId || '') : '';
            if (staffName) setCashierName(staffName);
            if (sid) setPosSessionId(sid);
            if (targetRole === 'pos') setIsCashierAuth(true);
            if (targetRole === 'bookkeeping') setIsBookkeepingAuth(true);
            if (targetRole === 'management') setIsManagementAuth(true);
            setRole(targetRole);
          }}
          onNavigate={(targetRole, name = '', sid = '') => {
            if (name) setCashierName(name);
            if (sid) setPosSessionId(sid);
            if (targetRole === 'pos') setIsCashierAuth(true);
            if (targetRole === 'bookkeeping') setIsBookkeepingAuth(true);
            if (targetRole === 'management') setIsManagementAuth(true);
            setRole(targetRole);
          }}
          onBackToCustomer={() => setRole('customer')}
        />
      )}

      {/* 🖥️ Cashier POS System */}
      {role === 'pos' && (
        <CashierView
          storeCode={storeCode}
          cashierName={cashierName || '收銀員'}
          sessionId={posSessionId}
          onLogout={() => handleLogout('pos')}
        />
      )}

      {/* 📊 Bookkeeping & Monthly Financial System */}
      {role === 'bookkeeping' && (
        <BookkeepingView
          storeCode={storeCode}
          onBackToDemo={() => setRole('login')}
          onLogout={() => handleLogout('bookkeeping')}
        />
      )}

      {/* ⚙️ Management View */}
      {role === 'management' && (
        <ManagementView
          storeCode={storeCode}
          onLogout={() => handleLogout('management')}
        />
      )}
    </div>
  );
}

export default App;
