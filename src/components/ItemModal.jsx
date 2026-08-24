import React, { useState, useEffect } from 'react';

export default function ItemModal({ item, onClose, onAddToCart, condimentsAvailability, isPos = false, editingCartItem = null }) {
  const isCombo = item.customizations?.is_combo === true || Array.isArray(item.customizations?.combo_sections);
  const comboSections = item.customizations?.combo_sections || [];

  const [quantity, setQuantity] = useState(1);
  const [selectedRadioOptions, setSelectedRadioOptions] = useState({});
  const [addonQuantities, setAddonQuantities] = useState({});
  const [selectedDropdowns, setSelectedDropdowns] = useState({});
  
  // Combo-specific States
  const [selectedComboOptions, setSelectedComboOptions] = useState({});
  const [comboCondiments, setComboCondiments] = useState({
    '香菜': '正常',
    '蒜末': '正常',
    '烏醋': '正常',
    '辣醬': '不辣'
  });
  const [comboDrinkOptions, setComboDrinkOptions] = useState({
    '甜度': '正常甜',
    '冰塊': '少冰'
  });

  const [totalPrice, setTotalPrice] = useState(item.price);

  // Initialize selections based on item's customizations / combo sections
  useEffect(() => {
    if (!item.customizations) return;

    if (isCombo) {
      const initialCombo = {};
      comboSections.forEach((sec, sIdx) => {
        const defaultOpt = sec.options.find(o => o.default) || sec.options[0];
        initialCombo[sec.id || `sec_${sIdx}`] = defaultOpt ? defaultOpt.name : '';
      });

      if (editingCartItem && editingCartItem.comboSelections) {
        Object.assign(initialCombo, editingCartItem.comboSelections);
        if (editingCartItem.comboCondiments) {
          setComboCondiments(editingCartItem.comboCondiments);
        }
        if (editingCartItem.comboDrinkOptions) {
          setComboDrinkOptions(editingCartItem.comboDrinkOptions);
        }
        setQuantity(editingCartItem.quantity || 1);
      } else {
        setQuantity(1);
      }
      setSelectedComboOptions(initialCombo);
      return;
    }

    const initialRadio = {};
    const initialDropdown = {};
    const initialAddons = {};

    Object.entries(item.customizations).forEach(([key, customGroup]) => {
      if (customGroup.type === 'radio') {
        initialRadio[key] = customGroup.default || customGroup.options[0].label;
      } else if (customGroup.type === 'checkbox') {
        customGroup.options.forEach(opt => {
          initialAddons[opt.label] = 0;
        });
      } else if (customGroup.type === 'selects') {
        const dropVals = {};
        customGroup.options.forEach(opt => {
          const isAvailable = !condimentsAvailability || condimentsAvailability[opt.name] !== false;
          if (isAvailable) {
            dropVals[opt.name] = opt.default;
          }
        });
        initialDropdown[key] = dropVals;
      }
    });

    // If editing an existing item from the cart, prefill selections and quantity!
    if (editingCartItem && editingCartItem.selections) {
      const selections = editingCartItem.selections;
      if (selections.radios) {
        Object.assign(initialRadio, selections.radios);
      }
      if (selections.addons) {
        Object.assign(initialAddons, selections.addons);
      }
      if (selections.dropdowns) {
        Object.entries(selections.dropdowns).forEach(([grpKey, grpVals]) => {
          initialDropdown[grpKey] = { ...initialDropdown[grpKey], ...grpVals };
        });
      }
      setQuantity(editingCartItem.quantity || 1);
    } else {
      setQuantity(1);
    }

    setSelectedRadioOptions(initialRadio);
    setSelectedDropdowns(initialDropdown);
    setAddonQuantities(initialAddons);
  }, [item, condimentsAvailability, editingCartItem, isCombo]);

  // Recalculate price whenever selections change
  useEffect(() => {
    let unitPrice = item.price;

    if (isCombo) {
      comboSections.forEach((sec, sIdx) => {
        const selectedName = selectedComboOptions[sec.id || `sec_${sIdx}`];
        const matchedOpt = sec.options.find(o => o.name === selectedName);
        if (matchedOpt && matchedOpt.priceChange) {
          unitPrice += Number(matchedOpt.priceChange) || 0;
        }
      });
      setTotalPrice(unitPrice * quantity);
      return;
    }

    if (item.customizations) {
      Object.entries(item.customizations).forEach(([key, customGroup]) => {
        if (customGroup.type === 'radio') {
          const selectedLabel = selectedRadioOptions[key];
          const matchedOpt = customGroup.options.find(o => o.label === selectedLabel);
          if (matchedOpt) {
            unitPrice += matchedOpt.priceChange || 0;
          }
        }
      });

      // Addons counter calculation
      if (item.customizations.addons) {
        item.customizations.addons.options.forEach(opt => {
          const qty = addonQuantities[opt.label] || 0;
          unitPrice += (opt.priceChange || 0) * qty;
        });
      }
    }

    setTotalPrice(unitPrice * quantity);
  }, [selectedRadioOptions, addonQuantities, selectedDropdowns, selectedComboOptions, quantity, item, isCombo]);

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

  const handleComboOptionSelect = (sectionId, optName) => {
    setSelectedComboOptions(prev => ({
      ...prev,
      [sectionId]: optName
    }));
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    // 1. Combo Item Submission
    if (isCombo) {
      const specs = [];
      const subItems = [];

      comboSections.forEach((sec, sIdx) => {
        const secId = sec.id || `sec_${sIdx}`;
        const selectedName = selectedComboOptions[secId];
        const matchedOpt = sec.options.find(o => o.name === selectedName);
        
        let detailStr = selectedName;
        const extraList = [];

        // If this section has condiments and is noodle-related
        if (sec.hasCondiments && !isPos) {
          const condParts = [];
          Object.entries(comboCondiments).forEach(([cName, cVal]) => {
            if (condimentsAvailability && condimentsAvailability[cName] === false) return;
            if (cVal !== '正常' && cVal !== '不辣') {
              condParts.push(`${cName}(${cVal})`);
            } else if (cVal === '不辣' && cName === '辣醬') {
              // default
            } else if (cVal === '不要香菜' || cVal === '不要蒜頭' || cVal === '不要烏醋') {
              condParts.push(cVal);
            }
          });
          if (condParts.length > 0) {
            extraList.push(condParts.join(', '));
          }
        }

        // If drink options
        if (sec.hasDrinkOptions && !isPos) {
          extraList.push(`${comboDrinkOptions['甜度'] || '正常'}/${comboDrinkOptions['冰塊'] || '少冰'}`);
        }

        if (extraList.length > 0) {
          detailStr += ` (${extraList.join(' | ')})`;
        }

        specs.push(`${sec.title.replace(/\(選.*\)/g, '').trim()}: ${detailStr}`);
        subItems.push({
          section: sec.title,
          name: selectedName,
          details: extraList.join(', '),
          priceChange: matchedOpt?.priceChange || 0
        });
      });

      const cartItem = {
        cartId: editingCartItem ? editingCartItem.cartId : `combo-${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        id: item.id,
        name: item.name,
        isCombo: true,
        basePrice: item.price,
        itemPrice: totalPrice / quantity,
        totalPrice: totalPrice,
        quantity,
        specs,
        subItems,
        comboSelections: selectedComboOptions,
        comboCondiments,
        comboDrinkOptions,
        image: item.image
      };

      onAddToCart(cartItem);
      onClose();
      return;
    }

    // 2. Regular Item Submission
    const specs = [];
    if (item.customizations) {
      Object.entries(item.customizations).forEach(([key, customGroup]) => {
        if (customGroup.type === 'radio') {
          const groupTitle = customGroup.title || customGroup.name || customGroup.label || '';
          if (groupTitle && groupTitle !== '份量' && groupTitle !== '份量大小' && groupTitle !== '規格' && groupTitle !== '尺寸') {
            specs.push(`${groupTitle}: ${selectedRadioOptions[key]}`);
          } else {
            specs.push(`${selectedRadioOptions[key]}`);
          }
        } else if (customGroup.type === 'selects') {
          if (isPos) return;
          const dropdownList = [];
          Object.entries(selectedDropdowns[key] || {}).forEach(([name, val]) => {
            if (condimentsAvailability && condimentsAvailability[name] === false) return;
            const opt = customGroup.options.find(o => o.name === name);
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
            specs.push(`${customGroup.title}: ${dropdownList.join(' | ')}`);
          }
        }
      });

      if (item.customizations.addons) {
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

    const cartItem = {
      cartId: editingCartItem ? editingCartItem.cartId : `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      id: item.id,
      name: item.name,
      basePrice: item.price,
      itemPrice: totalPrice / quantity,
      totalPrice: totalPrice,
      quantity,
      specs,
      image: item.image,
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
      const availableOptions = customGroup.options.filter(
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
        maxWidth: isCombo ? '540px' : '500px', 
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1.2rem' }}>{isCombo ? '🍱' : '🍽️'}</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
              {isCombo ? '自選超值套餐組合' : '餐點規格選擇'}
            </h3>
          </div>
          <button className="close-btn" onClick={onClose} style={{ fontSize: '1.5rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0', overflowY: 'auto' }}>
          <div className="modal-item-info" style={{ marginTop: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--primary)', margin: '0' }}>{item.name}</h2>
              <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--primary)' }}>NT$ {item.price} 起</span>
            </div>
            {item.description && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{item.description}</p>
            )}
          </div>

          {/* ================= COMBO SET BUILDER SECTIONS ================= */}
          {isCombo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {comboSections.map((section, sIdx) => {
                const secId = section.id || `sec_${sIdx}`;
                const selectedOptName = selectedComboOptions[secId];

                return (
                  <div key={secId} style={{ backgroundColor: 'var(--bg-body)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {section.title}
                      </span>
                      {section.required && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 107, 53, 0.1)', color: 'var(--primary)', fontWeight: 'bold' }}>
                          必選 1 項
                        </span>
                      )}
                    </div>

                    {/* Options Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      {section.options.map((opt) => {
                        const isSelected = (selectedOptName === opt.name);
                        return (
                          <button
                            key={opt.name}
                            type="button"
                            onClick={() => handleComboOptionSelect(secId, opt.name)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                              backgroundColor: isSelected ? 'rgba(255, 107, 53, 0.12)' : 'var(--bg-card)',
                              color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: '4px',
                              textAlign: 'left',
                              transition: 'all 0.1s ease',
                              fontWeight: isSelected ? 'bold' : 'normal'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                              <span style={{ fontSize: '0.9rem' }}>{isSelected ? '🔘' : '⚪'}</span>
                              <span style={{ fontSize: '0.85rem', flex: 1, lineHeight: 1.2 }}>{opt.name}</span>
                            </div>
                            {opt.priceChange > 0 && (
                              <span style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 'bold', marginLeft: '22px' }}>
                                +NT$ {opt.priceChange}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Sub-condiments (for noodles in combo) */}
                    {section.hasCondiments && !isPos && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                          🍜 主餐調料偏好 (香菜 / 蒜末 / 烏醋 / 辣度)：
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.75rem' }}>🌶️ 辣醬</span>
                            <select
                              value={comboCondiments['辣醬'] || '不辣'}
                              onChange={(e) => setComboCondiments({ ...comboCondiments, '辣醬': e.target.value })}
                              style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                            >
                              <option value="不辣">不辣</option>
                              <option value="微辣">微辣</option>
                              <option value="中辣">中辣</option>
                              <option value="大辣">大辣</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.75rem' }}>🌿 香菜</span>
                            <select
                              value={comboCondiments['香菜'] || '正常'}
                              onChange={(e) => setComboCondiments({ ...comboCondiments, '香菜': e.target.value })}
                              style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                            >
                              <option value="正常">正常</option>
                              <option value="多一點">多一點</option>
                              <option value="不要香菜">不要香菜</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.75rem' }}>🧄 蒜末</span>
                            <select
                              value={comboCondiments['蒜末'] || '正常'}
                              onChange={(e) => setComboCondiments({ ...comboCondiments, '蒜末': e.target.value })}
                              style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                            >
                              <option value="正常">正常</option>
                              <option value="多一點">多一點</option>
                              <option value="不要蒜頭">不要蒜頭</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.75rem' }}>🍶 烏醋</span>
                            <select
                              value={comboCondiments['烏醋'] || '正常'}
                              onChange={(e) => setComboCondiments({ ...comboCondiments, '烏醋': e.target.value })}
                              style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                            >
                              <option value="正常">正常</option>
                              <option value="多一點">多一點</option>
                              <option value="不要烏醋">不要烏醋</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Drink Options (Ice / Sweetness) */}
                    {section.hasDrinkOptions && !isPos && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                          🥤 飲品甜度與冰量：
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.75rem' }}>🍬 甜度</span>
                            <select
                              value={comboDrinkOptions['甜度'] || '正常甜'}
                              onChange={(e) => setComboDrinkOptions({ ...comboDrinkOptions, '甜度': e.target.value })}
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
                              value={comboDrinkOptions['冰塊'] || '少冰'}
                              onChange={(e) => setComboDrinkOptions({ ...comboDrinkOptions, '冰塊': e.target.value })}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================= REGULAR ITEM CUSTOMIZATIONS ================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 1. Size & Condiment Options */}
              {item.customizations && Object.entries(item.customizations)
                .filter(([_, customGroup]) => customGroup.type === 'radio' || customGroup.type === 'selects')
                .map(([groupKey, customGroup]) => renderOptionGroup(groupKey, customGroup))}

              {/* 2. Addons / Extra Ingredients */}
              {item.customizations && Object.entries(item.customizations)
                .filter(([_, customGroup]) => customGroup.type === 'checkbox')
                .map(([groupKey, customGroup]) => (
                  <div key={groupKey} style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    {renderOptionGroup(groupKey, customGroup)}
                  </div>
                ))}
            </div>
          )}
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
            <span>{editingCartItem ? '儲存修改' : '加入購物車'}</span>
            <span>總計 NT$ {totalPrice}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
