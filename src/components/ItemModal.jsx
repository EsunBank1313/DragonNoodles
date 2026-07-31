import React, { useState, useEffect } from 'react';

export default function ItemModal({ item, onClose, onAddToCart, condimentsAvailability, isPos = false }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedRadioOptions, setSelectedRadioOptions] = useState({});
  const [addonQuantities, setAddonQuantities] = useState({});
  const [selectedDropdowns, setSelectedDropdowns] = useState({});
  const [totalPrice, setTotalPrice] = useState(item.price);

  // Initialize selections based on item's customizations
  useEffect(() => {
    if (!item.customizations) return;

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

    setSelectedRadioOptions(initialRadio);
    setSelectedDropdowns(initialDropdown);
    setAddonQuantities(initialAddons);
  }, [item, condimentsAvailability]);

  // Recalculate price whenever selections change
  useEffect(() => {
    let price = item.price;

    if (item.customizations) {
      Object.entries(item.customizations).forEach(([key, customGroup]) => {
        if (customGroup.type === 'radio') {
          const selectedLabel = selectedRadioOptions[key];
          const matchedOpt = customGroup.options.find(o => o.label === selectedLabel);
          if (matchedOpt) {
            price += matchedOpt.priceChange || 0;
          }
        }
      });

      // Addons counter calculation
      if (item.customizations.addons) {
        item.customizations.addons.options.forEach(opt => {
          const qty = addonQuantities[opt.label] || 0;
          price += (opt.priceChange || 0) * qty;
        });
      }
    }

    setTotalPrice(price * quantity);
  }, [selectedRadioOptions, addonQuantities, selectedDropdowns, quantity, item]);

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

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    // Compile specification list for display in cart
    const specs = [];
    if (item.customizations) {
      Object.entries(item.customizations).forEach(([key, customGroup]) => {
        if (customGroup.type === 'radio') {
          specs.push(`${customGroup.title}: ${selectedRadioOptions[key]}`);
        } else if (customGroup.type === 'selects') {
          if (isPos) return;
          const dropdownList = Object.entries(selectedDropdowns[key] || {})
            .filter(([name]) => !condimentsAvailability || condimentsAvailability[name] !== false)
            .map(([name, val]) => `${name}(${val})`);
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
      cartId: `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
          <div className="option-choices" style={{ display: 'flex', gap: '8px' }}>
            {customGroup.options.map((opt) => {
              const isSelected = selectedRadioOptions[groupKey] === opt.label;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleRadioChange(groupKey, opt.label)}
                  style={{
                    flex: 1,
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
                  {opt.label} {opt.priceChange > 0 ? `(+${opt.priceChange})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (customGroup.type === 'checkbox') {
      // 2-column compact grid layout for addons
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
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+${opt.priceChange}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleAddonQtyChange(opt.label, -1)}
                      style={{
                        border: 'none',
                        background: 'var(--bg-input)',
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '0.85rem'
                      }}
                    >-</button>
                    <span style={{ width: '16px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>{qty}</span>
                    <button
                      type="button"
                      onClick={() => handleAddonQtyChange(opt.label, 1)}
                      style={{
                        border: 'none',
                        background: 'var(--bg-input)',
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '0.85rem'
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
        maxWidth: '500px', 
        maxHeight: '85vh', 
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
          <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>餐點規格選擇</h3>
          <button className="close-btn" onClick={onClose} style={{ fontSize: '1.5rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0', overflowY: 'auto' }}>
          <div className="modal-item-info" style={{ marginTop: '0' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--primary)', margin: '0' }}>{item.name}</h2>
          </div>

          {/* Single Column Layout (Scrollable Vertically, No Cut-offs on Mobile) */}
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
            <span>加入購物車</span>
            <span>總計 NT$ {totalPrice}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
