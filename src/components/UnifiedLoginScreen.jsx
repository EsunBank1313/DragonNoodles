import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getActiveStoreCode, filterItemsByStore, prefixNameForStore, getStoreSessionStorage, setStoreSessionStorage } from '../utils/storeContext';

const DEFAULT_STAFF_FALLBACK = [
  { name: '店長 (Admin)', pin: '8888' },
  { name: '收銀員-小明', pin: '1111' },
  { name: '收銀員-小華', pin: '2222' }
];

export default function UnifiedLoginScreen({ 
  storeCode = 'dragon',
  onSwitchStore,
  initialRole, 
  onChangeRole, 
  adminPin, 
  onSuccess,
  onNavigate,
  onBackToDemo
}) {
  const [storeDisplayName, setStoreDisplayName] = useState('龍城麵線');
  const [activeRole, setActiveRole] = useState(initialRole || 'pos'); // 'pos', 'bookkeeping', 'management'
  const [staffList, setStaffList] = useState(DEFAULT_STAFF_FALLBACK);
  const [selectedStaff, setSelectedStaff] = useState('店長 (Admin)');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [currentStoreAdminPin, setCurrentStoreAdminPin] = useState(adminPin || '8888');

  // Modern In-UI Modal States (Zero Browser alert/confirm blocks)
  const [takeoverModal, setTakeoverModal] = useState({ isOpen: false, currentUser: '', pendingPayload: null });
  const [blockedModal, setBlockedModal] = useState({ isOpen: false, currentUser: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  // Load staff list & PIN from Supabase for current storeCode
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*');
        if (error) throw error;

        if (data && data.length > 0) {
          const storeItems = filterItemsByStore(data, storeCode);
          
          const profileItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_STORE_PROFILE');
          if (profileItem && profileItem.description) {
            try {
              const p = JSON.parse(profileItem.description);
              if (p.storeName) setStoreDisplayName(p.storeName);
            } catch (e) {}
          } else {
            const nameItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_STORE_NAME');
            if (nameItem && nameItem.description) {
              setStoreDisplayName(nameItem.description);
            } else if (storeCode !== 'dragon') {
              setStoreDisplayName(`門市 [${storeCode}]`);
            }
          }

          const pinItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_ADMIN_PIN');
          if (pinItem && pinItem.description) {
            setCurrentStoreAdminPin(pinItem.description);
          }

          const staffItem = storeItems.find(i => i.name === 'SYSTEM_SETTING_STAFF_LIST');
          if (staffItem && staffItem.description) {
            try {
              const parsed = JSON.parse(staffItem.description);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setStaffList(parsed);
                setSelectedStaff(prev => {
                  return parsed.some(s => s.name === prev) ? prev : (parsed[0]?.name || '店長 (Admin)');
                });
                return;
              }
            } catch (e) {}
          }
        }
        
        setStaffList(DEFAULT_STAFF_FALLBACK);
        setSelectedStaff(DEFAULT_STAFF_FALLBACK[0].name);
      } catch (err) {
        console.error("Failed to load staff list from Supabase:", err);
        setStaffList(DEFAULT_STAFF_FALLBACK);
        setSelectedStaff(DEFAULT_STAFF_FALLBACK[0].name);
      }
    };
    fetchStaff();
  }, [storeCode]);

  // Update URL params when activeRole changes
  const handleRoleChange = (newRole) => {
    setActiveRole(newRole);
    setPin('');
    setError(false);
    setTakeoverModal({ isOpen: false, currentUser: '', pendingPayload: null });
    setBlockedModal({ isOpen: false, currentUser: '' });
    if (onChangeRole) {
      onChangeRole(newRole);
    }
  };

  // Sync with initialRole updates from parent/url
  useEffect(() => {
    if (initialRole && initialRole !== activeRole) {
      setActiveRole(initialRole);
      setPin('');
      setError(false);
    }
  }, [initialRole]);

  // Calculate dynamic expected PIN length based on active staff / admin PIN
  const getExpectedPinLength = () => {
    if (activeRole === 'pos') {
      const staff = staffList.find(s => s.name === selectedStaff);
      if (staff && staff.pin) return staff.pin.length;
      if (selectedStaff.includes('Admin') || selectedStaff.includes('店長')) {
        return (currentStoreAdminPin && currentStoreAdminPin.length) || 4;
      }
      return 4;
    }
    return (currentStoreAdminPin && currentStoreAdminPin.length) || 4;
  };

  const expectedPinLength = getExpectedPinLength();

  const handleNumClick = (num) => {
    if (pin.length < expectedPinLength && !takeoverModal.isOpen && !blockedModal.isOpen) {
      setPin(pin + num);
      setError(false);
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(false);
    }
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  // Execute actual login & cloud session registration
  const executeLogin = async (staffName, customSessionId = '') => {
    setIsProcessing(true);
    const sid = customSessionId || `${staffName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setStoreSessionStorage('pos_session_id', sid, storeCode);

    try {
      if (activeRole === 'pos') {
        const sessionKey = prefixNameForStore('SYSTEM_SETTING_ACTIVE_POS_SESSION', storeCode);
        const sessionPayload = { user: staffName, sessionId: sid, lastActive: Date.now() };
        const { data: exist } = await supabase.from('menu_items').select('*').eq('name', sessionKey);
        if (exist && exist.length > 0) {
          await supabase.from('menu_items').update({ description: JSON.stringify(sessionPayload) }).eq('name', sessionKey);
        } else {
          await supabase.from('menu_items').insert([{ name: sessionKey, price: 0, category: 'settings', description: JSON.stringify(sessionPayload) }]);
        }
      }
    } catch (e) {
      console.warn("Session update error:", e);
    }

    setTakeoverModal({ isOpen: false, currentUser: '', pendingPayload: null });
    setBlockedModal({ isOpen: false, currentUser: '' });
    setIsProcessing(false);

    // Track master admin session strictly for dragon master store
    if (typeof window !== 'undefined') {
      if (storeCode === 'dragon' && activeRole === 'management') {
        sessionStorage.setItem('is_master_admin_session', 'true');
      } else {
        sessionStorage.removeItem('is_master_admin_session');
      }
    }

    // Persist login auth state
    if (activeRole === 'pos') {
      localStorage.setItem('is_cashier_authenticated', 'true');
      sessionStorage.setItem('is_cashier_authenticated', 'true');
      localStorage.setItem('pos_login_time', String(Date.now()));
      sessionStorage.setItem('pos_login_time', String(Date.now()));
      localStorage.setItem('cashier_name', staffName);
      sessionStorage.setItem('cashier_name', staffName);
    } else if (activeRole === 'bookkeeping') {
      localStorage.setItem('is_bookkeeping_authenticated', 'true');
      sessionStorage.setItem('is_bookkeeping_authenticated', 'true');
      localStorage.setItem('bookkeeping_login_time', String(Date.now()));
      sessionStorage.setItem('bookkeeping_login_time', String(Date.now()));
    } else if (activeRole === 'management') {
      localStorage.setItem('is_management_authenticated', 'true');
      sessionStorage.setItem('is_management_authenticated', 'true');
      localStorage.setItem('management_login_time', String(Date.now()));
      sessionStorage.setItem('management_login_time', String(Date.now()));
    }

    if (onSuccess) {
      onSuccess(activeRole, activeRole === 'pos' ? { staffName, sessionId: sid } : true);
    } else if (onNavigate) {
      onNavigate(activeRole, staffName, sid);
    }
  };

  // Check pin and session availability
  useEffect(() => {
    const verifyPin = async () => {
      if (pin.length === expectedPinLength && pin.length >= 4) {
        const staff = staffList.find(s => s.name === selectedStaff);
        const isSelectedStaffManager = selectedStaff.includes('店長') || selectedStaff.includes('Admin') || selectedStaff.includes('admin') || selectedStaff.includes('主管') || (staffList.length > 0 && staffList[0].name === selectedStaff);
        
        // Correct if matches staff PIN or store Admin PIN (8888)
        const isPinCorrect = (activeRole === 'pos') 
          ? (Boolean(staff && pin === staff.pin) || pin === currentStoreAdminPin || pin === adminPin || pin === '8888')
          : (pin === currentStoreAdminPin || pin === adminPin || pin === '8888');

        if (isPinCorrect) {
          const isManager = isSelectedStaffManager || pin === currentStoreAdminPin || pin === adminPin || pin === '8888';

          if (activeRole === 'pos') {
            try {
              const sessionKey = prefixNameForStore('SYSTEM_SETTING_ACTIVE_POS_SESSION', storeCode);
              const { data } = await supabase.from('menu_items').select('*').eq('name', sessionKey);
              
              if (data && data.length > 0 && data[0].description) {
                const activeSession = JSON.parse(data[0].description);
                const currentLocalSessionId = getStoreSessionStorage('pos_session_id', storeCode);

                // If active on another device (lastActive within 25 seconds)
                if (activeSession && activeSession.sessionId && (Date.now() - Number(activeSession.lastActive || 0) <= 25000)) {
                  if (!currentLocalSessionId || activeSession.sessionId !== currentLocalSessionId) {
                    if (isManager) {
                      // Prompt Manager Takeover Modal
                      setTakeoverModal({
                        isOpen: true,
                        currentUser: activeSession.user || '其他收銀員',
                        pendingPayload: { staffName: selectedStaff }
                      });
                      return;
                    } else {
                      // Prompt Non-manager Blocked Modal
                      setBlockedModal({
                        isOpen: true,
                        currentUser: activeSession.user || '店長/收銀員'
                      });
                      return;
                    }
                  }
                }
              }
            } catch (e) {
              console.warn("Failed checking active POS session:", e);
            }
          }

          // Direct login if no conflict
          executeLogin(selectedStaff);
        } else {
          setError(true);
          const timer = setTimeout(() => {
            setPin('');
            setError(false);
          }, 800);
          return () => clearTimeout(timer);
        }
      }
    };
    verifyPin();
  }, [pin]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (takeoverModal.isOpen || blockedModal.isOpen) return;
      if (e.key >= '0' && e.key <= '9') {
        handleNumClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, activeRole, selectedStaff, takeoverModal.isOpen, blockedModal.isOpen]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-body)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative'
    }}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .shake-element {
          animation: shake 0.5s ease-in-out;
        }
        .pin-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid var(--primary);
          transition: all 0.15s ease;
        }
        .pin-dot.filled {
          background-color: var(--primary);
          transform: scale(1.15);
        }
        .pin-dot.error {
          border-color: #ef4444;
          background-color: #ef4444;
        }
        .keypad-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background-color: var(--bg-card);
          color: var(--text-main);
          font-size: 1.5rem;
          font-weight: 600;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }
        .keypad-btn:active {
          background-color: var(--primary);
          color: white;
          border-color: var(--primary);
          transform: scale(0.92);
        }
        .keypad-btn.special {
          font-size: 0.9rem;
          font-weight: normal;
          border-color: transparent;
          background-color: transparent;
        }
        .keypad-btn.special:active {
          background-color: rgba(255, 107, 53, 0.1);
          color: var(--primary);
          border-color: transparent;
        }
        .tab-btn {
          flex: 1;
          padding: 8px 12px;
          font-size: 0.85rem;
          font-weight: bold;
          border: 1px solid var(--border);
          background-color: var(--bg-card);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }
        .tab-btn.active {
          background-color: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .tab-btn:first-child {
          border-top-left-radius: 8px;
          border-bottom-left-radius: 8px;
        }
        .tab-btn:last-child {
          border-top-right-radius: 8px;
          border-bottom-right-radius: 8px;
        }
      `}</style>

      {/* Main Login Box */}
      <div className={error ? 'shake-element' : ''} style={{
        width: '100%',
        maxWidth: '380px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: '30px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Header Icon */}
        <div>
          <span style={{ fontSize: '2.5rem' }}>🔐</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '8px 0 4px 0', color: 'var(--text-main)' }}>
            {storeDisplayName} 系統登入
          </h2>
          <div style={{ display: 'inline-block', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)', border: '1px solid var(--border)', marginBottom: '4px' }}>
            🏬 門市代碼: <strong>{storeCode}</strong>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            請選擇欲進入之系統並輸入 PIN 碼
          </p>
        </div>

        {/* Tab System Selector */}
        <div style={{ display: 'flex', width: '100%', marginTop: '6px' }}>
          <button 
            type="button" 
            className={`tab-btn ${activeRole === 'pos' ? 'active' : ''}`}
            onClick={() => handleRoleChange('pos')}
          >
            💵 收銀 POS
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeRole === 'bookkeeping' ? 'active' : ''}`}
            onClick={() => handleRoleChange('bookkeeping')}
          >
            📊 營業記帳
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeRole === 'management' ? 'active' : ''}`}
            onClick={() => handleRoleChange('management')}
          >
            🛠️ 後台管理
          </button>
        </div>

        {/* Staff dropdown for POS */}
        {activeRole === 'pos' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', marginTop: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>選擇收銀人員</label>
            <select 
              value={selectedStaff}
              onChange={(e) => { setSelectedStaff(e.target.value); setPin(''); setError(false); }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-body)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {staffList.map((staff, idx) => (
                <option key={idx} value={staff.name}>{staff.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Staff instruction label for Admin Pin Roles */}
        {activeRole !== 'pos' && (
          <div style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-body)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', textAlign: 'center', marginTop: '4px' }}>
            🔑 登入身分：管理員 (Admin)
          </div>
        )}

        {/* PIN Indicators */}
        <div style={{ display: 'flex', gap: '16px', margin: '8px 0' }}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div 
                key={index} 
                className={`pin-dot ${isFilled ? 'filled' : ''} ${error ? 'error' : ''}`} 
              />
            );
          })}
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', margin: '-6px 0 2px 0' }}>
            PIN 碼錯誤，請重新輸入
          </div>
        )}

        {/* Keypad Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          width: '100%',
          justifyItems: 'center'
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button 
              key={num} 
              type="button" 
              className="keypad-btn"
              onClick={() => handleNumClick(String(num))}
            >
              {num}
            </button>
          ))}
          <button 
            type="button" 
            className="keypad-btn special"
            onClick={handleClear}
          >
            清除
          </button>
          <button 
            type="button" 
            className="keypad-btn"
            onClick={() => handleNumClick('0')}
          >
            0
          </button>
          <button 
            type="button" 
            className="keypad-btn special"
            onClick={handleBackspace}
          >
            ⌫
          </button>
        </div>
      </div>

      {/* 👑 IN-UI MODAL: Manager Force Takeover */}
      {takeoverModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            maxWidth: '380px', width: '100%', backgroundColor: 'var(--bg-card)',
            border: '2px solid #ea580c', borderRadius: '16px', padding: '28px 24px',
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>👑</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)' }}>
              店長權限：收銀機在線接管
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 20px 0' }}>
              目前收銀機正由其他裝置使用中 (<strong style={{ color: '#ea580c' }}>{takeoverModal.currentUser}</strong>)。<br />
              身為店長，您可以強制登出原裝置，並將收銀控制權移轉至本機。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => executeLogin(selectedStaff)}
                disabled={isProcessing}
                style={{
                  padding: '12px', fontSize: '0.95rem', fontWeight: 'bold',
                  backgroundColor: '#ea580c', color: 'white', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(234, 88, 12, 0.4)'
                }}
              >
                {isProcessing ? '⚡ 正在接管收銀機...' : '⚡ 強制登出原裝置並接管'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTakeoverModal({ isOpen: false, currentUser: '', pendingPayload: null });
                  setPin('');
                  setError(false);
                }}
                style={{
                  padding: '10px', fontSize: '0.85rem', fontWeight: 'bold',
                  backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                ✕ 取消返回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚫 IN-UI MODAL: Non-manager Blocked */}
      {blockedModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            maxWidth: '380px', width: '100%', backgroundColor: 'var(--bg-card)',
            border: '2px solid #ef4444', borderRadius: '16px', padding: '28px 24px',
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🚫</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: '900', color: '#ef4444' }}>
              收銀系統使用中
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 20px 0' }}>
              目前收銀機正由其他裝置在線使用中 (<strong style={{ color: '#ef4444' }}>{blockedModal.currentUser}</strong>)。<br />
              同一時間僅限一台收銀機登入。一般員工無法強制接管，請等待該裝置下線，或請<strong>【店長】</strong>登入處理。
            </p>

            <button
              type="button"
              onClick={() => {
                setBlockedModal({ isOpen: false, currentUser: '' });
                setPin('');
                setError(false);
              }}
              style={{
                width: '100%', padding: '12px', fontSize: '0.9rem', fontWeight: 'bold',
                backgroundColor: 'var(--bg-body)', color: 'var(--text-main)',
                border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer'
              }}
            >
              我知道了 (返回)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
