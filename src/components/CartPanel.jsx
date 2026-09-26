import React, { useState } from 'react';

export default function CartPanel({ 
  cart, 
  onClose, 
  onUpdateQty, 
  onRemoveItem, 
  onCheckout, 
  onEditItem,
  onOpenShareModal,
  onUpdateForWhom
}) {
  const [editingPersonCartId, setEditingPersonCartId] = useState(null);
  const [personInput, setPersonInput] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const serviceCharge = 0;
  const total = subtotal + serviceCharge;

  const handleStartEditPerson = (item) => {
    setEditingPersonCartId(item.cartId);
    setPersonInput(item.forWhom || '');
  };

  const handleSavePerson = (cartId) => {
    if (onUpdateForWhom) {
      onUpdateForWhom(cartId, personInput.trim());
    }
    setEditingPersonCartId(null);
  };

  return (
    <div className="modal-backdrop cart-panel-backdrop" onClick={onClose}>
      <div className="cart-panel-content" onClick={(e) => e.stopPropagation()}>
        <div className="cart-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>我的購物籃 ({cart.reduce((sum, item) => sum + item.quantity, 0)})</h3>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {cart.length > 0 && onOpenShareModal && (
              <button
                type="button"
                onClick={onOpenShareModal}
                style={{
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="分享訂購內容給同事核對或傳到 LINE"
              >
                <span>👥</span>
                <span>分享核對單</span>
              </button>
            )}
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="cart-items-list">
          {cart.length === 0 ? (
            <div className="cart-empty-state">
              <span className="cart-empty-icon">🛒</span>
              <p>購物籃是空的</p>
              <p style={{ fontSize: '0.85rem' }}>快去選購好吃的麵線吧！</p>
            </div>
          ) : (
            cart.map((item) => (
              <div className="cart-item-card" key={item.cartId}>
                <div className="cart-item-details">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="cart-item-name">{item.name}</div>
                    
                    {/* Person Tagging Feature */}
                    {editingPersonCartId === item.cartId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="text"
                          autoFocus
                          placeholder="姓名 (例: 小美)"
                          value={personInput}
                          onChange={(e) => setPersonInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePerson(item.cartId);
                          }}
                          style={{
                            padding: '2px 6px',
                            fontSize: '0.75rem',
                            border: '1.5px solid var(--primary, #ff6b35)',
                            borderRadius: '4px',
                            width: '90px'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePerson(item.cartId)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '0.72rem',
                            backgroundColor: 'var(--primary, #ff6b35)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEditPerson(item)}
                        style={{
                          background: item.forWhom ? '#eff6ff' : 'transparent',
                          color: item.forWhom ? '#2563eb' : 'var(--text-muted, #9ca3af)',
                          border: item.forWhom ? '1px solid #bfdbfe' : '1px dashed #d1d5db',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap'
                        }}
                        title="點擊標記這份餐點是哪位同事點的"
                      >
                        <span>👤</span>
                        <span>{item.forWhom ? `${item.forWhom}` : '+ 誰點的'}</span>
                      </button>
                    )}
                  </div>

                  <div className="cart-item-specs">
                    {item.specs.map((spec, idx) => (
                      <span key={idx} className="cart-item-spec-item">{spec}</span>
                    ))}
                  </div>
                  <div className="cart-item-bottom">
                    <span className="cart-item-price">NT$ {item.totalPrice}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => onEditItem && onEditItem(item)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--primary)',
                          color: 'var(--primary)',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ✏️ 編輯
                      </button>
                      <div className="qty-counter" style={{ margin: 0 }}>
                        <button
                          className="qty-btn"
                          style={{ width: '28px', height: '28px', fontSize: '0.9rem' }}
                          onClick={() => onUpdateQty(item.cartId, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className="qty-val" style={{ fontSize: '0.95rem' }}>{item.quantity}</span>
                        <button
                          className="qty-btn"
                          style={{ width: '28px', height: '28px', fontSize: '0.9rem' }}
                          onClick={() => onUpdateQty(item.cartId, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-summary-section">
            <div className="summary-row">
              <span>小計</span>
              <span>NT$ {subtotal}</span>
            </div>
            <div className="summary-row total">
              <span>總金額</span>
              <span>NT$ {total}</span>
            </div>

            {/* Split bill / Group share quick button */}
            {onOpenShareModal && (
              <button
                type="button"
                onClick={onOpenShareModal}
                style={{
                  width: '100%',
                  marginBottom: '8px',
                  backgroundColor: '#06c755',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(6, 199, 85, 0.25)'
                }}
              >
                <span>💬</span>
                <span>LINE 分享明細給同事 / 對帳</span>
              </button>
            )}

            <button className="cart-checkout-btn" onClick={onCheckout}>
              前往填寫資料送單 (共 NT$ {total}) ➔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
