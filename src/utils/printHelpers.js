// Standardized Thermal Printout Utilities (58mm / 80mm Compatible)
// Unified Single-Window Dual Print Engine (Customer Receipt + Kitchen Cut Ticket)

export const defaultStoreProfile = {
  storeName: '龍城麵線',
  storePhone: '',
  storeAddress: '',
  storeTaxId: '',          // 統一編號
  storeWifi: '',           // 店內 Wi-Fi 帳密
  receiptFooter: '謝謝惠顧，歡迎再度光臨！'
};

export const defaultReceiptConfig = {
  paperWidth: '58mm',      // 預設為 '58mm' (標準便攜小票/出單機，防止右邊界截斷；亦可於設定切換為 '80mm')
  printKitchenTicket: true, // 同時列印廚房備餐切單 (雙聯出單)
  printReceivedAndChange: true,
  printType: true,
  printDateTime: true,
  showTaxId: true,
  showPhone: true,
  showAddress: true,
  showWifi: true,
  showFooter: true,
  enableDailyClosingPrint: true,
  enableOnlineOrdering: true
};

// Helper to extract cart items safely
const getCartItemsFromOrder = (order) => {
  if (!order) return [];
  if (Array.isArray(order.items)) return order.items;
  if (order.items && Array.isArray(order.items.cart)) return order.items.cart;
  if (Array.isArray(order.cart)) return order.cart;
  return [];
};

// Core Reliable Print Window Engine
export const openAndPrintDocument = (html, title = '列印單據') => {
  if (typeof window === 'undefined') return false;

  try {
    const printWin = window.open('', '_blank', 'width=380,height=650,menubar=no,toolbar=no,location=no,status=no');
    if (!printWin) {
      console.warn("Popup blocked by browser.");
      return false;
    }

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();

    // Trigger focus and print reliably
    setTimeout(() => {
      try {
        printWin.focus();
        printWin.print();
      } catch (e) {
        console.warn("printWin invoke warning:", e);
      }
    }, 250);

    return true;
  } catch (err) {
    console.error("openAndPrintDocument error:", err);
    return false;
  }
};

// =========================================================================
// 1. Customer Receipt Thermal Printout
// =========================================================================
export const printThermalReceipt = (order, storeProfile = defaultStoreProfile, receiptConfig = defaultReceiptConfig) => {
  const cartItems = getCartItemsFromOrder(order);
  const storeName = storeProfile.storeName || '龍城麵線';
  const orderNumStr = order.serialNum || order.orderNumber || order.order_number || '';
  const totalNum = order.total || 0;
  const dateStr = order.timestamp || order.createdAt || order.created_at || new Date().toISOString();
  const isUber = order.type === 'uber' || order.type === 'ubereats' || String(orderNumStr).startsWith('U-');
  const isPanda = order.type === 'foodpanda' || order.type === 'panda' || String(orderNumStr).startsWith('P-');
  const isDineIn = order.type === 'dine-in';
  const typeStr = isUber ? '🛵 外送 (Uber Eats)' : (isPanda ? '🐼 外送 (foodpanda)' : (order.type === 'delivery' ? '🛵 外送' : (isDineIn ? '內用' : '現場外帶')));
  const tableNameStr = order.tableName || order.table_number || '';

  const is58mm = (receiptConfig?.paperWidth === '58mm');
  const printWidth = is58mm ? '158px' : '260px';
  const titleSize = is58mm ? '16px' : '20px';
  const subtitleSize = is58mm ? '11px' : '13px';
  const fontSize = is58mm ? '12px' : '14px';
  const isPosOrder = !isUber && !isPanda && (
    order.source === 'pos' ||
    order.items?.source === 'pos' ||
    !!order.cashier ||
    !!order.items?.cashier ||
    String(order.customerName || order.custName || order.items?.customerName || '').includes('(POS)')
  );
  const isOnlineOrder = !isUber && !isPanda && !isPosOrder && (
    order.source === 'customer' ||
    order.items?.source === 'customer' ||
    order.isOnline === true ||
    !!order.authUser ||
    !!order.lineUser ||
    !!order.customerAuth ||
    order.channel === '線上點餐' ||
    order.items?.channel === '線上點餐'
  );

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>收據列印 - ${orderNumStr}</title>
        <style>
          @page { margin: 0; size: auto; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important; }
          }
          body { font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: ${fontSize}; line-height: 1.35; padding: 6px 4px; width: ${printWidth}; max-width: ${printWidth}; box-sizing: border-box; height: auto; color: #000; margin: 0; background: #fff; word-break: break-all; overflow: hidden; }
          .center { text-align: center; }
          .title { font-size: ${titleSize}; font-weight: bold; margin-bottom: 3px; }
          .subtitle { font-size: ${subtitleSize}; font-weight: bold; margin-bottom: 3px; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .double-divider { border-top: 2px solid #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; width: 100%; box-sizing: border-box; }
          .item { font-weight: bold; }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.focus(); window.print(); }, 150);">
        <div class="center title">${storeName}</div>
        ${(receiptConfig.showTaxId !== false && storeProfile.storeTaxId) ? `<div class="center" style="font-size: 11px;">統一編號: ${storeProfile.storeTaxId}</div>` : ''}
        ${(receiptConfig.showPhone !== false && storeProfile.storePhone) ? `<div class="center" style="font-size: 11px;">電話: ${storeProfile.storePhone}</div>` : ''}
        ${(receiptConfig.showAddress !== false && storeProfile.storeAddress) ? `<div class="center" style="font-size: 10px;">${storeProfile.storeAddress}</div>` : ''}
        <div class="center subtitle" style="margin-top: 2px;">=== 交易收據明細 ===</div>
        ${isPosOrder ? '<div class="center" style="font-size: 13px; font-weight: bold; margin: 2px 0; border: 1px solid #000; padding: 2px 0;">【 💻 POS機點餐 】</div>' : (isOnlineOrder ? '<div class="center" style="font-size: 13px; font-weight: bold; margin: 2px 0; border: 1px solid #000; padding: 2px 0;">【 📱 線上點餐 】</div>' : '')}
        <div class="divider"></div>
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 2px;">單號: ${orderNumStr}</div>
        ${(receiptConfig.printType !== false) ? `<div style="font-weight: bold; color: ${isUber ? '#059669' : '#000'};">類型: ${isPosOrder ? '【POS機點餐】' : (isOnlineOrder ? '【線上點餐】' : '')}${typeStr} ${tableNameStr ? `(${tableNameStr}桌)` : ''}</div>` : ''}
        ${order.pickupTime ? `<div style="font-weight: bold; font-size: 13px; margin: 2px 0;">取餐時間: ${order.pickupTime}</div>` : ''}
        ${(receiptConfig.printDateTime !== false) ? `<div style="font-size: 11px;">時間: ${new Date(dateStr).toLocaleString('zh-TW', { hour12: false })}</div>` : ''}
        <div class="divider"></div>
        ${cartItems.map(item => {
          const unitPrice = item.price || (item.totalPrice && item.quantity ? Math.round(item.totalPrice / item.quantity) : 0);
          return `
            <div class="row" style="font-size: 13px;">
              <span class="item">${item.name} x${item.quantity}</span>
              <span>$${unitPrice}</span>
            </div>
            ${item.specs && item.specs.length > 0 ? `
              <div style="font-size: 11px; padding-left: 8px; font-weight: bold;">
                └ ${item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(', ')}
              </div>
            ` : ''}
          `;
        }).join('')}
        <div class="divider"></div>
        <div class="row" style="font-size: 14px; font-weight: bold;">
          <span>應收總計:</span>
          <span>$${totalNum}</span>
        </div>
        ${isUber ? `
          <div class="row" style="font-size: 13px; font-weight: bold; color: #059669;">
            <span>付款方式:</span>
            <span>🛵 平台線上結清 (免收款)</span>
          </div>
        ` : isPanda ? `
          <div class="row" style="font-size: 13px; font-weight: bold; color: #d946ef;">
            <span>付款方式:</span>
            <span>🐼 平台線上結清 (免收款)</span>
          </div>
        ` : (order.paymentMethod === 'linepay' || order.paymentMethod === 'LINE Pay') ? `
          <div class="row" style="font-size: 13px; font-weight: bold; color: #059669;">
            <span>付款方式:</span>
            <span>🟢 LINE Pay (免找零)</span>
          </div>
          ${(order.paymentNote || order.transferLast5) ? `
            <div class="row" style="font-size: 12px; font-weight: bold; color: #059669;">
              <span>收款註記:</span>
              <span>${order.paymentNote || order.transferLast5}</span>
            </div>
          ` : ''}
        ` : (order.paymentMethod === 'twqr' || order.paymentMethod === 'twqr_transfer' || order.paymentMethod === 'TWQR') ? `
          <div class="row" style="font-size: 13px; font-weight: bold; color: #2563eb;">
            <span>付款方式:</span>
            <span>🏦 TWQR/台灣Pay (免找零)</span>
          </div>
          ${(order.paymentNote || order.transferLast5) ? `
            <div class="row" style="font-size: 12px; font-weight: bold; color: #2563eb;">
              <span>收款末5碼:</span>
              <span>${order.paymentNote || order.transferLast5}</span>
            </div>
          ` : ''}
        ` : (order.paymentMethod === 'card' || order.paymentMethod === 'credit' || order.paymentMethod === '信用卡') ? `
          <div class="row" style="font-size: 13px; font-weight: bold;">
            <span>付款方式:</span>
            <span>💳 信用卡扣款 (免找零)</span>
          </div>
          ${(order.paymentNote || order.transferLast5) ? `
            <div class="row" style="font-size: 12px;">
              <span>卡號末4碼:</span>
              <span>${order.paymentNote || order.transferLast5}</span>
            </div>
          ` : ''}
        ` : (order.paymentMethod === 'online' || order.paymentMethod === '線上付') ? `
          <div class="row" style="font-size: 13px; font-weight: bold; color: #7c3aed;">
            <span>付款方式:</span>
            <span>📱 線上點餐付款</span>
          </div>
        ` : ((receiptConfig.printReceivedAndChange !== false && order.cashReceived !== undefined && order.cashReceived !== null) ? `
          <div class="row" style="font-size: 13px; font-weight: bold;">
            <span>付款方式:</span>
            <span>💵 現金支付</span>
          </div>
          <div class="row" style="font-size: 13px; font-weight: bold;">
            <span>實收金額:</span>
            <span>$${order.cashReceived}</span>
          </div>
          <div class="row" style="font-size: 13px; font-weight: bold;">
            <span>找零:</span>
            <span>$${order.changeAmount}</span>
          </div>
        ` : `
          <div class="row" style="font-size: 13px; font-weight: bold;">
            <span>付款方式:</span>
            <span>${order.paymentMethod || '💵 現金支付'}</span>
          </div>
        `)}
        ${(receiptConfig.showWifi !== false && storeProfile.storeWifi) ? `
          <div class="divider"></div>
          <div style="font-size: 10px; text-align: center;">📶 店內 Wi-Fi: ${storeProfile.storeWifi}</div>
        ` : ''}
        ${(receiptConfig.showFooter !== false && storeProfile.receiptFooter) ? `
          <div class="divider"></div>
          <div style="text-align: center; font-size: 11px;">${storeProfile.receiptFooter}</div>
        ` : ''}
      </body>
    </html>
  `;

  return openAndPrintDocument(html, `收據 - ${orderNumStr}`);
};

// =========================================================================
// 2. Kitchen Ticket Thermal Printout (廚房備餐大字切單)
// =========================================================================
export const printKitchenTicket = (order, storeProfile = defaultStoreProfile, receiptConfig = defaultReceiptConfig) => {
  const cartItems = getCartItemsFromOrder(order);
  const orderNumStr = order.serialNum || order.orderNumber || order.order_number || '';
  const dateStr = order.timestamp || order.createdAt || order.created_at || new Date().toISOString();
  const isUber = order.type === 'uber' || order.type === 'ubereats' || String(orderNumStr).startsWith('U-');
  const isPanda = order.type === 'foodpanda' || order.type === 'panda' || String(orderNumStr).startsWith('P-');
  const isDineIn = order.type === 'dine-in';
  const typeStr = isUber ? '【🛵 外送 (Uber Eats)】' : (isPanda ? '【🐼 外送 (foodpanda)】' : (order.type === 'delivery' ? '【🛵 外送】' : (isDineIn ? '【內用】' : '【現場外帶】')));
  const tableNameStr = order.tableName || order.table_number || '';
  const custNameStr = order.customerName || order.custName || '';
  const remarksStr = order.remarks || order.note || '';

  const isPosOrder = !isUber && !isPanda && (
    order.source === 'pos' ||
    order.items?.source === 'pos' ||
    !!order.cashier ||
    !!order.items?.cashier ||
    String(order.customerName || order.custName || order.items?.customerName || '').includes('(POS)')
  );
  const isOnlineOrder = !isUber && !isPanda && !isPosOrder && (
    order.source === 'customer' ||
    order.items?.source === 'customer' ||
    order.isOnline === true ||
    !!order.authUser ||
    !!order.lineUser ||
    !!order.customerAuth ||
    order.channel === '線上點餐' ||
    order.items?.channel === '線上點餐'
  );

  const is58mm = (receiptConfig?.paperWidth === '58mm');
  const printWidth = is58mm ? '170px' : '260px';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>廚房備餐單 - ${orderNumStr}</title>
        <style>
          @page { margin: 0; size: auto; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important; }
          }
          body { font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.35; padding: 6px 10px; width: ${printWidth}; box-sizing: border-box; color: #000; margin: 0; background: #fff; }
          .center { text-align: center; }
          .bold { font-weight: 900; }
          .badge { font-size: 20px; font-weight: 900; padding: 3px 0; border: 2px solid #000; margin: 4px 0; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; width: 100%; box-sizing: border-box; }
          .item-row { font-size: 16px; font-weight: 900; margin: 4px 0 2px 0; }
          .spec-row { font-size: 13px; font-weight: 900; padding-left: 10px; color: #000; margin-bottom: 3px; }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.focus(); window.print(); }, 150);">
        <div class="center bold" style="font-size: 16px;">=== 廚房備餐單 ===</div>
        <div class="center badge">
          ${isPosOrder ? '【POS機點餐】' : (isOnlineOrder ? '【線上點餐】' : '')}${typeStr} ${tableNameStr ? tableNameStr + '桌' : ''}
        </div>
        ${isPosOrder ? '<div class="center bold" style="font-size: 12px; margin: 2px 0; letter-spacing: 1px;">★ 門市現場 POS 收銀送單 ★</div>' : (isOnlineOrder ? '<div class="center bold" style="font-size: 12px; margin: 2px 0; letter-spacing: 1px;">★ 顧客手機線上送單 ★</div>' : '')}
        ${order.pickupTime ? `<div class="center bold" style="font-size: 15px; border: 2px solid #000; padding: 2px 0; margin: 3px 0; background: #000; color: #fff;">⏰ 預定取餐: ${order.pickupTime}</div>` : ''}
        <div class="row bold" style="font-size: 15px;">
          <span>單號: #${orderNumStr}</span>
          <span>${custNameStr ? custNameStr : ''}</span>
        </div>
        <div style="font-size: 11px;">時間: ${new Date(dateStr).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <div class="double-divider"></div>

        ${cartItems.map(item => `
          <div class="row item-row">
            <span>${item.name}</span>
            <span style="font-size: 20px; text-decoration: underline;">x${item.quantity}</span>
          </div>
          ${item.specs && item.specs.length > 0 ? `
            <div class="spec-row">
              ▶ ${item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(' | ')}
            </div>
          ` : ''}
          <div class="divider"></div>
        `).join('')}

        ${remarksStr ? `
          <div style="margin: 4px 0; padding: 4px; border: 1px solid #000; font-weight: 900; font-size: 13px;">
            ⚠️ 備註: ${remarksStr}
          </div>
          <div class="divider"></div>
        ` : ''}

        <div class="center" style="font-size: 11px; margin-top: 6px;">
          == 龍城出餐切單 ==
        </div>
      </body>
    </html>
  `;

  return openAndPrintDocument(html, `備餐單 - ${orderNumStr}`);
};

// =========================================================================
// 3. Combined Dual Printout (Customer Receipt + Kitchen Ticket in ONE STREAM)
// =========================================================================
export const printDualReceipts = (order, storeProfile = defaultStoreProfile, receiptConfig = defaultReceiptConfig) => {
  const shouldPrintKitchen = receiptConfig?.printKitchenTicket !== false;
  
  if (!shouldPrintKitchen) {
    return printThermalReceipt(order, storeProfile, receiptConfig);
  }

  const cartItems = getCartItemsFromOrder(order);
  const storeName = storeProfile.storeName || '龍城麵線';
  const orderNumStr = order.serialNum || order.orderNumber || order.order_number || '';
  const totalNum = order.total || 0;
  const dateStr = order.timestamp || order.createdAt || order.created_at || new Date().toISOString();
  const isUber = order.type === 'uber' || order.type === 'ubereats' || String(orderNumStr).startsWith('U-');
  const isPanda = order.type === 'foodpanda' || order.type === 'panda' || String(orderNumStr).startsWith('P-');
  const isDineIn = order.type === 'dine-in';
  const typeStr = isUber ? '🛵 外送 (Uber Eats)' : (isPanda ? '🐼 外送 (foodpanda)' : (order.type === 'delivery' ? '🛵 外送' : (isDineIn ? '內用' : '現場外帶')));
  const kitchenTypeStr = isUber ? '【🛵 外送 (Uber Eats)】' : (isPanda ? '【🐼 外送 (foodpanda)】' : (order.type === 'delivery' ? '【🛵 外送】' : (isDineIn ? '【內用】' : '【現場外帶】')));
  const tableNameStr = order.tableName || order.table_number || '';
  const custNameStr = order.customerName || order.custName || '';
  const remarksStr = order.remarks || order.note || '';

  const is58mm = (receiptConfig?.paperWidth === '58mm');
  const printWidth = is58mm ? '158px' : '260px';
  const titleSize = is58mm ? '16px' : '20px';
  const subtitleSize = is58mm ? '11px' : '13px';
  const fontSize = is58mm ? '12px' : '14px';
  const isPosOrder = !isUber && !isPanda && (
    order.source === 'pos' ||
    order.items?.source === 'pos' ||
    !!order.cashier ||
    !!order.items?.cashier ||
    String(order.customerName || order.custName || order.items?.customerName || '').includes('(POS)')
  );
  const isOnlineOrder = !isUber && !isPanda && !isPosOrder && (
    order.source === 'customer' ||
    order.items?.source === 'customer' ||
    order.isOnline === true ||
    !!order.authUser ||
    !!order.lineUser ||
    !!order.customerAuth ||
    order.channel === '線上點餐' ||
    order.items?.channel === '線上點餐'
  );

  // Output both tickets in ONE complete continuous document
  const combinedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>收據與廚房切單 - ${orderNumStr}</title>
        <style>
          @page { margin: 0; size: auto; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important; }
            .page-break { page-break-after: always; break-after: page; }
          }
          body { font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: ${fontSize}; line-height: 1.35; padding: 6px 4px; width: ${printWidth}; max-width: ${printWidth}; box-sizing: border-box; height: auto; color: #000; margin: 0; background: #fff; word-break: break-all; overflow: hidden; }
          .center { text-align: center; }
          .title { font-size: ${titleSize}; font-weight: bold; margin-bottom: 3px; }
          .subtitle { font-size: ${subtitleSize}; font-weight: bold; margin-bottom: 3px; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .double-divider { border-top: 2px solid #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; width: 100%; box-sizing: border-box; }
          .item { font-weight: bold; }
          .cut-line { text-align: center; font-size: 11px; font-weight: bold; margin: 16px 0; border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 6px 0; }
          .bold { font-weight: 900; }
          .badge { font-size: 20px; font-weight: 900; padding: 3px 0; border: 2px solid #000; margin: 4px 0; }
          .item-row { font-size: 16px; font-weight: 900; margin: 4px 0 2px 0; }
          .spec-row { font-size: 13px; font-weight: 900; padding-left: 10px; color: #000; margin-bottom: 3px; }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.focus(); window.print(); }, 150);">
        <!-- SECTION 1: Customer Receipt -->
        <div class="customer-receipt-section">
          <div class="center title">${storeName}</div>
          ${(receiptConfig.showTaxId !== false && storeProfile.storeTaxId) ? `<div class="center" style="font-size: 11px;">統一編號: ${storeProfile.storeTaxId}</div>` : ''}
          ${(receiptConfig.showPhone !== false && storeProfile.storePhone) ? `<div class="center" style="font-size: 11px;">電話: ${storeProfile.storePhone}</div>` : ''}
          ${(receiptConfig.showAddress !== false && storeProfile.storeAddress) ? `<div class="center" style="font-size: 10px;">${storeProfile.storeAddress}</div>` : ''}
          <div class="center subtitle" style="margin-top: 2px;">=== ${isUber ? 'Uber 外送出貨單' : (isPanda ? '熊貓外送出貨單' : '交易收據明細')} ===</div>
          ${isPosOrder ? '<div class="center" style="font-size: 13px; font-weight: bold; margin: 2px 0; border: 1px solid #000; padding: 2px 0;">【 💻 POS機點餐 】</div>' : (isOnlineOrder ? '<div class="center" style="font-size: 13px; font-weight: bold; margin: 2px 0; border: 1px solid #000; padding: 2px 0;">【 📱 線上點餐 】</div>' : '')}
          <div class="divider"></div>
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 2px;">單號: ${orderNumStr}</div>
          ${(receiptConfig.printType !== false) ? `<div>類型: ${isPosOrder ? '【POS機點餐】' : (isOnlineOrder ? '【線上點餐】' : '')}${typeStr} ${tableNameStr ? `(${tableNameStr}桌)` : ''}</div>` : ''}
          ${custNameStr ? `<div style="font-weight: bold; margin: 2px 0;">顧客: ${custNameStr}</div>` : ''}
          ${order.pickupTime ? `<div style="font-weight: bold; font-size: 13px; margin: 2px 0;">取餐時間: ${order.pickupTime}</div>` : ''}
          ${(receiptConfig.printDateTime !== false) ? `<div style="font-size: 11px;">時間: ${new Date(dateStr).toLocaleString('zh-TW', { hour12: false })}</div>` : ''}
          <div class="divider"></div>
          ${cartItems.map(item => {
            const unitPrice = item.price || (item.totalPrice && item.quantity ? Math.round(item.totalPrice / item.quantity) : 0);
            return `
              <div class="row" style="font-size: 13px;">
                <span class="item">${item.name} x${item.quantity}</span>
                ${(!isUber && !isPanda) ? `<span>$${unitPrice}</span>` : ''}
              </div>
              ${item.specs && item.specs.length > 0 ? `
                <div style="font-size: 11px; padding-left: 8px; font-weight: bold;">
                  └ ${item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(', ')}
                </div>
              ` : ''}
            `;
          }).join('')}
          ${(!isUber && !isPanda) ? `
          <div class="divider"></div>
          <div class="row" style="font-size: 14px; font-weight: bold;">
            <span>應收總計:</span>
            <span>$${totalNum}</span>
          </div>
          ` : '<div class="divider"></div>'}
          ${isUber ? `
            <div class="row" style="font-size: 13px; font-weight: bold; color: #059669;">
              <span>付款方式:</span>
              <span>🛵 平台線上結清 (免收款)</span>
            </div>
          ` : (isPanda ? `
            <div class="row" style="font-size: 13px; font-weight: bold; color: #d946ef;">
              <span>付款方式:</span>
              <span>🐼 平台線上結清 (免收款)</span>
            </div>
          ` : (order.paymentMethod === 'linepay' || order.paymentMethod === 'LINE Pay') ? `
            <div class="row" style="font-size: 13px; font-weight: bold; color: #059669;">
              <span>付款方式:</span>
              <span>🟢 LINE Pay (免找零)</span>
            </div>
            ${(order.paymentNote || order.transferLast5) ? `
              <div class="row" style="font-size: 12px; font-weight: bold; color: #059669;">
                <span>收款註記:</span>
                <span>${order.paymentNote || order.transferLast5}</span>
              </div>
            ` : ''}
          ` : (order.paymentMethod === 'twqr' || order.paymentMethod === 'twqr_transfer' || order.paymentMethod === 'TWQR') ? `
            <div class="row" style="font-size: 13px; font-weight: bold; color: #2563eb;">
              <span>付款方式:</span>
              <span>🏦 TWQR/台灣Pay (免找零)</span>
            </div>
            ${(order.paymentNote || order.transferLast5) ? `
              <div class="row" style="font-size: 12px; font-weight: bold; color: #2563eb;">
                <span>收款末5碼:</span>
                <span>${order.paymentNote || order.transferLast5}</span>
              </div>
            ` : ''}
          ` : (order.paymentMethod === 'card' || order.paymentMethod === 'credit' || order.paymentMethod === '信用卡') ? `
            <div class="row" style="font-size: 13px; font-weight: bold;">
              <span>付款方式:</span>
              <span>💳 信用卡扣款 (免找零)</span>
            </div>
            ${(order.paymentNote || order.transferLast5) ? `
              <div class="row" style="font-size: 12px;">
                <span>卡號末4碼:</span>
                <span>${order.paymentNote || order.transferLast5}</span>
              </div>
            ` : ''}
          ` : (order.paymentMethod === 'online' || order.paymentMethod === '線上付') ? `
            <div class="row" style="font-size: 13px; font-weight: bold; color: #7c3aed;">
              <span>付款方式:</span>
              <span>📱 線上點餐付款</span>
            </div>
          ` : ((receiptConfig.printReceivedAndChange !== false && order.cashReceived !== undefined && order.cashReceived !== null) ? `
            <div class="row" style="font-size: 13px; font-weight: bold;">
              <span>付款方式:</span>
              <span>💵 現金支付</span>
            </div>
            <div class="row" style="font-size: 13px; font-weight: bold;">
              <span>實收金額:</span>
              <span>$${order.cashReceived}</span>
            </div>
            <div class="row" style="font-size: 13px; font-weight: bold;">
              <span>找零:</span>
              <span>$${order.changeAmount}</span>
            </div>
          ` : `
            <div class="row" style="font-size: 13px; font-weight: bold;">
              <span>付款方式:</span>
              <span>${order.paymentMethod || '💵 現金支付'}</span>
            </div>
          `))}
          ${(receiptConfig.showWifi !== false && storeProfile.storeWifi) ? `
            <div class="divider"></div>
            <div style="font-size: 10px; text-align: center;">📶 店內 Wi-Fi: ${storeProfile.storeWifi}</div>
          ` : ''}
          ${(receiptConfig.showFooter !== false && storeProfile.receiptFooter) ? `
            <div class="divider"></div>
            <div style="text-align: center; font-size: 11px;">${storeProfile.receiptFooter}</div>
          ` : ''}
        </div>

        <!-- Cut Line / Page Break for Auto Cutter -->
        <div class="cut-line page-break">
          ✂️ --------------------------- ✂️<br />
          【 廚房出單備餐切線 】
        </div>

        <!-- SECTION 2: Kitchen Ticket -->
        <div class="kitchen-ticket-section">
          <div class="center bold" style="font-size: 16px;">=== 廚房備餐單 ===</div>
          <div class="center badge">
            ${isPosOrder ? '【POS機點餐】' : (isOnlineOrder ? '【線上點餐】' : '')}${kitchenTypeStr} ${tableNameStr ? tableNameStr + '桌' : ''}
          </div>
          ${isPosOrder ? '<div class="center bold" style="font-size: 12px; margin: 2px 0; letter-spacing: 1px;">★ 門市現場 POS 收銀送單 ★</div>' : (isOnlineOrder ? '<div class="center bold" style="font-size: 12px; margin: 2px 0; letter-spacing: 1px;">★ 顧客手機線上送單 ★</div>' : '')}
          ${order.pickupTime ? `<div class="center bold" style="font-size: 15px; border: 2px solid #000; padding: 2px 0; margin: 3px 0; background: #000; color: #fff;">⏰ 預定取餐: ${order.pickupTime}</div>` : ''}
          <div class="row bold" style="font-size: 15px;">
            <span>單號: #${orderNumStr}</span>
            <span>${custNameStr ? custNameStr : ''}</span>
          </div>
          <div style="font-size: 11px;">時間: ${new Date(dateStr).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div class="double-divider"></div>

          ${cartItems.map(item => `
            <div class="row item-row">
              <span>${item.name}</span>
              <span style="font-size: 20px; text-decoration: underline;">x${item.quantity}</span>
            </div>
            ${item.specs && item.specs.length > 0 ? `
              <div class="spec-row">
                ▶ ${item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(' | ')}
              </div>
            ` : ''}
            <div class="divider"></div>
          `).join('')}

          ${remarksStr ? `
            <div style="margin: 4px 0; padding: 4px; border: 1px solid #000; font-weight: 900; font-size: 13px;">
              ⚠️ 備註: ${remarksStr}
            </div>
            <div class="divider"></div>
          ` : ''}

          <div class="center" style="font-size: 11px; margin-top: 6px;">
            == 龍城出餐切單 ==
          </div>
        </div>
      </body>
    </html>
  `;

  return openAndPrintDocument(combinedHtml, `收據與廚房單 - ${orderNumStr}`);
};

// =========================================================================
// 4. Daily Closing Summary (X/Z Report) Thermal Printout
// =========================================================================
export const printDailyClosingReport = (dailyData, storeProfile = defaultStoreProfile) => {
  const now = new Date();
  const dateStr = dailyData.date || now.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
  const timeStr = now.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  const name = storeProfile?.storeName || '龍城麵線';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>日結對帳小票 - ${dateStr}</title>
        <style>
          @page { margin: 0; size: auto; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important; }
          }
          body { font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; line-height: 1.4; padding: 4px 8px; width: 170px; box-sizing: border-box; color: #000; margin: 0; background: #fff; }
          .center { text-align: center; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
          .subtitle { font-size: 12px; font-weight: bold; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .double-divider { border-top: 2px solid #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; width: 100%; box-sizing: border-box; }
          .bold { font-weight: bold; }
          .section-title { font-size: 12px; font-weight: bold; margin: 4px 0 2px 0; }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.focus(); window.print(); }, 150);">
        <div class="center title">${name}</div>
        <div class="center subtitle">【 營業日結對帳單 】</div>
        <div class="double-divider"></div>
        <div>對帳日期: ${dateStr}</div>
        <div>列印時間: ${timeStr}</div>
        <div>經手人員: ${dailyData.cashier || '店長 (Admin)'}</div>
        <div class="divider"></div>

        <div class="section-title">=== 營業額總結 ===</div>
        <div class="row bold" style="font-size: 14px;">
          <span>當日總營業額:</span>
          <span>$${(dailyData.totalRevenue || 0).toLocaleString()}</span>
        </div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 13px; color: #16a34a;">
          <span>💵 錢箱應有現金:</span>
          <span>$${(dailyData.cashRevenue || 0).toLocaleString()}</span>
        </div>
        <div class="row bold" style="font-size: 12px; color: #2563eb; margin-top: 3px;">
          <span>⚡ 取代現金缺口合計:</span>
          <span>$${((dailyData.nonCashTotal !== undefined ? dailyData.nonCashTotal : ((dailyData.totalRevenue || 0) - (dailyData.cashRevenue || 0))) || 0).toLocaleString()}</span>
        </div>
        ${dailyData.linePayRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 🟢 LINE Pay:</span>
            <span>$${dailyData.linePayRevenue.toLocaleString()} (${dailyData.linePayCount || 0}筆)</span>
          </div>
        ` : ''}
        ${dailyData.twqrRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 🏦 TWQR/台灣Pay:</span>
            <span>$${dailyData.twqrRevenue.toLocaleString()} (${dailyData.twqrCount || 0}筆)</span>
          </div>
        ` : ''}
        ${dailyData.otherOnlineRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 💳 其他電支/刷卡:</span>
            <span>$${dailyData.otherOnlineRevenue.toLocaleString()} (${dailyData.otherOnlineCount || 0}筆)</span>
          </div>
        ` : (dailyData.onlineRevenue && !dailyData.linePayRevenue && !dailyData.twqrRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 📱 線上點餐付款:</span>
            <span>$${dailyData.onlineRevenue.toLocaleString()}</span>
          </div>
        ` : '')}
        ${dailyData.uberRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 🛵 Uber Eats:</span>
            <span>$${dailyData.uberRevenue.toLocaleString()} (${dailyData.uberCount || 0}筆)</span>
          </div>
        ` : ''}
        ${dailyData.pandaRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 🐼 foodpanda:</span>
            <span>$${dailyData.pandaRevenue.toLocaleString()} (${dailyData.pandaCount || 0}筆)</span>
          </div>
        ` : ''}
        ${dailyData.manualRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 📝 手動補登:</span>
            <span>$${dailyData.manualRevenue.toLocaleString()}</span>
          </div>
        ` : ''}

        <div class="divider"></div>
        <div class="section-title">=== 訂單筆數統計 ===</div>
        <div class="row bold">
          <span>結帳總單數:</span>
          <span>${dailyData.totalOrders || 0} 筆</span>
        </div>
        <div class="row" style="padding-left: 6px;">
          <span>└ 內用就座:</span>
          <span>${dailyData.dineInCount || 0} 筆</span>
        </div>
        <div class="row" style="padding-left: 6px;">
          <span>└ 現場外帶:</span>
          <span>${dailyData.takeoutCount || 0} 筆</span>
        </div>
        ${(dailyData.uberCount || dailyData.pandaCount || dailyData.deliveryCount) ? `
          <div class="row bold" style="padding-left: 6px;">
            <span>└ 🛵 外送總數:</span>
            <span>${dailyData.deliveryCount || ((dailyData.uberCount || 0) + (dailyData.pandaCount || 0))} 筆</span>
          </div>
          ${dailyData.uberCount ? `
            <div class="row" style="padding-left: 14px; font-size: 11px;">
              <span>• Uber Eats:</span>
              <span>${dailyData.uberCount} 筆</span>
            </div>
          ` : ''}
          ${dailyData.pandaCount ? `
            <div class="row" style="padding-left: 14px; font-size: 11px;">
              <span>• foodpanda:</span>
              <span>${dailyData.pandaCount} 筆</span>
            </div>
          ` : ''}
        ` : ''}
        <div class="row" style="padding-left: 6px;">
          <span>└ 平均客單價:</span>
          <span>$${dailyData.avgOrderValue || 0}</span>
        </div>

        ${dailyData.topItems && dailyData.topItems.length > 0 ? `
          <div class="divider"></div>
          <div class="section-title">=== 當日熱銷前五名 ===</div>
          ${dailyData.topItems.slice(0, 5).map((item, idx) => `
            <div class="row">
              <span>${idx + 1}. ${item.name || item[0]}</span>
              <span>x${item.quantity || item[1]}</span>
            </div>
          `).join('')}
        ` : ''}

        <div class="double-divider"></div>
        <div style="margin-top: 14px; margin-bottom: 8px;">
          <div style="font-weight: bold; font-size: 13px;">錢箱實點現金應為: $${(dailyData.cashRevenue || 0).toLocaleString()} [  ] 相符</div>
          <div style="font-size: 10px; color: #444; margin-top: 3px; line-height: 1.3;">
            * 核算公式: 總營業額 - 電支外送缺口($${((dailyData.nonCashTotal !== undefined ? dailyData.nonCashTotal : ((dailyData.totalRevenue || 0) - (dailyData.cashRevenue || 0))) || 0).toLocaleString()}) = 錢箱實收現金
          </div>
          <div style="margin-top: 12px;">店長/結帳人員簽名:</div>
          <div style="border-bottom: 1px solid #000; margin-top: 25px;"></div>
        </div>
        <div class="center" style="font-size: 10px; margin-top: 8px;">
          === 龍城餐飲 POS 系統 ===
        </div>
      </body>
    </html>
  `;

  return openAndPrintDocument(html, `日結報表 - ${dateStr}`);
};

// =========================================================================
// 5. Shift Handover / X-Report Printout (員工換班/交班對帳小票)
// =========================================================================
export const printShiftHandoverReport = (shiftData, storeProfile = defaultStoreProfile, receiptConfig = defaultReceiptConfig) => {
  const is58mm = (receiptConfig?.paperWidth === '58mm');
  const printWidth = is58mm ? '170px' : '260px';
  const storeName = storeProfile.storeName || '龍城麵線';
  const now = new Date();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>換班交接小票 (X-Report) - ${storeName}</title>
        <style>
          @page { margin: 0; size: auto; }
          @media print {
            html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important; }
          }
          body { font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.4; padding: 6px 10px; width: ${printWidth}; box-sizing: border-box; color: #000; margin: 0; background: #fff; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
          .subtitle { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; width: 100%; box-sizing: border-box; margin: 2px 0; }
          .section-title { font-size: 12px; font-weight: bold; margin: 4px 0 2px 0; }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.focus(); window.print(); }, 150);">
        <div class="center title">${storeName}</div>
        <div class="center subtitle">=== 換班交接小票 (X-Report) ===</div>
        <div class="center" style="font-size: 11px;">門市代碼: ${shiftData.storeCode || 'dragon'}</div>
        <div class="divider"></div>

        <div class="row bold">
          <span>交班收銀員:</span>
          <span>${shiftData.cashierName || '店長/收銀員'}</span>
        </div>
        <div class="row" style="font-size: 11px;">
          <span>開班時間:</span>
          <span>${shiftData.loginTime ? new Date(shiftData.loginTime).toLocaleString('zh-TW', { hour12: false }) : '未記錄'}</span>
        </div>
        <div class="row" style="font-size: 11px;">
          <span>交班時間:</span>
          <span>${now.toLocaleString('zh-TW', { hour12: false })}</span>
        </div>
        <div class="double-divider"></div>

        <div class="section-title">=== 當班實收營業額 ===</div>
        <div class="row bold" style="font-size: 15px;">
          <span>當班總營收:</span>
          <span>NT$ ${(shiftData.totalRevenue || 0).toLocaleString()}</span>
        </div>
        <div class="divider"></div>
        <div class="row bold" style="font-size: 13px; color: #16a34a;">
          <span>💵 錢櫃應有現金:</span>
          <span>NT$ ${(shiftData.cashRevenue || 0).toLocaleString()}</span>
        </div>
        <div class="row bold" style="font-size: 12px; color: #2563eb; margin-top: 3px;">
          <span>⚡ 取代現金缺口合計:</span>
          <span>NT$ ${((shiftData.nonCashTotal !== undefined ? shiftData.nonCashTotal : ((shiftData.totalRevenue || 0) - (shiftData.cashRevenue || 0))) || 0).toLocaleString()}</span>
        </div>
        ${shiftData.linePayRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 🟢 LINE Pay:</span>
            <span>NT$ ${shiftData.linePayRevenue.toLocaleString()} (${shiftData.linePayCount || 0}筆)</span>
          </div>
        ` : ''}
        ${shiftData.twqrRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 🏦 TWQR/台灣Pay:</span>
            <span>NT$ ${shiftData.twqrRevenue.toLocaleString()} (${shiftData.twqrCount || 0}筆)</span>
          </div>
        ` : ''}
        ${shiftData.otherOnlineRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 💳 其他電支/刷卡:</span>
            <span>NT$ ${shiftData.otherOnlineRevenue.toLocaleString()} (${shiftData.otherOnlineCount || 0}筆)</span>
          </div>
        ` : (shiftData.onlineRevenue && !shiftData.linePayRevenue && !shiftData.twqrRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 📱 線上點餐付款:</span>
            <span>NT$ ${shiftData.onlineRevenue.toLocaleString()}</span>
          </div>
        ` : '')}
        ${shiftData.uberRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 🛵 Uber Eats:</span>
            <span>NT$ ${shiftData.uberRevenue.toLocaleString()} (${shiftData.uberCount || 0}筆)</span>
          </div>
        ` : ''}
        ${shiftData.pandaRevenue ? `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• 🐼 foodpanda:</span>
            <span>NT$ ${shiftData.pandaRevenue.toLocaleString()} (${shiftData.pandaCount || 0}筆)</span>
          </div>
        ` : ''}
        ${(shiftData.paymentBreakdown && Object.keys(shiftData.paymentBreakdown).some(k => k !== '現金' && k !== 'cash' && !['linepay', 'LINE Pay', 'twqr', 'TWQR'].includes(k))) ? Object.entries(shiftData.paymentBreakdown).filter(([k]) => k !== '現金' && k !== 'cash' && !['linepay', 'LINE Pay', 'twqr', 'TWQR'].includes(k) && shiftData.paymentBreakdown[k] > 0).map(([methodName, amount]) => `
          <div class="row" style="padding-left: 10px; font-size: 11px;">
            <span>• ${methodName}:</span>
            <span>NT$ ${(amount || 0).toLocaleString()}</span>
          </div>
        `).join('') : ''}

        <div class="divider"></div>
        <div class="section-title">=== 當班訂單統計 ===</div>
        <div class="row bold">
          <span>當班成交筆數:</span>
          <span>${shiftData.orderCount || 0} 筆</span>
        </div>
        <div class="row" style="padding-left: 6px;">
          <span>└ 內用筆數:</span>
          <span>${shiftData.dineInCount || 0} 筆</span>
        </div>
        <div class="row" style="padding-left: 6px;">
          <span>└ 現場外帶:</span>
          <span>${shiftData.takeoutCount || 0} 筆</span>
        </div>
        ${shiftData.uberCount ? `
          <div class="row" style="padding-left: 6px;">
            <span>└ 🛵 Uber Eats:</span>
            <span>${shiftData.uberCount || 0} 筆</span>
          </div>
        ` : ''}
        ${shiftData.pandaCount ? `
          <div class="row" style="padding-left: 6px;">
            <span>└ 🐼 熊貓外送:</span>
            <span>${shiftData.pandaCount || 0} 筆</span>
          </div>
        ` : ''}
        <div class="row" style="padding-left: 6px;">
          <span>└ 平均客單價:</span>
          <span>NT$ ${shiftData.avgOrderValue || 0}</span>
        </div>

        <div class="double-divider"></div>
        <div style="margin-top: 14px; margin-bottom: 8px;">
          <div style="font-weight: bold; font-size: 13px;">💰 錢櫃實點現金應為: NT$ ${(shiftData.cashRevenue || 0).toLocaleString()}</div>
          <div style="font-size: 10px; color: #555; margin-top: 3px; line-height: 1.3;">
            * 核算公式: 當班總營收 - 電支外送缺口($${((shiftData.nonCashTotal !== undefined ? shiftData.nonCashTotal : ((shiftData.totalRevenue || 0) - (shiftData.cashRevenue || 0))) || 0).toLocaleString()}) = 錢櫃應有現金
          </div>
          <div style="margin-top: 12px;">交班人員簽名:</div>
          <div style="border-bottom: 1px solid #000; margin-top: 22px;"></div>
          <div style="margin-top: 12px;">接班人員簽名:</div>
          <div style="border-bottom: 1px solid #000; margin-top: 22px;"></div>
        </div>
        <div class="center" style="font-size: 10px; margin-top: 8px;">
          === 龍城餐飲 POS 系統 ===
        </div>
      </body>
    </html>
  `;

  return openAndPrintDocument(html, `換班小票 - ${shiftData.cashierName || '店長'}`);
};

export const printViaHiddenIframe = openAndPrintDocument;
