import React, { useState } from 'react';
import { SYSTEM_MODULES, INDUSTRY_PRESETS, getActiveModuleSettings, saveActiveModuleSettings } from '../utils/moduleContext';
import { supabase } from '../supabaseClient';

export default function ModuleCenterModal({ isOpen, onClose, onModulesUpdated }) {
  if (!isOpen) return null;

  const [modules, setModules] = useState(() => getActiveModuleSettings());
  const [selectedPreset, setSelectedPreset] = useState('custom');
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (moduleId) => {
    setModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
    setSelectedPreset('custom');
  };

  const handleApplyPreset = (presetKey) => {
    const preset = INDUSTRY_PRESETS[presetKey];
    if (!preset) return;
    const newSettings = {};
    SYSTEM_MODULES.forEach(m => {
      newSettings[m.id] = preset.enabledModuleIds.includes(m.id);
    });
    setModules(newSettings);
    setSelectedPreset(presetKey);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      saveActiveModuleSettings(modules);
      // Sync to Supabase
      try {
        await supabase.from('menu_items').upsert([{
          id: 9993,
          name: 'SYSTEM_SETTING_ENABLED_MODULES',
          price: 0,
          category: 'settings',
          description: JSON.stringify(modules)
        }]);
      } catch (err) {}

      if (onModulesUpdated) {
        onModulesUpdated(modules);
      }
      alert("✅ 系統功能模組配置已成功儲存並即時生效！");
      onClose();
    } catch (e) {
      alert("儲存失敗：" + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.78)',
      zIndex: 999999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      backdropFilter: 'blur(6px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        maxWidth: '720px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-xl)',
        border: '2px solid var(--primary)',
        padding: '24px',
        animation: 'fadeIn 0.2s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧩 系統功能模組管理中心
            </h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              根據您的行業類型自由開關所需功能，打造專屬的高效收銀與管理介面
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Industry Presets Quick Selector */}
        <div style={{
          padding: '12px 14px',
          borderRadius: '10px',
          backgroundColor: 'rgba(255, 107, 53, 0.08)',
          border: '1px solid rgba(255, 107, 53, 0.2)',
          marginBottom: '18px'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '8px' }}>
            ⚡ 行業一鍵套用範本（自動配置對應模組）：
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.keys(INDUSTRY_PRESETS).map(key => {
              const p = INDUSTRY_PRESETS[key];
              const isSelected = selectedPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    borderRadius: '6px',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                    color: isSelected ? 'white' : 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p.name.split(' ')[0]} {p.name.split(' ')[1]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modules Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginBottom: '24px' }}>
          {SYSTEM_MODULES.map(m => {
            const isEnabled = Boolean(modules[m.id]);
            return (
              <div
                key={m.id}
                onClick={() => handleToggle(m.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: isEnabled ? '2px solid #22c55e' : '1px solid var(--border)',
                  backgroundColor: isEnabled ? 'rgba(34, 197, 94, 0.06)' : 'var(--bg-body)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
              >
                <div style={{ fontSize: '1.6rem', lineHeight: '1' }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                      {m.name}
                    </span>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      backgroundColor: isEnabled ? '#22c55e' : '#64748b',
                      color: 'white'
                    }}>
                      {isEnabled ? '已啟用' : '已關閉'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.35' }}>
                    {m.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            已啟用 <strong style={{ color: 'var(--primary)' }}>{Object.values(modules).filter(Boolean).length}</strong> / 10 個功能模組
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                fontSize: '0.85rem',
                backgroundColor: 'var(--bg-body)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '8px 24px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              {isSaving ? '儲存中...' : '💾 儲存並即刻套用'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
