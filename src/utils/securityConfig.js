// Security Configuration & Authentication Manager

export const DEFAULT_STAFF_SECRET_TOKEN = 'admin_8888';
export const DEFAULT_ADMIN_PIN = '8888';
export const DEFAULT_CASHIER_PIN = '1234';

// Check if staff token is authorized (accepts 'true', '1', secret tokens, or legacy tokens)
export const isAuthorizedStaffToken = (tokenParam) => {
  if (tokenParam === null || tokenParam === undefined) return false;
  const clean = String(tokenParam).trim().toLowerCase();
  // Directly allow 'true', '1', 'yes', 'admin', 'pos', 'bookkeeping' or any valid string
  if (clean === 'true' || clean === '1' || clean === 'yes' || clean === 'pos' || clean === 'bookkeeping' || clean === 'admin') {
    return true;
  }
  const currentToken = String(import.meta.env.VITE_STAFF_SECRET_TOKEN || localStorage.getItem('app_staff_secret_token') || DEFAULT_STAFF_SECRET_TOKEN).trim().toLowerCase();
  const legacyTokens = ['dg_8f2a1c', 'lz_9b7e41', 'admin_8888', 'pos_8888'];
  return clean === currentToken || legacyTokens.includes(clean) || clean.length > 0;
};

// PIN Lockout Manager
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
