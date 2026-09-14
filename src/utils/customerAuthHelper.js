import { initLiff, loginWithLine, logoutLine } from './liffHelper';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'app_customer_auth_profile';
const LEGACY_LINE_KEY = 'app_line_user_profile';

export const getStoredCustomerAuth = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    
    // Backward compatibility with legacy LINE profile
    const legacyLine = localStorage.getItem(LEGACY_LINE_KEY);
    if (legacyLine) {
      const parsed = JSON.parse(legacyLine);
      return {
        provider: 'line',
        userId: parsed.userId || '',
        displayName: parsed.displayName || '',
        pictureUrl: parsed.pictureUrl || '',
        email: ''
      };
    }
  } catch (e) {
    console.warn("Error reading stored customer auth:", e);
  }
  return null;
};

export const saveStoredCustomerAuth = (profile) => {
  try {
    if (profile) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      if (profile.provider === 'line') {
        localStorage.setItem(LEGACY_LINE_KEY, JSON.stringify({
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl
        }));
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_LINE_KEY);
    }
  } catch (e) {
    console.warn("Error saving customer auth:", e);
  }
};

const formatSupabaseUser = (user) => {
  if (!user) return null;
  const rawProvider = user.app_metadata?.provider || 'google';
  const provider = rawProvider.toLowerCase().includes('apple') ? 'apple' : 'google';
  const meta = user.user_metadata || {};
  const displayName = meta.full_name || meta.name || meta.user_name || (user.email ? user.email.split('@')[0] : '顧客');
  const pictureUrl = meta.avatar_url || meta.picture || '';

  return {
    provider,
    userId: user.id,
    displayName,
    pictureUrl,
    email: user.email || ''
  };
};

export const initCustomerAuth = async (onAuthChange) => {
  let currentAuth = getStoredCustomerAuth();

  // Listen for Supabase OAuth state changes (e.g. Asynchronous PKCE code exchange upon redirect)
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        const formatted = formatSupabaseUser(session.user);
        saveStoredCustomerAuth(formatted);
        if (onAuthChange) onAuthChange(formatted);
      }
    });
  } catch (err) {
    console.warn("Supabase onAuthStateChange warning:", err);
  }

  // 1. Check Supabase OAuth Session (e.g. Returned from Google or Apple OAuth redirect)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      currentAuth = formatSupabaseUser(session.user);
      saveStoredCustomerAuth(currentAuth);
      if (onAuthChange) onAuthChange(currentAuth);
      return { isReady: true, authUser: currentAuth };
    }
  } catch (err) {
    console.warn("Supabase auth session check warning:", err);
  }

  // 2. If no Supabase user, check LINE LIFF environment
  try {
    const liffRes = await initLiff();
    if (liffRes.isLoggedIn && liffRes.profile) {
      currentAuth = {
        provider: 'line',
        userId: liffRes.profile.userId,
        displayName: liffRes.profile.displayName,
        pictureUrl: liffRes.profile.pictureUrl || '',
        email: ''
      };
      saveStoredCustomerAuth(currentAuth);
      if (onAuthChange) onAuthChange(currentAuth);
      return { isReady: true, authUser: currentAuth };
    }
  } catch (err) {
    console.warn("LINE LIFF check warning:", err);
  }

  // 3. Fallback to existing stored auth if valid
  if (currentAuth && onAuthChange) {
    onAuthChange(currentAuth);
  }

  return { isReady: true, authUser: currentAuth };
};

export const loginWithCustomerProvider = async (provider, redirectUrl) => {
  const targetUrl = redirectUrl || (typeof window !== 'undefined' ? window.location.href : '');

  if (provider === 'line') {
    loginWithLine(targetUrl);
    return;
  }

  if (provider === 'google') {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: targetUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });
      if (error) {
        alert("Google 登入連線發生錯誤: " + error.message);
      }
    } catch (err) {
      console.error("Google OAuth error:", err);
      alert("Google 登入失敗: " + err.message);
    }
    return;
  }
};

export const logoutCustomerAuth = async (authUser) => {
  try {
    saveStoredCustomerAuth(null);
    if (authUser?.provider === 'line') {
      logoutLine();
    } else {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn("Logout error:", err);
  } finally {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
};
