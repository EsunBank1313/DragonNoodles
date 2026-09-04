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

// Resolve storeCode from URL param (?store=xxx or ?staff=xxx) or Domain Hostname
export const resolveStoreCode = (paramValue = '') => {
  if (!paramValue && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    paramValue = params.get('store') || params.get('staff') || '';

    // Domain / Hostname auto-detection if no ?store= param
    if (!paramValue) {
      const host = (window.location.hostname || '').toLowerCase();
      if (host.includes('luzhou') || host.includes('lz7')) return 'luzhou';
      if (host.includes('133')) return '133';
      return DEFAULT_STORE_CODE;
    }
  }
  let clean = String(paramValue || '').trim().toLowerCase();
  if (!clean) return DEFAULT_STORE_CODE;

  // Normalize aliases
  if (clean === 'luzhou7' || clean === 'lz7') clean = 'luzhou';

  // 1. PIN or Admin Tokens for default store
  if (
    clean === '8888' ||
    clean.includes('admin_8888') ||
    clean.includes('pos_8888') ||
    clean === 'admin' ||
    clean === 'pos' ||
    clean === 'cashier' ||
    clean === 'dragon' ||
    clean.startsWith('dg_')
  ) {
    return DEFAULT_STORE_CODE;
  }

  const stores = getRegisteredStores();

  // 2. Exact match by store code
  const matchCode = stores.find(s => s.code.toLowerCase() === clean);
  if (matchCode) return matchCode.code === 'luzhou7' ? 'luzhou' : matchCode.code;

  // 3. Match by staffToken
  const matchToken = stores.find(s => s.staffToken && s.staffToken.toLowerCase() === clean);
  if (matchToken) return matchToken.code === 'luzhou7' ? 'luzhou' : matchToken.code;

  // 4. Token prefix matching (e.g. lz_xxx, 133_xxx, storecode_random)
  if (clean.startsWith('lz_') || clean === 'luzhou' || clean.includes('luzhou')) return 'luzhou';
  if (clean.startsWith('133') || clean.includes('133')) return '133';

  // If token has standard format {storeCode}_{randomHex}, extract prefix
  if (clean.includes('_')) {
    const prefix = clean.split('_')[0];
    const matchPrefix = stores.find(s => s.code.toLowerCase() === prefix);
    if (matchPrefix) return matchPrefix.code === 'luzhou7' ? 'luzhou' : matchPrefix.code;
  }

  // 5. Check if clean matches any known custom store token stored in localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.endsWith('_staff_secret_token')) {
          const val = (localStorage.getItem(k) || '').trim().toLowerCase();
          if (val && val === clean) {
            const sc = k.replace('_staff_secret_token', '');
            if (sc) return sc;
          }
        }
      }
    } catch (e) {}
  }

  // 6. If clean is an already registered store code
  if (stores.some(s => s.code.toLowerCase() === clean)) {
    return clean;
  }

  // 7. Safety fallback: NEVER return an unregistered or unknown code that causes 0 items to be loaded!
  return DEFAULT_STORE_CODE;
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
  let sCode = resolveStoreCode(storeCode || getActiveStoreCode());
  if (sCode === 'luzhou7' || sCode === 'lz7') sCode = 'luzhou';
  
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
    .filter(item => item.name && (item.name.startsWith(`[${sCode}] `) || (sCode === 'luzhou' && item.name.startsWith('[luzhou7] '))))
    .map(item => ({
      ...item,
      originalDbName: item.name,
      name: item.name ? item.name.replace(new RegExp(`^\\[(${sCode}|luzhou7)\\]\\s*`), '') : ''
    }));
};

export const filterOrdersByStore = (orders = [], storeCode = '') => {
  if (!Array.isArray(orders)) return [];
  let sCode = (storeCode || getActiveStoreCode() || 'dragon').toLowerCase();
  if (sCode === 'luzhou7' || sCode === 'lz7') sCode = 'luzhou';

  return orders.filter(o => {
    let itemsData = o.items;
    if (typeof itemsData === 'string') {
      try { itemsData = JSON.parse(itemsData); } catch (e) { itemsData = {}; }
    }
    const orderStore = String(itemsData?.store_code || itemsData?.storeCode || o.store_code || '').trim().toLowerCase();

    if (sCode === 'dragon') {
      return !orderStore || orderStore === 'dragon';
    }

    if (sCode === 'luzhou') {
      return orderStore === 'luzhou' || orderStore === 'luzhou7' || orderStore.startsWith('lz_');
    }

    return orderStore === sCode;
  });
};

export const prefixNameForStore = (name = '', storeCode = '') => {
  let sCode = storeCode || getActiveStoreCode();
  if (sCode === 'luzhou7' || sCode === 'lz7') sCode = 'luzhou';
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
  const sCode = resolveStoreCode(storeCode || getActiveStoreCode());
  const token = getStoreStaffToken(sCode);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    customer: `${origin}/?store=${sCode}`,
    login: `${origin}/?store=${token}&login=true`,
    pos: `${origin}/?store=${token}&pos=true`,
    bookkeeping: `${origin}/?store=${token}&bookkeeping=true`,
    // Compatibility aliases for ManagementView
    customerUrl: `${origin}/?store=${sCode}`,
    posUrl: `${origin}/?store=${token}&pos=true`,
    bookkeepingUrl: `${origin}/?store=${token}&bookkeeping=true`,
    adminUrl: `${origin}/?store=${token}&admin=true`,
    publicToken: token
  };
};

export const getStoreDisplayName = (storeCode = '') => {
  let sCode = resolveStoreCode(storeCode || getActiveStoreCode());
  if (sCode === 'luzhou' || sCode === 'luzhou7' || sCode === 'lz7') return '蘆洲七號麵線';
  if (sCode === '133') return '133那個麵';
  if (sCode === 'dragon') return '龍城麵線';
  try {
    const cached = localStorage.getItem(`${sCode}_store_name`);
    if (cached) return cached;
  } catch (e) {}
  const stores = getRegisteredStores();
  const matched = stores.find(s => s.code === sCode);
  return matched?.name || (sCode === 'dragon' ? '龍城麵線' : `門市 [${sCode}]`);
};


