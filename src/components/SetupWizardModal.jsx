import React, { useState } from 'react';
import { INDUSTRY_PRESETS, saveActiveModuleSettings, SYSTEM_MODULES } from '../utils/moduleContext';
import { supabase } from '../supabaseClient';

export default function SetupWizardModal({ isOpen, onComplete }) {
  if (!isOpen) return null;

  const [step, setStep] = useState(1);
  const [storeNameInput, setStoreNameInput] = useState('我的智慧門市');
  const [adminPinInput, setAdminPinInput] = useState('8888');
  const [selectedIndustry, setSelectedIndustry] = useState('restaurant');
  const [isInitializing, setIsInitializing] = useState(false);

  // Industry Sample Items Seeds
  const industryMenuSamples = {
    restaurant: [
      { name: '招牌綜合麵線 (大)', price: 75, category: 'main', description: '大腸 + 鮮蚵 + 肉羹' },
      { name: '招牌綜合麵線 (小)', price: 60, category: 'main', description: '大腸 + 鮮蚵 + 肉羹' },
      { name: '大腸麵線', price: 60, category: 'main', description: '滷大腸頭' },
      { name: '鮮蚵麵線', price: 65, category: 'main', description: '東石直送鮮蚵' },
      { name: '古早味紅茶', price: 25, category: 'drink', description: '微甜冰涼' }
    ],
    fruit: [
      { name: '巨峰葡萄 (斤)', price: 95, category: 'fruit', description: '產地直送特甜 (按斤稱重)', unit: '斤', pricingMode: 'weight' },
      { name: '愛文芒果 (盒)', price: 250, category: 'fruit', description: '精選禮盒裝 (按盒計價)', unit: '盒', pricingMode: 'unit' },
      { name: '大湖草莓 (斤)', price: 180, category: 'fruit', description: '高甜度草莓 (按斤稱重)', unit: '斤', pricingMode: 'weight' },
      { name: '富士蘋果 (顆)', price: 35, category: 'fruit', description: '脆甜多汁 (按顆計價)', unit: '顆', pricingMode: 'unit' },
      { name: '金鑽鳳梨 (支)', price: 80, category: 'fruit', description: '已削皮現切 (按支計價)', unit: '支', pricingMode: 'unit' }
    ],
    beverage: [
      { name: '熟成紅茶', price: 35, category: 'tea', description: '斯里蘭卡產區' },
      { name: '珍珠鮮奶茶', price: 65, category: 'milk_tea', description: '每日現煮黑糖珍珠' },
      { name: '四季春青茶', price: 35, category: 'tea', description: '台灣高山茶葉' },
      { name: '百香雙響炮', price: 60, category: 'fruit_tea', description: '百香果 + 珍珠 + 椰果' }
    ],
    retail: [
      { name: '優質衛生紙 (串)', price: 169, category: 'daily', description: '100抽 x 8包', unit: '串', pricingMode: 'unit' },
      { name: '白米 (5kg包)', price: 280, category: 'food', description: '特選池上米', unit: '包', pricingMode: 'unit' },
      { name: '純天然洗碗精', price: 89, category: 'cleaning', description: '柑橘香氛', unit: '瓶', pricingMode: 'unit' }
    ],
    blank: []
  };

  const handleFinishSetup = async () => {
    setIsInitializing(true);
    try {
      // 1. Save Store Name & Admin PIN
      localStorage.setItem('app_store_name', storeNameInput.trim() || '我的智慧門市');
      localStorage.setItem('app_admin_pin', adminPinInput.trim() || '8888');

      // 2. Save Module Configuration
      const preset = INDUSTRY_PRESETS[selectedIndustry] || INDUSTRY_PRESETS.flagship;
      const newModuleSettings = {};
      SYSTEM_MODULES.forEach(m => {
        newModuleSettings[m.id] = preset.enabledModuleIds.includes(m.id);
      });
      saveActiveModuleSettings(newModuleSettings);

      // 3. Seed Sample Menu Items into Supabase
      const samples = industryMenuSamples[selectedIndustry] || [];
      if (samples.length > 0) {
        try {
          const itemsToInsert = samples.map((s, idx) => ({
            name: s.name,
            price: s.price,
            category: s.category || 'general',
            description: s.description || '',
            unit: s.unit || '份',
            pricing_mode: s.pricingMode || 'unit'
          }));
          await supabase.from('menu_items').insert(itemsToInsert);
        } catch (dbErr) {
          console.warn("Could not insert sample items:", dbErr);
        }
      }

      // Mark wizard completed
      localStorage.setItem('app_setup_wizard_completed', 'true');
      alert("🎉 系統初始化設定完成！即將為您載入全新專屬收銀系統。");
      if (onComplete) {
        onComplete({
          storeName: storeNameInput,
          adminPin: adminPinInput,
          industry: selectedIndustry
        });
      }
    } catch (err) {
      alert("初始化失敗：" + err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      zIndex: 9999999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '20px',
        maxWidth: '580px',
        width: '100%',
        boxShadow: 'var(--shadow-2xl)',
        border: '2px solid var(--primary)',
        padding: '30px',
        animation: 'fadeIn 0.25s ease'
      }}>
        {/* Wizard Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🚀</div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '1.45rem', fontWeight: '900', color: 'var(--text-main)' }}>
            歡迎使用智慧收銀與雲端記帳系統！
          </h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            僅需 1 分鐘快速設定，系統將自動為您量身配置最合適的行業功能
          </div>
        </div>

        {/* Step 1: Store Info & PIN */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
                🏪 店家名稱 / 品牌名稱：
              </label>
              <input
                type="text"
                value={storeNameInput}
                onChange={(e) => setStoreNameInput(e.target.value)}
                placeholder="例如: 龍城麵線 或 大湖草莓行"
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>
                🔑 管理員後台 PIN 碼 (預設 8888)：
              </label>
              <input
                type="password"
                maxLength="8"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                placeholder="輸入 4-8 位數字 PIN 碼"
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                用於進入後台財務記帳、修改菜單與切換系統功能模組
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  padding: '10px 24px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                下一步：選擇行業類型 ➔
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Industry */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '12px' }}>
              請選擇您的主要營運業態：
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {[
                { id: 'restaurant', icon: '🍜', title: '小吃餐飲模式', desc: '內外帶桌號、加料配料、廚房出單、進貨庫存、月財務報表' },
                { id: 'fruit', icon: '🍎', title: '水果生鮮零售模式', desc: '秤重計價、按斤賣/按個賣、去皮抹零、供應商星級評鑑、現金盤點' },
                { id: 'beverage', icon: '☕', title: '手搖飲料烘焙模式', desc: '冷熱甜度冰塊加料、線上點餐、標籤出單、損益報表' },
                { id: 'retail', icon: '🛒', title: '一般雜貨零售模式', desc: '通用商品單位、供應商管理、採購進貨、庫存低水位預警' },
                { id: 'blank', icon: '📄', title: '空白自訂模式', desc: '不載入範例菜單，從零開始自行建立' }
              ].map(ind => (
                <div
                  key={ind.id}
                  onClick={() => setSelectedIndustry(ind.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: selectedIndustry === ind.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: selectedIndustry === ind.id ? 'rgba(255, 107, 53, 0.08)' : 'var(--bg-body)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <span style={{ fontSize: '1.6rem' }}>{ind.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{ind.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ind.desc}</div>
                  </div>
                  <input
                    type="radio"
                    name="industry"
                    checked={selectedIndustry === ind.id}
                    onChange={() => setSelectedIndustry(ind.id)}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ padding: '8px 16px', fontSize: '0.85rem', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
              >
                上一步
              </button>
              <button
                type="button"
                onClick={handleFinishSetup}
                disabled={isInitializing}
                style={{
                  padding: '10px 24px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                {isInitializing ? '配置中...' : '🎉 完成並開啟系統'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
