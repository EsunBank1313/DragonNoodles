// Universal Store Context & Multi-Store Compatibility Layer

export const DEFAULT_STORE_CODE = 'dragon';

export const REGISTERED_STORES_FALLBACK = [
  { code: 'dragon', name: '龍城麵線', isDefault: true, staffToken: 'dg_8f2a1c', adminPin: '8888', createdAt: '2026-01-01' },
  { code: 'luzhou', name: '蘆洲七號麵線', staffToken: 'lz_9b7e41', adminPin: '8888', createdAt: '2026-08-20' },
  { code: '133', name: '133那個麵', staffToken: '133_g35gb6', adminPin: '8888', createdAt: '2026-08-23' }
];

export const getRegisteredStores = () => {
  if (typeof window === 'undefined') return REGISTERED_STORES_FALLBACK;
  try {
    const cached = localStorage.getItem('app_registered_stores_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return REGISTERED_STORES_FALLBACK;
};

export const syncRegisteredStoresCache = (storesList) => {
  if (typeof window === 'undefined' || !Array.isArray(storesList)) return;
  try {
    localStorage.setItem('app_registered_stores_cache', JSON.stringify(storesList));
  } catch (e) {}
};

// Resolve storeCode from URL param (?store=xxx or ?staff=xxx)
export const resolveStoreCode = (paramValue = '') => {
  if (!paramValue && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    paramValue = params.get('store') || params.get('staff') || '';
  }
  const clean = String(paramValue || '').trim().toLowerCase();
  if (!clean) return DEFAULT_STORE_CODE;

  const stores = getRegisteredStores();
  
  // Exact match by code
  const matchCode = stores.find(s => s.code.toLowerCase() === clean);
  if (matchCode) return matchCode.code;

  // Match by staffToken
  const matchToken = stores.find(s => s.staffToken && s.staffToken.toLowerCase() === clean);
  if (matchToken) return matchToken.code;

  // Prefix matching
  if (clean.startsWith('dg_') || clean === 'dragon') return 'dragon';
  if (clean.startsWith('lz_') || clean === 'luzhou' || clean.includes('luzhou')) return 'luzhou';
  if (clean.startsWith('133') || clean.includes('133')) return '133';

  return clean;
};

export const getActiveStoreCode = () => {
  return resolveStoreCode();
};

export const setActiveStoreCode = (code) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('app_active_store_code', code);
  } catch (e) {}
};

// LocalStorage helpers per store
export const getStoreStorage = (key, storeCode = '') => {
  if (typeof window === 'undefined') return null;
  const sCode = storeCode || getActiveStoreCode();
  return localStorage.getItem(`${sCode}_${key}`) || localStorage.getItem(key);
};

export const setStoreStorage = (key, val, storeCode = '') => {
  if (typeof window === 'undefined') return;
  const sCode = storeCode || getActiveStoreCode();
  localStorage.setItem(`${sCode}_${key}`, val);
  localStorage.setItem(key, val);
};

// SessionStorage helpers per store
export const getStoreSessionStorage = (key, storeCode = '') => {
  if (typeof window === 'undefined') return null;
  const sCode = storeCode || getActiveStoreCode();
  return sessionStorage.getItem(`${sCode}_${key}`) || sessionStorage.getItem(key);
};

export const setStoreSessionStorage = (key, val, storeCode = '') => {
  if (typeof window === 'undefined') return;
  const sCode = storeCode || getActiveStoreCode();
  sessionStorage.setItem(`${sCode}_${key}`, val);
  sessionStorage.setItem(key, val);
};

export const removeStoreSessionStorage = (key, storeCode = '') => {
  if (typeof window === 'undefined') return;
  const sCode = storeCode || getActiveStoreCode();
  sessionStorage.removeItem(`${sCode}_${key}`);
  sessionStorage.removeItem(key);
};

// Filter Supabase items by storeCode
export const filterItemsByStore = (items = [], storeCode = '') => {
  if (!Array.isArray(items)) return [];
  const sCode = storeCode || getActiveStoreCode();
  
  if (sCode === 'dragon') {
    // Default main store: items without [prefix] or with [dragon] prefix
    return items
      .filter(item => !item.name?.startsWith('[') || item.name?.startsWith('[dragon] '))
      .map(item => ({
        ...item,
        originalDbName: item.name,
        name: item.name ? item.name.replace(/^\[dragon\]\s*/, '') : ''
      }));
  }

  // Branch stores: items with [sCode] prefix
  return items
    .filter(item => item.name && item.name.startsWith(`[${sCode}] `))
    .map(item => ({
      ...item,
      originalDbName: item.name,
      name: item.name ? item.name.replace(new RegExp(`^\\[${sCode}\\]\\s*`), '') : ''
    }));
};

export const filterOrdersByStore = (orders = [], storeCode = '') => {
  if (!Array.isArray(orders)) return [];
  const sCode = storeCode || getActiveStoreCode();
  if (sCode === 'dragon') return orders;
  return orders;
};

export const prefixNameForStore = (name = '', storeCode = '') => {
  const sCode = storeCode || getActiveStoreCode();
  if (sCode === 'dragon') return name;
  if (name.startsWith(`[${sCode}] `)) return name;
  return `[${sCode}] ${name}`;
};

export const stripNameForStore = (name = '', storeCode = '') => {
  if (!name) return '';
  return name.replace(/^\[[^\]]+\]\s*/, '');
};

export const isStaffTokenValid = (tokenParam) => {
  if (!tokenParam) return false;
  const clean = String(tokenParam).trim().toLowerCase();
  const stores = getRegisteredStores();
  return stores.some(s => s.staffToken?.toLowerCase() === clean || s.code.toLowerCase() === clean);
};

export const getStoreStaffToken = (storeCode = '') => {
  const sCode = storeCode || getActiveStoreCode();
  const stores = getRegisteredStores();
  const matched = stores.find(s => s.code === sCode);
  return matched?.staffToken || 'dg_8f2a1c';
};

export const generateRandomStoreToken = (storeCode = 'store') => {
  const hex = Math.random().toString(16).substring(2, 8);
  return `${storeCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${hex}`;
};

export const getStoreLinks = (storeCode = '') => {
  const sCode = storeCode || getActiveStoreCode();
  const token = getStoreStaffToken(sCode);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    customer: `${origin}/?store=${sCode}`,
    login: `${origin}/?store=${token}&login=true`,
    pos: `${origin}/?store=${token}&pos=true`,
    bookkeeping: `${origin}/?store=${token}&bookkeeping=true`,
    admin: `${origin}/?store=${token}&admin=true`
  };
};
