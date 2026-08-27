// Security Configuration & Anti-Brute-Force Authentication Manager

export const DEFAULT_STAFF_SECRET_TOKEN = 'dg_8f2a1c';
export const DEFAULT_ADMIN_PIN = '8888';
export const DEFAULT_CASHIER_PIN = '1234';

// Get the active staff secret token from environment or localStorage
export const getStaffSecretToken = () => {
  if (typeof window === 'undefined') return DEFAULT_STAFF_SECRET_TOKEN;
  return (
    import.meta.env.VITE_STAFF_SECRET_TOKEN ||
    localStorage.getItem('app_staff_secret_token') ||
    DEFAULT_STAFF_SECRET_TOKEN
  );
};

// Save a new custom staff secret token
export const setStaffSecretToken = (token) => {
  if (typeof window === 'undefined') return;
  const clean = String(token).trim();
  if (clean) {
    localStorage.setItem('app_staff_secret_token', clean);
  }
};

// Check if the provided URL token matches the authorized secret staff token
export const isAuthorizedStaffToken = (tokenParam) => {
  if (!tokenParam) return false;
  const cleanParam = String(tokenParam).trim().toLowerCase();
  const currentToken = String(getStaffSecretToken()).trim().toLowerCase();
  
  // Accept default and legacy tokens for seamless backward compatibility
  const validTokens = [
    currentToken,
    'dg_8f2a1c',
    'lz_9b7e41',
    'dragon',
    'luzhou',
    'admin_8888',
    'pos_8888'
  ];
  return validTokens.includes(cleanParam);
};

// PIN Brute-force Lockout Manager (5 failed attempts -> 15 min lockout)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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
