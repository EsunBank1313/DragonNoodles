import React, { useState, useEffect } from 'react';
import { defaultUpgradeCombos, isComboApplicableToItem } from '../data/menuData';

export default function ItemModal({ 
  item, 
  onClose, 
  onAddToCart, 
  condimentsAvailability, 
  isPos = false, 
  editingCartItem = null,
  upgradeCombos = defaultUpgradeCombos 
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedRadioOptions, setSelectedRadioOptions] = useState({});
  const [addonQuantities, setAddonQuantities] = useState({});
  const [selectedDropdowns, setSelectedDropdowns] = useState({});
  
  // 🍱 Upgrade Combo States & Applicability Matching
  const allCombos = (upgradeCombos && Array.isArray(upgradeCombos) && upgradeCombos.length > 0) ? upgradeCombos : defaultUpgradeCombos;
  const availableUpgradeCombos = (allCombos || []).filter(pkg => isComboApplicableToItem(pkg, item));
  const canUpgrade = availableUpgradeCombos.length > 0;
  
  const [selectedUpgradeId, setSelectedUpgradeId] = useState(null);
  const [selectedUpgradeSlots, setSelectedUpgradeSlots] = useState({});
  const [upgradeDrinkOptions, setUpgradeDrinkOptions] = useState({
    '甜度': '正常甜',
    '冰塊': '少冰'
  });

  const [totalPrice, setTotalPrice] = useState(item.price);

  const activeUpgrade = availableUpgradeCombos.find(u => u.id === selectedUpgradeId);

  // Initialize selections based on item's customizations & editingCartItem
  useEffect(() => {
    if (!item.customizations) return;

    const initialRadio = {};
    const initialDropdown = {};
    const initialAddons = {};

    Object.entries(item.customizations).forEach(([key, customGroup]) => {
      if (customGroup && customGroup.type === 'radio') {
        initialRadio[key] = customGroup.default || customGroup.options[0]?.label || '';
      } else if (customGroup && customGroup.type === 'checkbox') {
        (customGroup.options || []).forEach(opt => {
          initialAddons[opt.label] = 0;
        });
      } else if (customGroup && customGroup.type === 'selects') {
        const dropVals = {};
        (customGroup.options || []).forEach(opt => {
          const isAvailable = !condimentsAvailability || condimentsAvailability[opt.name] !== false;
          if (isAvailable) {
            dropVals[opt.name] = opt.default;
          }
        });
        initialDropdown[key] = dropVals;
      }
    });

    // If editing an existing item from the cart, prefill selections and quantity!
    if (editingCartItem) {
      if (editingCartItem.selections) {
        const selections = editingCartItem.selections;
        if (selections.radios) Object.assign(initialRadio, selections.radios);
        if (selections.addons) Object.assign(initialAddons, selections.addons);
        if (selections.dropdowns) {
          Object.entries(selections.dropdowns).forEach(([grpKey, grpVals]) => {
            initialDropdown[grpKey] = { ...initialDropdown[grpKey], ...grpVals };
          });
        }
      }

      if (editingCartItem.upgradeCombo) {
        setSelectedUpgradeId(editingCartItem.upgradeCombo.id);
        setSelectedUpgradeSlots(editingCartItem.upgradeCombo.slots || {});
        if (editingCartItem.upgradeCombo.drinkOptions) {
          setUpgradeDrinkOptions(editingCartItem.upgradeCombo.drinkOptions);
        }
      } else {
        setSelectedUpgradeId(null);
        setSelectedUpgradeSlots({});
      }

      setQuantity(editingCartItem.quantity || 1);
    } else {
      setQuantity(1);
      setSelectedUpgradeId(null);
      setSelectedUpgradeSlots({});
    }

    setSelectedRadioOptions(initialRadio);
    setSelectedDropdowns(initialDropdown);
    setAddonQuantities(initialAddons);
  }, [item, condimentsAvailability, editingCartItem]);

  // When selected upgrade changes, initialize its default slot options
  const handleSelectUpgrade = (upgradeId) => {
    if (selectedUpgradeId === upgradeId) {
      setSelectedUpgradeId(null);
      setSelectedUpgradeSlots({});
      return;
    }

    setSelectedUpgradeId(upgradeId);
    const targetUpgrade = availableUpgradeCombos.find(u => u.id === upgradeId);
    if (targetUpgrade && targetUpgrade.slots && Array.isArray(targetUpgrade.slots)) {
      const initialSlots = {};
      targetUpgrade.slots.forEach((slot, sIdx) => {
        if (!slot) return;
        const optionsList = Array.isArray(slot.options) ? slot.options : [];
        const defOpt = optionsList.find(o => o && o.default) || optionsList[0];
        initialSlots[slot.id || `slot_${sIdx}`] = defOpt ? defOpt.name : '';
      });
      setSelectedUpgradeSlots(initialSlots);
    }
  };

  // Recalculate price whenever selections change
  useEffect(() => {
    let unitPrice = Number(item.price) || 0;

    // 1. Radio options (e.g. Size 大碗 +15)
    if (item.customizations) {
      Object.entries(item.customizations).forEach(([key, customGroup]) => {
        if (customGroup && customGroup.type === 'radio') {
          const selectedLabel = selectedRadioOptions[key];
          const matchedOpt = (customGroup.options || []).find(o => o.label === selectedLabel);
          if (matchedOpt && matchedOpt.priceChange) {
            unitPrice += Number(matchedOpt.priceChange) || 0;
          }
        }
      });

      // 2. Addons counter calculation
      if (item.customizations.addons && Array.isArray(item.customizations.addons.options)) {
        item.customizations.addons.options.forEach(opt => {
          const qty = addonQuantities[opt.label] || 0;
          unitPrice += (Number(opt.priceChange) || 0) * qty;
        });
      }
    }

    // 3. Upgrade Combo Add-on Price
    if (activeUpgrade) {
      unitPrice += Number(activeUpgrade.price) || 0;

      // Slot extra price changes (e.g. specialty drink +5)
      if (activeUpgrade.slots && Array.isArray(activeUpgrade.slots)) {
        activeUpgrade.slots.forEach((slot, sIdx) => {
          if (!slot) return;
          const slotKey = slot.id || `slot_${sIdx}`;
          const chosenName = selectedUpgradeSlots[slotKey];
          const optMatch = (slot.options || []).find(o => o && o.name === chosenName);
          if (optMatch && optMatch.priceChange) {
            unitPrice += Number(optMatch.priceChange) || 0;
          }
        });
      }
    }

    setTotalPrice(unitPrice * quantity);
  }, [selectedRadioOptions, addonQuantities, selectedDropdowns, selectedUpgradeId, selectedUpgradeSlots, quantity, item, activeUpgrade]);

  const handleRadioChange = (groupKey, optionLabel) => {
    setSelectedRadioOptions(prev => ({
      ...prev,
      [groupKey]: optionLabel
    }));
  };

  const handleAddonQtyChange = (label, delta) => {
    setAddonQuantities(prev => ({
      ...prev,
      [label]: Math.max(0, (prev[label] || 0) + delta)
    }));
  };

  const handleDropdownChange = (groupKey, selectName, value) => {
    setSelectedDropdowns(prev => {
      const currentGroup = prev[groupKey] || {};
      return {
        ...prev,
        [groupKey]: {
          ...currentGroup,
          [selectName]: value
        }
      };
    });
  };

  const handleUpgradeSlotOptionSelect = (slotKey, optName) => {
    setSelectedUpgradeSlots(prev => ({
      ...prev,
      [slotKey]: optName
    }));
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    const specs = [];

    // 1. Radio specs (Size / Temperature)
    if (item.customizations) {
      Object.entries(item.customizations).forEach(([key, customGroup]) => {
        if (customGroup && customGroup.type === 'radio') {
          const groupTitle = customGroup.title || customGroup.name || customGroup.label || '';
          if (groupTitle && groupTitle !== '份量' && groupTitle !== '份量大小' && groupTitle !== '規格' && groupTitle !== '尺寸') {
            specs.push(`${groupTitle}: ${selectedRadioOptions[key]}`);
          } else {
            specs.push(`${selectedRadioOptions[key]}`);
          }
        } else if (customGroup && customGroup.type === 'selects') {
          if (isPos) return;
          const dropdownList = [];
          Object.entries(selectedDropdowns[key] || {}).forEach(([name, val]) => {
            if (condimentsAvailability && condimentsAvailability[name] === false) return;
            const opt = (customGroup.options || []).find(o => o.name === name);
            const defaultVal = opt?.default || '加';
            if (val !== defaultVal) {
              if (val === '不加' || val === '不要') {
                dropdownList.push(`不加${name}`);
              } else if (val.startsWith('不加') || val.startsWith('不要') || val.startsWith('不')) {
                dropdownList.push(val);
              } else if (opt && opt.choices && opt.choices.length > 2) {
                dropdownList.push(`${name}(${val})`);
              } else {
                dropdownList.push(name);
              }
            }
          });
          if (dropdownList.length > 0) {
            specs.push(`調料: ${dropdownList.join(' | ')}`);
          }
        }
      });

      // 2. Extra Addons
      if (item.customizations.addons && Array.isArray(item.customizations.addons.options)) {
        const addonList = [];
        Object.entries(addonQuantities).forEach(([label, qty]) => {
          if (qty > 0) {
            addonList.push(`${label} x${qty}`);
          }
        });
        if (addonList.length > 0) {
          specs.push(`加料: ${addonList.join(', ')}`);
        }
      }
    }

    // 3. Upgrade Combo Formatting
    let upgradeComboPayload = null;
    if (activeUpgrade) {
      const subItemsList = [];
      if (activeUpgrade.slots) {
        activeUpgrade.slots.forEach((slot, sIdx) => {
          const slotKey = slot.id || `slot_${sIdx}`;
          const chosenOpt = selectedUpgradeSlots[slotKey];
          let optText = chosenOpt || '';
          
          if (slot.hasDrinkOptions && !isPos) {
            optText += ` (${upgradeDrinkOptions['甜度'] || '正常'}/${upgradeDrinkOptions['冰塊'] || '少冰'})`;
          }
          subItemsList.push(optText);
        });
      }

      const comboSummaryStr = `🍱 升級【${activeUpgrade.name} (+NT$ ${activeUpgrade.price})】: ${subItemsList.join('、')}`;
      specs.push(comboSummaryStr);

      upgradeComboPayload = {
        id: activeUpgrade.id,
        name: activeUpgrade.name,
        price: activeUpgrade.price,
        slots: selectedUpgradeSlots,
        drinkOptions: upgradeDrinkOptions,
        subItemsText: subItemsList.join('、')
      };
    }

    const cartItem = {
      cartId: editingCartItem ? editingCartItem.cartId : `item-${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      id: item.id,
      name: item.name,
      basePrice: item.price,
      itemPrice: totalPrice / quantity,
      totalPrice: totalPrice,
      quantity,
      specs,
      image: item.image,
      upgradeCombo: upgradeComboPayload,
      selections: {
        radios: selectedRadioOptions,
        addons: addonQuantities,
        dropdowns: selectedDropdowns
      }
    };

    onAddToCart(cartItem);
    onClose();
  };

  const renderOptionGroup = (groupKey, customGroup) => {
    if (customGroup.type === 'radio') {
      return (
        <div className="option-group" key={groupKey} style={{ margin: 0 }}>
          <div className="option-group-title" style={{ marginBottom: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            {customGroup.title}
          </div>
          <div className="option-choices" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {customGroup.options.map((opt) => {
              const isSelected = selectedRadioOptions[groupKey] === opt.label;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleRadioChange(groupKey, opt.label)}
                  style={{
                    flex: '1 1 45%',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    border: '2px solid',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                    backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    textAlign: 'center'
                  }}
                >
                  {opt.label} {opt.priceChange > 0 ? `(+NT$ ${opt.priceChange})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (customGroup.type === 'checkbox') {
      return (
        <div className="option-group" key={groupKey} style={{ margin: 0 }}>
          <div className="option-group-title" style={{ marginBottom: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            {customGroup.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {customGroup.options.map((opt) => {
              const qty = addonQuantities[opt.label] || 0;
              return (
                <div
                  key={opt.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: qty > 0 ? 'rgba(255, 107, 53, 0.06)' : 'var(--bg-card)',
                    border: qty > 0 ? '2px solid var(--primary)' : '1px solid var(--border)',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{opt.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+NT$ {opt.priceChange}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleAddonQtyChange(opt.label, -1)}
                      style={{
                        border: 'none',
                        background: 'var(--bg-input)',
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '0.9rem'
                      }}
                    >-</button>
                    <span style={{ width: '18px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>{qty}</span>
                    <button
                      type="button"
                      onClick={() => handleAddonQtyChange(opt.label, 1)}
                      style={{
                        border: 'none',
                        background: 'var(--bg-input)',
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '0.9rem'
                      }}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (customGroup.type === 'selects') {
      if (isPos) return null;
      const availableOptions = (customGroup.options || []).filter(
        opt => !condimentsAvailability || condimentsAvailability[opt.name] !== false
      );

      if (availableOptions.length === 0) return null;

      return (
        <div className="option-group" key={groupKey} style={{ margin: 0 }}>
          <div className="option-group-title" style={{ marginBottom: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            {customGroup.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {availableOptions.map((opt) => {
              const selectedVal = selectedDropdowns[groupKey]?.[opt.name] || opt.default || '加';
              const isMultiMode = opt.mode === 'multi' || (opt.choices && opt.choices.length > 2);
              
              if (isMultiMode) {
                return (
                  <div key={opt.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>{opt.name}</span>
                    <select
                      value={selectedVal}
                      onChange={(e) => handleDropdownChange(groupKey, opt.name, e.target.value)}
                      style={{ padding: '4px 6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}
                    >
                      {opt.choices.map(choice => (
                        <option key={choice} value={choice}>{choice}</option>
                      ))}
                    </select>
                  </div>
                );
              } else {
                const isChecked = selectedVal === '加' || selectedVal === '正常' || selectedVal === '要';
                return (
                  <label 
                    key={opt.name} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border)', 
                      backgroundColor: isChecked ? 'rgba(22, 163, 74, 0.05)' : 'var(--bg-card)', 
                      borderColor: isChecked ? '#16a34a' : 'var(--border)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      userSelect: 'none'
                    }}
                  >
                    <input 
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const newValue = e.target.checked ? '加' : '不加';
                        handleDropdownChange(groupKey, opt.name, newValue);
                      }}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>{opt.name} ({isChecked ? '加' : '不加'})</span>
                  </label>
                );
              }
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
        width: '92%', 
        maxWidth: canUpgrade ? '520px' : '480px', 
        maxHeight: '88vh', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '16px 20px', 
        borderRadius: '16px', 
        overflow: 'hidden', 
        boxSizing: 'border-box',
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div className="modal-header" style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>餐點規格與升級選擇</h3>
          <button className="close-btn" onClick={onClose} style={{ fontSize: '1.5rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0', overflowY: 'auto' }}>
          <div className="modal-item-info" style={{ marginTop: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--primary)', margin: '0' }}>{item.name}</h2>
              <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--primary)' }}>NT$ {item.price}</span>
            </div>
            {item.description && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{item.description}</p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Size & Condiment Options */}
            {item.customizations && Object.entries(item.customizations)
              .filter(([key, customGroup]) => customGroup && (customGroup.type === 'radio' || customGroup.type === 'selects'))
              .map(([groupKey, customGroup]) => renderOptionGroup(groupKey, customGroup))}

            {/* 2. Addons / Extra Ingredients */}
            {item.customizations && Object.entries(item.customizations)
              .filter(([key, customGroup]) => customGroup && customGroup.type === 'checkbox')
              .map(([groupKey, customGroup]) => (
                <div key={groupKey} style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  {renderOptionGroup(groupKey, customGroup)}
                </div>
              ))}

            {/* ================= 3. 🍱 超值加價升級套餐 (Upgrade Combos Section) ================= */}
            {canUpgrade && (
              <div style={{ borderTop: '2px dashed var(--primary)', paddingTop: '14px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🍱</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '900', color: 'var(--primary)' }}>
                      超值加價升級套餐 (選購)
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>以超值特惠加購小菜與冷飲</span>
                </div>

                {/* Upgrade Packages Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Option 0: No upgrade (單點) */}
                  <div
                    onClick={() => handleSelectUpgrade(null)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: selectedUpgradeId === null ? '2px solid var(--border)' : '1px solid var(--border)',
                      backgroundColor: selectedUpgradeId === null ? 'var(--bg-body)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1rem' }}>{selectedUpgradeId === null ? '🔘' : '⚪'}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: selectedUpgradeId === null ? 'bold' : 'normal', color: 'var(--text-main)' }}>
                        不升級套餐 (單點原價)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>+NT$ 0</span>
                  </div>

                  {/* Upgrade Tiers */}
                  {availableUpgradeCombos.map((pkg) => {
                    const isSelected = (selectedUpgradeId === pkg.id);
                    return (
                      <div
                        key={pkg.id}
                        style={{
                          borderRadius: '10px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                          backgroundColor: isSelected ? 'rgba(255, 107, 53, 0.05)' : 'var(--bg-card)',
                          overflow: 'hidden',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Package Header (Click to toggle) */}
                        <div
                          onClick={() => handleSelectUpgrade(pkg.id)}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: isSelected ? 'rgba(255, 107, 53, 0.1)' : 'transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.1rem' }}>{isSelected ? '🔘' : '⚪'}</span>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ fontSize: '0.9rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                                  {pkg.name}
                                </strong>
                                {pkg.tag && (
                                  <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#ea580c', color: 'white', fontWeight: 'bold' }}>
                                    {pkg.tag}
                                  </span>
                                )}
                              </div>
                              {pkg.description && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {pkg.description}
                                </div>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.95rem', fontWeight: '900', color: '#ea580c', whiteSpace: 'nowrap' }}>
                            +NT$ {pkg.price}
                          </span>
                        </div>

                        {/* Package Sub-selections (Expanded when selected) */}
                        {isSelected && pkg.slots && Array.isArray(pkg.slots) && (
                          <div style={{ padding: '10px 14px', borderTop: '1px dashed var(--border)', backgroundColor: 'var(--bg-body)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {pkg.slots.map((slot, sIdx) => {
                              if (!slot) return null;
                              const slotKey = slot.id || `slot_${sIdx}`;
                              const currentSelectedOpt = selectedUpgradeSlots[slotKey];
                              const slotOpts = Array.isArray(slot.options) ? slot.options : [];

                              return (
                                <div key={slotKey} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                    {slot.title}
                                  </span>

                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {slotOpts.map((opt) => {
                                      if (!opt || !opt.name) return null;
                                      const isOptActive = (currentSelectedOpt === opt.name);
                                      return (
                                        <button
                                          key={opt.name}
                                          type="button"
                                          onClick={() => handleUpgradeSlotOptionSelect(slotKey, opt.name)}
                                          style={{
                                            padding: '6px 10px',
                                            fontSize: '0.8rem',
                                            borderRadius: '6px',
                                            border: isOptActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                                            backgroundColor: isOptActive ? 'var(--primary)' : 'var(--bg-card)',
                                            color: isOptActive ? 'white' : 'var(--text-main)',
                                            fontWeight: isOptActive ? 'bold' : 'normal',
                                            cursor: 'pointer',
                                            transition: 'all 0.1s ease'
                                          }}
                                        >
                                          {opt.name} {opt.priceChange > 0 ? `(+NT$ ${opt.priceChange})` : ''}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Drink sweetness and ice options */}
                                  {slot.hasDrinkOptions && !isPos && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: '0.75rem' }}>🍬 甜度</span>
                                        <select
                                          value={upgradeDrinkOptions['甜度'] || '正常甜'}
                                          onChange={(e) => setUpgradeDrinkOptions({ ...upgradeDrinkOptions, '甜度': e.target.value })}
                                          style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                        >
                                          <option value="正常甜">正常甜</option>
                                          <option value="半糖">半糖</option>
                                          <option value="微糖">微糖</option>
                                          <option value="無糖">無糖</option>
                                        </select>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: '0.75rem' }}>🧊 冰塊</span>
                                        <select
                                          value={upgradeDrinkOptions['冰塊'] || '少冰'}
                                          onChange={(e) => setUpgradeDrinkOptions({ ...upgradeDrinkOptions, '冰塊': e.target.value })}
                                          style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                        >
                                          <option value="正常冰">正常冰</option>
                                          <option value="少冰">少冰</option>
                                          <option value="微冰">微冰</option>
                                          <option value="去冰">去冰</option>
                                          <option value="常溫">常溫</option>
                                        </select>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', paddingBottom: '0' }}>
          {/* Quantity Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>數量</span>
            <div className="qty-counter" style={{ margin: 0 }}>
              <button
                type="button"
                className="qty-btn"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                style={{ width: '28px', height: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                -
              </button>
              <span className="qty-val" style={{ width: '28px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>{quantity}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={() => setQuantity(q => q + 1)}
                style={{ width: '28px', height: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                +
              </button>
            </div>
          </div>

          <button className="add-to-cart-btn" onClick={handleSubmit} style={{ flex: 1, maxWidth: '300px', margin: 0, padding: '10px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
            <span>{editingCartItem ? '儲存修改' : '加入購物籃'}</span>
            <span>總計 NT$ {totalPrice}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
