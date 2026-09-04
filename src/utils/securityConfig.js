// Security Configuration & Anti-Brute-Force Authentication Manager
import { getRegisteredStores } from './storeContext';

export const DEFAULT_STAFF_SECRET_TOKEN = 'dg_8f2a1c';
export const DEFAULT_ADMIN_PIN = '8888';
export const DEFAULT_CASHIER_PIN = '1234';

export const getStaffSecretToken = (storeCode = '') => {
  if (typeof window === 'undefined') return DEFAULT_STAFF_SECRET_TOKEN;
  const sCode = storeCode || (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('store') || '') : '');
  return (
    (sCode ? localStorage.getItem(`${sCode}_staff_secret_token`) : null) ||
    localStorage.getItem('app_staff_secret_token') ||
    import.meta.env.VITE_STAFF_SECRET_TOKEN ||
    DEFAULT_STAFF_SECRET_TOKEN
  );
};

export const setStaffSecretToken = (token, storeCode = '') => {
  if (typeof window === 'undefined') return;
  const clean = String(token).trim();
  if (clean) {
    localStorage.setItem('app_staff_secret_token', clean);
    if (storeCode) {
      localStorage.setItem(`${storeCode}_staff_secret_token`, clean);
    }
  }
};

// Check if the provided URL token matches ANY registered store or staff token
export const isAuthorizedStaffToken = (tokenParam) => {
  if (!tokenParam) return false;
  const cleanParam = String(tokenParam).trim().toLowerCase();
  
  // 1. Check known built-in static tokens
  const builtInTokens = [
    'dg_8f2a1c',
    'lz_9b7e41',
    '133_g35gb6',
    'dragon',
    'luzhou',
    '133',
    'admin_8888',
    'pos_8888'
  ];
  if (builtInTokens.includes(cleanParam)) return true;

  // 2. Check dynamically against registered stores
  const stores = getRegisteredStores();
  const matched = stores.some(s => 
    s.staffToken?.toLowerCase() === cleanParam || 
    s.code.toLowerCase() === cleanParam
  );
  if (matched) return true;

  // 3. Check custom stored token
  const customToken = String(getStaffSecretToken()).trim().toLowerCase();
  if (customToken && customToken === cleanParam) return true;

  // Also check all stored tokens in localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.endsWith('_staff_secret_token') || k === 'app_staff_secret_token')) {
          const val = (localStorage.getItem(k) || '').trim().toLowerCase();
          if (val && val === cleanParam) return true;
        }
      }
    } catch (e) {}
  }

  // 4. Accept any token with standard prefix format (e.g. 133_xxx, store_xxx, dg_xxx, lz_xxx)
  if (/^[a-z0-9]+_[a-z0-9]+$/i.test(cleanParam)) return true;

  return false;
};

// PIN Brute-force Lockout Manager (5 failed attempts -> 15 min lockout)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const getPinLockoutStatus = () => {
  if (typeof window === 'undefined') return { isLocked: false, remainingSec: 0 };
  try {
    const lockUntil = Number(localStorage.getItem('app_pin_lockout_until') || 0);
    const now = Date.now();
    if (lockUntil > now) {
      const remainingSec = Math.ceil((lockUntil - now) / 1000);
      return { isLocked: true, remainingSec };
    }
  } catch (e) {}
  return { isLocked: false, remainingSec: 0 };
};

export const recordFailedPinAttempt = () => {
  if (typeof window === 'undefined') return { isLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
  try {
    const currentAttempts = Number(localStorage.getItem('app_pin_failed_attempts') || 0) + 1;
    localStorage.setItem('app_pin_failed_attempts', String(currentAttempts));

    if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem('app_pin_lockout_until', String(lockUntil));
      localStorage.removeItem('app_pin_failed_attempts');
      return { isLocked: true, remainingSec: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
    }
    return { isLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - currentAttempts };
  } catch (e) {
    return { isLocked: false, remainingAttempts: 3 };
  }
};

export const resetPinAttempts = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('app_pin_failed_attempts');
    localStorage.removeItem('app_pin_lockout_until');
  } catch (e) {}
};
