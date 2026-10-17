import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  createGroupRoom,
  getGroupRoom,
  isHostOfRoom,
  removeItemFromGroupRoom,
  updateItemQtyInGroupRoom,
  updateGroupRoomStatus,
  buildGroupOrderUrl
} from '../services/groupOrderService';

export default function GroupOrderShareModal({
  isOpen,
  onClose,
  storeName = '龍城麵線',
  storeCode = 'dragon',
  cart = [],
  order = null,
  activeGroupRoom = null,
  setActiveGroupRoom = null,
  currentUser = null,
  onImportToCheckout = null,
  onLeaveRoom = null,
  storeUrl = window.location.href
}) {
  const [activeTab, setActiveTab] = useState('room'); // 'room' | 'split' | 'create'
  const [copiedType, setCopiedType] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [hostNameInput, setHostNameInput] = useState(
    currentUser?.displayName || currentUser?.name || '主揪'
  );
  const [deadlineInput, setDeadlineInput] = useState('');
  const [showQrExpanded, setShowQrExpanded] = useState(false);

  const isHost = activeGroupRoom ? isHostOfRoom(activeGroupRoom) : false;

  // Decide initial active tab when modal opens
  useEffect(() => {
    if (isOpen) {
      if (activeGroupRoom) {
        setActiveTab('room');
      } else if (order || (cart && cart.length > 0)) {
        setActiveTab('split');
      } else {
        setActiveTab('create');
      }
    }
  }, [isOpen, activeGroupRoom, order]);

  // Generate QR Code whenever active room changes
  useEffect(() => {
    if (activeGroupRoom && activeGroupRoom.roomCode) {
      const roomUrl = buildGroupOrderUrl(activeGroupRoom.roomCode, storeCode);
      QRCode.toDataURL(roomUrl, {
        width: 260,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('QR code generation failed:', err));
    } else {
      setQrCodeDataUrl('');
    }
  }, [activeGroupRoom, storeCode]);

  if (!isOpen) return null;

  // Raw items source: either group room items, placed order items, or current cart
  const roomItems = activeGroupRoom ? (activeGroupRoom.items || []) : [];
  const rawItems = activeGroupRoom ? roomItems : (order ? (order.items || []) : cart);
  const itemsCount = rawItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalAmount = rawItems.reduce((sum, item) => sum + (item.totalPrice || ((item.price || 0) * (item.quantity || 1))), 0);

  // Group items by person (forWhom)
  const itemsByPerson = {};
  rawItems.forEach(item => {
    const person = (item.forWhom && item.forWhom.trim()) ? item.forWhom.trim() : (item.addedBy || '其他/未標記');
    if (!itemsByPerson[person]) {
      itemsByPerson[person] = [];
    }
    itemsByPerson[person].push(item);
  });

  const dedicatedRoomUrl = activeGroupRoom 
    ? buildGroupOrderUrl(activeGroupRoom.roomCode, storeCode) 
    : (() => {
        try {
          const url = new URL(storeUrl);
          url.searchParams.delete('order_id');
          return url.toString();
        } catch {
          return storeUrl;
        }
      })();

  // 1. Generate Invitation Text for Group Order Room
  const generateInviteText = () => {
    if (activeGroupRoom) {
      let text = `🍜【${storeName}】${activeGroupRoom.hostName} 發起揪團點餐囉！\n`;
      text += `大家各自用手機挑選想吃的麵線與小菜，餐點會即時彙整到主揪購物車！\n\n`;
      if (activeGroupRoom.deadline) {
        text += `⏰ 預計收單截止時間: ${activeGroupRoom.deadline}\n`;
      }
      text += `👉 請點擊下方專屬揪團連結加入點餐：\n${dedicatedRoomUrl}\n`;
      text += `(揪團房號: #${activeGroupRoom.roomCode})\n\n`;
      text += `進入後輸入您的稱呼即可開始挑選餐點，免安裝 App，主揪會統一送單結帳喔！😋`;
      return text;
    }

    let text = `🍜【${storeName}】揪團點餐囉！\n`;
    text += `同事、朋友們想一起吃麵線、肉包或小菜的，歡迎一起點！\n\n`;
    text += `👉 專屬線上菜單挑選連結：\n${dedicatedRoomUrl}\n\n`;
    text += `選好後請把您要的餐點及客製選項傳給我，我會統一幫大家送單喔！😋`;
    return text;
  };

  // 2. Generate Split-Bill Breakdown Text (for LINE group settlement)
  const generateSplitBillText = () => {
    let text = `🍜【${storeName}】揪團分帳與對帳明細表\n`;
    text += `=========================\n`;
    if (activeGroupRoom) {
      text += `👥 揪團房號: #${activeGroupRoom.roomCode} (主揪: ${activeGroupRoom.hostName})\n`;
    }
    if (order && (order.serialNum || order.id)) {
      text += `🔖 取餐單號: #${order.serialNum || order.id}\n`;
    }
    if (order && order.pickupTime) {
      text += `⏰ 取餐時間: ${order.pickupTime}\n`;
    }
    text += `📋 餐點總數: 共 ${itemsCount} 份\n`;
    text += `💰 訂單總額: NT$ ${totalAmount}\n`;
    text += `-------------------------\n`;
    text += `💵 各人應付分帳金額：\n`;

    Object.keys(itemsByPerson).forEach(person => {
      const personItems = itemsByPerson[person];
      const personSubtotal = personItems.reduce((s, it) => s + (it.totalPrice || ((it.price || 0) * (it.quantity || 1))), 0);
      const itemsSummary = personItems.map(it => `${it.name}x${it.quantity}`).join('、');
      text += `\n👤 【${person}】: NT$ ${personSubtotal}\n`;
      text += `   └ 餐點: ${itemsSummary}\n`;
    });

    text += `\n=========================\n`;
    text += `👉 請各位團員核對個人餐點與金額，記得轉帳或給現金喔！感謝大家～😋\n`;
    return text;
  };

  // Handle LINE Share
  const handleLineShare = (textToShare) => {
    const content = textToShare || (activeTab === 'split' ? generateSplitBillText() : generateInviteText());
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(content)}`;
    window.open(lineUrl, '_blank');
  };

  // Handle Copy
  const handleCopy = async (type, textToCopy) => {
    try {
      const content = textToCopy || (type === 'link' ? dedicatedRoomUrl : (activeTab === 'split' ? generateSplitBillText() : generateInviteText()));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
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
      alert('複製失敗，請手動選取複製');
    }
  };

  // Action: Create Group Room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    try {
      const newRoom = await createGroupRoom({
        hostName: hostNameInput || '主揪',
        storeCode,
        storeName,
        deadline: deadlineInput
      });
      if (setActiveGroupRoom) {
        setActiveGroupRoom(newRoom);
      }
      setActiveTab('room');
    } catch (err) {
      alert(`建立揪團房間失敗: ${err.message || '請檢查網路連線'}`);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Action: Lock / Unlock Room
  const handleToggleLockRoom = async () => {
    if (!activeGroupRoom || !isHost) return;
    const newStatus = activeGroupRoom.status === 'open' ? 'locked' : 'open';
    try {
      const updated = await updateGroupRoomStatus(activeGroupRoom.roomCode, newStatus);
      if (setActiveGroupRoom) setActiveGroupRoom(updated);
    } catch (err) {
      alert(`修改房間狀態失敗: ${err.message}`);
    }
  };

  // Action: Remove Item from Group Room
  const handleRemoveItem = async (cartId) => {
    if (!activeGroupRoom) return;
    if (!window.confirm('確定要自團體購物車中移除此品項嗎？')) return;
    try {
      const updated = await removeItemFromGroupRoom(activeGroupRoom.roomCode, cartId);
      if (setActiveGroupRoom) setActiveGroupRoom(updated);
    } catch (err) {
      alert(`移除失敗: ${err.message}`);
    }
  };

  // Action: Leave / Dismiss Room
  const handleLeaveOrDismiss = () => {
    const msg = isHost 
      ? '您是主揪，關閉後您仍可由本地記錄重新進入。確定要退出房間嗎？' 
      : '確定要退出此揪團點餐房間嗎？';
    if (!window.confirm(msg)) return;
    if (onLeaveRoom) {
      onLeaveRoom();
    } else if (setActiveGroupRoom) {
      setActiveGroupRoom(null);
    }
    onClose();
  };

  return (
    <div 
      className="modal-backdrop" 
      style={{ 
        zIndex: 1100, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)'
      }} 
      onClick={onClose}
    >
      <div 
        className="modal-content animate-fade-in" 
        style={{ 
          maxWidth: '500px', 
          width: '100%', 
          borderRadius: '20px', 
          padding: '20px', 
          backgroundColor: '#ffffff',
          color: '#1e293b',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem', backgroundColor: '#eff6ff', padding: '6px', borderRadius: '12px' }}>👥</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                  {activeGroupRoom ? '多人即時協同揪團' : '發起揪團點餐'}
                </h3>
                {activeGroupRoom && (
                  <span style={{ 
                    fontSize: '0.72rem', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    fontWeight: 800,
                    backgroundColor: activeGroupRoom.status === 'open' ? '#dcfce7' : (activeGroupRoom.status === 'submitted' ? '#e0e7ff' : '#fee2e2'),
                    color: activeGroupRoom.status === 'open' ? '#15803d' : (activeGroupRoom.status === 'submitted' ? '#3730a3' : '#b91c1c')
                  }}>
                    {activeGroupRoom.status === 'open' ? '🟢 開放點餐' : (activeGroupRoom.status === 'submitted' ? '✅ 已送單' : '🔒 已截止')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                {activeGroupRoom 
                  ? `房號: #${activeGroupRoom.roomCode}・主揪: ${activeGroupRoom.hostName} ${isHost ? '(您)' : ''}`
                  : '專屬連結即時協同點餐・免安裝 App'}
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.6rem', 
              cursor: 'pointer', 
              color: '#94a3b8',
              padding: '0 4px',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
          {activeGroupRoom ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('room')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: activeTab === 'room' ? '#ffffff' : 'transparent',
                  color: activeTab === 'room' ? '#2563eb' : '#64748b',
                  boxShadow: activeTab === 'room' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                👥 即時房間 ({itemsCount}份)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('split')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: activeTab === 'split' ? '#ffffff' : 'transparent',
                  color: activeTab === 'split' ? '#ea580c' : '#64748b',
                  boxShadow: activeTab === 'split' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                💵 分帳明細 (NT$ {totalAmount})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'create' ? '#ffffff' : 'transparent',
                  color: activeTab === 'create' ? '#059669' : '#64748b',
                  boxShadow: activeTab === 'create' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                🚀 發起專屬揪團房間
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('split')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'split' ? '#ffffff' : 'transparent',
                  color: activeTab === 'split' ? '#ea580c' : '#64748b',
                  boxShadow: activeTab === 'split' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                📋 分享目前購物明細
              </button>
            </>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: '12px', paddingRight: '2px' }}>
          
          {/* ================= VIEW 1: ACTIVE GROUP ROOM ================= */}
          {activeTab === 'room' && activeGroupRoom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Share Card: Dedicated Link + Room Code + QR */}
              <div style={{ 
                backgroundColor: '#f8fafc', 
                border: '1.5px solid #cbd5e1', 
                borderRadius: '16px', 
                padding: '14px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>專屬揪團點餐代碼：</span>
                    <span style={{ 
                      fontSize: '1.05rem', 
                      fontWeight: 900, 
                      letterSpacing: '1px', 
                      backgroundColor: '#1e293b', 
                      color: '#38bdf8', 
                      padding: '2px 8px', 
                      borderRadius: '6px' 
                    }}>
                      {activeGroupRoom.roomCode}
                    </span>
                  </div>
                  {activeGroupRoom.deadline && (
                    <span style={{ fontSize: '0.75rem', color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      ⏰ 截止: {activeGroupRoom.deadline}
                    </span>
                  )}
                </div>

                {/* Dedicated URL Copy Box */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '10px', 
                  padding: '6px 10px', 
                  gap: '6px',
                  marginBottom: '10px'
                }}>
                  <span style={{ fontSize: '0.9rem' }}>🔗</span>
                  <input 
                    type="text" 
                    readOnly 
                    value={dedicatedRoomUrl}
                    style={{ 
                      flex: 1, 
                      border: 'none', 
                      outline: 'none', 
                      fontSize: '0.78rem', 
                      color: '#2563eb', 
                      fontWeight: 700,
                      backgroundColor: 'transparent'
                    }} 
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy('link', dedicatedRoomUrl)}
                    style={{
                      backgroundColor: copiedType === 'link' ? '#10b981' : '#f1f5f9',
                      color: copiedType === 'link' ? '#ffffff' : '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {copiedType === 'link' ? '✓ 已複製連結' : '複製連結'}
                  </button>
                </div>

                {/* QR Code + LINE Button Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {qrCodeDataUrl && (
                    <div 
                      onClick={() => setShowQrExpanded(!showQrExpanded)}
                      style={{ 
                        flexShrink: 0, 
                        cursor: 'pointer', 
                        textAlign: 'center', 
                        backgroundColor: '#ffffff', 
                        padding: '4px', 
                        borderRadius: '8px', 
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                      title="點擊放大出示 QR Code"
                    >
                      <img src={qrCodeDataUrl} alt="Room QR" style={{ width: '64px', height: '64px', display: 'block' }} />
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', fontWeight: 'bold' }}>現場掃碼</div>
                    </div>
                  )}

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleLineShare()}
                      style={{
                        backgroundColor: '#06c755',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(6, 199, 85, 0.25)'
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>💬</span>
                      <span>LINE 一鍵發送邀請到群組</span>
                    </button>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: '1.3' }}>
                      💡 同事在自己手機點開連結即可選餐，品項會即時推播至您的主揪清單！
                    </div>
                  </div>
                </div>

                {/* Expanded QR Modal if clicked */}
                {showQrExpanded && qrCodeDataUrl && (
                  <div 
                    style={{ 
                      marginTop: '10px', 
                      padding: '12px', 
                      backgroundColor: '#ffffff', 
                      borderRadius: '12px', 
                      border: '2px solid #3b82f6', 
                      textAlign: 'center' 
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '6px', color: '#1e3a8a' }}>
                      請同事用手機相機掃描加入點餐：
                    </div>
                    <img src={qrCodeDataUrl} alt="Large Room QR" style={{ width: '180px', height: '180px', margin: '0 auto', display: 'block' }} />
                    <button 
                      type="button" 
                      onClick={() => setShowQrExpanded(false)}
                      style={{ marginTop: '8px', fontSize: '0.75rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      收起 QR Code
                    </button>
                  </div>
                )}
              </div>

              {/* Live Member Cart Items Breakdown */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                    📋 即時餐點清單 ({Object.keys(itemsByPerson).length} 人・共 {itemsCount} 份)
                  </span>
                  <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#ea580c' }}>
                    總額: NT$ {totalAmount}
                  </span>
                </div>

                {roomItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8' }}>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '6px' }}>🍜</span>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>目前購物車尚無餐點</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem' }}>請將上方專屬連結傳給同事，或直接由菜單選購！</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.keys(itemsByPerson).map((person, pIdx) => {
                      const pItems = itemsByPerson[person];
                      const pSubtotal = pItems.reduce((s, it) => s + (it.totalPrice || ((it.price || 0) * (it.quantity || 1))), 0);
                      const isCurrentUser = currentUser?.displayName === person || (isHost && person === activeGroupRoom.hostName);

                      return (
                        <div key={pIdx} style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '8px 10px', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                backgroundColor: isCurrentUser ? '#dbeafe' : '#e2e8f0', 
                                color: isCurrentUser ? '#1d4ed8' : '#334155', 
                                fontWeight: 900, 
                                padding: '1px 6px', 
                                borderRadius: '4px' 
                              }}>
                                👤 {person} {isCurrentUser ? '(您)' : ''}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>({pItems.length} 項)</span>
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                              NT$ {pSubtotal}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '6px' }}>
                            {pItems.map((it, itIdx) => (
                              <div key={it.cartId || itIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.78rem' }}>
                                <div style={{ flex: 1, paddingRight: '6px' }}>
                                  <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                    • {it.name} <span style={{ color: '#ea580c', fontWeight: 900 }}>x{it.quantity}</span>
                                  </div>
                                  {it.specs && it.specs.length > 0 && (
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                      └ {Array.isArray(it.specs) ? it.specs.join(', ') : it.specs}
                                    </div>
                                  )}
                                  {it.note && (
                                    <div style={{ fontSize: '0.7rem', color: '#b91c1c' }}>
                                      └ [{it.note}]
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  <span style={{ fontWeight: 800, color: '#475569' }}>
                                    ${it.totalPrice || ((it.price || 0) * (it.quantity || 1))}
                                  </span>
                                  {(isHost || isCurrentUser) && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItem(it.cartId)}
                                      style={{
                                        border: 'none',
                                        background: 'none',
                                        color: '#ef4444',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        padding: '0 2px',
                                        lineHeight: 1
                                      }}
                                      title="移除此項"
                                    >
                                      &times;
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Host Control Actions */}
              {isHost && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleToggleLockRoom}
                      style={{
                        flex: 1,
                        backgroundColor: activeGroupRoom.status === 'open' ? '#fef2f2' : '#f0fdf4',
                        color: activeGroupRoom.status === 'open' ? '#b91c1c' : '#15803d',
                        border: activeGroupRoom.status === 'open' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {activeGroupRoom.status === 'open' ? '🔒 截止點餐 (鎖定)' : '🔓 重新開放點餐'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy('text', generateSplitBillText())}
                      style={{
                        flex: 1,
                        backgroundColor: copiedType === 'text' ? '#10b981' : '#f8fafc',
                        color: copiedType === 'text' ? '#ffffff' : '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedType === 'text' ? '✓ 已複製分帳表' : '📋 複製 LINE 分帳表'}
                    </button>
                  </div>

                  {onImportToCheckout && (
                    <button
                      type="button"
                      onClick={() => {
                        onImportToCheckout(roomItems);
                        onClose();
                      }}
                      disabled={roomItems.length === 0}
                      style={{
                        backgroundColor: '#ea580c',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '0.95rem',
                        fontWeight: 900,
                        cursor: roomItems.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: roomItems.length === 0 ? 0.5 : 1,
                        boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)'
                      }}
                    >
                      🛒 匯入所有團員餐點 ({itemsCount}份) 並前往送單結帳 ➔
                    </button>
                  )}
                </div>
              )}

              {/* Leave Room Option */}
              <div style={{ textAlign: 'center', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleLeaveOrDismiss}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {isHost ? '🚪 退出/解散此揪團房間' : '🚪 退出此揪團房間'}
                </button>
              </div>
            </div>
          )}

          {/* ================= VIEW 2: CREATE GROUP ROOM ================= */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* How it works info */}
              <div style={{ 
                backgroundColor: '#eff6ff', 
                border: '1px solid #bfdbfe', 
                borderRadius: '14px', 
                padding: '12px',
                color: '#1e3a8a',
                fontSize: '0.8rem',
                lineHeight: '1.45'
              }}>
                <div style={{ fontWeight: 900, fontSize: '0.88rem', marginBottom: '6px', color: '#1d4ed8' }}>
                  💡 揪團點餐 3 步驟超輕鬆：
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>1.</strong> 建立專屬房間，取得專屬菜單連結與 QR Code。</div>
                  <div><strong>2.</strong> 一鍵發送至 LINE 群組，同事用自己手機點選喜歡的品項。</div>
                  <div><strong>3.</strong> 餐點即時匯入主揪購物車，統一送單送出，還有一鍵分帳對帳！</div>
                </div>
              </div>

              {/* Host Name Input */}
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '6px', color: '#334155' }}>
                  👤 主揪您的稱呼：
                </label>
                <input
                  type="text"
                  required
                  value={hostNameInput}
                  onChange={(e) => setHostNameInput(e.target.value)}
                  placeholder="例如: Eddie、王組長、小明"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    fontWeight: 700
                  }}
                />
              </div>

              {/* Deadline Input (Optional) */}
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '6px', color: '#334155' }}>
                  ⏰ 預計收單截止時間 (選填)：
                </label>
                <input
                  type="text"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  placeholder="例如: 11:30、15分鐘後"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreatingRoom}
                style={{
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  cursor: isCreatingRoom ? 'not-allowed' : 'pointer',
                  opacity: isCreatingRoom ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                  marginTop: '4px'
                }}
              >
                <span>🚀</span>
                <span>{isCreatingRoom ? '正在建立揪團房間...' : '立即建立專屬揪團房間'}</span>
              </button>
            </form>
          )}

          {/* ================= VIEW 3: SPLIT BILL TEXT ================= */}
          {activeTab === 'split' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>
                  傳送給同事/LINE 群組的對帳與分帳明細：
                </span>
                <span style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 900 }}>
                  共 {itemsCount} 份・NT$ {totalAmount}
                </span>
              </div>

              <textarea
                readOnly
                value={generateSplitBillText()}
                rows={10}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#1e293b',
                  fontFamily: 'monospace, sans-serif',
                  fontSize: '0.8rem',
                  lineHeight: '1.45',
                  resize: 'none',
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleLineShare(generateSplitBillText())}
                  style={{
                    flex: 1,
                    backgroundColor: '#06c755',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>💬</span>
                  <span>傳送分帳表至 LINE</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy('text', generateSplitBillText())}
                  style={{
                    backgroundColor: copiedType === 'text' ? '#10b981' : '#f1f5f9',
                    color: copiedType === 'text' ? '#ffffff' : '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {copiedType === 'text' ? '✓ 已複製' : '📋 複製文字'}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
