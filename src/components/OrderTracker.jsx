import React, { useEffect } from 'react';

export default function OrderTracker({ order, onBackToMenu, onShareGroupOrder }) {
  if (!order) return null;

  // Sound and vibration notification when order is completed or ready
  useEffect(() => {
    if (order.status === 'ready' || order.status === 'completed') {
      try {
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch (e) {}
    }
  }, [order.status]);

  // Map status to progress percentage, badge, and descriptive messages
  const getStatusDetails = (status) => {
    switch (status) {
      case 'cancelled':
      case 'rejected':
      case 'deleted':
        return {
          title: '⚠️ 店家無法提供此訂單',
          desc: '抱歉，店家因品項售罄或尖峰滿單，暫時無法為您提供此筆訂單。如有已付款項將自動為您辦理退款，敬請見諒。',
          step: 0,
          color: '#ef4444',
          isCancelled: true
        };
      case 'ready':
      case 'completed':
        return {
          title: '🎉 製作完成 (請取餐)',
          desc: order.type === 'dine-in' 
            ? '您的餐點已熱騰騰製作完成，服務人員即將為您送上桌！' 
            : '您的餐點已熱騰騰製作完成！請至櫃檯出示此畫面號碼取餐。',
          step: 3,
          color: '#10b981',
          isReady: true
        };
      case 'preparing':
        return {
          title: '🍜 收單製作中',
          desc: '店家已確認收單！廚房師傅正在為您用心烹調餐點，請稍候片刻。',
          step: 2,
          color: '#7c3aed'
        };
      case 'received':
      default:
        return {
          title: '⏳ 等待店家收單',
          desc: '訂單已成功送達店家！等待店家確認收單製作中，請稍候片刻。',
          step: 1,
          color: '#ea580c'
        };
    }
  };

  const statusDetails = getStatusDetails(order.status);
  const isReady = statusDetails.isReady || order.status === 'ready' || order.status === 'completed';
  const isCancelled = statusDetails.isCancelled;

  return (
    <div className="order-tracker-card" style={{ maxWidth: '460px', margin: '0 auto' }}>
      <div className="tracker-title" style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span>📋 訂單即時追蹤</span>
        <span style={{ fontSize: '0.72rem', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>📱 線上點餐</span>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
        訂單編號: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{order.serialNum || order.id}</span>
      </div>

      {/* Main Status Callout Box */}
      <div className="tracker-status-box" style={{
        marginTop: '16px',
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: isCancelled ? '#fef2f2' : (isReady ? '#ecfdf5' : (statusDetails.step === 2 ? '#f5f3ff' : 'rgba(234, 88, 12, 0.06)')),
        border: isCancelled ? '2px solid #ef4444' : (isReady ? '2px solid #10b981' : (statusDetails.step === 2 ? '2px solid #8b5cf6' : '1px solid var(--border)')),
        boxShadow: isReady ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <div className="status-highlight" style={{
          fontSize: isReady ? '1.4rem' : '1.2rem',
          fontWeight: '900',
          color: isCancelled ? '#dc2626' : (isReady ? '#059669' : statusDetails.color),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          {statusDetails.title}
        </div>
        <div className="status-sub" style={{ fontSize: '0.88rem', color: isCancelled ? '#991b1b' : 'var(--text-main)', marginTop: '6px', lineHeight: '1.5' }}>
          {statusDetails.desc}
        </div>
      </div>

      {/* Progress Stepper or Cancelled Notice */}
      {isCancelled ? (
        <div style={{
          margin: '20px 0 16px 0',
          padding: '12px 16px',
          backgroundColor: '#fef2f2',
          borderRadius: '10px',
          border: '1px dashed #fca5a5',
          textAlign: 'left',
          fontSize: '0.82rem',
          color: '#b91c1c',
          lineHeight: '1.5'
        }}>
          <div>💡 <strong>溫馨提示：</strong></div>
          <div>若店家無法提供該餐點，請向櫃檯人員洽詢更換品項或現場退款，造成您的不便敬請見諒！</div>
        </div>
      ) : (
        /* 3-Step Progress Stepper (等待收單 -> 收單製作中 -> 製作完成) */
        <div style={{ margin: '24px 0 16px 0', position: 'relative' }}>
          {/* Progress Background Track */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '15%',
            right: '15%',
            height: '4px',
            backgroundColor: 'var(--border)',
            zIndex: 1
          }}>
            {/* Active Progress Fill */}
            <div style={{
              height: '100%',
              backgroundColor: isReady ? '#10b981' : (statusDetails.step === 2 ? '#8b5cf6' : 'var(--primary)'),
              width: statusDetails.step === 1 ? '0%' : (statusDetails.step === 2 ? '50%' : '100%'),
              transition: 'width 0.4s ease'
            }} />
          </div>

          {/* Stepper Nodes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            {/* Step 1: 等待收單 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: statusDetails.step >= 1 ? '#ea580c' : 'var(--border)',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {statusDetails.step > 1 ? '✓' : '1'}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: statusDetails.step >= 1 ? '#ea580c' : 'var(--text-muted)' }}>
                等待收單
              </span>
            </div>

            {/* Step 2: 收單製作中 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: statusDetails.step >= 2 ? (isReady ? '#10b981' : '#8b5cf6') : 'var(--bg-card)',
                color: statusDetails.step >= 2 ? 'white' : 'var(--text-muted)',
                border: statusDetails.step >= 2 ? 'none' : '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {statusDetails.step > 2 ? '✓' : (statusDetails.step === 2 ? '🍜' : '2')}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: statusDetails.step >= 2 ? 'bold' : 'normal', color: statusDetails.step >= 2 ? (isReady ? '#10b981' : '#7c3aed') : 'var(--text-muted)' }}>
                收單製作中
              </span>
            </div>

            {/* Step 3: 製作完成 / 請取餐 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: isReady ? '#10b981' : 'var(--bg-card)',
                color: isReady ? 'white' : 'var(--text-muted)',
                border: isReady ? 'none' : '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '0.9rem',
                boxShadow: isReady ? '0 0 10px rgba(16, 185, 129, 0.6)' : '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {isReady ? '🎉' : '3'}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: isReady ? 'bold' : 'normal', color: isReady ? '#10b981' : 'var(--text-muted)' }}>
                製作完成
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Order Success Message & Serial Number Card */}
      <div style={{
        backgroundColor: isReady ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 107, 53, 0.05)',
        border: isReady ? '2px solid #10b981' : '2px dashed var(--primary)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 16px',
        margin: '16px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {(order.type === 'delivery' || order.deliveryType === 'lalamove' || String(order.serialNum || '').startsWith('D-')) ? '您的外送訂單編號' : '您的取餐號碼 (流水號)'}
        </span>
        <span style={{ fontSize: '3rem', fontWeight: 900, color: isReady ? '#059669' : 'var(--primary)', letterSpacing: '1px', lineHeight: 1 }}>
          {order.serialNum || 'A-001'}
        </span>
        {order.pickupTime ? (
          <div style={{
            marginTop: '8px',
            padding: '4px 12px',
            backgroundColor: 'rgba(234, 88, 12, 0.1)',
            borderRadius: '20px',
            border: '1px solid rgba(234, 88, 12, 0.25)',
            fontSize: '0.88rem',
            color: '#c2410c',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>⏰</span>
            <span>{order.type === 'dine-in' ? '預定到店時間' : ((order.type === 'delivery' || order.deliveryType === 'lalamove' || String(order.serialNum || '').startsWith('D-')) ? '預定外送時間' : '預定取餐時間')}: <strong>{order.pickupTime}</strong></span>
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            {order.type === 'takeout' ? '預計取餐時間: 即刻製作' : ''}
          </span>
        )}
        {order.type === 'dine-in' && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            內用桌位: <strong style={{ color: 'var(--text-main)' }}>{order.tableName} 號桌</strong>
          </span>
        )}
      </div>

      {/* 👥 一鍵分享取餐號碼與明細給同事核對 */}
      {onShareGroupOrder && (
        <button
          type="button"
          onClick={onShareGroupOrder}
          style={{
            width: '100%',
            marginBottom: '14px',
            backgroundColor: '#06c755',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '11px 14px',
            fontSize: '0.92rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 3px 8px rgba(6, 199, 85, 0.28)'
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>💬</span>
          <span>LINE 分享取餐號碼與明細給同事</span>
        </button>
      )}

      {/* 🛵 Lalamove 外送配送資訊 */}
      {(order.type === 'delivery' || order.deliveryType === 'lalamove' || String(order.serialNum || '').startsWith('D-')) && (
        <div style={{
          margin: '14px 0',
          padding: '12px 14px',
          backgroundColor: '#f0f9ff',
          borderRadius: '10px',
          border: '1.5px solid #bae6fd',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.9rem', color: '#0369a1', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🛵</span>
              <span>Lalamove 專車直送</span>
            </span>
            <span style={{ fontSize: '0.75rem', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
              外送訂單
            </span>
          </div>
          <div style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 'bold' }}>
            📍 外送地址: <span style={{ color: '#0369a1' }}>{order.deliveryAddress || '未填寫地址'}</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '4px' }}>
            👤 收件姓名: {order.customerName || '顧客'} {order.customerPhone ? `| 📞 ${order.customerPhone}` : ''}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
            💡 店家備餐完成後將呼叫 Lalamove 專車配送，抵達前司機將致電聯繫，請留意手機來電！
          </div>
        </div>
      )}

      {order.type === 'takeout' && (
        <div style={{ margin: '14px 0', padding: '10px', backgroundColor: 'var(--bg-body)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
            👤 顧客姓名: {order.customerName || '現場顧客'} {order.customerPhone ? `| 📞 ${order.customerPhone}` : ''}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            💡 到店時請向櫃檯人員出示此畫面號碼以利快速核對取餐。
          </div>
        </div>
      )}

      {/* 💳 付款狀態與線上支付引導 */}
      <div style={{
        margin: '14px 0',
        padding: '14px',
        borderRadius: '12px',
        backgroundColor: order.paymentMethod === 'linepay' ? '#f0fdf4' : (order.paymentMethod === 'twqr_transfer' ? '#f0f9ff' : '#f8fafc'),
        border: order.paymentMethod === 'linepay' ? '1.5px solid #86efac' : (order.paymentMethod === 'twqr_transfer' ? '1.5px solid #bae6fd' : '1px solid var(--border)'),
        textAlign: 'left'
      }}>
        {/* 1. LINE Pay */}
        {order.paymentMethod === 'linepay' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1.2rem' }}>🟢</span>
              <strong style={{ color: '#047857', fontSize: '0.98rem' }}>LINE Pay 行動支付</strong>
              <span style={{ fontSize: '0.7rem', backgroundColor: '#06c755', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>推薦</span>
            </div>
            
            <a
              href="https://qrcodepay.line.me/qr/payment/CVkxJf36wSgi%252B7dOr34Dv3AIepqDyYQEs6TiqM2ok%252B%252BjdqiG8UuEY3to%252F0bauscW"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#06c755',
                color: '#ffffff',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: 'bold',
                textDecoration: 'none',
                boxShadow: '0 3px 10px rgba(6, 199, 85, 0.35)',
                cursor: 'pointer'
              }}
            >
              <span>📱 點此開啟 LINE Pay 一鍵付款</span>
              <span>➔</span>
            </a>

            <div style={{ fontSize: '0.78rem', color: '#15803d', lineHeight: '1.4' }}>
              手機點擊上方綠色按鈕將自動跳轉至 LINE Pay 快速付款。<br/>
              若您使用電腦或平板點餐，可使用手機直接掃描下方條碼：
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <img
                src="/images/linepay_card.jpg"
                alt="LINE Pay 龍城麵線"
                style={{
                  maxWidth: '180px',
                  borderRadius: '10px',
                  border: '1px solid #bbf7d0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
              />
            </div>
          </div>
        )}

        {/* 2. TWQR / 網銀轉帳 */}
        {order.paymentMethod === 'twqr_transfer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.2rem' }}>🏦</span>
                <strong style={{ color: '#0369a1', fontSize: '0.95rem' }}>TWQR / 第一銀行 網銀轉帳</strong>
              </div>
              <span style={{ fontSize: '0.7rem', backgroundColor: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>跨機構共通</span>
            </div>

            <div style={{
              backgroundColor: '#ffffff',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #e0f2fe',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div>銀行：<strong>第一商業銀行 (代碼 007)</strong></div>
              <div>戶名：<strong>個人賣家_龍城麵線</strong></div>
              {order.transferLast5 ? (
                <div style={{ color: '#0284c7', fontWeight: 'bold', marginTop: '2px' }}>
                  ✓ 您提交的轉帳末5碼：<span>{order.transferLast5}</span> (店家核對中)
                </div>
              ) : (
                <div style={{ color: '#b45309', fontSize: '0.78rem', marginTop: '2px' }}>
                  ⚠️ 若已轉帳，請於備註或取餐時告知扣款帳號末 5 碼以利店家對帳
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.78rem', color: '#0369a1', lineHeight: '1.4' }}>
              📱 <strong>手機免掃碼小撇步：</strong>長按下方 TWQR 圖片存入相簿 ➔ 開啟 台灣Pay / 街口 / 全支付 / 第一銀行或各大網銀 App 點選「掃描相簿相片」即可免第二支手機完成付款！
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <img
                src="/images/twqr_card.jpg"
                alt="TWQR 第一銀行 龍城麵線"
                style={{
                  maxWidth: '220px',
                  borderRadius: '10px',
                  border: '1px solid #bae6fd',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
              />
            </div>
          </div>
        )}

        {/* 3. 到店付款 / 貨到付款 */}
        {(order.paymentMethod === 'counter' || order.paymentMethod === 'cash') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
            <span style={{ fontSize: '1.2rem' }}>💵</span>
            <div>
              <strong>付款方式：</strong>
              <span>
                {(order.type === 'delivery' || order.deliveryType === 'lalamove' || String(order.serialNum || '').startsWith('D-'))
                  ? '貨到付款 (請於餐點送達時以現金交付 Lalamove 司機)'
                  : '店內付款 (取餐時於櫃檯結帳，支援現金與現場共同支付)'}
              </span>
            </div>
          </div>
        )}

        {/* 4. 線上刷卡 */}
        {order.paymentMethod === 'online' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: '#059669' }}>
            <span style={{ fontSize: '1.2rem' }}>💳</span>
            <div>
              <strong>線上刷卡：</strong>
              <span>已授權付款完成</span>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Summary */}
      <div className="tracker-receipt" style={{ marginTop: '14px' }}>
        <div className="tracker-receipt-title" style={{ fontSize: '0.95rem', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🧾 線上點餐明細</span>
          <span style={{ fontSize: '0.72rem', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>📱 線上點餐</span>
        </div>
        {order.items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{item.name} x {item.quantity}</strong>
              {item.specs && item.specs.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '4px', marginTop: '2px', lineHeight: '1.3' }}>
                  {item.specs.join(', ')}
                </div>
              )}
            </div>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              NT$ {item.totalPrice}
            </span>
          </div>
        ))}
        {Number(order.deliveryFee) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#0369a1', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border)' }}>
            <span>🛵 Lalamove 外送運費</span>
            <span style={{ fontWeight: 'bold' }}>NT$ {order.deliveryFee}</span>
          </div>
        )}
        <div className="summary-row total" style={{ paddingBottom: 0, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <span style={{ fontWeight: 'bold' }}>實付總計</span>
          <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '1.1rem' }}>NT$ {order.total}</span>
        </div>
      </div>

      <button 
        className="btn-secondary" 
        style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        onClick={onBackToMenu}
      >
        返回菜單
      </button>
    </div>
  );
}
