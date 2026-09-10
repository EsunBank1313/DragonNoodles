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
    const targetUri = redirectUri || (typeof window !== 'undefined' ? window.location.href : '');
    liff.login({ redirectUri: targetUri });
  } catch (err) {
    console.error("LINE login error:", err);
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
