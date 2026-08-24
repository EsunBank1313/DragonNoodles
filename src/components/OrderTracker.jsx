import React, { useEffect } from 'react';

export default function OrderTracker({ order, onBackToMenu }) {
  if (!order) return null;

  // Sound and vibration notification when order is ready
  useEffect(() => {
    if (order.status === 'ready') {
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
      case 'ready':
        return {
          title: '🎉 餐點製作完成！',
          desc: order.type === 'dine-in' 
            ? '您的餐點已熱騰騰製作完成，服務人員即將為您送上桌！' 
            : '您的餐點已製作完成！請至櫃檯出示此畫面取餐。',
          step: 3,
          color: '#10b981'
        };
      case 'preparing':
        return {
          title: '🍜 餐點製作中',
          desc: '店家已接單，正在為您精心現做烹調中，請稍候片刻。',
          step: 2,
          color: 'var(--primary)'
        };
      case 'completed':
        return {
          title: '✔ 訂單已完成',
          desc: '感謝您的光臨，祝您用餐愉快！歡迎再次點餐。',
          step: 3,
          color: '#16a34a'
        };
      case 'received':
      default:
        return {
          title: '📋 已送單 (排單中)',
          desc: '訂單已送達店家廚房，等待店家排單製作中。',
          step: 1,
          color: '#ea580c'
        };
    }
  };

  const statusDetails = getStatusDetails(order.status);
  const isReady = order.status === 'ready';

  return (
    <div className="order-tracker-card" style={{ maxWidth: '460px', margin: '0 auto' }}>
      <div className="tracker-title" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
        📋 訂單即時追蹤
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
        訂單編號: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{order.serialNum || order.id}</span>
      </div>

      {/* Main Status Callout Box */}
      <div className="tracker-status-box" style={{
        marginTop: '16px',
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: isReady ? '#ecfdf5' : 'rgba(234, 88, 12, 0.06)',
        border: isReady ? '2px solid #10b981' : '1px solid var(--border)',
        boxShadow: isReady ? '0 4px 12px rgba(16, 185, 129, 0.2)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <div className="status-highlight" style={{
          fontSize: isReady ? '1.4rem' : '1.2rem',
          fontWeight: '900',
          color: isReady ? '#059669' : statusDetails.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          {statusDetails.title}
        </div>
        <div className="status-sub" style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginTop: '6px', lineHeight: '1.5' }}>
          {statusDetails.desc}
        </div>
      </div>

      {/* 3-Step Progress Stepper (已送單 -> 製作中 -> 製作完成) */}
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
            backgroundColor: isReady ? '#10b981' : 'var(--primary)',
            width: statusDetails.step === 1 ? '0%' : (statusDetails.step === 2 ? '50%' : '100%'),
            transition: 'width 0.4s ease'
          }} />
        </div>

        {/* Stepper Nodes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
          {/* Step 1: 已送單 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: 'var(--primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              ✓
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--primary)' }}>已送單</span>
          </div>

          {/* Step 2: 製作中 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: statusDetails.step >= 2 ? (isReady ? '#10b981' : 'var(--primary)') : 'var(--bg-card)',
              color: statusDetails.step >= 2 ? 'white' : 'var(--text-muted)',
              border: statusDetails.step >= 2 ? 'none' : '2px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {statusDetails.step >= 2 ? '✓' : '2'}
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: statusDetails.step >= 2 ? 'bold' : 'normal', color: statusDetails.step >= 2 ? (isReady ? '#10b981' : 'var(--primary)') : 'var(--text-muted)' }}>
              製作中
            </span>
          </div>

          {/* Step 3: 製作完成 / 請取餐 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: statusDetails.step >= 3 ? '#10b981' : 'var(--bg-card)',
              color: statusDetails.step >= 3 ? 'white' : 'var(--text-muted)',
              border: statusDetails.step >= 3 ? 'none' : '2px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: '0.9rem',
              boxShadow: isReady ? '0 0 10px rgba(16, 185, 129, 0.6)' : '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {statusDetails.step >= 3 ? '🍜' : '3'}
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: statusDetails.step >= 3 ? 'bold' : 'normal', color: statusDetails.step >= 3 ? '#10b981' : 'var(--text-muted)' }}>
              製作完成
            </span>
          </div>
        </div>
      </div>

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
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>您的取餐號碼 (流水號)</span>
        <span style={{ fontSize: '3rem', fontWeight: 900, color: isReady ? '#059669' : 'var(--primary)', letterSpacing: '1px', lineHeight: 1 }}>
          {order.serialNum || 'A-001'}
        </span>
        {order.type === 'takeout' ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            預計取餐時間: <strong style={{ color: 'var(--text-main)' }}>{order.pickupTime || '即刻製作'}</strong>
          </span>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            內用桌位: <strong style={{ color: 'var(--text-main)' }}>{order.tableName} 號桌</strong>
          </span>
        )}
      </div>

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

      {/* Receipt Summary */}
      <div className="tracker-receipt" style={{ marginTop: '14px' }}>
        <div className="tracker-receipt-title" style={{ fontSize: '0.9rem', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
          餐點明細
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
