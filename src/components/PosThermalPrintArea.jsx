import React from 'react';

export default function PosThermalPrintArea({ printPayload }) {
  if (!printPayload) return null;

  const { type, order, data, storeProfile = {}, receiptConfig = {} } = printPayload;
  const storeName = storeProfile.storeName || '龍城麵線';
  const is58mm = (receiptConfig.paperWidth === '58mm');
  const printWidth = is58mm ? '58mm' : '80mm';

  // Helper to extract cart items
  const getCartItems = (ord) => {
    if (!ord) return [];
    if (Array.isArray(ord.items)) return ord.items;
    if (ord.items && Array.isArray(ord.items.cart)) return ord.items.cart;
    if (Array.isArray(ord.cart)) return ord.cart;
    return [];
  };

  if (type === 'receipt' && order) {
    const cartItems = getCartItems(order);
    const orderNumStr = order.serialNum || order.orderNumber || order.order_number || '';
    const totalNum = order.total || 0;
    const dateStr = order.timestamp || order.createdAt || order.created_at || new Date().toISOString();
    const isDineIn = order.type === 'dine-in';
    const typeStr = isDineIn ? '內用' : '外帶';
    const tableNameStr = order.tableName || order.table_number || '';
    const custNameStr = order.customerName || order.custName || '';
    const remarksStr = order.remarks || order.note || '';
    const shouldPrintKitchen = receiptConfig.printKitchenTicket !== false;

    return (
      <div id="pos-thermal-print-area" style={{ width: printWidth }}>
        {/* ================= SECTION 1: Customer Receipt ================= */}
        <div className="customer-receipt">
          <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', marginBottom: '3px' }}>
            {storeName}
          </div>
          {receiptConfig.showTaxId !== false && storeProfile.storeTaxId && (
            <div style={{ textAlign: 'center', fontSize: '11px' }}>統一編號: {storeProfile.storeTaxId}</div>
          )}
          {receiptConfig.showPhone !== false && storeProfile.storePhone && (
            <div style={{ textAlign: 'center', fontSize: '11px' }}>電話: {storeProfile.storePhone}</div>
          )}
          {receiptConfig.showAddress !== false && storeProfile.storeAddress && (
            <div style={{ textAlign: 'center', fontSize: '10px' }}>{storeProfile.storeAddress}</div>
          )}
          <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', marginTop: '2px' }}>
            === 交易收據明細 ===
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px' }}>
            單號: {orderNumStr}
          </div>
          {receiptConfig.printType !== false && (
            <div>類型: {typeStr} {tableNameStr ? `(${tableNameStr}桌)` : ''}</div>
          )}
          {receiptConfig.printDateTime !== false && (
            <div style={{ fontSize: '11px' }}>時間: {new Date(dateStr).toLocaleString('zh-TW', { hour12: false })}</div>
          )}
          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>
          
          {cartItems.map((item, idx) => {
            const unitPrice = item.price || (item.totalPrice && item.quantity ? Math.round(item.totalPrice / item.quantity) : 0);
            return (
              <div key={idx} style={{ marginBottom: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                  <span>{item.name} x{item.quantity}</span>
                  <span>${unitPrice}</span>
                </div>
                {item.specs && item.specs.length > 0 && (
                  <div style={{ fontSize: '11px', paddingLeft: '8px', fontWeight: 'bold' }}>
                    └ {item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
          
          <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold' }}>
            <span>應收總計:</span>
            <span>${totalNum}</span>
          </div>
          {receiptConfig.printReceivedAndChange !== false && order.cashReceived !== undefined && order.cashReceived !== null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                <span>實收金額:</span>
                <span>${order.cashReceived}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                <span>找零:</span>
                <span>${order.changeAmount}</span>
              </div>
            </>
          )}
          {receiptConfig.showWifi !== false && storeProfile.storeWifi && (
            <>
              <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>
              <div style={{ fontSize: '10px', textAlign: 'center' }}>📶 店內 Wi-Fi: {storeProfile.storeWifi}</div>
            </>
          )}
          {receiptConfig.showFooter !== false && storeProfile.receiptFooter && (
            <>
              <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}></div>
              <div style={{ textAlign: 'center', fontSize: '11px' }}>{storeProfile.receiptFooter}</div>
            </>
          )}
        </div>

        {/* ================= SECTION 2: Kitchen Ticket ================= */}
        {shouldPrintKitchen && (
          <>
            <div className="print-page-break" style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '16px 0', borderTop: '2px dashed #000', borderBottom: '2px dashed #000', padding: '4px 0' }}>
              ✂️ --------------------------- ✂️<br />
              【 廚房出單備餐切線 】
            </div>
            <div className="kitchen-ticket">
              <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: '900' }}>=== 廚房備餐單 ===</div>
              <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: '900', padding: '3px 0', border: '2px solid #000', margin: '4px 0' }}>
                {typeStr} {tableNameStr ? tableNameStr + '桌' : ''}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '900' }}>
                <span>單號: #${orderNumStr}</span>
                <span>{custNameStr}</span>
              </div>
              <div style={{ fontSize: '11px' }}>時間: {new Date(dateStr).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
              <div style={{ borderTop: '2px solid #000', margin: '5px 0' }}></div>

              {cartItems.map((item, idx) => (
                <div key={idx} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900' }}>
                    <span>{item.name}</span>
                    <span style={{ fontSize: '20px', textDecoration: 'underline' }}>x{item.quantity}</span>
                  </div>
                  {item.specs && item.specs.length > 0 && (
                    <div style={{ fontSize: '13px', fontWeight: '900', paddingLeft: '10px', marginBottom: '3px' }}>
                      ▶ {item.specs.map(s => typeof s === 'object' && s ? (s.value || `${s.name}: ${s.value}`) : String(s)).join(' | ')}
                    </div>
                  )}
                  <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
                </div>
              ))}

              {remarksStr && (
                <>
                  <div style={{ margin: '4px 0', padding: '4px', border: '1px solid #000', fontWeight: '900', fontSize: '13px' }}>
                    ⚠️ 備註: {remarksStr}
                  </div>
                  <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
                </>
              )}

              <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>
                == 龍城出餐切單 ==
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (type === 'daily' && data) {
    const dateStr = data.date || new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
    const timeStr = new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    return (
      <div id="pos-thermal-print-area" style={{ width: printWidth }}>
        <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginBottom: '2px' }}>{storeName}</div>
        <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>【 營業日結對帳單 】</div>
        <div style={{ borderTop: '2px solid #000', margin: '5px 0' }}></div>
        <div>對帳日期: {dateStr}</div>
        <div>列印時間: {timeStr}</div>
        <div>經手人員: {data.cashier || '店長 (Admin)'}</div>
        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>

        <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0 2px 0' }}>=== 營業額總結 ===</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
          <span>當日總營收:</span>
          <span>${data.totalRevenue || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
          <span>└ 現金實收:</span>
          <span>${data.cashRevenue || 0}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
          <span>└ 線上/電子:</span>
          <span>${data.onlineRevenue || 0}</span>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0 2px 0' }}>=== 訂單筆數統計 ===</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>結帳總單數:</span>
          <span>{data.totalOrders || 0} 筆</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
          <span>└ 內用就座:</span>
          <span>{data.dineInCount || 0} 筆</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
          <span>└ 現場外帶:</span>
          <span>{data.takeoutCount || 0} 筆</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
          <span>└ 平均客單價:</span>
          <span>${data.avgOrderValue || 0}</span>
        </div>

        {data.topItems && data.topItems.length > 0 && (
          <>
            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0 2px 0' }}>=== 當日熱銷前五名 ===</div>
            {data.topItems.slice(0, 5).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{idx + 1}. {item.name || item[0]}</span>
                <span>x{item.quantity || item[1]}</span>
              </div>
            ))}
          </>
        )}

        <div style={{ borderTop: '2px solid #000', margin: '5px 0' }}></div>
        <div style={{ marginTop: '14px', marginBottom: '8px' }}>
          <div>錢箱現金核對: [  ] 相符</div>
          <div style={{ marginTop: '12px' }}>店長/結帳人員簽名:</div>
          <div style={{ borderBottom: '1px solid #000', marginTop: '25px' }}></div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px' }}>
          === 龍城餐飲 POS 系統 ===
        </div>
      </div>
    );
  }

  if (type === 'shift' && data) {
    const now = new Date();
    return (
      <div id="pos-thermal-print-area" style={{ width: printWidth }}>
        <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', marginBottom: '2px' }}>{storeName}</div>
        <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>=== 換班交接小票 (X-Report) ===</div>
        <div style={{ textAlign: 'center', fontSize: '11px' }}>門市代碼: {data.storeCode || 'dragon'}</div>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>交班收銀員:</span>
          <span>{data.cashierName || '店長/收銀員'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>開班時間:</span>
          <span>{data.loginTime ? new Date(data.loginTime).toLocaleString('zh-TW', { hour12: false }) : '未記錄'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>交班時間:</span>
          <span>{now.toLocaleString('zh-TW', { hour12: false })}</span>
        </div>
        <div style={{ borderTop: '2px solid #000', margin: '6px 0' }}></div>

        <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0 2px 0' }}>=== 當班實收營業額 ===</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
          <span>當班總營收:</span>
          <span>NT$ {(data.totalRevenue || 0).toLocaleString()}</span>
        </div>
        {data.paymentBreakdown ? Object.entries(data.paymentBreakdown).map(([methodName, amount]) => (
          <div key={methodName} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
            <span>└ {methodName}:</span>
            <span style={{ fontWeight: methodName === '現金' || methodName === 'cash' ? 'bold' : 'normal' }}>NT$ {(amount || 0).toLocaleString()}</span>
          </div>
        )) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
            <span>└ 現金實收:</span>
            <span style={{ fontWeight: 'bold' }}>NT$ {(data.cashRevenue || 0).toLocaleString()}</span>
          </div>
        )}
        {data.onlineRevenue ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
            <span>└ 線上點餐付:</span>
            <span>NT$ {(data.onlineRevenue || 0).toLocaleString()}</span>
          </div>
        ) : null}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0 2px 0' }}>=== 當班訂單統計 ===</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>當班成交筆數:</span>
          <span>{data.orderCount || 0} 筆</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
          <span>└ 內用筆數:</span>
          <span>{data.dineInCount || 0} 筆</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
          <span>└ 外帶筆數:</span>
          <span>{data.takeoutCount || 0} 筆</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '6px' }}>
          <span>└ 平均客單價:</span>
          <span>NT$ {data.avgOrderValue || 0}</span>
        </div>

        <div style={{ borderTop: '2px solid #000', margin: '6px 0' }}></div>
        <div style={{ marginTop: '14px', marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold' }}>💰 錢櫃實點現金應為: NT$ {(data.cashRevenue || 0).toLocaleString()}</div>
          <div style={{ marginTop: '12px' }}>交班人員簽名:</div>
          <div style={{ borderBottom: '1px solid #000', marginTop: '22px' }}></div>
          <div style={{ marginTop: '12px' }}>接班人員簽名:</div>
          <div style={{ borderBottom: '1px solid #000', marginTop: '22px' }}></div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px' }}>
          === 龍城餐飲 POS 系統 ===
        </div>
      </div>
    );
  }

  return null;
}
