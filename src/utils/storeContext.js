// Multi-Tenant SaaS Architecture Helper with Dynamic Secret Staff Tokens

export const DEFAULT_STORE_CODE = 'dragon';

// Base built-in Secret Staff Security Tokens
export const BUILTIN_STAFF_TOKENS = {
  'dg_8f2a1c': 'dragon',
  'lz_9b7e41': 'luzhou'
};

export const BUILTIN_STORE_TOKENS = {
  'dragon': 'dg_8f2a1c',
  'luzhou': 'lz_9b7e41'
};

// Helper to load dynamically registered stores from localStorage cache
export const getDynamicStaffTokens = () => {
  if (typeof window === 'undefined') return { tokenMap: { ...BUILTIN_STAFF_TOKENS }, storeMap: { ...BUILTIN_STORE_TOKENS } };
  
  try {
    const raw = localStorage.getItem('app_registered_stores_cache');
    if (raw) {
      const stores = JSON.parse(raw);
      const tokenMap = { ...BUILTIN_STAFF_TOKENS };
      const storeMap = { ...BUILTIN_STORE_TOKENS };
      if (Array.isArray(stores)) {
        stores.forEach(st => {
          if (st.code && st.staffToken) {
            tokenMap[st.staffToken.toLowerCase()] = st.code.toLowerCase();
            storeMap[st.code.toLowerCase()] = st.staffToken.toLowerCase();
          }
        });
      }
      return { tokenMap, storeMap };
    }
  } catch (e) {}

  return { tokenMap: { ...BUILTIN_STAFF_TOKENS }, storeMap: { ...BUILTIN_STORE_TOKENS } };
};

// Save dynamic store registry cache
export const syncRegisteredStoresCache = (storesList = []) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('app_registered_stores_cache', JSON.stringify(storesList));
  } catch (e) {}
};

// Check if raw store param in URL is an authorized Secret Staff Token
export const isStaffTokenValid = (rawStoreParam) => {
  if (!rawStoreParam) return false;
  const clean = String(rawStoreParam).trim().toLowerCase();
  const { tokenMap } = getDynamicStaffTokens();
  return Boolean(tokenMap[clean]);
};

// Resolve any incoming token or customer slug into internal canonical storeCode ('dragon' | 'luzhou' | 'newstore')
export const resolveStoreCode = (param) => {
  if (!param) return DEFAULT_STORE_CODE;
  const clean = String(param).trim().toLowerCase();
  const { tokenMap } = getDynamicStaffTokens();
  if (tokenMap[clean]) {
    return tokenMap[clean];
  }
  return clean;
};

// Get the internal secret staff token for a store
export const getStoreStaffToken = (storeCode = DEFAULT_STORE_CODE) => {
  const clean = resolveStoreCode(storeCode);
  const { storeMap } = getDynamicStaffTokens();
  return storeMap[clean] || `st_${clean.slice(0, 3)}_${Math.random().toString(36).substr(2, 4)}`;
};

// Generate random secret token for a new store
export const generateRandomStoreToken = (prefix = 'st') => {
  const cleanPrefix = String(prefix).replace(/[^a-zA-Z0-9]/g, '').slice(0, 3) || 'st';
  const rand = Math.random().toString(36).substr(2, 6);
  return `${cleanPrefix}_${rand}`.toLowerCase();
};

// Get active store code from URL
export const getActiveStoreCode = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const storeParam = params.get('store');
    if (storeParam) {
      return resolveStoreCode(storeParam);
    }
  }
  return DEFAULT_STORE_CODE;
};

// Set active store code
export const setActiveStoreCode = (storeCode) => {
  if (typeof window !== 'undefined') {
    const clean = resolveStoreCode(storeCode);
    localStorage.setItem('app_current_store_code', clean);
  }
};

// Prefix database name with tenant tag (e.g. "[luzhou] 招牌紅麵線")
export const prefixNameForStore = (rawName, storeCode = getActiveStoreCode()) => {
  if (!rawName) return '';
  const clean = resolveStoreCode(storeCode);
  if (clean === DEFAULT_STORE_CODE) {
    return rawName;
  }
  if (rawName.startsWith(`[${clean}] `)) {
    return rawName;
  }
  return `[${clean}] ${rawName}`;
};

// Strip database tenant tag for UI display
export const stripNameForStore = (dbName, storeCode = getActiveStoreCode()) => {
  if (!dbName) return '';
  const clean = resolveStoreCode(storeCode);
  const prefix = `[${clean}] `;
  if (dbName.startsWith(prefix)) {
    return dbName.slice(prefix.length);
  }
  if (clean === DEFAULT_STORE_CODE && !dbName.startsWith('[')) {
    return dbName;
  }
  return dbName;
};

// Filter menu items / settings belonging to active store
export const filterItemsByStore = (items = [], storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  const prefix = `[${clean}] `;

  return items
    .filter(item => {
      if (!item || !item.name) return false;
      if (clean === DEFAULT_STORE_CODE) {
        return !item.name.startsWith('[') || item.name.startsWith('[dragon] ');
      }
      return item.name.startsWith(prefix);
    })
    .map(item => {
      return {
        ...item,
        originalDbName: item.name,
        name: stripNameForStore(item.name, clean)
      };
    });
};

// Filter orders belonging to active store
export const filterOrdersByStore = (orders = [], storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  const upper = clean.toUpperCase();

  return orders.filter(order => {
    if (!order) return false;
    let itemsData = order.items;
    if (typeof itemsData === 'string') {
      try { itemsData = JSON.parse(itemsData); } catch (e) {}
    }
    const rawStore = order.store_code || itemsData?.store_code || order.storeCode;
    const orderStore = rawStore ? resolveStoreCode(rawStore) : null;
    if (orderStore) {
      return orderStore.toLowerCase() === clean;
    }
    const orderNum = String(order.order_number || order.orderNumber || order.serialNum || '');
    if (orderNum.startsWith(`${upper}-`)) {
      return true;
    }
    if (clean === DEFAULT_STORE_CODE) {
      return !rawStore || resolveStoreCode(rawStore) === 'dragon';
    }
    return false;
  });
};

// Generate shareable links for a store
export const getStoreLinks = (storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  const staffToken = getStoreStaffToken(clean);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dragon.twabc.com';
  
  // Public customer link (clean for QR codes)
  const customerStoreParam = clean === DEFAULT_STORE_CODE ? '' : `store=${clean}`;
  const customerUrl = customerStoreParam ? `${origin}/?${customerStoreParam}` : `${origin}/`;

  // Internal staff links (ONLY accessible with random staff token)
  const staffStoreParam = `store=${staffToken}`;
  const makeStaffUrl = (extraParam = '') => {
    const parts = [staffStoreParam, extraParam].filter(Boolean);
    return `${origin}/${parts.length > 0 ? '?' + parts.join('&') : ''}`;
  };

  return {
    cleanStoreCode: clean,
    staffToken,
    customerUrl,
    posUrl: makeStaffUrl('pos=true'),
    bookkeepingUrl: makeStaffUrl('bookkeeping=true'),
    adminUrl: makeStaffUrl('admin=true'),
    loginUrl: makeStaffUrl('login=true')
  };
};

export const getStoreStorage = (key, storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  try {
    return localStorage.getItem(`${clean}_${key}`);
  } catch (e) {
    return null;
  }
};

export const setStoreStorage = (key, value, storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  try {
    localStorage.setItem(`${clean}_${key}`, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (e) {}
};

export const removeStoreStorage = (key, storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  try {
    localStorage.removeItem(`${clean}_${key}`);
  } catch (e) {}
};

export const getStoreSessionStorage = (key, storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  try {
    return sessionStorage.getItem(`${clean}_${key}`) || localStorage.getItem(`${clean}_${key}`);
  } catch (e) {
    return null;
  }
};

export const setStoreSessionStorage = (key, value, storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  try {
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    sessionStorage.setItem(`${clean}_${key}`, val);
    localStorage.setItem(`${clean}_${key}`, val);
  } catch (e) {}
};

export const removeStoreSessionStorage = (key, storeCode = getActiveStoreCode()) => {
  const clean = resolveStoreCode(storeCode);
  try {
    sessionStorage.removeItem(`${clean}_${key}`);
    localStorage.removeItem(`${clean}_${key}`);
  } catch (e) {}
};
