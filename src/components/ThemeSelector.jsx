import React, { useState, useEffect } from 'react';

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('app_theme') || 'default');

  useEffect(() => {
    if (currentTheme === 'default') {
      document.body.className = '';
    } else {
      document.body.className = `theme-${currentTheme}`;
    }
  }, [currentTheme]);

  const changeTheme = (t) => {
    setCurrentTheme(t);
    localStorage.setItem('app_theme', t);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
      <span style={{ color: 'var(--text-muted)' }}>🎨 風格:</span>
      <select
        value={currentTheme}
        onChange={(e) => changeTheme(e.target.value)}
        style={{
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-main)',
          fontWeight: 'bold',
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        <option value="default">🥢 經典原裝 (預設)</option>
        <option value="orange">🍊 活力橘</option>
        <option value="green">🌲 森林綠</option>
        <option value="dark">🌌 極光黑</option>
        <option value="pink">🌸 櫻花粉</option>
        <option value="blue">🌊 星空藍</option>
      </select>
    </div>
  );
}
