// Universal Standalone Compatibility Layer for Store Context

export const DEFAULT_STORE_CODE = 'standalone';

export const getActiveStoreCode = () => {
  return 'standalone';
};

export const setActiveStoreCode = () => {};

export const getStoreStorage = (key, storeCode = '') => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
};

export const setStoreStorage = (key, val, storeCode = '') => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, val);
};

export const getStoreSessionStorage = (key, storeCode = '') => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(key);
};

export const setStoreSessionStorage = (key, val, storeCode = '') => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(key, val);
};

export const removeStoreSessionStorage = (key, storeCode = '') => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(key);
};

export const filterItemsByStore = (items = [], storeCode = '') => {
  if (!Array.isArray(items)) return [];
  return items;
};

export const filterOrdersByStore = (orders = [], storeCode = '') => {
  if (!Array.isArray(orders)) return [];
  return orders;
};

export const prefixNameForStore = (name = '', storeCode = '') => {
  return name;
};

export const stripNameForStore = (name = '', storeCode = '') => {
  if (!name) return '';
  return name.replace(/^\[[^\]]+\]\s*/, '');
};

export const isStaffTokenValid = () => true;
export const resolveStoreCode = () => 'standalone';
export const getStoreStaffToken = () => 'admin_8888';
export const generateRandomStoreToken = () => 'admin_8888';

export const getStoreLinks = (storeCode = 'standalone') => {
  return {
    customer: window.location.origin,
    pos: `${window.location.origin}/?pos=admin_8888`,
    bookkeeping: `${window.location.origin}/?bookkeeping=admin_8888`
  };
};

export const syncRegisteredStoresCache = () => {};
