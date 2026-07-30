import React, { useState, useEffect, useRef } from 'react';

export default function UnifiedLoginScreen({ 
  initialRole, 
  onChangeRole, 
  adminPin, 
  onSuccess,
  onBackToDemo
}) {
  const [activeRole, setActiveRole] = useState(initialRole || 'pos'); // 'pos', 'bookkeeping', 'management'
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  // Load staff list
  useEffect(() => {
    const saved = localStorage.getItem('restaurant_staff_list');
    const defaultStaff = [
      { name: '店長 (Admin)', pin: '6666' },
      { name: '收銀員-小明', pin: '1111' },
      { name: '收銀員-小華', pin: '2222' },
      { name: '收銀員-阿強', pin: '3333' }
    ];
    if (saved) {
      const parsed = JSON.parse(saved);
      setStaffList(parsed);
      setSelectedStaff(parsed[0]?.name || '');
    } else {
      setStaffList(defaultStaff);
      setSelectedStaff(defaultStaff[0].name);
    }
  }, []);

  // Update URL params when activeRole changes
  const handleRoleChange = (newRole) => {
    setActiveRole(newRole);
    setPin('');
    setError(false);
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

  // Determine expected PIN
  let expectedPin = adminPin || '8888';
  if (activeRole === 'pos') {
    expectedPin = staffList.find(s => s.name === selectedStaff)?.pin || '6666';
  }

  const handleNumClick = (num) => {
    if (pin.length < 4) {
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

  // Check pin
  useEffect(() => {
    if (pin.length === 4) {
      if (pin === expectedPin) {
        onSuccess(activeRole, activeRole === 'pos' ? selectedStaff : true);
      } else {
        setError(true);
        const timer = setTimeout(() => {
          setPin('');
          setError(false);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [pin, expectedPin, activeRole, selectedStaff, onSuccess]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
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
  }, [pin, activeRole, selectedStaff]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-body)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
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
        {/* Back to Home Demo */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
          <button 
            type="button"
            onClick={onBackToDemo}
            style={{
              padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)',
              backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer'
            }}
          >
            🏠 返回主頁
          </button>
        </div>

        {/* Header Icon */}
        <div>
          <span style={{ fontSize: '2.5rem' }}>🔐</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '8px 0 4px 0', color: 'var(--text-main)' }}>
            龍城麵線 系統登入
          </h2>
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

        {/* Error message */}
        <div style={{ height: '18px', fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold' }}>
          {error ? '密碼錯誤，請重新輸入' : ''}
        </div>

        {/* Keypad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px 18px',
          margin: '4px 0'
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button key={num} type="button" className="keypad-btn" onClick={() => handleNumClick(num)}>
              {num}
            </button>
          ))}
          <button type="button" className="keypad-btn special" onClick={handleClear}>
            C
          </button>
          <button type="button" className="keypad-btn" onClick={() => handleNumClick('0')}>
            0
          </button>
          <button type="button" className="keypad-btn special" onClick={handleBackspace} style={{ fontSize: '1.2rem' }}>
            ⌫
          </button>
        </div>

      </div>
    </div>
  );
}
