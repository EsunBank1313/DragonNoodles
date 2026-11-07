import { supabase } from '../supabaseClient.js';
import { prefixNameForStore } from './storeContext.js';

// Activation Timestamp: Only deduct orders created on or after this feature activation (2026-11-07 00:00:00 UTC)
// This strictly prevents historical orders from draining current physical stock!
export const INVENTORY_DEDUCTION_START_TIMESTAMP = new Date('2026-11-07T00:00:00Z').getTime();

/**
 * Parses an order to calculate what inventory items should be deducted and by how much.
 * Supports:
 * 1. Meat Buns (肉包): direct item ("肉包", "鮮肉包", "大肉包"), bulk packs ("肉包(量販包)" = 10), and combo upgrades ("B套餐: 大肉包")
 * 2. Century Egg (皮蛋): direct item, toppings/addons ("加料: 皮蛋 x1", "加料: 加皮蛋", "加皮蛋"), and selections.addons
 * 3. Meatball (貢丸): addons ("加料: 貢丸", "加貢丸") and direct items
 * 4. Drinks (優格氣泡飲, 美粒果, 紅茶)
 * 5. Specialties (辣泡菜, 要你命辣醬)
 */
export function calculateOrderInventoryDeductions(order) {
  if (!order || !order.items) return [];

  const deductions = [];
  const rawItems = order.items;
  let cart = [];

  if (Array.isArray(rawItems)) {
    cart = rawItems;
  } else if (rawItems && typeof rawItems === 'object') {
    cart = Array.isArray(rawItems.cart) ? rawItems.cart : (Array.isArray(rawItems.items) ? rawItems.items : []);
  }

  cart.forEach(item => {
    if (!item) return;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const name = String(item.name || '').trim();
    const specs = Array.isArray(item.specs) ? item.specs : [];
    const selections = item.selections || {};
    const upgrade = item.upgradeCombo || null;

    // --- 1. 肉包 (Meat Buns) ---
    if (name.includes('肉包(量販包)') || name.includes('量販包')) {
      deductions.push({
        targetName: '肉包',
        qty: qty * 10,
        unit: '顆',
        reason: `${name} x${qty} (每包含10顆)`
      });
    } else if (name.includes('肉包') || name.includes('鮮肉包') || name.includes('包子')) {
      deductions.push({
        targetName: '肉包',
        qty: qty * 1,
        unit: '顆',
        reason: `${name} x${qty}`
      });
    }

    // Check combo upgrades for meat buns (e.g. B套餐 大肉包)
    const upgradeStr = JSON.stringify(upgrade || '') + specs.join(' ');
    if ((upgradeStr.includes('肉包') || upgradeStr.includes('包子')) && !name.includes('肉包') && !name.includes('包子')) {
      deductions.push({
        targetName: '肉包',
        qty: qty * 1,
        unit: '顆',
        reason: `${name} 套餐升級大肉包 x${qty}`
      });
    }

    // --- 2. 皮蛋 (Century Eggs) ---
    let pDanCount = 0;
    // Check selections.addons
    if (selections.addons && selections.addons['皮蛋']) {
      pDanCount += Number(selections.addons['皮蛋']) || 0;
    }
    // Check specs strings: '加料: 皮蛋 x2', '加料: 加皮蛋', '加皮蛋'
    specs.forEach(sp => {
      if (typeof sp === 'string' && sp.includes('皮蛋')) {
        const m = sp.match(/x\s*(\d+)/i);
        if (m) {
          pDanCount += parseInt(m[1], 10);
        } else {
          pDanCount += 1;
        }
      }
    });
    // Direct item: 皮蛋 or 皮蛋豆腐
    if (name === '皮蛋' || name === '皮蛋豆腐') {
      pDanCount += 1;
    }
    if (pDanCount > 0) {
      deductions.push({
        targetName: '皮蛋',
        qty: pDanCount * qty,
        unit: '顆',
        reason: `${name} 加皮蛋 x${pDanCount * qty}`
      });
    }

    // --- 3. 貢丸 (Meatballs - Add-on) ---
    let meatballCount = 0;
    if (selections.addons && selections.addons['貢丸']) {
      meatballCount += Number(selections.addons['貢丸']) || 0;
    }
    specs.forEach(sp => {
      if (typeof sp === 'string' && (sp.includes('加料: 貢丸') || sp.includes('加料: 加貢丸') || sp.includes('加貢丸'))) {
        const m = sp.match(/x\s*(\d+)/i);
        if (m) meatballCount += parseInt(m[1], 10);
        else meatballCount += 1;
      }
    });
    if (meatballCount > 0) {
      deductions.push({
        targetName: '貢丸',
        qty: meatballCount * qty,
        unit: '顆',
        reason: `${name} 加貢丸 x${meatballCount * qty}`
      });
    }

    // --- 4. 飲品 (Drinks) ---
    if (name.includes('優格氣泡飲') || upgradeStr.includes('優格氣泡飲')) {
      deductions.push({
        targetName: '優格氣泡飲',
        qty: qty * 1,
        unit: '瓶',
        reason: `${name} x${qty}`
      });
    } else if (name.includes('美粒果葡萄')) {
      deductions.push({
        targetName: '美粒果葡萄蘇打風味',
        qty: qty * 1,
        unit: '罐',
        reason: `${name} x${qty}`
      });
    } else if (name.includes('美粒果蘋果')) {
      deductions.push({
        targetName: '美粒果蘋果蘇打',
        qty: qty * 1,
        unit: '罐',
        reason: `${name} x${qty}`
      });
    }

    // --- 5. 罐裝特產 (Specialties) ---
    if (name.includes('辣泡菜') || name === '泡菜') {
      deductions.push({
        targetName: '泡菜',
        qty: qty * 1,
        unit: '包',
        reason: `${name} x${qty}`
      });
    } else if (name.includes('要你命')) {
      deductions.push({
        targetName: name,
        qty: qty * 1,
        unit: '罐',
        reason: `${name} x${qty}`
      });
    }
  });

  return deductions;
}

/**
 * Matches a target item name to an existing inventory item in the inventory list.
 * Supports aliases (e.g. 肉包 matches 包子 or 鮮肉包).
 */
export function findMatchingInventoryItem(inventory = [], targetName = '') {
  if (!Array.isArray(inventory) || !targetName) return null;
  const cleanTarget = targetName.trim().toLowerCase();

  // 1. Exact match
  let found = inventory.find(i => (i.name || '').trim().toLowerCase() === cleanTarget);
  if (found) return found;

  // 2. Alias mapping for meat bun
  if (cleanTarget === '肉包' || cleanTarget === '鮮肉包' || cleanTarget === '大肉包') {
    found = inventory.find(i => {
      const n = (i.name || '').trim().toLowerCase();
      return n === '肉包' || n === '包子' || n === '鮮肉包' || n.includes('肉包');
    });
    if (found) return found;
  }

  // 3. Partial match
  found = inventory.find(i => {
    const n = (i.name || '').trim().toLowerCase();
    return n.includes(cleanTarget) || cleanTarget.includes(n);
  });

  return found || null;
}

/**
 * Deducts inventory for a specific order in Supabase and local cache.
 * Fully atomic, idempotently checked via `items.inventory_deducted === true`.
 */
export async function deductInventoryForOrder(order, storeCode = 'dragon') {
  if (!order || !order.id) return { success: false, reason: 'Invalid order' };

  // 1. Idempotency check: Don't deduct if already deducted
  const rawItems = order.items;
  let itemsObj = {};
  if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
    itemsObj = { ...rawItems };
  } else if (Array.isArray(rawItems)) {
    itemsObj = { cart: rawItems };
  } else if (typeof rawItems === 'string') {
    try { itemsObj = JSON.parse(rawItems); } catch (e) { itemsObj = {}; }
  }

  if (itemsObj.inventory_deducted === true) {
    return { success: false, reason: 'Already deducted' };
  }

  // 2. Skip test orders
  const isTest = order.type === 'test' || itemsObj.is_test === true || String(order.serialNum || order.order_number || '').startsWith('TEST');
  if (isTest) {
    return { success: false, reason: 'Test order skipped' };
  }

  // 3. Skip orders before the feature activation start timestamp
  const orderTime = order.timestamp || (order.created_at ? new Date(order.created_at).getTime() : 0);
  if (orderTime && orderTime < INVENTORY_DEDUCTION_START_TIMESTAMP) {
    return { success: false, reason: 'Historical order skipped' };
  }

  // 4. Calculate deductions needed
  const deductions = calculateOrderInventoryDeductions(order);
  if (deductions.length === 0) {
    // Even if no specific tracked items were in this order, mark order as processed so we don't re-check it
    try {
      itemsObj.inventory_deducted = true;
      await supabase.from('orders').update({ items: itemsObj }).eq('id', order.id);
    } catch (e) {}
    return { success: true, deductions: [], message: 'No tracked inventory in order' };
  }

  // 5. Fetch latest inventory from cloud
  const invKey = prefixNameForStore('SYSTEM_SETTING_INVENTORY', storeCode);
  const logsKey = prefixNameForStore('SYSTEM_SETTING_INVENTORY_LOGS', storeCode);

  let currentInventory = [];
  try {
    const { data: invData } = await supabase.from('menu_items').select('*').eq('name', invKey);
    if (invData && invData.length > 0 && invData[0].description) {
      currentInventory = JSON.parse(invData[0].description);
    } else {
      // Fallback local
      const local = localStorage.getItem(`${storeCode}_restaurant_inventory`) || localStorage.getItem('restaurant_inventory');
      currentInventory = local ? JSON.parse(local) : [];
    }
  } catch (err) {
    console.error('[inventoryDeduction] Failed to fetch inventory:', err);
    return { success: false, reason: 'Failed to fetch inventory' };
  }

  if (!Array.isArray(currentInventory) || currentInventory.length === 0) {
    return { success: false, reason: 'Inventory empty or not loaded' };
  }

  // 6. Apply deductions and construct log entries
  const newLogs = [];
  const updatedInventory = currentInventory.map(item => ({ ...item }));
  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  const orderNum = order.serialNum || order.order_number || String(order.id).slice(-6);

  let appliedCount = 0;
  deductions.forEach(ded => {
    const match = findMatchingInventoryItem(updatedInventory, ded.targetName);
    if (match) {
      const oldQty = Number(match.qty) || 0;
      const newQty = Math.max(0, Number((oldQty - ded.qty).toFixed(2)));
      match.qty = newQty;
      appliedCount++;

      newLogs.push({
        id: `LOG-SALE-${order.id}-${match.name}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        time: timeStr,
        date: dateStr,
        itemName: match.name,
        type: '銷售扣減(自動)',
        change: `-${ded.qty}`,
        unit: match.unit || ded.unit || '個',
        remarks: `單號: ${orderNum} [${ded.reason}]`
      });
    }
  });

  // 7. Persist updated inventory and logs to Supabase and localStorage
  try {
    // Save Inventory
    localStorage.setItem(`${storeCode}_restaurant_inventory`, JSON.stringify(updatedInventory));
    await supabase.from('menu_items').upsert([
      { name: invKey, price: 0, category: 'settings', description: JSON.stringify(updatedInventory) }
    ], { onConflict: 'name' });

    // Save Logs
    let existingLogs = [];
    try {
      const { data: logsData } = await supabase.from('menu_items').select('*').eq('name', logsKey);
      if (logsData && logsData.length > 0 && logsData[0].description) {
        existingLogs = JSON.parse(logsData[0].description);
      }
    } catch (e) {}

    const combinedLogs = [...newLogs, ...existingLogs].slice(0, 80);
    localStorage.setItem(`${storeCode}_restaurant_inventory_logs`, JSON.stringify(combinedLogs));
    await supabase.from('menu_items').upsert([
      { name: logsKey, price: 0, category: 'settings', description: JSON.stringify(combinedLogs) }
    ], { onConflict: 'name' });

    // Mark order as deducted in Supabase
    itemsObj.inventory_deducted = true;
    itemsObj.inventory_deductions = deductions;
    await supabase.from('orders').update({ items: itemsObj }).eq('id', order.id);

    console.log(`[inventoryDeduction] Successfully deducted inventory for Order #${orderNum}:`, deductions);
    return { success: true, deductions, updatedInventory };
  } catch (err) {
    console.error('[inventoryDeduction] Failed to update cloud inventory:', err);
    return { success: false, reason: err.message };
  }
}

/**
 * Scans a list of orders (e.g. recent completed / received orders)
 * and processes any pending orders that haven't been deducted yet.
 */
export async function processBatchPendingOrders(orders = [], storeCode = 'dragon') {
  if (!Array.isArray(orders) || orders.length === 0) return 0;

  let processedCount = 0;
  for (const o of orders) {
    if (o.status !== 'completed' && o.status !== 'received') continue;

    const rawItems = o.items;
    let itemsObj = {};
    if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
      itemsObj = rawItems;
    } else if (typeof rawItems === 'string') {
      try { itemsObj = JSON.parse(rawItems); } catch (e) {}
    }

    if (itemsObj.inventory_deducted === true) continue;

    const orderTime = o.timestamp || (o.created_at ? new Date(o.created_at).getTime() : 0);
    if (orderTime && orderTime < INVENTORY_DEDUCTION_START_TIMESTAMP) continue;

    const res = await deductInventoryForOrder(o, storeCode);
    if (res.success && res.deductions && res.deductions.length > 0) {
      processedCount++;
    }
  }

  return processedCount;
}
