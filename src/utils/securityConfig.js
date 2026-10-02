// Security Configuration & Anti-Brute-Force Authentication Manager
import { getRegisteredStores } from './storeContext';

export const DEFAULT_STAFF_SECRET_TOKEN = import.meta.env.VITE_STAFF_SECRET_TOKEN || 'dg_8f2a1c';
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

// Strict Token Mode: When enabled, ONLY the active current token is permitted (old & arbitrary tokens blocked)
export const isStrictTokenMode = (storeCode = '') => {
  if (typeof window === 'undefined') return true;
  const sCode = storeCode || 'dragon';
  const val = localStorage.getItem(`${sCode}_strict_token_mode`) || localStorage.getItem('app_strict_token_mode');
  // Default to true for enhanced security
  return val !== 'false';
};

export const setStrictTokenMode = (isStrict, storeCode = '') => {
  if (typeof window === 'undefined') return;
  const sCode = storeCode || 'dragon';
  const strVal = isStrict ? 'true' : 'false';
  localStorage.setItem('app_strict_token_mode', strVal);
  localStorage.setItem(`${sCode}_strict_token_mode`, strVal);
};

// Revoked Tokens List: Explicitly blocked tokens (e.g. historical original keys like dg_8f2a1c)
export const getRevokedTokens = (storeCode = '') => {
  if (typeof window === 'undefined') return ['dg_8f2a1c'];
  const sCode = storeCode || 'dragon';
  try {
    const raw = localStorage.getItem(`${sCode}_revoked_tokens`) || localStorage.getItem('app_revoked_tokens');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}

  // If a custom token exists and differs from initial 'dg_8f2a1c', default 'dg_8f2a1c' to revoked in strict mode
  const currentToken = getStaffSecretToken(sCode);
  if (currentToken && currentToken !== 'dg_8f2a1c') {
    return ['dg_8f2a1c'];
  }
  return [];
};

export const setRevokedTokens = (tokens, storeCode = '') => {
  if (typeof window === 'undefined') return;
  const sCode = storeCode || 'dragon';
  try {
    const json = JSON.stringify(tokens || []);
    localStorage.setItem('app_revoked_tokens', json);
    localStorage.setItem(`${sCode}_revoked_tokens`, json);
  } catch (e) {}
};

export const revokeToken = (tokenToRevoke, storeCode = '') => {
  if (!tokenToRevoke) return;
  const clean = String(tokenToRevoke).trim().toLowerCase();
  const current = getRevokedTokens(storeCode);
  if (!current.includes(clean)) {
    const updated = [...current, clean];
    setRevokedTokens(updated, storeCode);
  }
};

export const unrevokeToken = (tokenToRestore, storeCode = '') => {
  if (!tokenToRestore) return;
  const clean = String(tokenToRestore).trim().toLowerCase();
  const current = getRevokedTokens(storeCode);
  const updated = current.filter(t => t.toLowerCase() !== clean);
  setRevokedTokens(updated, storeCode);
};

// Check if the provided URL token matches ANY registered store or staff token
export const isAuthorizedStaffToken = (tokenParam, storeCode = '') => {
  // If no token param, only allow if staff is ALREADY authenticated within valid session
  if (!tokenParam) {
    if (typeof window !== 'undefined') {
      const hasSession = localStorage.getItem('is_cashier_authenticated') === 'true' ||
                         localStorage.getItem('is_bookkeeping_authenticated') === 'true' ||
                         localStorage.getItem('is_management_authenticated') === 'true';
      if (hasSession) return true;
    }
    return false;
  }
  const cleanParam = String(tokenParam).trim().toLowerCase();
  const sCode = storeCode || 'dragon';

  // 1. Explicitly REVOKED tokens are NEVER allowed!
  const revoked = getRevokedTokens(sCode).map(t => String(t).trim().toLowerCase());
  if (revoked.includes(cleanParam)) {
    return false;
  }

  // 2. Check currently active configured token
  const currentToken = String(getStaffSecretToken(sCode)).trim().toLowerCase();
  if (currentToken && cleanParam === currentToken) {
    return true;
  }

  if (typeof localStorage !== 'undefined') {
    const appToken = String(localStorage.getItem('app_staff_secret_token') || '').trim().toLowerCase();
    if (appToken && cleanParam === appToken) return true;
  }

  const strictMode = isStrictTokenMode(sCode);

  // In STRICT MODE:
  // ONLY the active current token (or registered other stores like lz_xxx/133_xxx) can pass!
  // The old/fallback token 'dg_8f2a1c' is rejected, and the arbitrary regex is disabled!
  if (strictMode) {
    // Check if it matches other registered stores (e.g. luzhou or 133)
    const stores = getRegisteredStores();
    const otherStoreMatch = stores.find(s => s.code !== sCode && s.staffToken?.toLowerCase() === cleanParam);
    if (otherStoreMatch) return true;
    return false;
  }

  // Fallback (Only in NON-STRICT / Compatible Mode):
  // 3. Check known built-in static secret tokens (if not revoked)
  const builtInTokens = ['dg_8f2a1c', 'lz_9b7e41', '133_g35gb6'];
  if (builtInTokens.includes(cleanParam)) return true;

  // 4. Check dynamically against registered stores
  const stores = getRegisteredStores();
  const matched = stores.some(s => 
    s.staffToken?.toLowerCase() === cleanParam || 
    s.code.toLowerCase() === cleanParam
  );
  if (matched) return true;

  // 5. Accept standard prefix format in non-strict mode
  if (/^[a-z0-9]+_[a-z0-9]+$/i.test(cleanParam)) return true;

  return false;
};

// Test & Inspect utility for debugging links and tokens
export const testTokenStatus = (inputUrlOrToken, storeCode = '') => {
  if (!inputUrlOrToken) {
    return { isValid: false, token: '', targetRole: 'unknown', reason: '請輸入網址或代碼' };
  }
  let token = String(inputUrlOrToken).trim();
  let targetRole = 'customer';
  
  // If it's a URL, extract search parameters
  if (token.includes('?') || token.startsWith('http')) {
    try {
      const url = new URL(token.startsWith('http') ? token : `https://example.com/${token}`);
      token = url.searchParams.get('store') || url.searchParams.get('staff') || '';
      if (url.searchParams.get('pos') !== null || url.searchParams.get('cashier') !== null) targetRole = 'pos';
      else if (url.searchParams.get('bookkeeping') !== null) targetRole = 'bookkeeping';
      else if (url.searchParams.get('admin') !== null || url.searchParams.get('management') !== null) targetRole = 'management';
      else if (url.searchParams.get('login') !== null || url.searchParams.get('portal') !== null) targetRole = 'login';
    } catch (e) {}
  }

  const sCode = storeCode || 'dragon';
  const cleanToken = token.trim().toLowerCase();
  const revoked = getRevokedTokens(sCode).map(t => String(t).trim().toLowerCase());
  const currentToken = String(getStaffSecretToken(sCode)).trim().toLowerCase();
  const strictMode = isStrictTokenMode(sCode);

  if (!cleanToken) {
    return {
      isValid: false,
      token: '',
      targetRole: 'customer',
      reason: '未包含安全金鑰參數（?store=...），將顯示【顧客點餐菜單】'
    };
  }

  if (revoked.includes(cleanToken)) {
    return {
      isValid: false,
      token: cleanToken,
      targetRole: 'blocked',
      reason: `此金鑰【${cleanToken}】已在作廢黑名單中，外部點擊將強制退回【顧客點餐菜單】`
    };
  }

  if (cleanToken === currentToken) {
    return {
      isValid: true,
      token: cleanToken,
      targetRole,
      reason: `驗證通過！此為當前最新生效金鑰，將正常導向【${targetRole === 'bookkeeping' ? '財務記帳' : targetRole === 'pos' ? 'POS收銀' : targetRole === 'management' ? '後台管理' : targetRole === 'login' ? '統一登入大門' : '指定系統'}】`
    };
  }

  if (strictMode) {
    return {
      isValid: false,
      token: cleanToken,
      targetRole: 'blocked',
      reason: `嚴格安全模式已啟用：此代碼【${cleanToken}】不符合當前金鑰【${currentToken}】，已自動封鎖，將退回【顧客點餐菜單】`
    };
  }

  return {
    isValid: true,
    token: cleanToken,
    targetRole,
    reason: `相容模式允許：代碼【${cleanToken}】符合系統通用規則，但建議升級至當前金鑰【${currentToken}】`
  };
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
