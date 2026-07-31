import React from 'react';

export default function OrderTracker({ order, onBackToMenu }) {
  if (!order) return null;

  // Map state to progress percentage and title
  const getStatusDetails = (status) => {
    switch (status) {
      case 'received':
        return {
          title: '已送單',
          desc: '訂單已送出，等待店家接單中。'
        };
      default:
        return {
          title: '已接單',
          desc: '店家已接單並開始製作，請準備取餐。'
        };
    }
  };

  const statusDetails = getStatusDetails(order.status);

  return (
    <div className="order-tracker-card">
      <div className="tracker-title">📋 訂單追蹤</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        單號: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{order.id}</span>
      </div>

      <div className="tracker-status-box">
        <div className="status-highlight">{statusDetails.title}</div>
        <div className="status-sub">{statusDetails.desc}</div>
      </div>

      {/* Progress Bar (2 Nodes: 已送單 -> 已接單) */}
      <div className="progress-stepper" style={{ justifyContent: 'space-around', margin: '24px 0', position: 'relative' }}>
        <div 
          className="progress-bar-fill" 
          style={{ 
            width: order.status !== 'received' ? '50%' : '0%',
            height: '4px',
            backgroundColor: 'var(--primary)',
            position: 'absolute',
            top: '15px',
            left: '25%',
            right: '25%',
            zIndex: 1,
            transition: 'width 0.3s ease'
          }}
        ></div>
        <div className="step-node active" style={{ zIndex: 2 }}>
          <div className="step-circle" style={{ backgroundColor: 'var(--primary)', color: 'white', fontWeight: 'bold' }}>✓</div>
          <span className="step-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>已送單</span>
        </div>
        <div className={`step-node ${order.status !== 'received' ? 'active' : ''}`} style={{ zIndex: 2 }}>
          <div className="step-circle" style={{ 
            backgroundColor: order.status !== 'received' ? 'var(--primary)' : 'var(--bg-input)',
            color: order.status !== 'received' ? 'white' : 'var(--text-muted)',
            fontWeight: 'bold'
          }}>
            {order.status !== 'received' ? '✓' : '2'}
          </div>
          <span className="step-label" style={{ 
            color: order.status !== 'received' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: order.status !== 'received' ? 'bold' : 'normal'
          }}>已接單</span>
        </div>
      </div>

      {/* Order Success Message & Serial Number Card */}
      <div style={{
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
        border: '1px solid rgba(34, 197, 94, 0.2)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        margin: '16px 0',
        color: '#16a34a',
        fontWeight: 'bold',
        fontSize: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        🎉 下單成功！餐點製作進度將即時更新
      </div>

      <div style={{
        backgroundColor: 'rgba(255, 107, 53, 0.05)',
        border: '2px dashed var(--primary)',
        borderRadius: 'var(--radius-md)',
        padding: '24px 16px',
        margin: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>您的取餐號碼 (流水號)</span>
        <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '1px', lineHeight: 1 }}>
          {order.serialNum || 'A-001'}
        </span>
        {order.type === 'takeout' ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            預計取餐時間: <strong style={{ color: 'var(--text-main)' }}>{order.pickupTime}</strong>
          </span>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            內用桌位: <strong style={{ color: 'var(--text-main)' }}>{order.tableName} 號桌</strong>
          </span>
        )}
      </div>

      {order.type === 'takeout' && order.status !== 'completed' && (
        <div style={{ margin: '16px 0' }}>
          <div className="barcode-sim" style={{ margin: '8px auto 12px auto' }}>||||| | |||| || ||| {order.id.slice(-6)}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            取餐姓名: {order.customerName} | 電話: {order.customerPhone || '無'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            提示: 請於到店時向櫃檯人員出示此畫面以利核對。
          </div>
        </div>
      )}

      {/* Receipt Summary */}
      <div className="tracker-receipt">
        <div className="tracker-receipt-title">明細項目</div>
        {order.items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{item.name} x {item.quantity}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '4px', marginTop: '2px', lineHeight: '1.3' }}>
                {item.specs.join(', ')}
              </div>
            </div>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>NT$ {item.totalPrice}</span>
          </div>
        ))}
        <div className="summary-row total" style={{ paddingBottom: 0, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
          <span>實付總計</span>
          <span>NT$ {order.total}</span>
        </div>
      </div>

      {/* Auto refresh & Edit policy reminder */}
      <div style={{ 
        marginTop: '16px', 
        padding: '12px', 
        borderRadius: '8px', 
        backgroundColor: 'rgba(255, 107, 53, 0.05)', 
        border: '1px solid rgba(255, 107, 53, 0.15)',
        fontSize: '0.8rem',
        color: 'var(--primary)',
        textAlign: 'center',
        fontWeight: 'bold',
        lineHeight: '1.4'
      }}>
        💡 提醒您：本頁面每 8 秒自動抓取更新狀態。當店家接單後，即進入廚房製作，屆時將無法修改或取消訂單。
      </div>

      {/* Edit and Cancel Buttons (Conditional based on status) */}
      {order.status === 'received' ? (
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            onClick={() => onEditOrder && onEditOrder(order)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--primary)',
              backgroundColor: 'transparent',
              color: 'var(--primary)',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ✏️ 修改訂單
          </button>
          <button
            onClick={() => onCancelOrder && onCancelOrder(order)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #ef4444',
              backgroundColor: 'transparent',
              color: '#ef4444',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ❌ 取消訂單
          </button>
        </div>
      ) : (
        order.status !== 'completed' && order.status !== 'deleted' && (
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            🔒 店家已接單並開始製作，訂單已鎖定無法修改或取消。
          </div>
        )
      )}

      <button 
        className="btn-secondary" 
        style={{ width: '100%', marginTop: '16px', padding: '12px' }}
        onClick={onBackToMenu}
      >
        返回菜單
      </button>
    </div>
  );
}
