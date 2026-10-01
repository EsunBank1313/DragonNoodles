import liff from '@line/liff';

const DEFAULT_LIFF_ID = '2010677905-BF95rJ6h';

let isInitialized = false;

export const getLiffId = () => {
  return import.meta.env.VITE_LINE_LIFF_ID || DEFAULT_LIFF_ID;
};

export const initLiff = async () => {
  const liffId = getLiffId();
  if (!liffId) {
    console.warn("⚠️ LINE LIFF ID 未設定");
    return { isReady: false, isLoggedIn: false, profile: null };
  }

  try {
    if (!isInitialized) {
      await liff.init({ liffId });
      isInitialized = true;
    }

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      return {
        isReady: true,
        isLoggedIn: true,
        isInClient: liff.isInClient(),
        profile: {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl || '',
          statusMessage: profile.statusMessage || ''
        }
      };
    } else {
      return {
        isReady: true,
        isLoggedIn: false,
        isInClient: liff.isInClient(),
        profile: null
      };
    }
  } catch (err) {
    console.warn("LINE LIFF init error:", err);
    return {
      isReady: false,
      isLoggedIn: false,
      isInClient: false,
      profile: null,
      error: err
    };
  }
};

export const loginWithLine = (redirectUri = '') => {
  try {
    const liffId = getLiffId();
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isInClient = (typeof liff !== 'undefined' && liff.isInClient) ? liff.isInClient() : false;

    // 1. If already inside LINE in-app browser, call liff.login() directly
    if (isInClient) {
      if (!liff.isLoggedIn()) {
        liff.login();
      }
      return;
    }

    // 2. On mobile browsers (Safari / Chrome), directly redirecting to the official LIFF URL (https://liff.line.me/{liffId})
    // triggers the OS Universal Link / App Link, opening the LINE App directly!
    // Inside the LINE App, the customer is already authenticated, avoiding access.line.me web login and password prompts completely!
    if (isMobile && liffId) {
      const currentQuery = typeof window !== 'undefined' ? window.location.search : '';
      try {
        sessionStorage.setItem('customer_pending_checkout', 'true');
      } catch (e) {}

      window.location.href = `https://liff.line.me/${liffId}${currentQuery}`;
      return;
    }

    // 3. Desktop / PC or fallback: use clean redirect to prevent query param mismatch
    const cleanRedirect = redirectUri || (typeof window !== 'undefined' ? (window.location.origin + window.location.pathname) : '');
    try {
      sessionStorage.setItem('customer_pending_checkout', 'true');
    } catch (e) {}

    liff.login({ redirectUri: cleanRedirect });
  } catch (err) {
    console.error("LINE login error:", err);
    // If liff.login throws, fallback to opening official LIFF URL
    const liffId = getLiffId();
    if (liffId && typeof window !== 'undefined') {
      window.location.href = `https://liff.line.me/${liffId}`;
    }
  }
};

export const logoutLine = () => {
  try {
    if (liff.isLoggedIn()) {
      liff.logout();
      window.location.reload();
    }
  } catch (err) {
    console.error("LINE logout error:", err);
  }
};
