import React, { useState } from 'react';

export default function GroupOrderShareModal({
  isOpen,
  onClose,
  storeName = '龍城麵線',
  cart = [],
  order = null,
  storeUrl = window.location.href
}) {
  const [activeTab, setActiveTab] = useState(
    (order || (cart && cart.length > 0)) ? 'details' : 'invite'
  );
  const [copiedType, setCopiedType] = useState(null);

  if (!isOpen) return null;

  // Normalize items from either cart or placed order
  const rawItems = order ? (order.items || []) : cart;
  const itemsCount = rawItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalAmount = order 
    ? (order.total || rawItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0))
    : rawItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  
  const pickupTime = order ? order.pickupTime : null;
  const serialNum = order ? (order.serialNum || order.id) : null;

  // Clean menu link without transient order id params
  const cleanStoreUrl = (() => {
    try {
      const url = new URL(storeUrl);
      url.searchParams.delete('order_id');
      return url.toString();
    } catch {
      return storeUrl;
    }
  })();

  // 1. Generate Order Details Text for Office / Group Split-bill & Verification
  const generateOrderDetailsText = () => {
    let text = `🍜【${storeName}】揪團點餐明細核對單\n`;
    text += `=========================\n`;
    if (serialNum) {
      text += `🔖 訂單取餐號: #${serialNum}\n`;
    }
    if (pickupTime) {
      text += `⏰ 預定取餐時間: ${pickupTime}\n`;
    }
    text += `📋 餐點明細 (${itemsCount} 份):\n`;

    // Group or list items
    rawItems.forEach((item, index) => {
      text += `\n${index + 1}. ${item.name} x ${item.quantity} = NT$ ${item.totalPrice || item.price * item.quantity}`;
      if (item.forWhom && item.forWhom.trim()) {
        text += `\n   👤 點餐人: ${item.forWhom.trim()}`;
      }
      if (item.specs && item.specs.length > 0) {
        text += `\n   規格: ${item.specs.join(', ')}`;
      }
    });

    text += `\n=========================\n`;
    text += `💰 訂單總金額: NT$ ${totalAmount}\n`;
    
    // Per-person split breakdown if names were tagged
    const personBreakdown = {};
    let untaggedTotal = 0;
    rawItems.forEach(item => {
      const person = (item.forWhom && item.forWhom.trim()) ? item.forWhom.trim() : null;
      const price = item.totalPrice || (item.price * item.quantity);
      if (person) {
        personBreakdown[person] = (personBreakdown[person] || 0) + price;
      } else {
        untaggedTotal += price;
      }
    });

    const taggedPeople = Object.keys(personBreakdown);
    if (taggedPeople.length > 0) {
      text += `\n💵 各人分帳應付金額:\n`;
      taggedPeople.forEach(name => {
        text += `   • ${name}: NT$ ${personBreakdown[name]}\n`;
      });
      if (untaggedTotal > 0) {
        text += `   • 其他 (未標記姓名): NT$ ${untaggedTotal}\n`;
      }
    }

    text += `\n👉 請同事/朋友核對餐點與個人金額！祝大家用餐愉快～😋\n`;
    text += `🔗 線上菜單連結: ${cleanStoreUrl}`;

    return text;
  };

  // 2. Generate Group Order Invitation Text (Before ordering)
  const generateInviteText = () => {
    let text = `🍜【${storeName}】揪團點餐囉！\n`;
    text += `同事、朋友們想一起吃麵線、肉包或小菜的，歡迎一起點！\n\n`;
    text += `👉 請點擊下方專屬線上菜單挑選：\n${cleanStoreUrl}\n\n`;
    text += `選好後請把您要的餐點及客製選項傳給我，我會統一幫大家送單喔！😋`;
    return text;
  };

  const currentShareText = activeTab === 'details' ? generateOrderDetailsText() : generateInviteText();

  // Handle LINE Share
  const handleLineShare = () => {
    const textToShare = currentShareText;
    // LINE scheme URL for sharing text
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(textToShare)}`;
    window.open(lineUrl, '_blank');
  };

  // Handle Copy to Clipboard
  const handleCopy = async (type) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentShareText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = currentShareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
      alert('複製失敗，請手動長按選取複製');
    }
  };

  // Native Web Share API if supported
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${storeName} 揪團點餐`,
          text: currentShareText
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleLineShare();
        }
      }
    } else {
      handleLineShare();
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div 
        className="modal-content animate-fade-in" 
        style={{ 
          maxWidth: '460px', 
          width: '100%', 
          borderRadius: '18px', 
          padding: '20px', 
          backgroundColor: 'var(--bg-card, #ffffff)',
          color: 'var(--text-main, #1f2937)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>👥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                揪團點餐與分享明細
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)', marginTop: '2px' }}>
                一鍵分享給同事、朋友或 LINE 群組
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.5rem', 
              cursor: 'pointer', 
              color: 'var(--text-muted, #9ca3af)',
              padding: '0 4px',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', backgroundColor: 'var(--bg-input, #f3f4f6)', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === 'details' ? '#ffffff' : 'transparent',
              color: activeTab === 'details' ? '#ea580c' : 'var(--text-muted, #6b7280)',
              boxShadow: activeTab === 'details' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            📋 分享餐點明細與對帳
            {rawItems.length > 0 && <span style={{ marginLeft: '4px', fontSize: '0.75rem' }}>({itemsCount})</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invite')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === 'invite' ? '#ffffff' : 'transparent',
              color: activeTab === 'invite' ? '#0284c7' : 'var(--text-muted, #6b7280)',
              boxShadow: activeTab === 'invite' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            🔗 邀請同事點餐
          </button>
        </div>

        {/* Content Preview */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: '14px', marginBottom: '14px', paddingRight: '2px' }}>
          {activeTab === 'details' ? (
            rawItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted, #6b7280)' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>🛒</span>
                <p style={{ margin: 0, fontWeight: 'bold' }}>購物籃目前還是空的喔！</p>
                <p style={{ fontSize: '0.8rem', margin: '4px 0 16px 0' }}>請先挑選餐點，或切換至【邀請同事點餐】發送菜單連結！</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('invite')}
                  style={{
                    backgroundColor: '#0284c7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  切換至邀請同事 ➔
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted, #6b7280)' }}>
                    預覽傳送給同事/群組的內容：
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 'bold' }}>
                    共 {itemsCount} 份・NT$ {totalAmount}
                  </span>
                </div>
                <textarea
                  readOnly
                  value={currentShareText}
                  rows={9}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border, #d1d5db)',
                    backgroundColor: 'var(--bg-body, #f8fafc)',
                    color: 'var(--text-main, #1e293b)',
                    fontFamily: 'monospace, sans-serif',
                    fontSize: '0.8rem',
                    lineHeight: '1.45',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #6b7280)', marginTop: '4px' }}>
                  💡 小撇步：在購物籃內可為每一份餐點標記【👤 誰點的】，自動列出個人分帳金額！
                </div>
              </div>
            )
          ) : (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted, #6b7280)', marginBottom: '6px' }}>
                邀請同事朋友點餐訊息預覽：
              </div>
              <textarea
                readOnly
                value={currentShareText}
                rows={7}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border, #d1d5db)',
                  backgroundColor: 'var(--bg-body, #f8fafc)',
                  color: 'var(--text-main, #1e293b)',
                  fontFamily: 'monospace, sans-serif',
                  fontSize: '0.82rem',
                  lineHeight: '1.45',
                  resize: 'none',
                  outline: 'none'
                }}
              />
              <div style={{ 
                marginTop: '10px', 
                padding: '10px', 
                borderRadius: '8px', 
                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.2)',
                fontSize: '0.76rem',
                color: '#0369a1',
                lineHeight: '1.4'
              }}>
                💬 <strong>如何使用？</strong><br/>
                點擊下方【💬 LINE 分享給同事】，直接選擇辦公室 LINE 群組發送。同事收到點擊連結即可直接看線上菜單，免安裝任何 App！
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: '14px' }}>
          {/* Main LINE Share Button */}
          <button
            type="button"
            onClick={handleLineShare}
            disabled={activeTab === 'details' && rawItems.length === 0}
            style={{
              width: '100%',
              backgroundColor: '#06c755',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px',
              fontSize: '0.95rem',
              fontWeight: '900',
              cursor: (activeTab === 'details' && rawItems.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (activeTab === 'details' && rawItems.length === 0) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(6, 199, 85, 0.3)',
              transition: 'transform 0.1s'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            <span>LINE 一鍵分享給同事 / 群組</span>
          </button>

          {/* Secondary Actions Row */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleCopy('text')}
              disabled={activeTab === 'details' && rawItems.length === 0}
              style={{
                flex: 1,
                backgroundColor: copiedType === 'text' ? '#10b981' : '#ffffff',
                color: copiedType === 'text' ? '#ffffff' : '#374151',
                border: copiedType === 'text' ? '1.5px solid #10b981' : '1.5px solid #d1d5db',
                borderRadius: '8px',
                padding: '9px 10px',
                fontSize: '0.82rem',
                fontWeight: 'bold',
                cursor: (activeTab === 'details' && rawItems.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                transition: 'all 0.2s'
              }}
            >
              <span>{copiedType === 'text' ? '✅' : '📋'}</span>
              <span>{copiedType === 'text' ? '已複製內容！' : '複製文字內容'}</span>
            </button>

            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={activeTab === 'details' && rawItems.length === 0}
                style={{
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1.5px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="更多分享方式"
              >
                <span>📤</span>
                <span>系統分享</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
